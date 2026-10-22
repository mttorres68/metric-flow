/*
 * MetricFlow — acesso ao banco da coleta do CheckNow (spec checknow-coleta §4–5).
 * Contas (segredos cifrados), entregas por revenda, registro de coletas e trava por revenda.
 */
import { and, desc, eq, gte, inArray, isNull, lte, notInArray, or } from "drizzle-orm";
import type { Pool } from "pg";
import { getDb } from "../../db";
import { checknowColetas, checknowEntregas, entregasContas, revendas } from "../../../drizzle/schema";
import type { Entrega, Situacao } from "../entregas/parseCheckNow";
import { diaBRT } from "@shared/entregas";
import { cifrar, decifrar } from "./cofre";

export class ColetaError extends Error {}
export type Origem = "auto" | "botao" | "upload" | "erp";
const CHAVE_TRAVA = 7301;

async function exigirDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

type Linha = typeof checknowEntregas.$inferSelect;

export function paraLinha(revendaId: number, e: Entrega) {
  return { ...e, revendaId, dia: diaBRT(e.rotaInicio!), rotaInicio: e.rotaInicio! };
}

export function deLinha(r: Linha): Entrega {
  const { id, revendaId, dia, coletadoEm, ...e } = r;
  return { ...e, situacao: e.situacao as Situacao };
}

/** Troca só as rotas presentes em `entregas` (transação). Entregas sem início de rota ficam de fora. */
export async function gravarEntregas(revendaId: number, entregas: Entrega[]): Promise<{ rotas: number; linhas: number }> {
  const unicas = new Map(entregas.filter(e => e.rotaInicio).map(e => [`${e.routeId}|${e.codCliente}`, e]));
  if (!unicas.size) return { rotas: 0, linhas: 0 };
  const rotas = [...new Set([...unicas.values()].map(e => e.routeId))];
  const linhas = [...unicas.values()].map(e => paraLinha(revendaId, e));
  const db = await exigirDb();
  await db.transaction(async tx => {
    await tx.delete(checknowEntregas).where(and(eq(checknowEntregas.revendaId, revendaId), inArray(checknowEntregas.routeId, rotas)));
    for (let i = 0; i < linhas.length; i += 500) await tx.insert(checknowEntregas).values(linhas.slice(i, i + 500));
  });
  return { rotas: rotas.length, linhas: linhas.length };
}

/**
 * Entregas das rotas que estavam rodando no período: começaram até `ate` (no máximo 31 dias antes de `de`)
 * e não fecharam antes de `de`. Quem filtra os dias das linhas é o processarEntregas (opção periodo).
 */
