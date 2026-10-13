/* MetricFlow — banco da produtividade da rota: uma linha por revenda + rota + dia (spec rota-produtividade §3). */
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { rotasDia } from "../../../drizzle/schema";
import type { RotaDia } from "./rotaDia";

async function exigirDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}
const lotes = <T>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const proximoDia = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const paraRotaDia = ({ id, revendaId, calculadoEm, ...r }: typeof rotasDia.$inferSelect): RotaDia => r;

export async function gravarRotasDia(revendaId: number, rs: RotaDia[]): Promise<void> {
  if (!rs.length) return;
  const db = await exigirDb();
  const colunas = [...Object.keys(rs[0]).filter(c => c !== "routeId" && c !== "dia"), "calculadoEm"];
  const unicas = [...new Map(rs.map(r => [`${r.routeId}|${r.dia}`, r])).values()];
  for (const lote of lotes(unicas)) {
    await db.insert(rotasDia).values(lote.map(r => ({ ...r, revendaId, calculadoEm: new Date() }))).onConflictDoUpdate({
      target: [rotasDia.revendaId, rotasDia.routeId, rotasDia.dia],
      set: Object.fromEntries(colunas.map(c => [c, sql.raw(`excluded."${c}"`)])),
    });
  }
}

/** Todos os dias das rotas que começaram no período (BRT). */
export async function rotasIniciadasEm(revendaId: number, de: string, ate: string): Promise<RotaDia[]> {
  const db = await exigirDb();
  const ids = db.select({ routeId: rotasDia.routeId }).from(rotasDia).where(and(eq(rotasDia.revendaId, revendaId),
    gte(rotasDia.rotaInicio, new Date(`${de}T00:00:00-03:00`)), sql`${rotasDia.rotaInicio} < ${new Date(`${proximoDia(ate)}T00:00:00-03:00`)}`));
  const rows = await db.select().from(rotasDia).where(and(eq(rotasDia.revendaId, revendaId), inArray(rotasDia.routeId, ids)));
  return rows.map(paraRotaDia);
}

export async function diasDoPeriodo(revendaId: number, de: string, ate: string): Promise<RotaDia[]> {
  const db = await exigirDb();
  const rows = await db.select().from(rotasDia).where(and(eq(rotasDia.revendaId, revendaId), gte(rotasDia.dia, de), lte(rotasDia.dia, ate)));
  return rows.map(paraRotaDia);
}

export async function diasDasRotas(revendaId: number, routeIds: string[]): Promise<RotaDia[]> {
  if (!routeIds.length) return [];
  const db = await exigirDb();
  const rows = await db.select().from(rotasDia).where(and(eq(rotasDia.revendaId, revendaId), inArray(rotasDia.routeId, routeIds)));
  return rows.map(paraRotaDia);
}
