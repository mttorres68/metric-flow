const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "localhost") throw new Error(`Recusado: banco não é local (${url.hostname}).`);
const { getDb } = await import("../server/db");
const { revendas, erpPedidos, entregasEvidencias, desvioRevisoes } = await import("../drizzle/schema");
const erpRepo = await import("../server/services/erp/repo");
const repo = await import("../server/services/desvio/repo");
const { and, eq } = await import("drizzle-orm");
const db = (await getDb())!;
const [rev] = await db.select().from(revendas).limit(1);
const confere = (nome: string, ok: boolean, detalhe: unknown) => {
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome}:`, detalhe);
  if (!ok) process.exitCode = 1;
};
const pedido = (situacao: "aberto" | "acertado", dataAcerto: string | null) => ({
  pedido: "TSTDSV1", romaneio: "TSTR1", cliente: "1", vendedor: "", canal: "", origem: "G", placa: "TST0001", motoristaCod: "1",
  dataPedido: "2026-01-01", tipoCobranca: "1", condicaoPagamento: "14", banco: "000", vencimento1: null,
  situacao, dataAcerto, flagRomaneio: "N", valor: 100, valorRetorno: 0, itens: 1, produtos: 1,
});
const evidencia = (distParadaM: number) => ({
  dia: "2026-01-01", routeId: "TSTDSV", codCliente: "1", placa: "TST-0001", motorista: "TESTE", documentos: ["TSTDSV1"], status: "relampago",
  distParadaM, paradaLat: null, paradaLon: null, paradaInicio: null, paradaFim: null, distAppM: null, clienteLat: null, clienteLon: null,
});
try {
  await erpRepo.gravarCabecalhos(rev.id, [pedido("aberto", null)]);
  await erpRepo.gravarCabecalhos(rev.id, [pedido("acertado", "2026-01-03")]); // planilha nova com o acerto
  const ps = (await repo.carregarPedidos(rev.id, "2026-01-01")).filter(p => p.pedido === "TSTDSV1");
  confere("pedido regravado vira acertado", ps.length === 1 && ps[0].situacao === "acertado" && ps[0].dataAcerto === "2026-01-03", ps.map(p => [p.situacao, p.dataAcerto]));
  await repo.gravarEvidencias(rev.id, [evidencia(500)]);
  await repo.gravarEvidencias(rev.id, [evidencia(800)]);
  const evs = (await repo.carregarEvidencias(rev.id, "2026-01-01")).filter(e => e.documentos.includes("TSTDSV1"));
  confere("evidência sem duplicar", evs.length === 1 && evs[0].distParadaM === 800, evs.map(e => e.distParadaM));
  await repo.revisar(rev.id, "TSTDSV1", "suspeito", "a");
  await repo.revisar(rev.id, "TSTDSV1", "ok", "b");
  const r = (await repo.revisoes(rev.id)).get("TSTDSV1");
  confere("revisão sem duplicar", r?.situacao === "ok" && r.observacao === "b", r);
  confere("versão", (await repo.versao(rev.id)).split("|").length === 3, await repo.versao(rev.id));
} finally {
  await db.delete(erpPedidos).where(and(eq(erpPedidos.revendaId, rev.id), eq(erpPedidos.pedido, "TSTDSV1")));
  await db.delete(entregasEvidencias).where(and(eq(entregasEvidencias.revendaId, rev.id), eq(entregasEvidencias.routeId, "TSTDSV")));
  await db.delete(desvioRevisoes).where(and(eq(desvioRevisoes.revendaId, rev.id), eq(desvioRevisoes.pedido, "TSTDSV1")));
  process.exit(process.exitCode ?? 0);
}
