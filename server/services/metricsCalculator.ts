/*
 * MetricFlow — Metrics Calculator Service
 * Implementa a lógica de cálculo de métricas do código Python
 */

import { ProcessedVisita } from "./googleSheetsService";
import { REPORT_CONFIG } from "../config";

export interface KPIs {
  receita_total: number;
  receita_trend: number;
  clientes_visitados: number;
  taxa_conversao: number;
  tempo_medio_visita: number;
  distancia_total: number;
}

export interface GraficoData {
  evolucao_horaria: Array<{
    hora: string;
    acumulado: number;
    visitas: number;
  }>;
  vendedores: Array<{
    vendedor: string;
    clientes: number;
    receita: number;
  }>;
  motivos_nao_venda: Array<{
    motivo: string;
    quantidade: number;
    cor: string;
  }>;
}

export interface DashboardMetrics {
  kpis: KPIs;
  visitas: ProcessedVisita[];
  graficos: GraficoData;
}

export function calcularKPIs(visitas: ProcessedVisita[]): KPIs {
  const visitasConvertidas = visitas.filter((v) => v.status === "convertido");
  const receitaTotal = visitasConvertidas.reduce((sum, v) => sum + v.valorNumerico, 0);
  const clientesUnicos = new Set(visitas.map((v) => v.codCliente)).size;
  const taxaConversao = visitas.length > 0 ? (visitasConvertidas.length / visitas.length) * 100 : 0;

  // Calcular tempo médio de visita
  let tempoTotalMinutos = 0;
  let visitasComTempo = 0;
  for (const v of visitas) {
    if (v.tempoVisita && v.tempoVisita !== "ND") {
      const [horas, minutos] = v.tempoVisita.split(":").map(Number);
      if (!isNaN(horas) && !isNaN(minutos)) {
        tempoTotalMinutos += horas * 60 + minutos;
        visitasComTempo++;
      }
    }
  }
  const tempoMedio = visitasComTempo > 0 ? tempoTotalMinutos / visitasComTempo : 0;

  // Calcular distância total (simplificado)
  let distanciaTotal = 0;
  for (const v of visitas) {
    if (v.distR && v.distR !== "ND") {
      const dist = parseFloat(String(v.distR).replace(",", "."));
      if (!isNaN(dist)) {
        distanciaTotal += dist;
      }
    }
  }

  return {
    receita_total: receitaTotal,
    receita_trend: 12.4, // Valor fixo por enquanto
    clientes_visitados: clientesUnicos,
    taxa_conversao: taxaConversao,
    tempo_medio_visita: tempoMedio,
    distancia_total: distanciaTotal / 1000, // Converter para km
  };
}

export function calcularGraficos(visitas: ProcessedVisita[]): GraficoData {
  // Evolução horária
  const evolucaoPorHora: Record<string, { acumulado: number; visitas: number }> = {};
  let acumulado = 0;

  for (const v of visitas) {
    if (v.horaInicio && v.horaInicio !== "ND") {
      const hora = v.horaInicio.substring(0, 5); // HH:MM
      if (!evolucaoPorHora[hora]) {
        evolucaoPorHora[hora] = { acumulado: 0, visitas: 0 };
      }
      acumulado += v.valorNumerico;
      evolucaoPorHora[hora].acumulado = acumulado;
      evolucaoPorHora[hora].visitas += 1;
    }
  }

  const evolucao_horaria = Object.entries(evolucaoPorHora)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hora, data]) => ({
      hora,
      acumulado: data.acumulado,
      visitas: data.visitas,
    }));

  // Clientes por vendedor
  const vendedorMap: Record<number, { clientes: number; receita: number }> = {};
  const clientesPorVendedor: Record<number, Set<number>> = {};

  for (const v of visitas) {
    if (!vendedorMap[v.vendedor]) {
      vendedorMap[v.vendedor] = { clientes: 0, receita: 0 };
      clientesPorVendedor[v.vendedor] = new Set();
    }
    clientesPorVendedor[v.vendedor].add(v.codCliente);
    vendedorMap[v.vendedor].receita += v.valorNumerico;
  }

  const vendedores = Object.entries(vendedorMap)
    .map(([vendedor, data]) => ({
      vendedor: `V0${vendedor}`,
      clientes: clientesPorVendedor[Number(vendedor)].size,
      receita: data.receita,
    }))
    .sort((a, b) => b.clientes - a.clientes);

  // Motivos de não venda
  const motivosMap: Record<string, number> = {};
  const cores: Record<string, string> = {
    "Sem dinheiro": "#FF6B6B",
    "Recusou a compra": "#FFA500",
    "Estoque cheio": "#4ECDC4",
    "Comprou em adega": "#95E1D3",
    "Pedido via HeiShop": "#C7CEEA",
    "Fechado no momento da visita": "#B19CD9",
    "Encerrou atividade": "#DDA0DD",
    Inadimplente: "#EE82EE",
    "Motivo não identificado": "#D3D3D3",
  };

  for (const v of visitas) {
    if (v.status === "nao_convertido") {
      motivosMap[v.motivo] = (motivosMap[v.motivo] || 0) + 1;
    }
  }

  const motivos_nao_venda = Object.entries(motivosMap)
    .map(([motivo, quantidade]) => ({
      motivo,
      quantidade,
      cor: cores[motivo] || "#CCCCCC",
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    evolucao_horaria,
    vendedores,
    motivos_nao_venda,
  };
}

export function filtrarVisitas(
  visitas: ProcessedVisita[],
  filtroVendedor?: string,
  filtroStatus?: string
): ProcessedVisita[] {
  return visitas.filter((v) => {
    const matchVendedor = !filtroVendedor || v.vendedor === Number(filtroVendedor);
    const matchStatus = !filtroStatus || v.status === filtroStatus;
    return matchVendedor && matchStatus;
  });
}

export function calcularMetricas(
  visitas: ProcessedVisita[],
  filtroVendedor?: string,
  filtroStatus?: string
): DashboardMetrics {
  const visitasFiltradas = filtrarVisitas(visitas, filtroVendedor, filtroStatus);
  const kpis = calcularKPIs(visitasFiltradas);
  const graficos = calcularGraficos(visitasFiltradas);

  return {
    kpis,
    visitas: visitasFiltradas.slice(0, 50), // Limitar a 50 para a tabela
    graficos,
  };
}
