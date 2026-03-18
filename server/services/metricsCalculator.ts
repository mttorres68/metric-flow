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
 * ND ou vazio → 0, igual ao Python converter_distancia_pv() que usa fillna(0).
 * Linhas sem visita (sem_visita) têm Duracao=null e nunca entram no filtro de raio,
 * portanto o 0 não as contamina — apenas visitas com duração chegam até aqui.
 */
function parseDistPV(distStr: any): number {
  if (!distStr || distStr === "ND" || String(distStr).trim() === "") return 0;
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

  const _label = `[metricsCalc] filtro=${filtroVendedor ?? "todos"} status=${filtroStatus ?? "todos"}`;
  console.group(_label);

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

  console.log("① entrada          total=%d  raio=%dm  curta<%dmin",
    visitasMapeadas.length, cfg.raioPDV, cfg.minutosCurta);

  // ── 2. FILTRO DE FALSAS VISITAS ───────────────────────────────────────
  const falsasVisitas = visitasMapeadas.filter((v) => v.isCurta && v.distPVNum > cfg.raioPDV);
  let visitasValidas = visitasMapeadas.filter((v) => !(v.isCurta && v.distPVNum > cfg.raioPDV));

  console.log("② falsas removidas=%d  válidas=%d", falsasVisitas.length, visitasValidas.length);
  if (falsasVisitas.length > 0) {
    console.table(falsasVisitas.map((v) => ({
      vendedor: v.vendedor, cliente: v.codCliente,
      distPV: v.distPVNum.toFixed(1) + "m", duracao: v.duracaoMin?.toFixed(1) + "min",
    })));
  }

  // ── CARTEIRA TOTAL ────────────────────────────────────────────────────
  // Usa visitasMapeadas (ANTES de remover falsas) — igual ao Python que usa df completo.
  // Falsas visitas e sem_visita ainda pertencem à carteira do vendedor.
  const visitasParaCarteira = filtroVendedor
    ? visitasMapeadas.filter((v) => v.vendedor === Number(filtroVendedor))
    : visitasMapeadas;
  const totalCarteira = new Set(visitasParaCarteira.map((v) => v.codCliente)).size;

  console.log("③ carteira         totalCarteira=%d  (inclui sem_visita e falsas)", totalCarteira);

  // ── 3. FILTROS DO DASHBOARD ───────────────────────────────────────────
  if (filtroVendedor) {
    visitasValidas = visitasValidas.filter((v) => v.vendedor === Number(filtroVendedor));
  }
  if (filtroStatus) {
    visitasValidas = visitasValidas.filter((v) => v.status === filtroStatus);
  }

  console.log("④ pós-filtros      válidas=%d", visitasValidas.length);

  if (visitasValidas.length === 0) {
    console.warn("  ⚠ sem visitas após filtros — retornando zeros");
    console.groupEnd();
    return _retornarMetricasZeradas(cfg);
  }

  // ── 4. SEGMENTOS DENTRO DO RAIO ───────────────────────────────────────
  // Apenas visitas COM duração — igual ao Python: df_valido = df[Duracao.notna()]
  // Sem este filtro, sem_visita com distPV=ND→0 entraria como "dentro do raio"
  // e inflaria visitasUnicasRaio e cobertura incorretamente.
  const visitasComDuracao  = visitasValidas.filter((v) => v.duracaoMin !== null);
  const dentroRaioBrutas   = visitasComDuracao.filter((v) => v.dentroDoRaio);
  const dentroRaioUnico    = dentroRaioBrutas.filter(
    (v, i, arr) => arr.findIndex((x) => x.codCliente === v.codCliente) === i
  );

  const visitasBrutasRaio  = dentroRaioBrutas.length;
  const visitasUnicasRaio  = dentroRaioUnico.length;
  const foraRaio           = visitasComDuracao.length - visitasBrutasRaio;

  console.log("⑤ raio             brutas=%d  únicas=%d  fora_raio=%d",
    visitasBrutasRaio, visitasUnicasRaio, foraRaio);

  // ── 5. MÉTRICAS DE QUALIDADE (sobre raio) ─────────────────────────────
  const visitasCurtasUnicas = dentroRaioUnico.filter((v) => v.isCurta).length;
  const visitas_curtas_perc = visitasUnicasRaio > 0
    ? (visitasCurtasUnicas / visitasUnicasRaio) * 100
    : 0;

  console.log("⑥ relâmpago        curtas_únicas=%d  únicas_raio=%d  %%=%.1f",
    visitasCurtasUnicas, visitasUnicasRaio, visitas_curtas_perc);

  // ── 6. HORÁRIOS (sobre brutas dentro do raio) ─────────────────────────
  let visitas_almoco = 0;
  let visitasTarde   = 0;

  for (const v of dentroRaioBrutas) {
    if (v.inicioMin !== null) {
      if (v.inicioMin >= JANELA_ALMOCO_INICIO && v.inicioMin <= JANELA_ALMOCO_FIM) visitas_almoco++;
      if (v.inicioMin >= JANELA_TARDE_INICIO) visitasTarde++;
    }
  }

  console.log("⑦ horários         almoço=%d  tarde=%d  %%tarde=%.1f",
    visitas_almoco, visitasTarde,
    visitasBrutasRaio > 0 ? (visitasTarde / visitasBrutasRaio) * 100 : 0);

  // Tempo médio: média de TODAS as visitas válidas (com duração não nula),
  // sem filtro de raio e sem filtro de duração mínima — igual ao Python.
  let somaDuracao = 0;
  let comDuracao  = 0;
  for (const v of visitasValidas) {
    if (v.duracaoMin !== null) {
      somaDuracao += v.duracaoMin;
      comDuracao++;
    }
  }

  const tempoMedio = comDuracao > 0 ? somaDuracao / comDuracao : 0;
  console.log("⑧ tempo médio      visitas_com_duracao=%d  média=%.1fmin  (sem filtro raio/min)",
    comDuracao, tempoMedio);

  // ── 7. FINANCEIRO ─────────────────────────────────────────────────────
  const convertidas   = visitasValidas.filter((v) => v.status === "convertido");
  const receitaTotal  = convertidas.reduce((sum, v) => sum + v.valorNumerico, 0);
  const taxaConversao = visitasValidas.length > 0
    ? (convertidas.length / visitasValidas.length) * 100
    : 0;

  console.log("⑨ financeiro       receita=%.2f  convertidas=%d  conversão=%.1f%%",
    receitaTotal, convertidas.length, taxaConversao);

  // ── 8. KPIs FINAIS ────────────────────────────────────────────────────
  const cobertura_perc = totalCarteira > 0
    ? (visitasUnicasRaio / totalCarteira) * 100
    : 0;

  const visitas_tarde_perc = visitasBrutasRaio > 0
    ? (visitasTarde / visitasBrutasRaio) * 100
    : 0;

  console.log("⑩ cobertura        %d/%d = %.1f%%", visitasUnicasRaio, totalCarteira, cobertura_perc);
  console.log("   config usada    raioPDV=%dm  curta<%dmin  alertas: cobertura<%d%% curtas>%d%% tarde<%d%%",
    cfg.raioPDV, cfg.minutosCurta,
    cfg.alertaCoberturaPerc, cfg.alertaCurtasPerc, cfg.alertaTardePerc);
  console.groupEnd();

  const kpis: KPIs = {
    cobertura_perc,
    clientes_unicos_visitados: visitasUnicasRaio,
    total_carteira:            totalCarteira,

    visitas_curtas_perc,
    visitas_curtas_count:      visitasCurtasUnicas,
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

  // Ranking por vendedor — cobertura individual + dados do relatório
  const vendedorMap: Record<
    number,
    {
      revenda:         string;
      clientesRaio:    Set<number>;
      totalCarteira:   Set<number>;
      receita:         number;
      curtas:          number;
      totalRaioUnico:  number;
      brutasRaio:      number;
      visitasAlmoco:   number;
      visitasTarde:    number;
      hrInicioMin:     number | null;
      hrFimMin:        number | null;
    }
  > = {};

  // Precisamos do fimMin — parseia horaFim para minutos
  const parseFim = (horaFim: string): number | null => {
    if (!horaFim || horaFim === "ND") return null;
    const p = horaFim.split(":");
    if (p.length < 2) return null;
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
  };

  visitasValidas.forEach((v) => {
    if (!vendedorMap[v.vendedor]) {
      vendedorMap[v.vendedor] = {
        revenda:        v.revenda,
        clientesRaio:   new Set(),
        totalCarteira:  new Set(),
        receita:        0,
        curtas:         0,
        totalRaioUnico: 0,
        brutasRaio:     0,
        visitasAlmoco:  0,
        visitasTarde:   0,
        hrInicioMin:    null,
        hrFimMin:       null,
      };
    }
    const vd = vendedorMap[v.vendedor];
    vd.totalCarteira.add(v.codCliente);

    if (v.dentroDoRaio && v.duracaoMin !== null) {
      vd.brutasRaio++;

      // Hora início (primeira visita dentro do raio)
      if (v.inicioMin !== null) {
        if (vd.hrInicioMin === null || v.inicioMin < vd.hrInicioMin) vd.hrInicioMin = v.inicioMin;
      }
      // Hora fim (última visita dentro do raio — usa horaFim)
      const fimMin = parseFim(v.horaFim);
      if (fimMin !== null) {
        if (vd.hrFimMin === null || fimMin > vd.hrFimMin) vd.hrFimMin = fimMin;
      }

      // Almoço e tarde sobre brutas dentro do raio
      if (v.inicioMin !== null) {
        if (v.inicioMin >= JANELA_ALMOCO_INICIO && v.inicioMin <= JANELA_ALMOCO_FIM) vd.visitasAlmoco++;
        if (v.inicioMin >= JANELA_TARDE_INICIO) vd.visitasTarde++;
      }

      // Cobertura: deduplica por cliente
      if (!vd.clientesRaio.has(v.codCliente)) {
        vd.clientesRaio.add(v.codCliente);
        vd.totalRaioUnico++;
        if (v.isCurta) vd.curtas++;
      }
    }
    if (v.status === "convertido") vd.receita += v.valorNumerico;
  });

  // Converte minutos → "HH:MM:SS"
  const minToHHMM = (min: number | null): string => {
    if (min === null) return "ND";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const vendedoresRanking = Object.entries(vendedorMap)
    .map(([vendedor, d]) => ({
      vendedor:       `V0${vendedor}`,
      vendedorCod:    Number(vendedor),
      revenda:        d.revenda,
      clientes:       d.clientesRaio.size,
      receita:        d.receita,
      curtas_perc:    d.totalRaioUnico > 0 ? (d.curtas / d.totalRaioUnico) * 100 : 0,
      cobertura_perc: d.totalCarteira.size > 0
        ? (d.clientesRaio.size / d.totalCarteira.size) * 100
        : 0,
      hrInicio:          minToHHMM(d.hrInicioMin),
      hrFim:             minToHHMM(d.hrFimMin),
      visitasAlmoco:     d.visitasAlmoco,
      visitasTarde:      d.visitasTarde,
      visitasBrutasRaio: d.brutasRaio,
      totalCarteira:     d.totalCarteira.size,
      visitasUnicasRaio: d.clientesRaio.size,
      curtasCount:       d.curtas,
      percTarde:    d.brutasRaio     > 0 ? (d.visitasTarde / d.brutasRaio)          * 100 : 0,
      percCurtas:   d.totalRaioUnico > 0 ? (d.curtas       / d.totalRaioUnico)      * 100 : 0,
      percCobertura: d.totalCarteira.size > 0 ? (d.clientesRaio.size / d.totalCarteira.size) * 100 : 0,
    }))
    .sort((a, b) => a.revenda.localeCompare(b.revenda) || a.vendedorCod - b.vendedorCod);

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
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#445552", "#07004D", "#FF5154",
  "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#42E2B8", "#2D82B7"
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