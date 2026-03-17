/*
 * MetricFlow — Compliance Router
 * Endpoints tRPC para análise de justificativas de não conversão
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getVisitasData } from "../services/dataCache";

export const complianceRouter = router({

  // ── MACRO: ranking de motivos com breakdown por vendedor ──────────────
  resumoMotivos: publicProcedure
    .input(z.object({
      revenda:    z.string().optional(),
      vendedor:   z.number().optional(),
      dataInicio: z.string().optional(),
      dataFim:    z.string().optional(),
    }))
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      // Aplica filtros
      visitas = visitas.filter(v => v.status === "nao_convertido");
      if (input.revenda)    visitas = visitas.filter(v => v.revenda === input.revenda);
      if (input.vendedor)   visitas = visitas.filter(v => v.vendedor === input.vendedor);
      if (input.dataInicio) visitas = visitas.filter(v => v.data >= input.dataInicio!);
      if (input.dataFim)    visitas = visitas.filter(v => v.data <= input.dataFim!);

      const total = visitas.length;

      // Agrega por motivo
      const motivoMap: Record<string, {
        motivo: string;
        total: number;
        vendedores: Record<number, { vendedor: number; count: number }>;
        clientes: Set<number>;
      }> = {};

      for (const v of visitas) {
        if (!motivoMap[v.motivo]) {
          motivoMap[v.motivo] = { motivo: v.motivo, total: 0, vendedores: {}, clientes: new Set() };
        }
        const m = motivoMap[v.motivo];
        m.total++;
        m.clientes.add(v.codCliente);
        if (!m.vendedores[v.vendedor]) m.vendedores[v.vendedor] = { vendedor: v.vendedor, count: 0 };
        m.vendedores[v.vendedor].count++;
      }

      const motivos = Object.values(motivoMap)
        .map(m => ({
          motivo:          m.motivo,
          total:           m.total,
          perc:            total > 0 ? (m.total / total) * 100 : 0,
          clientesUnicos:  m.clientes.size,
          topVendedores:   Object.values(m.vendedores)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(v => ({ vendedor: `V0${v.vendedor}`, count: v.count })),
        }))
        .sort((a, b) => b.total - a.total);

      return { total, motivos };
    }),

  // ── MICRO: clientes que receberam um motivo específico ────────────────
  clientesPorMotivo: publicProcedure
    .input(z.object({
      motivo:     z.string(),
      revenda:    z.string().optional(),
      vendedor:   z.number().optional(),
      dataInicio: z.string().optional(),
      dataFim:    z.string().optional(),
    }))
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      visitas = visitas.filter(v =>
        v.status === "nao_convertido" && v.motivo === input.motivo
      );
      if (input.revenda)    visitas = visitas.filter(v => v.revenda === input.revenda);
      if (input.vendedor)   visitas = visitas.filter(v => v.vendedor === input.vendedor);
      if (input.dataInicio) visitas = visitas.filter(v => v.data >= input.dataInicio!);
      if (input.dataFim)    visitas = visitas.filter(v => v.data <= input.dataFim!);

      // Agrupa por cliente para mostrar histórico
      const clienteMap: Record<number, {
        codCliente:  number;
        cliente:     string;
        ocorrencias: number;
        vendedores:  Set<number>;
        visitas: Array<{
          data:       string;
          vendedor:   number;
          horaInicio: string;
          duracao:    string;
          distPV:     string;
        }>;
      }> = {};

      for (const v of visitas) {
        if (!clienteMap[v.codCliente]) {
          clienteMap[v.codCliente] = {
            codCliente: v.codCliente,
            cliente:    v.cliente,
            ocorrencias: 0,
            vendedores: new Set(),
            visitas: [],
          };
        }
        const c = clienteMap[v.codCliente];
        c.ocorrencias++;
        c.vendedores.add(v.vendedor);
        c.visitas.push({
          data:       v.data,
          vendedor:   v.vendedor,
          horaInicio: v.horaInicio,
          duracao:    v.tempoVisita,
          distPV:     v.distPV,
        });
      }

      return Object.values(clienteMap)
        .map(c => ({
          ...c,
          vendedores:       c.vendedores.size,
          vendedoresList:   Array.from(c.vendedores).map(v => `V0${v}`),
          visitas:          c.visitas.sort((a, b) => b.data.localeCompare(a.data)),
        }))
        .sort((a, b) => b.ocorrencias - a.ocorrencias);
    }),


  // ── TEMPORAL: evolução diária dos top motivos ─────────────────────────
  evolucaoTemporal: publicProcedure
    .input(z.object({
      revenda:    z.string().optional(),
      vendedor:   z.number().optional(),
      dataInicio: z.string().optional(),
      dataFim:    z.string().optional(),
      topN:       z.number().min(1).max(10).default(5),
    }))
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      visitas = visitas.filter(v => v.status === "nao_convertido");
      if (input.revenda)    visitas = visitas.filter(v => v.revenda === input.revenda);
      if (input.vendedor)   visitas = visitas.filter(v => v.vendedor === input.vendedor);
      if (input.dataInicio) visitas = visitas.filter(v => v.data >= input.dataInicio!);
      if (input.dataFim)    visitas = visitas.filter(v => v.data <= input.dataFim!);

      if (visitas.length === 0) return { datas: [], series: [], pontos: [] };

      // Top N motivos por volume total
      const totalPorMotivo: Record<string, number> = {};
      for (const v of visitas) totalPorMotivo[v.motivo] = (totalPorMotivo[v.motivo] || 0) + 1;
      const topMotivos = Object.entries(totalPorMotivo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, input.topN)
        .map(([m]) => m);

      // Agrupa por data × motivo
      const porData: Record<string, Record<string, number>> = {};
      for (const v of visitas) {
        if (!topMotivos.includes(v.motivo)) continue;
        if (!porData[v.data]) porData[v.data] = {};
        porData[v.data][v.motivo] = (porData[v.data][v.motivo] || 0) + 1;
      }

      const datas = Object.keys(porData).sort();
      const pontos = datas.map(data => {
        const ponto: Record<string, any> = { data };
        for (const m of topMotivos) ponto[m] = porData[data][m] ?? 0;
        return ponto;
      });

      return { datas, series: topMotivos, pontos };
    }),

  // ── UTIL: lista de revendas disponíveis para filtro ──────────────────
  revendas: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    return [...new Set(visitas.map(v => v.revenda))].sort();
  }),

  // ── UTIL: lista de vendedores (opcionalmente filtrados por revenda) ───
  vendedores: publicProcedure
    .input(z.object({ revenda: z.string().optional() }))
    .query(async ({ input }) => {
      let visitas = await getVisitasData();
      if (input.revenda) visitas = visitas.filter(v => v.revenda === input.revenda);
      const mapa: Record<number, string> = {};
      for (const v of visitas) mapa[v.vendedor] = `V0${v.vendedor}`;
      return Object.entries(mapa)
        .map(([id, nome]) => ({ id: Number(id), nome }))
        .sort((a, b) => a.id - b.id);
    }),
});