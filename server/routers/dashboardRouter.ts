/*
 * MetricFlow — Dashboard Router
 * Endpoints tRPC para o painel de análise
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { calcularMetricas } from "../services/metricsCalculator";
import { getVisitasData, invalidarCache, getCacheInfo } from "../services/dataCache";

// Schema reutilizável para os parâmetros de configuração dinâmica
// O frontend envia esses valores a partir do painel de configurações
const configMetricasSchema = z.object({
  raioPDV:             z.number().min(50).max(5000).optional(),  // metros
  minutosCurta:        z.number().min(1).max(30).optional(),      // minutos
  limiteInicioTardio:  z.string().regex(/^\d{2}:\d{2}$/).optional(), // "HH:MM"
  alertaCurtasPerc:    z.number().min(0).max(100).optional(),
  alertaCoberturaPerc: z.number().min(0).max(100).optional(),
  alertaTardePerc:     z.number().min(0).max(100).optional(),
});

export const dashboardRouter = router({

  getMetrics: publicProcedure
    .input(
      z.object({
        // Filtros de dados
        vendedor:   z.string().optional(),
        status:     z.enum(["convertido", "nao_convertido", "sem_visita"]).optional(),
        gerente:    z.number().optional(),
        revenda:    z.string().optional(),
        dataInicio: z.string().optional(), // YYYY-MM-DD
        dataFim:    z.string().optional(), // YYYY-MM-DD
        // Parâmetros de configuração dinâmica (enviados pelo frontend)
        config:     configMetricasSchema.optional(),
      })
    )
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      // Filtros de dimensão
      if (input.gerente !== undefined) visitas = visitas.filter((v) => v.gerente === input.gerente);
      if (input.revenda)               visitas = visitas.filter((v) => v.revenda === input.revenda);
      if (input.dataInicio)            visitas = visitas.filter((v) => v.data >= input.dataInicio!);
      if (input.dataFim)               visitas = visitas.filter((v) => v.data <= input.dataFim!);

      return calcularMetricas(visitas, input.vendedor, input.status, input.config);
    }),

  // Força refresh do cache compartilhado
  refreshData: publicProcedure.mutation(async () => {
    invalidarCache();
    const visitas = await getVisitasData();
    return { success: true, recordCount: visitas.length };
  }),

  // Informações sobre o estado do cache (útil para o frontend exibir "atualizado há X min")
  getCacheInfo: publicProcedure.query(() => {
    return getCacheInfo();
  }),

  // Listas de opções para os filtros do dashboard
  getVendedores: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    return Array.from(new Set(visitas.map((v) => v.vendedor)))
      .sort((a, b) => a - b)
      .map((v) => ({ id: v, label: `V0${v}` }));
  }),

  getGerentes: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    return Array.from(new Set(visitas.map((v) => v.gerente)))
      .sort((a, b) => a - b)
      .map((v) => ({ id: v, label: `Gerente ${v}` }));
  }),

  getRevendas: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    return Array.from(new Set(visitas.map((v) => v.revenda)))
      .sort()
      .map((v) => ({ id: v, label: v }));
  }),

  getDateRange: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    const datas = visitas.map((v) => v.data).filter((d) => d?.length > 0).sort();
    return {
      minDate: datas[0]  ?? "",
      maxDate: datas[datas.length - 1] ?? "",
    };
  }),

  // Retorna os valores padrão de configuração para o frontend pré-preencher o painel
  getConfigPadrao: publicProcedure.query(() => {
    return {
      raioPDV:             500,
      minutosCurta:        3,
      limiteInicioTardio:  "08:45",
      alertaCurtasPerc:    10,
      alertaCoberturaPerc: 100,
      alertaTardePerc:     25,
    };
  }),
});