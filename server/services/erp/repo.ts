/* MetricFlow — banco do ERP: cadastro de produtos (global), itens dos pedidos (por revenda) e pontos do "4 semanas". */
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { erpPedidoItens, produtividadeParadas, produtos } from "../../../drizzle/schema";
import type { Produto } from "./parseProdutos";
import type { ItemPedido } from "./parsePedidosErp";

export type ItemComProduto = ItemPedido & { produto: Pick<Produto, "litrosEmb" | "litrosUn" | "tipo" | "descricao"> | null };
export interface PontoProdutividade { dia: string; placa: string; motorista: string; routeId: string; codCliente: string; hl: number; minDescarga: number }

async function exigirDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}
const lotes = <T>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function salvarProdutos(ps: Produto[]): Promise<number> {
  const db = await exigirDb();
  const unicos = [...new Map(ps.map(p => [p.codigo, p])).values()];
  for (const lote of lotes(unicos)) {
    await db.insert(produtos).values(lote.map(p => ({ ...p, atualizadoEm: new Date() }))).onConflictDoUpdate({
      target: produtos.codigo,
      set: {
        descricao: sql`excluded."descricao"`, familia: sql`excluded."familia"`, categoria: sql`excluded."categoria"`,
        marca: sql`excluded."marca"`, embalagem: sql`excluded."embalagem"`, tipo: sql`excluded."tipo"`,
        unPorEmb: sql`excluded."unPorEmb"`, litrosEmb: sql`excluded."litrosEmb"`, litrosUn: sql`excluded."litrosUn"`,
        ativo: sql`excluded."ativo"`, atualizadoEm: sql`excluded."atualizadoEm"`,
      },
    });
  }
  return unicos.length;
}

/** Troca, numa transação, todos os itens dos pedidos presentes no arquivo; os outros pedidos ficam. */
export async function gravarPedidos(revendaId: number, itens: ItemPedido[]): Promise<{ pedidos: number; itens: number }> {
  const unicos = [...new Map(itens.map(i => [`${i.pedido}|${i.item}`, i])).values()];
  const pedidos = [...new Set(unicos.map(i => i.pedido))];
  const db = await exigirDb();
  await db.transaction(async tx => {
    for (const lote of lotes(pedidos)) await tx.delete(erpPedidoItens).where(and(eq(erpPedidoItens.revendaId, revendaId), inArray(erpPedidoItens.pedido, lote)));
    for (const lote of lotes(unicos)) await tx.insert(erpPedidoItens).values(lote.map(i => ({ ...i, revendaId })));
  });
  return { pedidos: pedidos.length, itens: unicos.length };
}

export async function codigosSemCadastro(codigos: string[]): Promise<string[]> {
  const unicos = [...new Set(codigos)];
  if (!unicos.length) return [];
  const db = await exigirDb();
  const achados = new Set((await db.select({ c: produtos.codigo }).from(produtos).where(inArray(produtos.codigo, unicos))).map(r => r.c));
  return unicos.filter(c => !achados.has(c)).sort();
}

export async function itensDosDocumentos(revendaId: number, docs: string[]): Promise<ItemComProduto[]> {
  const unicos = [...new Set(docs)];
  if (!unicos.length) return [];
  const db = await exigirDb();
  const rows = await db.select({ i: erpPedidoItens, p: produtos }).from(erpPedidoItens)
    .leftJoin(produtos, eq(produtos.codigo, erpPedidoItens.codProduto))
    .where(and(eq(erpPedidoItens.revendaId, revendaId), inArray(erpPedidoItens.pedido, unicos)));
  return rows.map(({ i, p }) => {
    const { id, revendaId: _r, importadoEm, ...item } = i;
    return { ...item, produto: p ? { litrosEmb: p.litrosEmb, litrosUn: p.litrosUn, tipo: p.tipo as Produto["tipo"], descricao: p.descricao } : null };
  });
}

export async function gravarPontos(revendaId: number, pontos: PontoProdutividade[]) {
  if (!pontos.length) return;
  const db = await exigirDb();
  await db.insert(produtividadeParadas).values(pontos.map(p => ({ ...p, revendaId }))).onConflictDoUpdate({
    target: [produtividadeParadas.revendaId, produtividadeParadas.routeId, produtividadeParadas.codCliente, produtividadeParadas.dia],
    set: { hl: sql`excluded."hl"`, minDescarga: sql`excluded."minDescarga"`, placa: sql`excluded."placa"`, motorista: sql`excluded."motorista"` },
  });
}

export async function pontosDoMotorista(revendaId: number, motorista: string, desde: string, ate: string) {
  const db = await exigirDb();
  return db.select({ hl: produtividadeParadas.hl, minDescarga: produtividadeParadas.minDescarga, dia: produtividadeParadas.dia })
    .from(produtividadeParadas)
    .where(and(eq(produtividadeParadas.revendaId, revendaId), eq(produtividadeParadas.motorista, motorista),
      gte(produtividadeParadas.dia, desde), lte(produtividadeParadas.dia, ate)));
}
