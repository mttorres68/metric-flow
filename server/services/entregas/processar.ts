/*
 * MetricFlow — pipeline do relatório de entregas: planilha → linhas → GPS → cruzamento.
 * Usado pela tela (tRPC entregas.processar) e pelo download do PDF (REST).
 * Lança PlanilhaInvalidaError (parseCheckNow); devolve [] quando nenhuma rota foi iniciada.
 */
import { parseCheckNow } from "./parseCheckNow";
import { montarLinhas, agruparPorRota, cruzar, type ResultadoLinha } from "./cruzar";
import { analisarRotas, type AnaliseRota } from "./rota";
import type { ConfigEntregas } from "@shared/entregas";
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

/** Linhas por dia (ordenadas por dia, placa e motorista) e análise por rota. cercaId: cerca da base (saída/retorno); config: raio e limites do modal ⚙. */
export async function processarPlanilha(
  buffer: Buffer, agora: Date, { cercaId, config }: { cercaId?: string; config?: Partial<ConfigEntregas> } = {},
): Promise<{ linhas: ResultadoLinha[]; rotas: AnaliseRota[] }> {
  const entregas = parseCheckNow(buffer);
  const linhas = montarLinhas(entregas, agora);
  if (!linhas.length) return { linhas: [], rotas: [] };

  const veiculos = await mapaVeiculos();
  const porRota = agruparPorRota(entregas);
  const resultados = await emParalelo(linhas, 3, async l => {
    const vId = veiculos.get(normalizarPlaca(l.placa));
    const gps = vId ? await buscarGpsLinha(vId, l.janela, { cercaId }) : gpsErro("sem rastreador");
    return cruzar(l, porRota.get(l.routeId)!, gps, config);
  });
  resultados.sort((a, b) =>
    a.linha.data.localeCompare(b.linha.data)
    || a.linha.placa.localeCompare(b.linha.placa)
    || a.linha.motorista.localeCompare(b.linha.motorista));
  return { linhas: resultados, rotas: analisarRotas(entregas, resultados) };
}
