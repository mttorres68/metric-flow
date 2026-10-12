/* MetricFlow — API dos pernoites (aba "Pernoite" do Relatório de Entregas). */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { listarNoites, resumoPorMotorista } from "../services/pernoite/repo";
import { processarNoites, reprocessar, statusReprocessamento } from "../services/pernoite/processar";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodo = z.object({ revendaId: z.number().int(), de: dia, ate: dia })
  .refine(p => p.de <= p.ate && Date.parse(p.ate) - Date.parse(p.de) <= 30 * 86_400_000, "Período de no máximo 31 dias.");

export const pernoiteRouter = router({
  listar: publicProcedure.input(periodo).query(({ input }) => listarNoites(input.revendaId, input.de, input.ate)),
  resumo: publicProcedure.input(periodo).query(({ input }) => resumoPorMotorista(input.revendaId, input.de, input.ate)),
  recalcular: publicProcedure.input(z.object({ revendaId: z.number().int(), dia })).mutation(async ({ input }) => {
    try {
      return { noites: await processarNoites(input.revendaId, input.dia) };
    } catch (e) {
      throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
    }
  }),
  reprocessar: publicProcedure.input(periodo).mutation(({ input }) => {
    reprocessar(input.revendaId, input.de, input.ate);
    return statusReprocessamento(input.revendaId);
  }),
  status: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(({ input }) => statusReprocessamento(input.revendaId)),
});
