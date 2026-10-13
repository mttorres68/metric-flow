/* MetricFlow — grava a produtividade da rota por dia (spec rota-produtividade §5). */
import { cruzarDia, type LinhaProcessada } from "../entregas/cruzarDia";
import type { Entrega } from "../entregas/parseCheckNow";
import { rotaDiaDe } from "./rotaDia";
import { fecharRotas, gravarRotasDia } from "./repo";

export async function gravarLinhas(revendaId: number, r: { linhas: LinhaProcessada[]; entregas: Entrega[] }): Promise<void> {
  // Falha passageira da API do Infleet não sobrescreve um dia já gravado (nem acusa o motorista de "sem GPS").
  const validas = r.linhas.filter(l => !l.semGps?.startsWith("falha no Infleet"));
  await gravarRotasDia(revendaId, validas.map(l => rotaDiaDe(l, r.entregas.filter(e => e.routeId === l.linha.routeId))));
}

/**
 * A tela "Por dia" só entra no histórico quando o número é o mesmo do processamento diário: um dia já passado
 * (não o retrato parcial de hoje), um dia só e a saída/retorno pela cerca Sede da conta.
 */
export function deveGravarTela(p: { de: string; ate: string; cercaId?: string; sedeId: string | null; hoje: string }): boolean {
  return p.de === p.ate && p.de < p.hoje && !!p.cercaId && p.cercaId === p.sedeId;
}

/** O mesmo cruzamento da tela "Por dia" para um dia, com a cerca dada (Sede no processamento diário). */
export async function registrarRotasDia(revendaId: number, dia: string, cercaId?: string): Promise<number> {
  const r = await cruzarDia(revendaId, dia, dia, cercaId);
  await gravarLinhas(revendaId, r);
  await fecharRotas(revendaId); // rota fechada no app depois do último processamento (dia sem entrega não vira linha)
  return r.linhas.length;
}
