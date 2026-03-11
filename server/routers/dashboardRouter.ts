/*
 * MetricFlow — Dashboard Router
 * Endpoints tRPC para o painel de análise
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { loadGoogleSheetsData, processarVisitas } from "../services/googleSheetsService";
import { calcularMetricas } from "../services/metricsCalculator";

// Cache para evitar múltiplas requisições ao Google Sheets
let cachedVisitas: ReturnType<typeof processarVisitas> | null = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

async function getVisitasData() {
  const now = Date.now();

  // Se cache ainda é válido, retornar dados em cache
  if (cachedVisitas && now - lastCacheTime < CACHE_DURATION_MS) {
    console.log("[Dashboard] Usando dados em cache");
    return cachedVisitas;
  }

  console.log("[Dashboard] Carregando dados do Google Sheets...");
  try {
    const rawData = await loadGoogleSheetsData();
    cachedVisitas = processarVisitas(rawData);
    lastCacheTime = now;
    console.log(`[Dashboard] ✓ ${cachedVisitas.length} visitas processadas`);
    return cachedVisitas;
  } catch (error) {
    console.error("[Dashboard] Erro ao carregar dados:", error);
    // Se houver erro e temos cache antigo, usar mesmo que expirado
    if (cachedVisitas) {
      console.log("[Dashboard] Usando cache expirado como fallback");
      return cachedVisitas;
    }
    throw new Error("Falha ao carregar dados do painel");
  }
}

export const dashboardRouter = router({
  getMetrics: publicProcedure
    .input(
      z.object({
        vendedor: z.string().optional(),
        status: z.enum(["convertido", "nao_convertido", "sem_visita"]).optional(),
        gerente: z.number().optional(),
        revenda: z.string().optional(),
        dataInicio: z.string().optional(), // YYYY-MM-DD
        dataFim: z.string().optional(), // YYYY-MM-DD
      })
    )
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      // Aplicar filtros de gerente e revenda
      if (input.gerente !== undefined) {
        visitas = visitas.filter((v) => v.gerente === input.gerente);
      }
      if (input.revenda) {
        visitas = visitas.filter((v) => v.revenda === input.revenda);
      }

      // Aplicar filtros de data
      if (input.dataInicio) {
        visitas = visitas.filter((v) => v.data >= input.dataInicio!);
      }
      if (input.dataFim) {
        visitas = visitas.filter((v) => v.data <= input.dataFim!);
      }

      const metricas = calcularMetricas(visitas, input.vendedor, input.status);
      return metricas;
    }),

  // Endpoint para forçar refresh dos dados
  refreshData: publicProcedure.mutation(async () => {
    console.log("[Dashboard] Forçando refresh dos dados...");
    cachedVisitas = null;
    lastCacheTime = 0;
    const visitas = await getVisitasData();
    return { success: true, recordCount: visitas.length };
  }),

  // Endpoint para obter lista de vendedores
  getVendedores: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    const vendedores = Array.from(new Set(visitas.map((v) => v.vendedor)))
      .sort((a, b) => a - b)
      .map((v) => ({ id: v, label: `V0${v}` }));
    return vendedores;
  }),

  // Endpoint para obter lista de gerentes
  getGerentes: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    const gerentes = Array.from(new Set(visitas.map((v) => v.gerente)))
      .sort((a, b) => a - b)
      .map((v) => ({ id: v, label: `Gerente ${v}` }));
    return gerentes;
  }),

  // Endpoint para obter lista de revendas
  getRevendas: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    const revendas = Array.from(new Set(visitas.map((v) => v.revenda)))
      .sort()
      .map((v) => ({ id: v, label: v }));
    return revendas;
  }),

  // Endpoint para obter intervalo de datas disponíveis
  getDateRange: publicProcedure.query(async () => {
    const visitas = await getVisitasData();
    const datas = visitas.map((v) => v.data).filter((d) => d && d.length > 0);
    const datasOrdenadas = datas.sort();
    
    return {
      minDate: datasOrdenadas.length > 0 ? datasOrdenadas[0] : "",
      maxDate: datasOrdenadas.length > 0 ? datasOrdenadas[datasOrdenadas.length - 1] : "",
    };
  }),
});
