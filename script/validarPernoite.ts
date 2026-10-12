const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "localhost") throw new Error(`Recusado: banco não é local (${url.hostname}).`);
const { getDb } = await import("../server/db");
const { revendas, pernoites } = await import("../drizzle/schema");
const repo = await import("../server/services/pernoite/repo");
const { and, eq } = await import("drizzle-orm");
const db = (await getDb())!;
const [rev] = await db.select().from(revendas).limit(1);
const NAO = { ok: false };
const noite = (galo: number) => ({
  dia: "2026-01-01", placa: "TST-0001", motorista: "TESTE", lat: -6.9, lon: -43, endereco: null, cidade: "TESTE", distSedeKm: 50,
  chegada: new Date(), saidaManha: new Date(), descansoMin: 600, ultimoClienteSaida: null, chaveLigadaMin: null, madrugadaEventos: 0,
  classificacao: "evitavel" as const, galo,
  sinais: { foraDaSede: NAO, perto: NAO, davaParaChegar: NAO, voltou: NAO, finalLento: NAO, parouCedo: NAO, ociosidade: NAO, paraTras: NAO },
});
try {
  await repo.gravarNoites(rev.id, [noite(1)]);
  await repo.gravarNoites(rev.id, [noite(3)]); // recálculo da mesma noite
  const ns = (await repo.listarNoites(rev.id, "2026-01-01", "2026-01-01")).filter(n => n.placa === "TST-0001");
  console.log("esperado 1 linha com galo 3:", ns.length, ns[0]?.galo);
} finally {
  await db.delete(pernoites).where(and(eq(pernoites.revendaId, rev.id), eq(pernoites.placa, "TST-0001")));
  process.exit(0);
}
