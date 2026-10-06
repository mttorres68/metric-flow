/*
 * MetricFlow — pipeline do relatório de entregas: planilha → linhas → GPS → cruzamento.
 * Usado pela tela (tRPC entregas.processar) e pelo download do PDF (REST).
 * Lança PlanilhaInvalidaError (parseCheckNow); devolve [] quando nenhuma rota foi iniciada.
 */
import { parseCheckNow } from "./parseCheckNow";
import { montarLinhas, agruparPorRota, cruzar, type ResultadoLinha } from "./cruzar";
import { mapaVeiculos, buscarGpsLinha, gpsErro, normalizarPlaca } from "./infleetEntregas";

/** Executa fn sobre itens com no máximo n chamadas simultâneas, preservando a ordem. */
async function emParalelo<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (proximo < itens.length) {
      const k = proximo++;
      out[k] = await fn(itens[k]);
    }
  }));
  return out;
}

/** Resultados de todos os dias, ordenados por dia, placa e motorista. */
export async function processarPlanilha(buffer: Buffer, agora: Date): Promise<ResultadoLinha[]> {
  const entregas = parseCheckNow(buffer);
  const linhas = montarLinhas(entregas, agora);
  if (!linhas.length) return [];

  const veiculos = await mapaVeiculos();
  const porRota = agruparPorRota(entregas);
  const resultados = await emParalelo(linhas, 3, async l => {
    const vId = veiculos.get(normalizarPlaca(l.placa));
    const gps = vId ? await buscarGpsLinha(vId, l.janela) : gpsErro("sem rastreador");
    return cruzar(l, porRota.get(l.routeId)!, gps);
  });
  return resultados.sort((a, b) =>
    a.linha.data.localeCompare(b.linha.data)
    || a.linha.placa.localeCompare(b.linha.placa)
    || a.linha.motorista.localeCompare(b.linha.motorista));
}