export async function entregasDoPeriodo(revendaId: number, de: string, ate: string): Promise<Entrega[]> {
  const db = await exigirDb();
  const limite = new Date(Date.parse(`${de}T12:00:00Z`) - 31 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.select().from(checknowEntregas).where(and(
    eq(checknowEntregas.revendaId, revendaId), gte(checknowEntregas.dia, limite), lte(checknowEntregas.dia, ate),
    or(isNull(checknowEntregas.rotaFim), gte(checknowEntregas.rotaFim, new Date(`${de}T00:00:00-03:00`))),
  ));
  return rows.map(deLinha);
}

/** Uma coleta por revenda por vez (advisory lock de sessão numa conexão dedicada). */
export async function comTrava<T>(revendaId: number, fn: () => Promise<T>): Promise<T> {
  const db = await exigirDb();
  const client = await (db.$client as Pool).connect();
  try {
    const { rows } = await client.query("select pg_try_advisory_lock($1, $2) as ok", [CHAVE_TRAVA, revendaId]);
    if (!rows[0].ok) throw new ColetaError("coleta já em andamento");
    try { return await fn(); }
    finally { await client.query("select pg_advisory_unlock($1, $2)", [CHAVE_TRAVA, revendaId]); }
  } finally {
    client.release();
  }
}

export async function abrirColeta(revendaId: number, origem: Origem, de: string, ate: string): Promise<number> {
  const db = await exigirDb();
  const [r] = await db.insert(checknowColetas).values({ revendaId, origem, periodoDe: de, periodoAte: ate, status: "rodando" }).returning({ id: checknowColetas.id });
  return r.id;
}

export async function fecharColeta(id: number, revendaId: number, r: { status: "ok" | "sem_dados" | "erro"; rotas?: number; linhas?: number; erro?: string }) {
  const db = await exigirDb();
  const agora = new Date();
  await db.update(checknowColetas).set({ status: r.status, rotas: r.rotas ?? null, linhas: r.linhas ?? null, erro: r.erro ?? null, terminadoEm: agora }).where(eq(checknowColetas.id, id));
  await db.update(entregasContas).set({ ultimaColetaEm: agora, ultimaColetaOk: r.status !== "erro", ultimaColetaErro: r.erro ?? null }).where(eq(entregasContas.revendaId, revendaId));
}

export async function ultimasColetas(revendaId: number, n = 10) {
  const db = await exigirDb();
  return db.select().from(checknowColetas).where(eq(checknowColetas.revendaId, revendaId)).orderBy(desc(checknowColetas.iniciadoEm)).limit(n);
}

/** Data final da última coleta do portal que deu certo (ok ou sem dados); uploads não contam. */
export async function ultimoPeriodoOk(revendaId: number): Promise<string | null> {
  const db = await exigirDb();
  const [r] = await db.select({ ate: checknowColetas.periodoAte }).from(checknowColetas)
    .where(and(eq(checknowColetas.revendaId, revendaId), inArray(checknowColetas.status, ["ok", "sem_dados"]), notInArray(checknowColetas.origem, ["upload", "erp"])))
    .orderBy(desc(checknowColetas.periodoAte)).limit(1);
  return r?.ate ?? null;
}

/** Decifra senha e token; cifrados com outra CHECKNOW_CHAVE viram um erro que diz o que fazer. */
export function abrirSegredos(c: { checknowSenha: string; infleetToken: string | null }) {
  try {
    return { senha: decifrar(c.checknowSenha), infleetToken: c.infleetToken ? decifrar(c.infleetToken) : null };
  } catch {
    throw new ColetaError("credenciais cifradas com outra CHECKNOW_CHAVE — recadastre a conta");
  }
}

/** Token do Infleet da conta; ausente ou ilegível → undefined (vale o INFLEET_TOKEN do .env). */
export function lerToken(cifrado: string | null): string | undefined {
  if (!cifrado) return undefined;
  try {
    return decifrar(cifrado);
  } catch {
    console.warn("[CheckNow] token do Infleet cifrado com outra CHECKNOW_CHAVE; usando o INFLEET_TOKEN do .env");
    return undefined;
  }
}

/** Login recusado não volta a ser tentado sozinho (risco de bloquear a conta) até a conta ser editada. */
export const deveColetarAuto = (c: { ultimaColetaOk: boolean | null; ultimaColetaErro: string | null }) =>
  !(c.ultimaColetaOk === false && c.ultimaColetaErro === "login recusado");

export async function contaComSegredos(revendaId: number) {
  const db = await exigirDb();
  const [c] = await db.select().from(entregasContas).where(eq(entregasContas.revendaId, revendaId));
  if (!c) return null;
  return { revendaId, ativo: c.ativo, usuario: c.checknowUsuario, ...abrirSegredos(c) };
}

/** Só o token do Infleet (a leitura do relatório não depende da senha do CheckNow). */
export async function tokenInfleet(revendaId: number): Promise<string | undefined> {
  const db = await exigirDb();
  const [c] = await db.select({ t: entregasContas.infleetToken }).from(entregasContas).where(eq(entregasContas.revendaId, revendaId));
  return lerToken(c?.t ?? null);
}

/** Para a tela: nunca devolve senha nem token. */
export async function listarContas() {
  const db = await exigirDb();
  const rows = await db.select({ c: entregasContas, revenda: revendas.nome }).from(entregasContas)
    .innerJoin(revendas, eq(revendas.id, entregasContas.revendaId)).orderBy(revendas.nome);
  return rows.map(({ c, revenda }) => ({
    revendaId: c.revendaId, revenda, ativo: c.ativo, checknowUsuario: c.checknowUsuario,
    senhaDefinida: !!c.checknowSenha, infleetDefinido: !!c.infleetToken,
    ultimaColetaEm: c.ultimaColetaEm, ultimaColetaOk: c.ultimaColetaOk, ultimaColetaErro: c.ultimaColetaErro,
    pathfindBase: c.pathfindBase, pathfindUsuario: c.pathfindUsuario, pathfindSenhaDefinida: !!c.pathfindSenha,
    pathfindUltimaColetaEm: c.pathfindUltimaColetaEm, pathfindUltimaColetaOk: c.pathfindUltimaColetaOk, pathfindUltimaColetaErro: c.pathfindUltimaColetaErro,
  }));
}

export interface SalvarConta {
  revendaId: number; checknowUsuario: string;
  checknowSenha?: string;          // vazio/ausente = mantém (obrigatória ao criar)
  infleetToken?: string | null;    // ausente = mantém; null = remove (usa o .env)
  pathfindBase?: string | null;    // ausente = mantém; null/vazio = remove
  pathfindUsuario?: string | null;
  pathfindSenha?: string;          // vazio/ausente = mantém
}

/** Só o Pathfind de verdade recebe a senha: https em routing.pathfindsistema.com.br. */
export function enderecoPathfindValido(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "routing.pathfindsistema.com.br";
  } catch {
    return false;
  }
}

