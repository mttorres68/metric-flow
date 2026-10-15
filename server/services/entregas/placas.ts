/* MetricFlow — placas únicas de cada fonte (pedidos do ERP, CheckNow, Infleet), alinhadas por placa. */
import { and, between, eq, ne } from "drizzle-orm";
import { getDb } from "../../db";
import { checknowEntregas, erpPedidos } from "../../../drizzle/schema";
import { normalizarPlaca } from "./infleetEntregas";

export type Fonte = "pedidos" | "checknow" | "infleet";
export type LinhaPlaca = { chave: string } & Record<Fonte, string | null>;

/** Uma linha por placa (normalizada), com a grafia de cada fonte ou null quando ela não tem a placa. */
export function alinharPlacas(fontes: Record<Fonte, string[]>): LinhaPlaca[] {
  const linhas = new Map<string, LinhaPlaca>();
  for (const fonte of ["pedidos", "checknow", "infleet"] as Fonte[]) {
    for (const placa of fontes[fonte]) {
      const chave = normalizarPlaca(placa);
      if (!chave) continue;
      const l = linhas.get(chave) ?? { chave, pedidos: null, checknow: null, infleet: null };
      l[fonte] ??= placa;
      linhas.set(chave, l);
    }
  }
  return [...linhas.values()].sort((a, b) => a.chave.localeCompare(b.chave));
}

/** Placas distintas dos pedidos (data do pedido) e do CheckNow (dia da entrega) no período. */
export async function placasDoPeriodo(revendaId: number, de: string, ate: string): Promise<Pick<Record<Fonte, string[]>, "pedidos" | "checknow">> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [pedidos, checknow] = await Promise.all([
    db.selectDistinct({ placa: erpPedidos.placa }).from(erpPedidos)
      .where(and(eq(erpPedidos.revendaId, revendaId), between(erpPedidos.dataPedido, de, ate), ne(erpPedidos.placa, ""))),
    db.selectDistinct({ placa: checknowEntregas.placa }).from(checknowEntregas)
      .where(and(eq(checknowEntregas.revendaId, revendaId), between(checknowEntregas.dia, de, ate))),
  ]);
  return { pedidos: pedidos.map(p => p.placa), checknow: checknow.map(p => p.placa) };
}
