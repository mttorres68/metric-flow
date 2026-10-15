/* MetricFlow — API da produtividade da rota (aba "Produtividade" do Relatório de Entregas). Spec rota-produtividade §6. */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { periodoAte } from "./periodo";
import { agregarRotas, entregasPorDia } from "../services/produtividadeRota/rotaDia";
import * as repo from "../services/produtividadeRota/repo";

// Ver é só leitura do banco: até 1 ano por consulta.
const periodo = periodoAte(366);
const routeId = z.string().min(1).max(40);

export const produtividadeRouter = router({
  ranking: publicProcedure.input(periodo).query(async ({ input }) => agregarRotas(await repo.rotasIniciadasEm(input.revendaId, input.de, input.ate))),
  porDia: publicProcedure.input(periodo.and(z.object({ routeIds: z.array(routeId).max(4).optional() })))
    .query(async ({ input }) => entregasPorDia(await repo.diasDoPeriodo(input.revendaId, input.de, input.ate), input.de, input.ate, input.routeIds)),
  // Calendário de jornada (aba Análise): 53 semanas cabem em 371 dias.
  jornadas: publicProcedure.input(periodoAte(371)).query(async ({ input }) =>
    (await repo.diasDoPeriodo(input.revendaId, input.de, input.ate))
      .filter(d => d.jornadaMin)
      .map(d => ({ dia: d.dia, placa: d.placa, motorista: d.motorista, jornadaMin: d.jornadaMin! }))),
  rotas: publicProcedure.input(z.object({ revendaId: z.number().int(), routeIds: z.array(routeId).min(2).max(4) })).query(async ({ input }) => {
    const dias = await repo.diasDasRotas(input.revendaId, input.routeIds);
    return input.routeIds.map(id => ({ routeId: id, dias: dias.filter(d => d.routeId === id).sort((a, b) => a.dia.localeCompare(b.dia)) }));
  }),
});
