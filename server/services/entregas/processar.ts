/*
 * MetricFlow — pipeline do relatório de entregas: entregas → linhas → GPS → cruzamento.
 * Usado pela tela (tRPC entregas.processar) e pelo download do PDF (REST), com as entregas lidas do banco.
 * Devolve [] quando nenhuma rota foi iniciada.
 */
import type { Entrega } from "./parseCheckNow";
import { montarLinhas, agruparPorRota, cruzar, type ResultadoLinha } from "./cruzar";
import { analisarRotas, type AnaliseRota } from "./rota";
import type { ConfigEntregas } from "@shared/entregas";
import { mapaVeiculos, buscarGpsLinha, gpsErro, kmNoPeriodo, normalizarPlaca } from "./infleetEntregas";

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

/** Linhas por dia (ordenadas por dia, placa e motorista) e análise por rota. cercaId: cerca da base (saída/retorno);
 * token: conta Infleet da revenda (sem = INFLEET_TOKEN); config: raio e limites do modal ⚙;
 * periodo: só esses dias viram linha (as rotas podem ter começado antes). O km de cada rota vem de uma
 * consulta da rota inteira (início → fim), para contar os dias de viagem sem entrega. */
export async function processarEntregas(
  entregas: Entrega[], agora: Date,
  { cercaId, token, config, periodo }: { cercaId?: string; token?: string; config?: Partial<ConfigEntregas>; periodo?: { de: string; ate: string } } = {},
): Promise<{ linhas: ResultadoLinha[]; rotas: AnaliseRota[] }> {
  const linhas = montarLinhas(entregas, agora).filter(l => !periodo || (l.data >= periodo.de && l.data <= periodo.ate));
  if (!linhas.length) return { linhas: [], rotas: [] };

  const veiculos = await mapaVeiculos(token);
  const porRota = agruparPorRota(entregas);
  const resultados = await emParalelo(linhas, 3, async l => {
    const vId = veiculos.get(normalizarPlaca(l.placa));
    const gps = vId ? await buscarGpsLinha(vId, l.janela, { cercaId, token }) : gpsErro("sem rastreador");
    return cruzar(l, porRota.get(l.routeId)!, gps, config);
  });
  resultados.sort((a, b) =>
    a.linha.data.localeCompare(b.linha.data)
    || a.linha.placa.localeCompare(b.linha.placa)
    || a.linha.motorista.localeCompare(b.linha.motorista));

  const kmRotas = new Map(await emParalelo([...new Set(linhas.map(l => l.routeId))], 3, async routeId => {
    const e = porRota.get(routeId)![0];
    const vId = veiculos.get(normalizarPlaca(e.placa));
    const km = vId && e.rotaInicio ? await kmNoPeriodo(vId, e.rotaInicio, e.rotaFim ?? agora, token).catch(() => null) : null;
    return [routeId, km] as const;
  }));
  return { linhas: resultados, rotas: analisarRotas(entregas, resultados, kmRotas) };
}
