import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  listAllRespostas,
  listRespostas,
  upsertResposta,
  listRevendas,
  listColaboradores,
  upsertColaborador,
  listResponsabilidades,
  listAllResponsabilidades,
  upsertResponsabilidade,
} from "../db/assessment";

const RespostaInput = z.object({
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
  data: z.string().optional(),
  operacao: z.number().int().optional(),
  revenda: z.string().min(1),
  item: z.string().min(1),
  autoavaliacao: z.string().optional(),
  evidencia: z.string().optional(),
  statusFinal: z.enum(["Sim", "Parcial", "Não"]).optional(),
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

const ColaboradorInput = z.object({
  id: z.number().int().optional(),
  revendaId: z.number().int(),
  nome: z.string().min(1),
  cargo: z.string().optional(),
  whatsapp: z.string().optional(),
  ativo: z.boolean().optional(),
});

const ResponsabilidadeInput = z.object({
  revendaId: z.number().int(),
  item: z.string().min(1),
  responsavelId: z.number().int().nullable().optional(),
  apoioId: z.number().int().nullable().optional(),
});

export const assessmentRouter = router({
  // ── Respostas ──────────────────────────────────────────────────────────────
  listAll: publicProcedure
    .input(z.object({ ano: z.number().int(), mes: z.number().int() }))
    .query(({ input }) => listAllRespostas(input.ano, input.mes)),

  list: publicProcedure
    .input(z.object({ revenda: z.string(), ano: z.number().int(), mes: z.number().int() }))
    .query(({ input }) => listRespostas(input.revenda, input.ano, input.mes)),

  upsert: publicProcedure
    .input(RespostaInput)
    .mutation(({ input }) => upsertResposta(input)),

  // ── Revendas ───────────────────────────────────────────────────────────────
  listRevendas: publicProcedure
    .query(() => listRevendas()),

  // ── Colaboradores ──────────────────────────────────────────────────────────
  listColaboradores: publicProcedure
    .input(z.object({ revendaId: z.number().int().optional() }))
    .query(({ input }) => listColaboradores(input.revendaId)),

  upsertColaborador: publicProcedure
    .input(ColaboradorInput)
    .mutation(({ input }) => upsertColaborador(input)),

  // ── Responsabilidades ──────────────────────────────────────────────────────
  listResponsabilidades: publicProcedure
    .input(z.object({ revendaId: z.number().int() }))
    .query(({ input }) => listResponsabilidades(input.revendaId)),

  listAllResponsabilidades: publicProcedure
    .query(() => listAllResponsabilidades()),

  upsertResponsabilidade: publicProcedure
    .input(ResponsabilidadeInput)
    .mutation(({ input }) => upsertResponsabilidade(input)),

  // ── Sincronização — dispara check.py via api.py ────────────────────────────
  triggerSync: publicProcedure
    .input(z.object({ ano: z.number().int().optional(), mes: z.number().int().optional() }).optional())
    .mutation(async ({ input }) => {
      const automacaoUrl = process.env.AUTOMATION_API_URL ?? "http://localhost:5000";
      const now = new Date();
      const body = {
        ano: input?.ano ?? now.getFullYear(),
        mes: input?.mes ?? (now.getMonth() + 1),
      };
      const resp = await fetch(`${automacaoUrl}/assessment/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(130_000),
      });
      if (!resp.ok) throw new Error(`Automação respondeu ${resp.status}`);
      return resp.json() as Promise<{ sucesso: boolean; output?: string; erro?: string }>;
    }),
});
