/*
 * MetricFlow — Metrics Calculator Service
 *
 * Regras de negócio espelhadas do metrics_calculator.py.
 * Correções aplicadas vs versão anterior:
 *
 *  1. Campo de raio: usa distPV ("Dist. PV") em vez de distR ("Dist. R")
 *     — alinhado com o Python que usa Dist_PV_Numeric
 *
 *  2. Raio padrão: 500m (era 300m) — alinhado com VENDEDORES_DIST_PDV do Python
 *
 *  3. Visitas curtas: calculadas APENAS sobre visitas dentro do raio
 *     — Python: df_raio['Visita_Curta'].sum()
 *
 *  4. Cobertura: numerador = clientes únicos dentro do raio (deduplicados),
 *     denominador = total de clientes distintos na base filtrada (carteira)
 *     — antes estava hardcoded em 100%
 *
 *  5. Após 14h: sobre visitas brutas dentro do raio (não deduplicadas)
 *     — alinhado com o Python
 *
 *  6. CONFIG dinâmico: todos os limiares podem ser sobrescritos via parâmetro
 *     do endpoint — o frontend envia os valores configurados pelo usuário
 */

import { ProcessedVisita } from "./googleSheetsService";

// ---------------------------------------------------------------------------
// Tipos de configuração dinâmica
// ---------------------------------------------------------------------------

/**
 * Parâmetros de configuração enviados pelo frontend.
 * Todos são opcionais — se ausente, usa o valor padrão abaixo.
 */
export interface ConfigMetricas {
  /** Raio máximo do PDV para considerar visita válida (metros). Padrão: 500 */
  raioPDV?: number;
  /** Duração mínima de uma visita para não ser "relâmpago" (minutos). Padrão: 3 */
  minutosCurta?: number;
  /** Horário limite de início para alerta de início tardio (HH:MM). Padrão: "08:45" */
  limiteInicioTardio?: string;
  /** Limiar de alerta para % visitas curtas (%). Padrão: 10 */
  alertaCurtasPerc?: number;
  /** Limiar de alerta para % cobertura (%). Padrão: 100 */
  alertaCoberturaPerc?: number;
  /** Limiar de alerta para % visitas após 14h (%). Padrão: 25 */
  alertaTardePerc?: number;
}

// Valores padrão — espelham o config.py do Python
const CONFIG_PADRAO: Required<ConfigMetricas> = {
  raioPDV:            500,   // VENDEDORES_DIST_PDV
  minutosCurta:       3,     // SHORT_VISIT_LIMIT
  limiteInicioTardio: "08:45",
  alertaCurtasPerc:   10,
  alertaCoberturaPerc: 100,
  alertaTardePerc:    25,
};

// Janelas de horário fixas (não configuráveis — regra de negócio invariante)
const JANELA_ALMOCO_INICIO = 12 * 60 + 15; // 12:15
const JANELA_ALMOCO_FIM    = 13 * 60 + 45; // 13:45
const JANELA_TARDE_INICIO  = 14 * 60;       // 14:00

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------

export interface KPIs {
  // Cobertura
  cobertura_perc: number;           // únicos dentro do raio / total carteira
  clientes_unicos_visitados: number;
  total_carteira: number;

  // Qualidade
  visitas_curtas_perc: number;      // curtas / brutas dentro do raio
  visitas_curtas_count: number;
  visitas_brutas_raio: number;      // denominador de curtas e após14h

  // Horários
  visitas_almoco: number;
  visitas_tarde_perc: number;       // brutas tarde / brutas raio

  // Financeiro
  receita_total: number;
  taxa_conversao: number;

  // Tempo
  tempo_medio_visita: number;       // minutos
  visitas_com_duracao_valida: number;

  // Alertas (baseados nos limiares configurados)
  alertas: {
    cobertura: boolean;
    curtas: boolean;
    tarde: boolean;
  };

  // Config efetiva usada no cálculo (para o frontend exibir)
  config_usada: Required<ConfigMetricas>;
}

export interface GraficoData {
  evolucao_horaria: Array<{ hora: string; acumulado: number; visitas: number }>;
  vendedores: Array<{
    vendedor: string;
    clientes: number;
    receita: number;
    curtas_perc: number;
    cobertura_perc: number;
  }>;
  motivos_nao_venda: Array<{ motivo: string; quantidade: number; cor: string }>;
}

export interface DashboardMetrics {
  kpis: KPIs;
  visitas: ProcessedVisita[];
  graficos: GraficoData;
}

// ---------------------------------------------------------------------------
// Funções auxiliares
// ---------------------------------------------------------------------------

/**
 * Converte "Dist. PV" para número em metros.
 * Mesmo algoritmo do converter_distancia_pv() do Python.
 */
function parseDistPV(distStr: any): number {
  if (!distStr || distStr === "ND") return 0;
  const limpo = String(distStr)
    .trim()
    .replace(/\./g, "")      // remove separador de milhar
    .replace(",", ".")        // converte decimal
    .replace(/[^0-9.\-]/g, "");
  const val = parseFloat(limpo);
  return isNaN(val) ? 0 : val;
}