const semBarra = (s: string | null | undefined) => s?.trim().replace(/\/+$/, "") || null;

/**
 * Campos do Pathfind a gravar: ausente = mantém; senha vazia = mantém. Trocar o endereço sem mandar a senha de novo
 * apaga a senha guardada — a senha nunca segue para um endereço que não foi cadastrado junto com ela.
 */
export function camposPathfind(atual: { pathfindBase: string | null }, c: SalvarConta) {
  const base = c.pathfindBase !== undefined ? semBarra(c.pathfindBase) : undefined;
  const trocouEndereco = base !== undefined && base !== semBarra(atual.pathfindBase);
  return {
    ...(base !== undefined ? { pathfindBase: base } : {}),
    ...(c.pathfindUsuario !== undefined ? { pathfindUsuario: c.pathfindUsuario?.trim() || null } : {}),
    ...(c.pathfindSenha ? { pathfindSenha: cifrar(c.pathfindSenha) } : trocouEndereco ? { pathfindSenha: null } : {}),
  };
}

/** Pathfind: só com endereço cadastrado e sem login recusado pendente (mesma regra do CheckNow). */
export const deveColetarPathfind = (c: { pathfindBase: string | null; pathfindUltimaColetaOk: boolean | null; pathfindUltimaColetaErro: string | null }) =>
  !!c.pathfindBase && !(c.pathfindUltimaColetaOk === false && c.pathfindUltimaColetaErro === "login recusado");

/** Conta do Pathfind com a senha aberta (só para o coletor); null sem endereço, usuário ou senha. */
export async function contaPathfind(revendaId: number): Promise<{ base: string; usuario: string; senha: string } | null> {
  const db = await exigirDb();
  const [c] = await db.select({ base: entregasContas.pathfindBase, usuario: entregasContas.pathfindUsuario, senha: entregasContas.pathfindSenha })
    .from(entregasContas).where(eq(entregasContas.revendaId, revendaId));
  if (!c?.base || !c.usuario || !c.senha) return null;
  try {
    return { base: c.base.replace(/\/+$/, ""), usuario: c.usuario, senha: decifrar(c.senha) };
  } catch {
    throw new ColetaError("senha do Pathfind cifrada com outra CHECKNOW_CHAVE — recadastre a conta");
  }
}

