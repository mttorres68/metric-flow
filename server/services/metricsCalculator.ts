/*
 * MetricFlow — Metrics Calculator Service
 * Inteligência de Negócio espelhada do metrics_calculator.py
 */

import { ProcessedVisita } from "./googleSheetsService";

// Configurações Globais de Regras de Negócio (Baseado no config.py)
const CONFIG = {
  DIST_LIMIT: 300, // metros
  SHORT_VISIT_MINUTES: 3, // minutos
  START_THRESHOLD: 8 * 60 + 45, // 08:45 em minutos
  END_THRESHOLD: 15 * 60, // 15:00 em minutos
  LUNCH_START: 12 * 60 + 15, // 12:15 em minutos
  LUNCH_END: 13 * 60 + 45, // 13:45 em minutos
  AFTERNOON_START: 14 * 60, // 14:00 em minutos
};

// --- Tipagens Atualizadas ---
export interface KPIs {
  receita_total: number;
  taxa_conversao: number;
  clientes_unicos_visitados: number;
  cobertura_perc: number;
  visitas_curtas_perc: number;
  visitas_adequadas_perc: number;
  tempo_medio_visita: number;
  distancia_total_km: number;
  visitas_almoco: number;
  visitas_tarde_perc: number;
  visitas_curtas_count: number;
  visitas_com_duracao_valida: number;
}

export interface GraficoData {
  evolucao_horaria: Array<{ hora: string; acumulado: number; visitas: number }>;
  vendedores: Array<{ vendedor: string; clientes: number; receita: number; curtas_perc: number }>;
  motivos_nao_venda: Array<{ motivo: string; quantidade: number; cor: string }>;
}

export interface DashboardMetrics {
  kpis: KPIs;
  visitas: ProcessedVisita[];
  graficos: GraficoData;
}

// --- Funções Auxiliares (Iguais ao Python) ---

function parseDistance(distStr: any): number {
  if (!distStr || distStr === "ND") return 0;
  const limpo = String(distStr).replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const val = parseFloat(limpo);
  return isNaN(val) ? 0 : val;
}

function parseTimeToMinutes(timeStr: any): number | null {
  if (!timeStr || timeStr === "ND") return null;
  const partes = String(timeStr).split(":");
  if (partes.length >= 2) {
    const horas = parseInt(partes[0], 10);
    const minutos = parseInt(partes[1], 10);
    if (!isNaN(horas) && !isNaN(minutos)) return horas * 60 + minutos;
  }
  return null;
}

// --- Motor de Cálculo ---

