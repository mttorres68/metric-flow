/*
 * MetricFlow — Entregas Router
 * Processa a planilha do CheckNow e devolve o cruzamento com o GPS (Infleet)
 * para a tela "Relatório de Entregas". Sem banco: o client reenvia a planilha.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { PlanilhaInvalidaError } from "../services/entregas/parseCheckNow";
import { processarPlanilha } from "../services/entregas/processar";

export const entregasRouter = router({
  processar: publicProcedure
    .input(z.object({ xlsxBase64: z.string().min(1), cercaId: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        return await processarPlanilha(Buffer.from(input.xlsxBase64, "base64"), new Date(), input.cercaId);
      } catch (e) {
        if (e instanceof PlanilhaInvalidaError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
        throw e;
      }
    }),
});
