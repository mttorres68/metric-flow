/*
 * MetricFlow — Dashboard Router
 * Resta apenas o refresh do cache de visitas, usado pela tela de Análise.
 * (getMetrics e as listas de filtro do dashboard foram removidos.)
 */

import { publicProcedure, router } from "../_core/trpc";
import { getVisitasData, invalidarCache } from "../services/dataCache";

export const dashboardRouter = router({

  // Força refresh do cache compartilhado
  refreshData: publicProcedure.mutation(async () => {
    invalidarCache();
    const visitas = await getVisitasData();
    return { success: true, recordCount: visitas.length };
  }),
});