export async function salvarConta(c: SalvarConta) {
  const db = await exigirDb();
  const [atual] = await db.select({ id: entregasContas.id, pathfindBase: entregasContas.pathfindBase, pathfindUsuario: entregasContas.pathfindUsuario })
    .from(entregasContas).where(eq(entregasContas.revendaId, c.revendaId));
  const segredos: { checknowSenha?: string; infleetToken?: string | null } = {
    ...(c.checknowSenha ? { checknowSenha: cifrar(c.checknowSenha) } : {}),
    ...(c.infleetToken === null ? { infleetToken: null } : c.infleetToken ? { infleetToken: cifrar(c.infleetToken) } : {}),
  };
  const pathfind = camposPathfind(atual ?? { pathfindBase: null }, c);
  const mudouPathfind = Object.keys(pathfind).length > 0;
  if (atual) {
    // Editar a conta libera de novo a coleta automática parada por login recusado.
    await db.update(entregasContas).set({
      checknowUsuario: c.checknowUsuario, ...segredos, ...pathfind, ultimaColetaOk: null, ultimaColetaErro: null,
      ...(mudouPathfind ? { pathfindUltimaColetaOk: null, pathfindUltimaColetaErro: null } : {}), updatedAt: new Date(),
    }).where(eq(entregasContas.id, atual.id));
  } else {
    if (!c.checknowSenha) throw new ColetaError("informe a senha do CheckNow");
    await db.insert(entregasContas).values({ revendaId: c.revendaId, checknowUsuario: c.checknowUsuario, checknowSenha: cifrar(c.checknowSenha), infleetToken: segredos.infleetToken ?? null, ...pathfind });
  }
}

export async function ativarConta(revendaId: number, ativo: boolean) {
  const db = await exigirDb();
  await db.update(entregasContas).set({ ativo, updatedAt: new Date() }).where(eq(entregasContas.revendaId, revendaId));
}

export async function revendasSemConta() {
  const db = await exigirDb();
  const comConta = (await db.select({ id: entregasContas.revendaId }).from(entregasContas)).map(r => r.id);
  const todas = await db.select({ id: revendas.id, nome: revendas.nome }).from(revendas).orderBy(revendas.nome);
  return todas.filter(r => !comConta.includes(r.id));
}

/** Revendas ativas com conta do Pathfind e sem login recusado pendente. */
export async function contasParaPathfind(): Promise<number[]> {
  const db = await exigirDb();
  const rows = await db.select({ id: entregasContas.revendaId, pathfindBase: entregasContas.pathfindBase,
    pathfindUltimaColetaOk: entregasContas.pathfindUltimaColetaOk, pathfindUltimaColetaErro: entregasContas.pathfindUltimaColetaErro })
    .from(entregasContas).where(eq(entregasContas.ativo, true));
  return rows.filter(deveColetarPathfind).map(r => r.id);
}

/** Revendas ativas (o pernoite usa banco + Infleet: não depende do login do CheckNow). */
export async function contasAtivas(): Promise<number[]> {
  const db = await exigirDb();
  const rows = await db.select({ id: entregasContas.revendaId }).from(entregasContas).where(eq(entregasContas.ativo, true));
  return rows.map(r => r.id);
}

/** Revendas que a coleta automática deve buscar: ativas e sem login recusado pendente. */
export async function contasParaColeta(): Promise<number[]> {
  const db = await exigirDb();
  const rows = await db.select({ id: entregasContas.revendaId, ultimaColetaOk: entregasContas.ultimaColetaOk, ultimaColetaErro: entregasContas.ultimaColetaErro })
    .from(entregasContas).where(eq(entregasContas.ativo, true));
  return rows.filter(deveColetarAuto).map(r => r.id);
}