/**
 * Converte "HH:MM:SS" ou "HH:MM" para minutos desde meia-noite.
 * Retorna null para valores inválidos ou "ND".
 */
function parseTimeToMinutes(timeStr: any): number | null {
  if (!timeStr || timeStr === "ND") return null;
  const partes = String(timeStr).split(":");
  if (partes.length >= 2) {
    const h = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  return null;
}

function resolverConfig(config?: ConfigMetricas): Required<ConfigMetricas> {
  return { ...CONFIG_PADRAO, ...config };
}

// ---------------------------------------------------------------------------
// Motor de cálculo principal
// ---------------------------------------------------------------------------

export function calcularMetricas(
  visitasBrutas: ProcessedVisita[],
  filtroVendedor?: string,
  filtroStatus?: string,
  config?: ConfigMetricas,
): DashboardMetrics {

  const cfg = resolverConfig(config);

  // ── 1. PRÉ-PROCESSAMENTO ──────────────────────────────────────────────
  const visitasMapeadas = visitasBrutas.map((v) => {
    const distPVNum  = parseDistPV(v.distPV);
    const duracaoMin = parseTimeToMinutes(v.tempoVisita);
    const inicioMin  = parseTimeToMinutes(v.horaInicio);

    return {
      ...v,
      distPVNum,
      duracaoMin,
      inicioMin,
      isCurta:      duracaoMin !== null ? duracaoMin < cfg.minutosCurta : false,
      dentroDoRaio: distPVNum <= cfg.raioPDV,
    };
  });

  // ── 2. FILTRO DE FALSAS VISITAS ───────────────────────────────────────
  // Remove registros onde duração < minutosCurta E distância > raioPDV
  // (GPS errado ou registro espúrio — mesma lógica do Python)
  let visitasValidas = visitasMapeadas.filter((v) => {
    const isFalsa = v.isCurta && v.distPVNum > cfg.raioPDV;
    return !isFalsa;
  });

  // ── 3. FILTROS DO DASHBOARD ───────────────────────────────────────────
  if (filtroVendedor) {
    visitasValidas = visitasValidas.filter((v) => v.vendedor === Number(filtroVendedor));
  }
  if (filtroStatus) {
    visitasValidas = visitasValidas.filter((v) => v.status === filtroStatus);
  }

  if (visitasValidas.length === 0) {
    return _retornarMetricasZeradas(cfg);
  }

  // ── 4. SEGMENTOS DENTRO DO RAIO ───────────────────────────────────────
  // Brutas dentro do raio: todas as linhas (inclui re-visitas ao mesmo cliente)
  const dentroRaioBrutas = visitasValidas.filter((v) => v.dentroDoRaio);

  // Únicas dentro do raio: um cliente visitado 2x conta como 1
  // Usado como numerador de cobertura (mesmo critério do Python)
  const dentroRaioUnico = dentroRaioBrutas.filter(
    (v, i, arr) => arr.findIndex((x) => x.codCliente === v.codCliente) === i
  );

  // Total carteira = clientes distintos em toda a base filtrada (inclui não-visitados)
  const totalCarteira = new Set(visitasValidas.map((v) => v.codCliente)).size;

  const visitasBrutasRaio  = dentroRaioBrutas.length;
  const visitasUnicasRaio  = dentroRaioUnico.length;

  // ── 5. MÉTRICAS DE QUALIDADE (sobre raio) ─────────────────────────────
  // Curtas: sobre únicos dentro do raio (mesmo critério exato do Python)
  const visitasCurtas = dentroRaioUnico.filter((v) => v.isCurta).length;
  const visitas_curtas_perc = visitasUnicasRaio > 0
    ? (visitasCurtas / visitasUnicasRaio) * 100
    : 0;

  // ── 6. HORÁRIOS (sobre brutas dentro do raio) ─────────────────────────
  let visitas_almoco = 0;
  let visitasTarde   = 0;
  let somaDuracao    = 0;
  let comDuracao     = 0;

  for (const v of dentroRaioBrutas) {
    if (v.inicioMin !== null) {
      if (v.inicioMin >= JANELA_ALMOCO_INICIO && v.inicioMin <= JANELA_ALMOCO_FIM) visitas_almoco++;
      if (v.inicioMin >= JANELA_TARDE_INICIO) visitasTarde++;
    }
    if (v.duracaoMin !== null) {
      somaDuracao += v.duracaoMin;
      comDuracao++;
    }
  }

  // ── 7. FINANCEIRO ─────────────────────────────────────────────────────
  const convertidas   = visitasValidas.filter((v) => v.status === "convertido");
  const receitaTotal  = convertidas.reduce((sum, v) => sum + v.valorNumerico, 0);
  const taxaConversao = visitasValidas.length > 0
    ? (convertidas.length / visitasValidas.length) * 100
    : 0;

  // ── 8. KPIs FINAIS ────────────────────────────────────────────────────
  const cobertura_perc = totalCarteira > 0
    ? (visitasUnicasRaio / totalCarteira) * 100
    : 0;

  const visitas_tarde_perc = visitasBrutasRaio > 0
    ? (visitasTarde / visitasBrutasRaio) * 100
    : 0;

  const kpis: KPIs = {
    cobertura_perc,
    clientes_unicos_visitados: visitasUnicasRaio,
    total_carteira:            totalCarteira,

    visitas_curtas_perc,
    visitas_curtas_count:      visitasCurtas,
    visitas_brutas_raio:       visitasBrutasRaio,

    visitas_almoco,
    visitas_tarde_perc,

    receita_total:             receitaTotal,
    taxa_conversao:            taxaConversao,

    tempo_medio_visita:        comDuracao > 0 ? somaDuracao / comDuracao : 0,
    visitas_com_duracao_valida: comDuracao,

    alertas: {
      cobertura: cobertura_perc   < cfg.alertaCoberturaPerc,
      curtas:    visitas_curtas_perc > cfg.alertaCurtasPerc,
      tarde:     visitas_tarde_perc  < cfg.alertaTardePerc,
    },

    config_usada: cfg,
  };

  // ── 9. GRÁFICOS ───────────────────────────────────────────────────────
  const evolucaoPorHora: Record<string, { acumulado: number; visitas: number }> = {};
  let acumulado = 0;

  visitasValidas.forEach((v) => {
    if (v.horaInicio && v.horaInicio !== "ND") {
      const hora = v.horaInicio.substring(0, 5);
      if (!evolucaoPorHora[hora]) evolucaoPorHora[hora] = { acumulado: 0, visitas: 0 };
      if (v.status === "convertido") acumulado += v.valorNumerico;
      evolucaoPorHora[hora].acumulado = acumulado;
      evolucaoPorHora[hora].visitas++;
    }
  });

  // Ranking por vendedor — cobertura individual
  const vendedorMap: Record<
    number,
    { clientesRaio: Set<number>; totalCarteira: Set<number>; receita: number; curtas: number; totalRaioUnico: number }
  > = {};

  visitasValidas.forEach((v) => {
    if (!vendedorMap[v.vendedor]) {
      vendedorMap[v.vendedor] = {
        clientesRaio:  new Set(),
        totalCarteira: new Set(),
        receita: 0,
        curtas: 0,
        totalRaioUnico: 0,
      };
    }
    const vd = vendedorMap[v.vendedor];
    vd.totalCarteira.add(v.codCliente);

    if (v.dentroDoRaio) {
      // Deduplicar por cliente para cobertura individual
      if (!vd.clientesRaio.has(v.codCliente)) {
        vd.clientesRaio.add(v.codCliente);
        vd.totalRaioUnico++;
        if (v.isCurta) vd.curtas++;
      }
    }
    if (v.status === "convertido") vd.receita += v.valorNumerico;
  });

  const vendedoresRanking = Object.entries(vendedorMap)
    .map(([vendedor, d]) => ({
      vendedor:      `V0${vendedor}`,
      clientes:      d.clientesRaio.size,
      receita:       d.receita,
      curtas_perc:   d.totalRaioUnico > 0 ? (d.curtas / d.totalRaioUnico) * 100 : 0,
      cobertura_perc: d.totalCarteira.size > 0
        ? (d.clientesRaio.size / d.totalCarteira.size) * 100
        : 0,
    }))
    .sort((a, b) => b.receita - a.receita);

  return {
    kpis,
    visitas: visitasValidas.slice(0, 100),
    graficos: {
      evolucao_horaria: Object.entries(evolucaoPorHora)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hora, d]) => ({ hora, ...d })),
      vendedores: vendedoresRanking,
      motivos_nao_venda: _calcularMotivos(visitasValidas),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CORES_MOTIVO = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
  "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
];

function _calcularMotivos(visitas: any[]) {
  const motivosMap: Record<string, number> = {};
  visitas
    .filter((v) => v.status === "nao_convertido")
    .forEach((v) => { motivosMap[v.motivo] = (motivosMap[v.motivo] || 0) + 1; });

  return Object.entries(motivosMap)
    .map(([motivo, quantidade], i) => ({
      motivo,
      quantidade,
      cor: CORES_MOTIVO[i % CORES_MOTIVO.length], // cores fixas, sem Math.random()
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function _retornarMetricasZeradas(cfg: Required<ConfigMetricas>): DashboardMetrics {
  return {
    kpis: {
      cobertura_perc: 0, clientes_unicos_visitados: 0, total_carteira: 0,
      visitas_curtas_perc: 0, visitas_curtas_count: 0, visitas_brutas_raio: 0,
      visitas_almoco: 0, visitas_tarde_perc: 0,
      receita_total: 0, taxa_conversao: 0,
      tempo_medio_visita: 0, visitas_com_duracao_valida: 0,
      alertas: { cobertura: false, curtas: false, tarde: false },
      config_usada: cfg,
    },
    visitas: [],
    graficos: { evolucao_horaria: [], vendedores: [], motivos_nao_venda: [] },
  };
}