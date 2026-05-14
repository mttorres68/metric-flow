import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { listRespostas, upsertResposta } from "../db/assessment";

const RespostaInput = z.object({
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
  data: z.string().optional(),
  operacao: z.number().int().optional(),
  revenda: z.string().min(1),
  item: z.string().min(1),
  autoavaliacao: z.string().optional(),
  evidencia: z.string().optional(),
  padrinho: z.string().optional(),
  horaCheck: z.string().optional(),
  macroArea: z.string().optional(),
  microArea: z.string().optional(),
  piramide: z.string().optional(),
  descricao: z.string().optional(),
  tipoResposta: z.string().optional(),
  pontoPossivel: z.number().int().optional(),
  pontosEvidencia: z.number().int().optional(),
  pontosAutoavaliacao: z.number().int().optional(),
});

export const assessmentRouter = router({
  list: publicProcedure
    .input(z.object({ revenda: z.string(), ano: z.number().int(), mes: z.number().int() }))
    .query(({ input }) => listRespostas(input.revenda, input.ano, input.mes)),

  upsert: publicProcedure
    .input(RespostaInput)
    .mutation(({ input }) => upsertResposta(input)),
});
