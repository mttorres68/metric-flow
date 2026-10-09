const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "localhost") throw new Error(`Recusado: banco não é local (${url.hostname}).`);
const { getDb } = await import("../server/db");
const { revendas, erpPedidoItens, produtos } = await import("../drizzle/schema");
const repo = await import("../server/services/erp/repo");
const { eq, like } = await import("drizzle-orm");
const db = (await getDb())!;
const [rev] = await db.select().from(revendas).limit(1);
const item = (pedido: string, n: number, liqCx: number) => ({ pedido, item: n, romaneio: "", cliente: "1", placa: "", motoristaCod: "", dataPedido: "2026-01-01",
  codProduto: "TST0000001", qtdCx: liqCx, qtdUn: 0, retCx: 0, retUn: 0, liqCx, liqUn: 0, motivoDev: null, valor: 0, cancelado: false });
try {
  await repo.salvarProdutos([{ codigo: "TST0000001", descricao: "TESTE", familia: "", categoria: "", marca: "", embalagem: "CX", tipo: "descartavel", unPorEmb: 24, litrosEmb: 14.4, litrosUn: 0.6, ativo: true }]);
  await repo.gravarPedidos(rev.id, [item("TSTERP1", 1, 10), item("TSTERP1", 2, 5), item("TSTERP2", 1, 1)]);
  await repo.gravarPedidos(rev.id, [item("TSTERP1", 1, 3)]); // reenvio do pedido 1 com 1 item só
  const it = await repo.itensDosDocumentos(rev.id, ["TSTERP1", "TSTERP2"]);
  console.log("esperado TSTERP1/1=3 e TSTERP2/1=1:", it.map(i => `${i.pedido}/${i.item}=${i.liqCx}`).sort(), "| com produto:", it.every(i => i.produto?.litrosEmb === 14.4));
  console.log("sem cadastro:", await repo.codigosSemCadastro(["TST0000001", "TST0000002"]));
} finally {
  await db.delete(erpPedidoItens).where(like(erpPedidoItens.pedido, "TSTERP%"));
  await db.delete(produtos).where(eq(produtos.codigo, "TST0000001"));
  process.exit(0);
}
