/* MetricFlow — banco do detector de desvio: pedidos do ERP, evidências de GPS, noites sem sinal, rotas e revisões. */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { desvioRevisoes, entregasEvidencias, erpPedidos, pernoites } from "../../../drizzle/schema";
import type { PedidoErp, SituacaoPedido } from "../erp/parsePedidosErp";
import type { Evidencia, RotaPedido } from "./analisar";
import type { EvidenciaNova } from "./evidencias";

export interface Revisao { situacao: "ok" | "suspeito" | "investigando"; observacao: string; revisadoEm: Date }

async function exigirDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}
const lotes = <T>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function gravarEvidencias(revendaId: number, evs: EvidenciaNova[]): Promise<void> {
  if (!evs.length) return;
  const db = await exigirDb();
  const colunas = ["placa", "motorista", "documentos", "status", "distParadaM", "paradaLat", "paradaLon", "paradaInicio", "paradaFim",
    "distAppM", "clienteLat", "clienteLon", "calculadoEm"];
  // A mesma entrega pode vir duas vezes no lote (rota de vários dias cruzada em duas linhas): fica a última.
  const unicas = [...new Map(evs.map(e => [`${e.routeId}|${e.codCliente}|${e.dia}`, e])).values()];
  for (const lote of lotes(unicas)) {
    await db.insert(entregasEvidencias).values(lote.map(e => ({ ...e, revendaId, calculadoEm: new Date() }))).onConflictDoUpdate({
      target: [entregasEvidencias.revendaId, entregasEvidencias.routeId, entregasEvidencias.codCliente, entregasEvidencias.dia],
      set: Object.fromEntries(colunas.map(c => [c, sql.raw(`excluded."${c}"`)])),
    });
  }
}

export async function carregarPedidos(revendaId: number, desde: string): Promise<PedidoErp[]> {
  const db = await exigirDb();
  const rows = await db.select().from(erpPedidos).where(and(eq(erpPedidos.revendaId, revendaId), gte(erpPedidos.dataPedido, desde)));
  return rows.map(({ id, revendaId: _r, atualizadoEm, ...p }) => ({ ...p, situacao: p.situacao as SituacaoPedido }));
}

export async function carregarEvidencias(revendaId: number, desde: string): Promise<Evidencia[]> {
  const db = await exigirDb();
  const rows = await db.select().from(entregasEvidencias).where(and(eq(entregasEvidencias.revendaId, revendaId), gte(entregasEvidencias.dia, desde)));
  return rows.map(({ id, revendaId: _r, routeId, codCliente, calculadoEm, ...e }) => e);
}

export async function noitesSemSinal(revendaId: number, desde: string): Promise<{ placa: string; dia: string }[]> {
  const db = await exigirDb();
  return db.select({ placa: pernoites.placa, dia: pernoites.dia }).from(pernoites)
    .where(and(eq(pernoites.revendaId, revendaId), eq(pernoites.classificacao, "sem_sinal"), gte(pernoites.dia, desde)));
}

/** Pedido (Documento do CheckNow) → rota mais recente em que ele aparece. */
export async function rotasDosPedidos(revendaId: number, desde: string): Promise<Map<string, RotaPedido>> {
  const db = await exigirDb();
  const { rows } = await db.$client.query<{ doc: string; rotaInicio: Date; motorista: string; placa: string }>(
    `select distinct on (doc) doc, "rotaInicio", motorista, placa
       from checknow_entregas, unnest(documentos) doc
      where "revendaId" = $1 and dia >= $2
      order by doc, "rotaInicio" desc`, [revendaId, desde]);
  return new Map(rows.map(r => [r.doc, { inicio: r.rotaInicio, motorista: r.motorista, placa: r.placa }]));
}

/** Muda quando chega planilha do ERP, evidência nova ou noite recalculada (chave do cache do serviço). */
export async function versao(revendaId: number): Promise<string> {
  const db = await exigirDb();
  const { rows } = await db.$client.query<{ p: Date | null; e: Date | null; n: Date | null }>(
    `select (select max("atualizadoEm") from erp_pedidos where "revendaId" = $1) p,
            (select max("calculadoEm") from entregas_evidencias where "revendaId" = $1) e,
            (select max("calculadoEm") from pernoites where "revendaId" = $1) n`, [revendaId]);
  const r = rows[0];
  return [r?.p, r?.e, r?.n].map(d => (d ? new Date(d).toISOString() : "-")).join("|");
}

export async function revisoes(revendaId: number): Promise<Map<string, Revisao>> {
  const db = await exigirDb();
  const rows = await db.select().from(desvioRevisoes).where(eq(desvioRevisoes.revendaId, revendaId));
  return new Map(rows.map(r => [r.pedido, { situacao: r.situacao as Revisao["situacao"], observacao: r.observacao, revisadoEm: r.revisadoEm }]));
}

export async function revisar(revendaId: number, pedido: string, situacao: Revisao["situacao"], observacao: string): Promise<void> {
  const db = await exigirDb();
  await db.insert(desvioRevisoes).values({ revendaId, pedido, situacao, observacao, revisadoEm: new Date() }).onConflictDoUpdate({
    target: [desvioRevisoes.revendaId, desvioRevisoes.pedido],
    set: { situacao, observacao, revisadoEm: new Date() },
  });
}
