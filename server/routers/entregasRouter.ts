/*
 * MetricFlow — Entregas Router: lê as entregas do CheckNow guardadas por revenda, cruza com o GPS
 * (Infleet da revenda), coleta/importa e cadastra as contas (spec checknow-coleta §5).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { PlanilhaInvalidaError } from "../services/entregas/parseCheckNow";
import { processarEntregas } from "../services/entregas/processar";
import { listarCercasInfleet, mapaVeiculos } from "../services/entregas/infleetEntregas";
import { getConfigEntregas } from "../services/configService";
import * as repo from "../services/checknow/repo";
import { coletarRevenda, importarPlanilha } from "../services/checknow/sincronizar";
import { testarLogin } from "../services/checknow/coletor";
import { cofreDisponivel } from "../services/checknow/cofre";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodo = z.object({ revendaId: z.number().int(), de: dia, ate: dia })
  .refine(p => p.de <= p.ate && Date.parse(p.ate) - Date.parse(p.de) <= 30 * 86_400_000, "Período de no máximo 31 dias.");

/** ColetaError e planilha inválida viram BAD_REQUEST com a mensagem; o resto sobe. */
async function amigavel<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof repo.ColetaError || e instanceof PlanilhaInvalidaError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
    throw e;
  }
}

async function tokenDa(revendaId: number) {
  return (await repo.contaComSegredos(revendaId))?.infleetToken ?? undefined;
}

const contas = router({
  cofre: publicProcedure.query(() => ({ disponivel: cofreDisponivel() })),
  listar: publicProcedure.query(() => repo.listarContas()),
  revendasSemConta: publicProcedure.query(() => repo.revendasSemConta()),
  salvar: publicProcedure
    .input(z.object({
      revendaId: z.number().int(), checknowUsuario: z.string().trim().min(1).max(120),
      checknowSenha: z.string().max(200).optional(), infleetToken: z.string().max(4000).nullable().optional(),
    }))
    .mutation(({ input }) => amigavel(() => repo.salvarConta(input))),
  ativar: publicProcedure.input(z.object({ revendaId: z.number().int(), ativo: z.boolean() }))
    .mutation(({ input }) => repo.ativarConta(input.revendaId, input.ativo)),
  testarCheckNow: publicProcedure.input(z.object({ revendaId: z.number().int() })).mutation(({ input }) => amigavel(async () => {
    const c = await repo.contaComSegredos(input.revendaId);
    if (!c) throw new repo.ColetaError("revenda sem conta do CheckNow");
    return testarLogin(c);
  })),
  testarInfleet: publicProcedure.input(z.object({ revendaId: z.number().int() })).mutation(async ({ input }) =>
    ({ veiculos: (await mapaVeiculos(await tokenDa(input.revendaId))).size })),
});

export const entregasRouter = router({
  contas,
  processar: publicProcedure.input(periodo.and(z.object({ cercaId: z.string().optional() }))).mutation(async ({ input }) => {
    const [entregas, token, config] = await Promise.all([repo.entregasDoPeriodo(input.revendaId, input.de, input.ate), tokenDa(input.revendaId), getConfigEntregas()]);
    return processarEntregas(entregas, new Date(), { cercaId: input.cercaId, token, config });
  }),
  importar: publicProcedure.input(z.object({ revendaId: z.number().int(), xlsxBase64: z.string().min(1) }))
    .mutation(({ input }) => amigavel(() => importarPlanilha(input.revendaId, Buffer.from(input.xlsxBase64, "base64")))),
  coletar: publicProcedure.input(periodo).mutation(({ input }) => amigavel(() => coletarRevenda(input.revendaId, input.de, input.ate, "botao"))),
  coletas: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(({ input }) => repo.ultimasColetas(input.revendaId)),
  cercas: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(async ({ input }) => listarCercasInfleet(await tokenDa(input.revendaId))),
});
