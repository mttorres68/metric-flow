const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "localhost") throw new Error(`Recusado: banco não é local (${url.hostname}).`);
const { getDb } = await import("../server/db");
const { revendas, rotasDia } = await import("../drizzle/schema");
const repo = await import("../server/services/produtividadeRota/repo");
const { and, eq, inArray } = await import("drizzle-orm");
const db = (await getDb())!;
const [rev] = await db.select().from(revendas).limit(1);
const confere = (nome: string, ok: boolean, detalhe: unknown) => {
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome}:`, detalhe);
  if (!ok) process.exitCode = 1;
};
const linha = (routeId: string, entregas: number, rotaInicio: string) => ({
  routeId, dia: "2026-01-02", placa: "TST-0001", motorista: "TESTE", saida: null, retorno: null, jornadaMin: 600, rodandoMin: null,
  emClienteMin: null, paradoSemClienteMin: null, idaMin: null, voltaMin: null, entregas, entregasAlmoco: 0, aEntregar: 10, totalRota: 10, hl: 5, hlPorHora: 0.5,
  devPct: null, kmGps: null, semGps: null, parcial: false, incompleto: false, rotaInicio: new Date(rotaInicio), rotaFim: new Date("2026-01-02T18:00:00-03:00"),
});
try {
  await repo.gravarRotasDia(rev.id, [linha("TSTROTA", 3, "2026-01-01T06:00:00-03:00")]);
  await repo.gravarRotasDia(rev.id, [linha("TSTROTA", 8, "2026-01-01T06:00:00-03:00")]); // a tela regravou o dia
  await repo.gravarRotasDia(rev.id, [linha("TSTROTA2", 4, "2025-12-31T06:00:00-03:00")]); // começou antes do período
  const ini = (await repo.rotasIniciadasEm(rev.id, "2026-01-01", "2026-01-31")).filter(r => r.routeId.startsWith("TSTROTA"));
  confere("regravação sem duplicar e só a rota que começou no período", ini.length === 1 && ini[0].routeId === "TSTROTA" && ini[0].entregas === 8, ini.map(r => [r.routeId, r.entregas]));
  const dias = (await repo.diasDoPeriodo(rev.id, "2026-01-02", "2026-01-02")).filter(r => r.routeId.startsWith("TSTROTA"));
  confere("dias do período trazem as duas rotas", dias.length === 2, dias.map(r => r.routeId));
  const ds = await repo.diasDasRotas(rev.id, ["TSTROTA2"]);
  confere("dias de uma rota", ds.length === 1 && ds[0].routeId === "TSTROTA2", ds.map(r => r.routeId));
} finally {
  await db.delete(rotasDia).where(and(eq(rotasDia.revendaId, rev.id), inArray(rotasDia.routeId, ["TSTROTA", "TSTROTA2"])));
  process.exit(process.exitCode ?? 0);
}
