/*
 * MetricFlow — acesso ao banco da coleta do CheckNow (spec checknow-coleta §4–5).
 * Contas (segredos cifrados), entregas por revenda, registro de coletas e trava por revenda.
 */
import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type { Pool } from "pg";
import { getDb } from "../../db";
import { checknowColetas, checknowEntregas, entregasContas, revendas } from "../../../drizzle/schema";
import type { Entrega, Situacao } from "../entregas/parseCheckNow";
import { diaBRT } from "@shared/entregas";
import { cifrar, decifrar } from "./cofre";

export class ColetaError extends Error {}
export type Origem = "auto" | "botao" | "upload";
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

export async function entregasDoPeriodo(revendaId: number, de: string, ate: string): Promise<Entrega[]> {
  const db = await exigirDb();
  const rows = await db.select().from(checknowEntregas)
    .where(and(eq(checknowEntregas.revendaId, revendaId), gte(checknowEntregas.dia, de), lte(checknowEntregas.dia, ate)));
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
    .where(and(eq(checknowColetas.revendaId, revendaId), inArray(checknowColetas.status, ["ok", "sem_dados"]), ne(checknowColetas.origem, "upload")))
    .orderBy(desc(checknowColetas.periodoAte)).limit(1);
  return r?.ate ?? null;
}

export async function contaComSegredos(revendaId: number) {
  const db = await exigirDb();
  const [c] = await db.select().from(entregasContas).where(eq(entregasContas.revendaId, revendaId));
  if (!c) return null;
  return { revendaId, ativo: c.ativo, usuario: c.checknowUsuario, senha: decifrar(c.checknowSenha), infleetToken: c.infleetToken ? decifrar(c.infleetToken) : null };
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
  }));
}

export interface SalvarConta {
  revendaId: number; checknowUsuario: string;
  checknowSenha?: string;          // vazio/ausente = mantém (obrigatória ao criar)
  infleetToken?: string | null;    // ausente = mantém; null = remove (usa o .env)
}

export async function salvarConta(c: SalvarConta) {
  const db = await exigirDb();
  const [atual] = await db.select({ id: entregasContas.id }).from(entregasContas).where(eq(entregasContas.revendaId, c.revendaId));
  const segredos: { checknowSenha?: string; infleetToken?: string | null } = {
    ...(c.checknowSenha ? { checknowSenha: cifrar(c.checknowSenha) } : {}),
    ...(c.infleetToken === null ? { infleetToken: null } : c.infleetToken ? { infleetToken: cifrar(c.infleetToken) } : {}),
  };
  if (atual) {
    await db.update(entregasContas).set({ checknowUsuario: c.checknowUsuario, ...segredos, updatedAt: new Date() }).where(eq(entregasContas.id, atual.id));
  } else {
    if (!c.checknowSenha) throw new ColetaError("informe a senha do CheckNow");
    await db.insert(entregasContas).values({ revendaId: c.revendaId, checknowUsuario: c.checknowUsuario, checknowSenha: cifrar(c.checknowSenha), infleetToken: segredos.infleetToken ?? null });
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

export async function contasAtivas(): Promise<number[]> {
  const db = await exigirDb();
  return (await db.select({ id: entregasContas.revendaId }).from(entregasContas).where(eq(entregasContas.ativo, true))).map(r => r.id);
}
