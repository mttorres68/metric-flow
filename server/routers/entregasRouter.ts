/*
 * MetricFlow — Entregas Router: lê as entregas do CheckNow guardadas por revenda, cruza com o GPS
 * (Infleet da revenda), coleta/importa e cadastra as contas (spec checknow-coleta §5). O processamento do dia
 * anexa a produtividade em hL pelos pedidos do ERP (spec produtividade §6) e as importações do ERP ficam em `erp`.
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
import * as erpRepo from "../services/erp/repo";
import { importarPedidos, importarProdutos } from "../services/erp/importar";
import { ArquivoErpInvalidoError } from "../services/erp/parseProdutos";
import { pontosDaLinha, produtividadeLinha, volumeEntrega } from "../services/entregas/produtividade";

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
    const [entregas, token, config] = await Promise.all([repo.entregasDoPeriodo(input.revendaId, input.de, input.ate), repo.tokenInfleet(input.revendaId), getConfigEntregas()]);
    const res = await processarEntregas(entregas, new Date(), { cercaId: input.cercaId, token, config, periodo: { de: input.de, ate: input.ate } });
    // Produtividade em hL: itens do ERP dos documentos das entregas; pontos de descarga guardados para o "4 semanas".
    const itens = await erpRepo.itensDosDocumentos(input.revendaId, res.linhas.flatMap(l => l.baixas.flatMap(b => b.entrega.documentos))).catch(() => []);
    const desde = new Date(Date.parse(`${input.de}T12:00:00Z`) - 28 * 86_400_000).toISOString().slice(0, 10);
    const linhas = await Promise.all(res.linhas.map(async l => {
      const volumes = l.baixas.map(b => (b.entrega.documentos.length ? volumeEntrega(b.entrega.documentos, itens) : null));
      await erpRepo.gravarPontos(input.revendaId, pontosDaLinha(l, volumes)).catch(() => undefined);
      const p4 = await erpRepo.pontosDoMotorista(input.revendaId, l.linha.motorista, desde, l.linha.data).catch(() => []);
      return { ...l, volumes, produtividade: produtividadeLinha(l, volumes, config.raioM, p4) };
    }));
    return { ...res, linhas };
  }),
  importar: publicProcedure.input(z.object({ revendaId: z.number().int(), xlsxBase64: z.string().min(1) }))
    .mutation(({ input }) => amigavel(() => importarPlanilha(input.revendaId, Buffer.from(input.xlsxBase64, "base64")))),
  coletar: publicProcedure.input(periodo).mutation(({ input }) => amigavel(() => coletarRevenda(input.revendaId, input.de, input.ate, "botao"))),
  coletas: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(({ input }) => repo.ultimasColetas(input.revendaId)),
  cercas: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(async ({ input }) => listarCercasInfleet(await repo.tokenInfleet(input.revendaId))),
});