export function calcularMetricas(
  visitasBrutas: ProcessedVisita[],
  filtroVendedor?: string,
  filtroStatus?: string
): DashboardMetrics {
  
  // 1. PRÉ-PROCESSAMENTO: Limpeza de dados e conversões
  const visitasMapeadas = visitasBrutas.map((v) => {
    const distNumeric = parseDistance(v.distR);
    const duracaoMin = parseTimeToMinutes(v.tempoVisita);
    const inicioMin = parseTimeToMinutes(v.horaInicio);
    
    return {
      ...v,
      distNumeric,
      duracaoMin,
      inicioMin,
      isCurta: duracaoMin !== null ? duracaoMin < CONFIG.SHORT_VISIT_MINUTES : false,
    };
  });

  // 2. FILTRO DE FALSAS VISITAS (Regra de Negócio principal do Python)
  // Remove duração < 3min E distância > 500m
  let visitasValidas = visitasMapeadas.filter((v) => {
    const isFalsa = v.isCurta && v.distNumeric > CONFIG.DIST_LIMIT;
    return !isFalsa;
  });

  // 3. APLICAÇÃO DE FILTROS DO DASHBOARD (Vendedor / Status)
  if (filtroVendedor) {
    visitasValidas = visitasValidas.filter((v) => v.vendedor === Number(filtroVendedor));
  }
  if (filtroStatus) {
    visitasValidas = visitasValidas.filter((v) => v.status === filtroStatus);
  }

  // Se não sobrar nada, retorna zerado
  if (visitasValidas.length === 0) {
    return _retornarMetricasZeradas();
  }

  // --- CÁLCULO DE KPIs ---
  const convertidas = visitasValidas.filter((v) => v.status === "convertido");
  const receitaTotal = convertidas.reduce((sum, v) => sum + v.valorNumerico, 0);
  const taxaConversao = (convertidas.length / visitasValidas.length) * 100;

  // Clientes Únicos e Cobertura
  // Nota: Aqui consideramos total_clientes da base filtrada. Em prod, você pode cruzar com uma tabela de clientes mestre
  const clientesUnicos = new Set(visitasValidas.map((v) => v.codCliente));
  
  // Qualidade das Visitas
  let visitasCurtasCount = 0;
  let visitasComDuracaoValida = 0;
  let somaDuracao = 0;
  let distanciaTotalMetros = 0;

  // Períodos (Almoço / Tarde)
  let visitasAlmocoCount = 0;
  let visitasTardeCount = 0;

  visitasValidas.forEach((v) => {
    distanciaTotalMetros += v.distNumeric;

    if (v.duracaoMin !== null) {
      visitasComDuracaoValida++;
      somaDuracao += v.duracaoMin;
      if (v.isCurta) visitasCurtasCount++;
    }

    if (v.inicioMin !== null) {
      if (v.inicioMin >= CONFIG.LUNCH_START && v.inicioMin <= CONFIG.LUNCH_END) {
        visitasAlmocoCount++;
      }
      if (v.inicioMin >= CONFIG.AFTERNOON_START) {
        visitasTardeCount++;
      }
    }
  });

  const kpis: KPIs = {
    receita_total: receitaTotal,
    taxa_conversao: taxaConversao,
    clientes_unicos_visitados: clientesUnicos.size,
    cobertura_perc: 100, // Necessita total_carteira geral para ser < 100% real
    visitas_curtas_perc: visitasComDuracaoValida > 0 ? (visitasCurtasCount / visitasComDuracaoValida) * 100 : 0,
    visitas_adequadas_perc: visitasComDuracaoValida > 0 ? ((visitasComDuracaoValida - visitasCurtasCount) / visitasComDuracaoValida) * 100 : 0,
    tempo_medio_visita: visitasComDuracaoValida > 0 ? somaDuracao / visitasComDuracaoValida : 0,
    distancia_total_km: distanciaTotalMetros / 1000,
    visitas_almoco: visitasAlmocoCount,
    visitas_tarde_perc: visitasValidas.length > 0 ? (visitasTardeCount / visitasValidas.length) * 100 : 0,
    visitas_curtas_count: visitasCurtasCount,
    visitas_com_duracao_valida: visitasComDuracaoValida,
  };

  // --- CÁLCULO DE GRÁFICOS ---
  const evolucaoPorHora: Record<string, { acumulado: number; visitas: number }> = {};
  let acumulado = 0;

  // Evolução Horária
  visitasValidas.forEach((v) => {
    if (v.horaInicio && v.horaInicio !== "ND") {
      const hora = v.horaInicio.substring(0, 5);
      if (!evolucaoPorHora[hora]) evolucaoPorHora[hora] = { acumulado: 0, visitas: 0 };
      if (v.status === "convertido") acumulado += v.valorNumerico;
      evolucaoPorHora[hora].acumulado = acumulado;
      evolucaoPorHora[hora].visitas += 1;
    }
  });

  // Vendedores Ranking
  const vendedorMap: Record<number, { clientes: Set<number>; receita: number; curtas: number; totalComTempo: number }> = {};
  visitasValidas.forEach((v) => {
    if (!vendedorMap[v.vendedor]) {
      vendedorMap[v.vendedor] = { clientes: new Set(), receita: 0, curtas: 0, totalComTempo: 0 };
    }
    vendedorMap[v.vendedor].clientes.add(v.codCliente);
    if (v.status === "convertido") vendedorMap[v.vendedor].receita += v.valorNumerico;
    
    if (v.duracaoMin !== null) {
      vendedorMap[v.vendedor].totalComTempo++;
      if (v.isCurta) vendedorMap[v.vendedor].curtas++;
    }
  });

  const vendedoresRanking = Object.entries(vendedorMap)
    .map(([vendedor, data]) => ({
      vendedor: `V0${vendedor}`,
      clientes: data.clientes.size,
      receita: data.receita,
      curtas_perc: data.totalComTempo > 0 ? (data.curtas / data.totalComTempo) * 100 : 0,
    }))
    .sort((a, b) => b.receita - a.receita);

  return {
    kpis,
    visitas: visitasValidas.slice(0, 100), // Envia as 100 primeiras para a tabela do painel
    graficos: {
      evolucao_horaria: Object.entries(evolucaoPorHora).sort().map(([h, d]) => ({ hora: h, ...d })),
      vendedores: vendedoresRanking,
      motivos_nao_venda: _calcularMotivos(visitasValidas),
    },
  };
}

function _calcularMotivos(visitas: any[]) {
  const motivosMap: Record<string, number> = {};
  visitas.filter(v => v.status === "nao_convertido").forEach(v => {
    motivosMap[v.motivo] = (motivosMap[v.motivo] || 0) + 1;
  });
  return Object.entries(motivosMap)
    .map(([motivo, quantidade]) => ({ motivo, quantidade, cor: "#" + Math.floor(Math.random()*16777215).toString(16) }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function _retornarMetricasZeradas(): DashboardMetrics {
  return {
    kpis: {
      receita_total: 0, taxa_conversao: 0, clientes_unicos_visitados: 0, cobertura_perc: 0,
      visitas_curtas_perc: 0, visitas_adequadas_perc: 0, tempo_medio_visita: 0,
      distancia_total_km: 0, visitas_almoco: 0, visitas_tarde_perc: 0, visitas_com_duracao_valida: 0, visitas_curtas_count: 0
    },
    visitas: [],
    graficos: { evolucao_horaria: [], vendedores: [], motivos_nao_venda: [] }
  };
}