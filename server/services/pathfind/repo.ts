/* MetricFlow — banco do Pathfind: rotas planejadas e paradas com hora prevista (spec pathfind-previsto §4). */
import { and, asc, between, eq, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { entregasContas, pathfindParadas, pathfindRotas } from "../../../drizzle/schema";
import type { SimulacaoBaixada } from "./coletor";
import type { ParadaPf } from "./ler";

export interface RotaGravada { dataSimulacao: string; simulacao: string; rota: string; placa: string; motorista: string; paradas: ParadaPf[] }

async function exigirDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

/** Grava a simulação: rotas por upsert; as paradas de cada rota são trocadas inteiras (na mesma transação). */
export async function gravarSimulacao(revendaId: number, dia: string, s: SimulacaoBaixada): Promise<void> {
  const db = await exigirDb();
  await db.transaction(async tx => {
    // Rota que sumiu da simulação (ou trocou de código) na recoleta sai junto com as paradas (cascade).
    await tx.delete(pathfindRotas).where(and(eq(pathfindRotas.revendaId, revendaId), eq(pathfindRotas.simulacao, s.simulacao),
      s.rotas.length ? notInArray(pathfindRotas.rota, s.rotas.map(r => r.rota)) : undefined));
    for (const r of s.rotas) {
      const dados = { dataSimulacao: dia, placa: r.placa, motorista: r.motorista, tempoMin: r.tempoMin, km: r.km, coletadoEm: new Date() };
      const [{ id }] = await tx.insert(pathfindRotas).values({ revendaId, simulacao: s.simulacao, rota: r.rota, ...dados })
        .onConflictDoUpdate({ target: [pathfindRotas.revendaId, pathfindRotas.simulacao, pathfindRotas.rota], set: dados })
        .returning({ id: pathfindRotas.id });
      await tx.delete(pathfindParadas).where(eq(pathfindParadas.rotaId, id));
      if (r.paradas.length) await tx.insert(pathfindParadas).values(r.paradas.map(p => ({
        rotaId: id, sequencia: p.sequencia, pedido: p.pedido, codCliente: p.codCliente, cliente: p.cliente, cidade: p.cidade,
        chegadaPrevista: p.chegada, saidaPrevista: p.saida, km: p.km,
      }))).onConflictDoNothing();
    }
  });
}

/** Rotas com simulação no período, com as paradas na ordem da sequência. */
export async function rotasPathfind(revendaId: number, de: string, ate: string): Promise<RotaGravada[]> {
  const db = await exigirDb();
  const rotas = await db.select().from(pathfindRotas)
    .where(and(eq(pathfindRotas.revendaId, revendaId), between(pathfindRotas.dataSimulacao, de, ate)));
  if (!rotas.length) return [];
  const paradas = await db.select().from(pathfindParadas).where(inArray(pathfindParadas.rotaId, rotas.map(r => r.id))).orderBy(asc(pathfindParadas.sequencia));
  return rotas.map(r => ({
    dataSimulacao: r.dataSimulacao, simulacao: r.simulacao, rota: r.rota, placa: r.placa, motorista: r.motorista,
    paradas: paradas.filter(p => p.rotaId === r.id).map(p => ({
      sequencia: p.sequencia, pedido: p.pedido, codCliente: p.codCliente, cliente: p.cliente, cidade: p.cidade,
      chegada: p.chegadaPrevista, saida: p.saidaPrevista, km: p.km,
    })),
  }));
}

export async function marcarColeta(revendaId: number, ok: boolean, erro: string | null): Promise<void> {
  const db = await exigirDb();
  await db.update(entregasContas).set({ pathfindUltimaColetaEm: sql`now()`, pathfindUltimaColetaOk: ok, pathfindUltimaColetaErro: erro })
    .where(eq(entregasContas.revendaId, revendaId));
}
