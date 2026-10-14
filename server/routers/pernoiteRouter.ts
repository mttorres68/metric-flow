/* MetricFlow — API dos pernoites (aba "Pernoite" do Relatório de Entregas). */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { diaIso, periodoAte } from "./periodo";
import { listarNoites, resumoPorMotorista } from "../services/pernoite/repo";
import { processarNoites, reprocessar, statusReprocessamento } from "../services/pernoite/processar";
import { tokenInfleet } from "../services/checknow/repo";
import { sedeDaConta } from "../services/entregas/infleetEntregas";

// Ver é só leitura do banco: até 1 ano por consulta.
const periodo = periodoAte(366);
const periodoAnalise = periodoAte(92); // analisar consulta o GPS dia a dia (~10–15 s por dia)

export const pernoiteRouter = router({
  listar: publicProcedure.input(periodo).query(({ input }) => listarNoites(input.revendaId, input.de, input.ate)),
  resumo: publicProcedure.input(periodo).query(({ input }) => resumoPorMotorista(input.revendaId, input.de, input.ate)),
  recalcular: publicProcedure.input(z.object({ revendaId: z.number().int(), dia: diaIso })).mutation(async ({ input }) => {
    try {
      return { noites: await processarNoites(input.revendaId, input.dia) };
    } catch (e) {
      throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
    }
  }),
  reprocessar: publicProcedure.input(periodoAnalise).mutation(({ input }) => {
    reprocessar(input.revendaId, input.de, input.ate);
    return statusReprocessamento(input.revendaId);
  }),
  sede: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(async ({ input }) =>
    tokenInfleet(input.revendaId).then(sedeDaConta).catch(() => null)),
  status: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(({ input }) => statusReprocessamento(input.revendaId)),
});
