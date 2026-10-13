/* MetricFlow — grava a produtividade da rota por dia (spec rota-produtividade §5). */
import { cruzarDia, type LinhaProcessada } from "../entregas/cruzarDia";
import type { Entrega } from "../entregas/parseCheckNow";
import { rotaDiaDe } from "./rotaDia";
import { gravarRotasDia } from "./repo";

export async function gravarLinhas(revendaId: number, r: { linhas: LinhaProcessada[]; entregas: Entrega[] }): Promise<void> {
  await gravarRotasDia(revendaId, r.linhas.map(l => rotaDiaDe(l, r.entregas.filter(e => e.routeId === l.linha.routeId))));
}

/** O mesmo cruzamento da tela "Por dia" para um dia, com a cerca dada (Sede no processamento diário). */
export async function registrarRotasDia(revendaId: number, dia: string, cercaId?: string): Promise<number> {
  const r = await cruzarDia(revendaId, dia, dia, cercaId);
  await gravarLinhas(revendaId, r);
  return r.linhas.length;
}
