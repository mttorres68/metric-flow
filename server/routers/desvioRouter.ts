/* MetricFlow — API do detector de desvio de carga (aba "Desvio" do Relatório de Entregas). Spec desvio §8. */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as servico from "../services/desvio/servico";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const revenda = z.object({ revendaId: z.number().int() });
const periodo = z.object({ revendaId: z.number().int(), de: dia, ate: dia })
  .refine(p => p.de <= p.ate && Date.parse(p.ate) - Date.parse(p.de) <= 30 * 86_400_000, "Período de no máximo 31 dias.");
const pedido = z.string().min(1).max(20);

export const desvioRouter = router({
  fila: publicProcedure.input(periodo.and(z.object({ incluirRevisados: z.boolean().optional() })))
    .query(({ input }) => servico.fila(input.revendaId, input.de, input.ate, input.incluirRevisados)),
  paraOlhar: publicProcedure.input(periodo).query(({ input }) => servico.paraOlhar(input.revendaId, input.de, input.ate)),
  abertos: publicProcedure.input(revenda).query(({ input }) => servico.abertos(input.revendaId)),
  motoristas: publicProcedure.input(periodo).query(({ input }) => servico.motoristas(input.revendaId, input.de, input.ate)),
  detalhe: publicProcedure.input(revenda.extend({ pedido })).query(({ input }) => servico.detalhe(input.revendaId, input.pedido)),
  revisar: publicProcedure
    .input(revenda.extend({ pedido, situacao: z.enum(["ok", "suspeito", "investigando"]), observacao: z.string().max(500) }))
    .mutation(({ input }) => servico.revisar(input.revendaId, input.pedido, input.situacao, input.observacao)),
});
