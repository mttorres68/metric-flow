/*
 * Valida o repositório da coleta do CheckNow contra o banco LOCAL (recusa outro host).
 * Uso: pnpm tsx --env-file=../../../.env script/validarRepoCheckNow.ts
 * Grava rotas de teste (placa TST-0001) e apaga no fim.
 */
import { randomBytes } from "crypto";

const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "localhost") throw new Error(`Recusado: banco não é local (${url.hostname}).`);
process.env.CHECKNOW_CHAVE ??= randomBytes(32).toString("base64");
const { getDb } = await import("../server/db");
const { revendas, checknowEntregas } = await import("../drizzle/schema");
const repo = await import("../server/services/checknow/repo");
const { eq } = await import("drizzle-orm");

const db = (await getDb())!;
const [rev] = await db.select().from(revendas).limit(1);
const base = {
  placa: "TST-0001", motorista: "TESTE", cliente: "C", lat: -7, lon: -43, latApp: null, lonApp: null, documentos: [], situacao: "ENTREGUE" as const, baixaEm: null, saidaApp: null,
  rotaFim: null, odoIniInformado: null, odoFimInformado: null, ordemPlanejada: null, valor: 0, pesoKg: 0, notas: 1, motivoProblema: null, capacidadeKg: null, cidade: "",
};
const ini = new Date("2026-01-01T10:00:00-03:00");
try {
  await repo.gravarEntregas(rev.id, [
    { ...base, routeId: "T1", codCliente: "1", rotaInicio: ini },
    { ...base, routeId: "T2", codCliente: "1", rotaInicio: ini },
  ]);
  // Arquivo com a rota T1 parcial (só o cliente 2): atualiza o 2 e NÃO apaga o 1 (o CheckNow manda rota parcial).
  await repo.gravarEntregas(rev.id, [{ ...base, routeId: "T1", codCliente: "2", rotaInicio: ini, cidade: "NOVA" }]);
  const lidas = await repo.entregasDoPeriodo(rev.id, "2026-01-01", "2026-01-01");
  console.log("esperado T1/1, T1/2 e T2/1:", lidas.map(e => `${e.routeId}/${e.codCliente}`).sort(), "| T1/2 atualizado:", lidas.find(e => e.routeId === "T1" && e.codCliente === "2")?.cidade === "NOVA");
  console.log("rotaInicio volta igual:", lidas[0].rotaInicio!.getTime() === ini.getTime());
  console.log("gravar vazio não apaga:", await repo.gravarEntregas(rev.id, []), (await repo.entregasDoPeriodo(rev.id, "2026-01-01", "2026-01-01")).length === 3);
  // Rota que começou antes do período e continua aberta entra; a que fechou antes do período não.
  await repo.gravarEntregas(rev.id, [
    { ...base, routeId: "T3", codCliente: "1", rotaInicio: new Date("2025-12-30T10:00:00-03:00"), rotaFim: null },
    { ...base, routeId: "T4", codCliente: "1", rotaInicio: new Date("2025-12-30T10:00:00-03:00"), rotaFim: new Date("2025-12-31T18:00:00-03:00") },
  ]);
  console.log("esperado T1/1, T1/2, T2/1 e T3/1:", (await repo.entregasDoPeriodo(rev.id, "2026-01-01", "2026-01-01")).map(e => `${e.routeId}/${e.codCliente}`).sort());
  await repo.comTrava(rev.id, async () => {
    await repo.comTrava(rev.id, async () => null).then(() => console.log("ERRO: trava não segurou"), e => console.log("trava ocupada:", e.message));
  });
} finally {
  await db.delete(checknowEntregas).where(eq(checknowEntregas.placa, "TST-0001"));
  process.exit(0);
}
