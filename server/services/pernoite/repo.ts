/* MetricFlow — banco dos pernoites (uma noite por revenda + placa + dia). */
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { pernoites } from "../../../drizzle/schema";
import type { Classificacao, Noite } from "./analisar";

export type NoiteGravada = typeof pernoites.$inferSelect & { classificacao: Classificacao };
export interface ResumoMotorista {
  motorista: string; noitesFora: number; naMalicia: number; evitavel: number; comGalo: number; semSinal: number;
  lugares: { cidade: string; noites: number }[];
}

async function exigirDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

export async function gravarNoites(revendaId: number, noites: Noite[]): Promise<void> {
  if (!noites.length) return;
  const db = await exigirDb();
  const colunas = ["motorista", "lat", "lon", "endereco", "cidade", "distSedeKm", "chegada", "saidaManha", "descansoMin",
    "ultimoClienteSaida", "chaveLigadaMin", "madrugadaEventos", "classificacao", "sinais", "galo", "calculadoEm"] as const;
  await db.insert(pernoites).values(noites.map(n => ({ ...n, revendaId, calculadoEm: new Date() }))).onConflictDoUpdate({
    target: [pernoites.revendaId, pernoites.placa, pernoites.dia],
    set: Object.fromEntries(colunas.map(c => [c, sql.raw(`excluded."${c}"`)])),
  });
}

export async function listarNoites(revendaId: number, de: string, ate: string): Promise<NoiteGravada[]> {
  const db = await exigirDb();
  return db.select().from(pernoites)
    .where(and(eq(pernoites.revendaId, revendaId), gte(pernoites.dia, de), lte(pernoites.dia, ate)))
    .orderBy(desc(pernoites.dia), asc(pernoites.placa)) as Promise<NoiteGravada[]>;
}

/** Contagens por motorista e as 3 cidades onde mais dormiu fora da Sede. */
export function resumir(noites: Pick<NoiteGravada, "motorista" | "classificacao" | "galo" | "cidade">[]): ResumoMotorista[] {
  const m = new Map<string, ResumoMotorista & { cidades: Map<string, number> }>();
  for (const n of noites) {
    // Todo motorista com noite no período aparece; na Sede e rodando às 02h não contam como noite fora.
    const r = m.get(n.motorista) ?? { motorista: n.motorista, noitesFora: 0, naMalicia: 0, evitavel: 0, comGalo: 0, semSinal: 0, lugares: [], cidades: new Map() };
    m.set(n.motorista, r);
    if (n.classificacao === "na_base" || n.classificacao === "sem_parada") continue;
    if (n.classificacao === "sem_sinal") { r.semSinal++; continue; }
    r.noitesFora++;
    if (n.classificacao === "na_malicia") r.naMalicia++;
    if (n.classificacao === "evitavel") r.evitavel++;
    if (n.galo >= 2) r.comGalo++;
    const c = n.cidade || "?";
    r.cidades.set(c, (r.cidades.get(c) ?? 0) + 1);
  }
  return [...m.values()]
    .map(({ cidades, ...r }) => ({ ...r, lugares: [...cidades].map(([cidade, noites]) => ({ cidade, noites })).sort((a, b) => b.noites - a.noites).slice(0, 3) }))
    .sort((a, b) => b.naMalicia - a.naMalicia || b.evitavel - a.evitavel || b.semSinal - a.semSinal || b.noitesFora - a.noitesFora);
}

export const resumoPorMotorista = async (revendaId: number, de: string, ate: string) => resumir(await listarNoites(revendaId, de, ate));
