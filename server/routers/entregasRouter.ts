/*
 * MetricFlow — Entregas Router: lê as entregas do CheckNow guardadas por revenda, cruza com o GPS
 * (Infleet da revenda), coleta/importa e cadastra as contas (spec checknow-coleta §5). O processamento do dia
 * anexa a produtividade em hL pelos pedidos do ERP (spec produtividade §6) e as importações do ERP ficam em `erp`.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { PlanilhaInvalidaError } from "../services/entregas/parseCheckNow";
import { cruzarDia } from "../services/entregas/cruzarDia";
import { deveGravarTela, gravarLinhas } from "../services/produtividadeRota/registrar";
import { fecharRotas } from "../services/produtividadeRota/repo";
import { diaBRT } from "@shared/entregas";
import { listarCercasInfleet, mapaVeiculos, placasInfleet, sedeDaConta } from "../services/entregas/infleetEntregas";
import { alinharPlacas, placasDoPeriodo } from "../services/entregas/placas";
import { periodoAte } from "./periodo";
import * as repo from "../services/checknow/repo";
import { coletarRevenda, importarPlanilha } from "../services/checknow/sincronizar";
import { testarLogin } from "../services/checknow/coletor";
import { cofreDisponivel } from "../services/checknow/cofre";
import { importarPedidos, importarProdutos } from "../services/erp/importar";
import { ArquivoErpInvalidoError } from "../services/erp/parseProdutos";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodo = z.object({ revendaId: z.number().int(), de: dia, ate: dia })
  .refine(p => p.de <= p.ate && Date.parse(p.ate) - Date.parse(p.de) <= 30 * 86_400_000, "Período de no máximo 31 dias.");

/** ColetaError e planilha inválida viram BAD_REQUEST com a mensagem; o resto sobe. */
async function amigavel<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof repo.ColetaError || e instanceof PlanilhaInvalidaError || e instanceof ArquivoErpInvalidoError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
    throw e;
  }
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
    ({ veiculos: (await mapaVeiculos(await repo.tokenInfleet(input.revendaId))).size })),
});

const erp = router({
  importarProdutos: publicProcedure.input(z.object({ xlsxBase64: z.string().min(1) }))
    .mutation(({ input }) => amigavel(() => importarProdutos(Buffer.from(input.xlsxBase64, "base64")))),
  importarPedidos: publicProcedure.input(z.object({ revendaId: z.number().int(), csvBase64: z.string().min(1) }))
    .mutation(({ input }) => amigavel(() => importarPedidos(input.revendaId, Buffer.from(input.csvBase64, "base64")))),
});

export const entregasRouter = router({
  contas,
  erp,
  processar: publicProcedure.input(periodo.and(z.object({ cercaId: z.string().optional() }))).mutation(async ({ input }) => {
    const r = await cruzarDia(input.revendaId, input.de, input.ate, input.cercaId);
    // O dia visto entra no histórico da produtividade da rota só com o mesmo critério do processamento diário
    // (dia passado, cerca Sede); falha aqui não quebra a tela.
    const gravar = async () => {
      const sede = input.cercaId ? await sedeDaConta(await repo.tokenInfleet(input.revendaId)) : null;
      if (!deveGravarTela({ de: input.de, ate: input.ate, cercaId: input.cercaId, sedeId: sede?.cercaId ?? null, hoje: diaBRT(new Date()) })) return;
      await gravarLinhas(input.revendaId, r);
      await fecharRotas(input.revendaId);
    };
    await gravar().catch(e => console.warn(`[produtividade-rota] gravar: ${(e as Error).message}`));
    return { linhas: r.linhas, rotas: r.rotas };
  }),
  importar: publicProcedure.input(z.object({ revendaId: z.number().int(), xlsxBase64: z.string().min(1) }))
    .mutation(({ input }) => amigavel(() => importarPlanilha(input.revendaId, Buffer.from(input.xlsxBase64, "base64")))),
  coletar: publicProcedure.input(periodo).mutation(({ input }) => amigavel(() => coletarRevenda(input.revendaId, input.de, input.ate, "botao"))),
  coletas: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(({ input }) => repo.ultimasColetas(input.revendaId)),
  cercas: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(async ({ input }) => listarCercasInfleet(await repo.tokenInfleet(input.revendaId))),
  // Aba Análise: placas únicas de pedidos e CheckNow no período e do cadastro do Infleet, alinhadas.
  placas: publicProcedure.input(periodoAte(366)).query(async ({ input }) => {
    const [doPeriodo, infleet] = await Promise.all([
      placasDoPeriodo(input.revendaId, input.de, input.ate), placasInfleet(await repo.tokenInfleet(input.revendaId)),
    ]);
    return alinharPlacas({ ...doPeriodo, infleet });
  }),
});
