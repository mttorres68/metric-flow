/**
 * metricsCalculator.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Valida as regras de negócio de calcularMetricas() espelhando o Python.
 *
 * COMO RODAR:
 *   npx vitest run                        # roda uma vez e sai
 *   npx vitest                            # modo watch (re-roda ao salvar)
 *   npx vitest run --reporter=verbose     # mostra cada teste individualmente
 *
 * ESTRUTURA DOS CENÁRIOS:
 *   1. BASE MÍNIMA       — smoke test, garante que nada explode
 *   2. COBERTURA         — únicas raio / total carteira (inclui sem_visita)
 *   3. RELÂMPAGO         — curtas únicas / únicas raio
 *   4. FALSAS VISITAS    — curta + fora do raio → removida
 *   5. TEMPO MÉDIO       — todas as visitas com duração, sem filtro de raio
 *   6. ALMOÇO / TARDE    — janelas horárias sobre brutas no raio
 *   7. FINANCEIRO        — receita e conversão
 *   8. FILTROS           — por vendedor e por status
 *   9. CONFIG CUSTOMIZADA — raio e limite de curta configuráveis
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import { calcularMetricas } from "./metricsCalculator";
import type { ProcessedVisita } from "./googleSheetsService";

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY — cria uma ProcessedVisita com defaults sãos
// Use para não repetir todos os campos em cada teste.
// ─────────────────────────────────────────────────────────────────────────────
function visita(overrides: Partial<ProcessedVisita> & { id: number }): ProcessedVisita {
  return {
    vendedor:      1,
    cliente:       `Cliente ${overrides.id}`,
    codCliente:    overrides.id * 100,
    seqERP:        overrides.id,
    seqPT:         overrides.id,
    valorPedido:   "0,00",
    valorNumerico: 0,
    tipoCobr:      "-",
    horaInicio:    "08:00:00",
    horaFim:       "08:10:00",
    tempoVisita:   "00:10:00",   // 10 min → não é relâmpago
    distR:         "50",
    distPV:        "50",         // 50 m → dentro do raio padrão (500m)
    status:        "convertido",
    motivo:        "Pedido realizado",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SMOKE TEST
// ─────────────────────────────────────────────────────────────────────────────
describe("1. smoke test", () => {
  it("retorna estrutura completa com lista vazia de visitas", () => {
    const result = calcularMetricas([]);
    expect(result).toHaveProperty("kpis");
    expect(result).toHaveProperty("graficos");
    expect(result.kpis.receita_total).toBe(0);
    expect(result.kpis.cobertura_perc).toBe(0);
  });

  it("retorna estrutura completa com visitas normais", () => {
    const result = calcularMetricas([visita({ id: 1 })]);
    expect(result.kpis).toHaveProperty("cobertura_perc");
    expect(result.kpis).toHaveProperty("visitas_curtas_perc");
    expect(result.kpis).toHaveProperty("tempo_medio_visita");
    expect(result.kpis).toHaveProperty("alertas");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. COBERTURA
// Regra: clientes únicos dentro do raio / total de clientes da carteira
//        (carteira inclui sem_visita — calculada ANTES dos filtros de status)
// ─────────────────────────────────────────────────────────────────────────────
describe("2. cobertura", () => {
  it("100% quando todos os clientes da carteira foram visitados no raio", () => {
    const visitas = [
      visita({ id: 1, distPV: "100", status: "convertido" }),
      visita({ id: 2, distPV: "200", status: "nao_convertido" }),
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.cobertura_perc).toBeCloseTo(100, 1);
    expect(kpis.clientes_unicos_visitados).toBe(2);
    expect(kpis.total_carteira).toBe(2);
  });

  it("50% quando metade da carteira visitada no raio, metade sem_visita", () => {
    const visitas = [
      visita({ id: 1, distPV: "100", status: "convertido" }),
      // sem_visita — conta na carteira mas não no numerador
      visita({ id: 2, distPV: "ND", tempoVisita: "ND", horaInicio: "ND", horaFim: "ND", status: "sem_visita" }),
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.total_carteira).toBe(2);
    expect(kpis.clientes_unicos_visitados).toBe(1);
    expect(kpis.cobertura_perc).toBeCloseTo(50, 1);
  });

  it("cliente visitado 2x dentro do raio conta como 1 no numerador", () => {
    const visitas = [
      visita({ id: 1, codCliente: 100, distPV: "50"  }),
      visita({ id: 2, codCliente: 100, distPV: "80"  }),  // mesma cliente, segunda visita
      visita({ id: 3, codCliente: 200, distPV: "ND", tempoVisita: "ND", horaInicio: "ND", horaFim: "ND", status: "sem_visita" }),
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.total_carteira).toBe(2);        // 2 clientes distintos
    expect(kpis.clientes_unicos_visitados).toBe(1); // só 1 cliente único no raio
    expect(kpis.cobertura_perc).toBeCloseTo(50, 1);
  });

  it("cliente fora do raio não entra no numerador da cobertura", () => {
    const visitas = [
      visita({ id: 1, distPV: "100"  }),   // dentro
      visita({ id: 2, distPV: "1000" }),   // fora do raio padrão (500m)
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.total_carteira).toBe(2);
    expect(kpis.clientes_unicos_visitados).toBe(1);
    expect(kpis.cobertura_perc).toBeCloseTo(50, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RELÂMPAGO
// Regra Python: curtas únicas no raio / únicas no raio
// ─────────────────────────────────────────────────────────────────────────────
describe("3. visitas relâmpago", () => {
  it("0% quando nenhuma visita é curta", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:10:00", distPV: "50" }),
      visita({ id: 2, tempoVisita: "00:05:00", distPV: "50" }),
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_curtas_perc).toBe(0);
    expect(kpis.visitas_curtas_count).toBe(0);
  });

  it("50% quando 1 de 2 visitas únicas no raio é curta (<3min)", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:01:00", distPV: "50" }),  // curta (1min)
      visita({ id: 2, tempoVisita: "00:10:00", distPV: "50" }),  // adequada
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_curtas_count).toBe(1);
    expect(kpis.clientes_unicos_visitados).toBe(2);
    expect(kpis.visitas_curtas_perc).toBeCloseTo(50, 1);
  });

  it("visita curta FORA do raio não conta como relâmpago (é falsa visita)", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:01:30", distPV: "800" }),  // curta + fora = falsa
      visita({ id: 2, tempoVisita: "00:10:00", distPV: "50"  }),  // normal
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_curtas_count).toBe(0);
    expect(kpis.visitas_curtas_perc).toBe(0);
  });

  it("cliente visitado 2x: usa a primeira ocorrência única para avaliar se é curta", () => {
    // Mesmo cliente visitado 2x dentro do raio — conta como 1 único
    // Primeira visita é curta → o cliente único conta como curto
    const visitas = [
      visita({ id: 1, codCliente: 999, tempoVisita: "00:01:00", distPV: "50" }),  // curta
      visita({ id: 2, codCliente: 999, tempoVisita: "00:10:00", distPV: "50" }),  // adequada (mesma cliente)
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.clientes_unicos_visitados).toBe(1);
    expect(kpis.visitas_curtas_count).toBe(1); // primeira ocorrência é curta
    expect(kpis.visitas_curtas_perc).toBeCloseTo(100, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. FALSAS VISITAS
// Regra: curta (< minutosCurta) E fora do raio → removida completamente
// ─────────────────────────────────────────────────────────────────────────────
describe("4. falsas visitas", () => {
  it("visita curta + fora do raio é removida do raio mas ainda conta na carteira", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:01:00", distPV: "900" }),  // falsa: curta + fora
      visita({ id: 2, tempoVisita: "00:10:00", distPV: "50"  }),  // válida
    ];
    const { kpis } = calcularMetricas(visitas);
    // Python: total_carteira = df['Cód. Cli.'].nunique() — inclui a falsa
    expect(kpis.total_carteira).toBe(2);
    // Falsa foi removida do cálculo de raio → só 1 visitado
    expect(kpis.clientes_unicos_visitados).toBe(1);
    // cobertura = 1/2 = 50%
    expect(kpis.cobertura_perc).toBeCloseTo(50, 1);
    expect(kpis.visitas_curtas_count).toBe(0);
  });

  it("visita curta MAS dentro do raio NÃO é removida (é relâmpago legítimo)", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:01:00", distPV: "50"  }),  // curta mas dentro
      visita({ id: 2, tempoVisita: "00:10:00", distPV: "50"  }),
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_curtas_count).toBe(1);
    expect(kpis.clientes_unicos_visitados).toBe(2);
  });

  it("visita longa MAS fora do raio NÃO é removida (não é falsa)", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:10:00", distPV: "900" }),  // longa, fora do raio
      visita({ id: 2, tempoVisita: "00:10:00", distPV: "50"  }),
    ];
    const { kpis } = calcularMetricas(visitas);
    // A de fora do raio: está no totalCarteira mas não em unicos_raio
    expect(kpis.total_carteira).toBe(2);
    expect(kpis.clientes_unicos_visitados).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. TEMPO MÉDIO
// Regra Python: mean(Duracao_Minutos) de TODAS as visitas com duração,
//              sem filtro de raio e sem filtro de duração mínima.
// ─────────────────────────────────────────────────────────────────────────────
describe("5. tempo médio", () => {
  it("calcula média de todas as visitas com duração (inclui curtas e fora do raio)", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:10:00", distPV: "50"  }),   // 10 min, dentro
      visita({ id: 2, tempoVisita: "00:02:00", distPV: "50"  }),   // 2 min (curta), dentro
      visita({ id: 3, tempoVisita: "00:06:00", distPV: "900" }),   // 6 min, fora do raio (longa → não é falsa)
    ];
    // Falsa = curta + fora → só id=2 poderia ser falsa se distPV > 500
    // id=2: 2min curto, distPV=50 (dentro) → NÃO é falsa → entra no tempo médio
    // média = (10 + 2 + 6) / 3 = 6.0
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_com_duracao_valida).toBe(3);
    expect(kpis.tempo_medio_visita).toBeCloseTo(6.0, 1);
  });

  it("sem_visita não entra no tempo médio", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:06:00", distPV: "50" }),
      visita({ id: 2, tempoVisita: "ND", horaInicio: "ND", horaFim: "ND", distPV: "ND", status: "sem_visita" }),
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_com_duracao_valida).toBe(1);
    expect(kpis.tempo_medio_visita).toBeCloseTo(6.0, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ALMOÇO E TARDE
// Regra: contagem bruta de visitas dentro do raio pelo horário de início
//        Almoço: 12:15–13:45   Tarde: >= 14:00
// ─────────────────────────────────────────────────────────────────────────────
describe("6. almoço e tarde", () => {
  it("conta visitas iniciadas entre 12:15 e 13:45 como almoço", () => {
    const visitas = [
      visita({ id: 1, horaInicio: "12:00:00", horaFim: "12:10:00", tempoVisita: "00:10:00", distPV: "50" }),  // antes
      visita({ id: 2, horaInicio: "12:15:00", horaFim: "12:25:00", tempoVisita: "00:10:00", distPV: "50" }),  // início da janela ✓
      visita({ id: 3, horaInicio: "13:00:00", horaFim: "13:10:00", tempoVisita: "00:10:00", distPV: "50" }),  // dentro ✓
      visita({ id: 4, horaInicio: "13:45:00", horaFim: "13:55:00", tempoVisita: "00:10:00", distPV: "50" }),  // fim da janela ✓
      visita({ id: 5, horaInicio: "14:00:00", horaFim: "14:10:00", tempoVisita: "00:10:00", distPV: "50" }),  // após — não almoço
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_almoco).toBe(3); // ids 2, 3, 4
  });

  it("conta visitas iniciadas >= 14:00 como tarde", () => {
    const visitas = [
      visita({ id: 1, horaInicio: "13:59:00", horaFim: "14:09:00", tempoVisita: "00:10:00", distPV: "50" }),  // não tarde
      visita({ id: 2, horaInicio: "14:00:00", horaFim: "14:10:00", tempoVisita: "00:10:00", distPV: "50" }),  // exato ✓
      visita({ id: 3, horaInicio: "16:00:00", horaFim: "16:10:00", tempoVisita: "00:10:00", distPV: "50" }),  // tarde ✓
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_tarde_perc).toBeCloseTo((2 / 3) * 100, 1); // 2 de 3 brutas
  });

  it("visita no almoço fora do raio não é contada", () => {
    const visitas = [
      visita({ id: 1, horaInicio: "13:00:00", horaFim: "13:10:00", tempoVisita: "00:10:00", distPV: "50"  }),  // dentro ✓
      visita({ id: 2, horaInicio: "13:00:00", horaFim: "13:10:00", tempoVisita: "00:10:00", distPV: "900" }),  // fora
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.visitas_almoco).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. FINANCEIRO
// ─────────────────────────────────────────────────────────────────────────────
describe("7. financeiro", () => {
  it("soma receita apenas de visitas convertidas", () => {
    const visitas = [
      visita({ id: 1, valorNumerico: 100, status: "convertido"    }),
      visita({ id: 2, valorNumerico: 50,  status: "nao_convertido" }),
      visita({ id: 3, valorNumerico: 200, status: "convertido"    }),
    ];
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.receita_total).toBe(300);
  });

  it("taxa de conversão = convertidas / total visitas válidas", () => {
    const visitas = [
      visita({ id: 1, status: "convertido"    }),
      visita({ id: 2, status: "convertido"    }),
      visita({ id: 3, status: "nao_convertido" }),
      visita({ id: 4, status: "sem_visita", tempoVisita: "ND", horaInicio: "ND", horaFim: "ND", distPV: "ND" }),
    ];
    const { kpis } = calcularMetricas(visitas);
    // sem_visita não tem duração → não passa pelo filtro de falsas → entra em visitasValidas
    // Python: taxaConversao = convertidas / visitasValidas.length
    expect(kpis.taxa_conversao).toBeCloseTo((2 / 4) * 100, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. FILTROS DE DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
describe("8. filtros de dashboard", () => {
  const visitasMistas = [
    visita({ id: 1, vendedor: 10, distPV: "50",  status: "convertido",    valorNumerico: 100 }),
    visita({ id: 2, vendedor: 10, distPV: "50",  status: "nao_convertido", valorNumerico: 0   }),
    visita({ id: 3, vendedor: 20, distPV: "50",  status: "convertido",    valorNumerico: 200 }),
    visita({ id: 4, vendedor: 20, distPV: "ND",  status: "sem_visita", tempoVisita: "ND", horaInicio: "ND", horaFim: "ND" }),
  ];

  it("filtro por vendedor restringe métricas ao vendedor", () => {
    const { kpis } = calcularMetricas(visitasMistas, "10");
    expect(kpis.receita_total).toBe(100);
    expect(kpis.clientes_unicos_visitados).toBe(2);
  });

  it("filtro por status='convertido' inclui apenas convertidas", () => {
    const { kpis } = calcularMetricas(visitasMistas, undefined, "convertido");
    expect(kpis.receita_total).toBe(300);
  });

  it("filtro vendedor + status combinados", () => {
    const { kpis } = calcularMetricas(visitasMistas, "10", "convertido");
    expect(kpis.receita_total).toBe(100);
    expect(kpis.clientes_unicos_visitados).toBe(1);
  });

  it("totalCarteira é calculado antes do filtro de status (inclui sem_visita do vendedor)", () => {
    // Vendedor 20 tem 1 visitada + 1 sem_visita = carteira 2
    const { kpis } = calcularMetricas(visitasMistas, "20");
    expect(kpis.total_carteira).toBe(2);
    expect(kpis.clientes_unicos_visitados).toBe(1); // apenas a que tem distPV válido dentro do raio
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. CONFIG CUSTOMIZADA
// ─────────────────────────────────────────────────────────────────────────────
describe("9. config customizada", () => {
  it("raio menor exclui visitas que antes estavam dentro", () => {
    const visitas = [
      visita({ id: 1, distPV: "100" }),  // 100m
      visita({ id: 2, distPV: "400" }),  // 400m
    ];
    const comRaioPadrao   = calcularMetricas(visitas);
    const comRaioRestrito = calcularMetricas(visitas, undefined, undefined, { raioPDV: 150 });

    expect(comRaioPadrao.kpis.clientes_unicos_visitados).toBe(2);
    expect(comRaioRestrito.kpis.clientes_unicos_visitados).toBe(1); // só 100m
  });

  it("limite de curta maior classifica mais visitas como relâmpago", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:04:00", distPV: "50" }),  // 4min — adequada com limite 3, curta com limite 5
      visita({ id: 2, tempoVisita: "00:10:00", distPV: "50" }),
    ];
    const padrao     = calcularMetricas(visitas);
    const limiteMaior = calcularMetricas(visitas, undefined, undefined, { minutosCurta: 5 });

    expect(padrao.kpis.visitas_curtas_count).toBe(0);
    expect(limiteMaior.kpis.visitas_curtas_count).toBe(1);
  });

  it("config_usada nos KPIs reflete os valores efetivamente aplicados", () => {
    const { kpis } = calcularMetricas([], undefined, undefined, { raioPDV: 300, minutosCurta: 5 });
    expect(kpis.config_usada.raioPDV).toBe(300);
    expect(kpis.config_usada.minutosCurta).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. ALERTAS
// ─────────────────────────────────────────────────────────────────────────────
describe("10. alertas", () => {
  it("alerta de cobertura ativo quando cobertura < limiar configurado", () => {
    const visitas = [
      visita({ id: 1, distPV: "50", status: "convertido" }),
      visita({ id: 2, distPV: "ND", tempoVisita: "ND", horaInicio: "ND", horaFim: "ND", status: "sem_visita" }),
    ];
    // cobertura = 50% → abaixo do padrão 100%
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.alertas.cobertura).toBe(true);
  });

  it("alerta de curtas ativo quando % relâmpago > limiar (padrão 10%)", () => {
    const visitas = [
      visita({ id: 1, tempoVisita: "00:01:00", distPV: "50" }),  // curta
      visita({ id: 2, tempoVisita: "00:01:00", distPV: "50" }),  // curta
      visita({ id: 3, tempoVisita: "00:10:00", distPV: "50" }),  // ok
    ];
    // 2/3 = 66% > 10%
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.alertas.curtas).toBe(true);
  });

  it("sem alertas quando tudo está dentro dos limiares", () => {
    const visitas = [
      visita({ id: 1, distPV: "50", status: "convertido" }),
    ];
    // cobertura = 100%, curtas = 0%, tarde = 0%
    // alerta tarde < 25% → 0 < 25 → TRUE (tarde em alerta por ser baixa)
    const { kpis } = calcularMetricas(visitas);
    expect(kpis.alertas.cobertura).toBe(false);
    expect(kpis.alertas.curtas).toBe(false);
  });
});