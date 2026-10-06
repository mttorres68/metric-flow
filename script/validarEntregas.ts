/*
 * Validação do relatório de entregas com dados reais (spec §9).
 * Cruza o status do GPS com a distância da baixa informada pelo próprio CheckNow.
 * Uso (a partir da worktree):
 *   pnpm tsx --env-file=../../../.env script/validarEntregas.ts <planilha.xlsx>
 */
import fs from "fs";
import * as XLSX from "xlsx";
import { parseCheckNow } from "../server/services/entregas/parseCheckNow";
import { montarLinhas, agruparPorRota, cruzar, diaBRT, horaBRT } from "../server/services/entregas/cruzar";
import { mapaVeiculos, buscarGpsLinha, gpsErro, normalizarPlaca } from "../server/services/entregas/infleetEntregas";

const buf = fs.readFileSync(process.argv[2]);
const entregas = parseCheckNow(buf);

const wb = XLSX.read(buf, { type: "buffer" });
const distBaixa = new Map<string, number>();
for (const r of XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null })) {
  const chave = `${String(r["RouteId"]).trim()}|${String(r["Código do Cliente"]).trim()}`;
  if (!distBaixa.has(chave)) distBaixa.set(chave, Number(r["Distância do Ponto (MT)"] ?? 0));
}
const faixa = (m: number) => (m <= 300 ? "baixa ≤300m" : m <= 500 ? "baixa 300–500m" : "baixa >500m");

const veiculos = await mapaVeiculos();
const porRota = agruparPorRota(entregas);
const tabela: Record<string, Record<string, number>> = {};

for (const l of montarLinhas(entregas, new Date())) {
  const vId = veiculos.get(normalizarPlaca(l.placa));
  const es = porRota.get(l.routeId)!;
  const r = cruzar(l, es, vId ? await buscarGpsLinha(vId, l.janela) : gpsErro("sem rastreador"));
  console.log(
    l.data, l.placa.padEnd(9), l.motorista.padEnd(22),
    r.semGps ? `SEM GPS: ${r.semGps}` :
      `saída ${r.saida ? horaBRT(r.saida) : "—"} | no raio ${r.noRaio}/${r.baixasComCoord} | sem parada ${r.semParada} | relâmpago ${r.relampago} | s/ cliente ${r.paradasSemCliente.qtd} | km ${r.kmGps}`,
  );
  if (r.semGps) continue;
  for (const e of es.filter(x => x.situacao !== "AGUARDANDO" && x.baixaEm && diaBRT(x.baixaEm) === l.data)) {
    const status = r.excecoes.find(x => x.entrega === e)?.status ?? "no_raio";
    const f = faixa(distBaixa.get(`${e.routeId}|${e.codCliente}`) ?? 0);
    tabela[f] ??= {};
    tabela[f][status] = (tabela[f][status] ?? 0) + 1;
  }
}

console.log("\nDistância da baixa (CheckNow) × status pelo GPS:");
console.table(tabela);
