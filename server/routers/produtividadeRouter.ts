/* MetricFlow — API da produtividade da rota (aba "Produtividade" do Relatório de Entregas). Spec rota-produtividade §6. */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { agregarRotas, entregasPorDia } from "../services/produtividadeRota/rotaDia";
import * as repo from "../services/produtividadeRota/repo";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodo = z.object({ revendaId: z.number().int(), de: dia, ate: dia })
  .refine(p => p.de <= p.ate && Date.parse(p.ate) - Date.parse(p.de) <= 30 * 86_400_000, "Período de no máximo 31 dias.");
const routeId = z.string().min(1).max(40);

export const produtividadeRouter = router({
  ranking: publicProcedure.input(periodo).query(async ({ input }) => agregarRotas(await repo.rotasIniciadasEm(input.revendaId, input.de, input.ate))),
  porDia: publicProcedure.input(periodo.and(z.object({ routeIds: z.array(routeId).max(4).optional() })))
    .query(async ({ input }) => entregasPorDia(await repo.diasDoPeriodo(input.revendaId, input.de, input.ate), input.de, input.ate, input.routeIds)),
  rotas: publicProcedure.input(z.object({ revendaId: z.number().int(), routeIds: z.array(routeId).min(2).max(4) })).query(async ({ input }) => {
    const dias = await repo.diasDasRotas(input.revendaId, input.routeIds);
    return input.routeIds.map(id => ({ routeId: id, dias: dias.filter(d => d.routeId === id).sort((a, b) => a.dia.localeCompare(b.dia)) }));
  }),
});
