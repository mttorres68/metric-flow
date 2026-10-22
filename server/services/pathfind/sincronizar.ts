/* MetricFlow — coleta do Pathfind de uma revenda num dia: baixa a simulação mais recente e grava. Erro não apaga nada. */
import { ColetaError, contaPathfind } from "../checknow/repo";
import { baixarSimulacao } from "./coletor";
import { gravarSimulacao, marcarColeta } from "./repo";

export type ResultadoPathfind = { status: "ok" | "sem_simulacao"; rotas: number; simulacao: string | null };

/** Botão "Buscar do Pathfind" no dia visto: a rota que sai no dia foi simulada na véspera — busca a véspera e o dia. */
export async function coletarParaODia(revendaId: number, dia: string): Promise<{ rotas: number; simulacoes: string[] }> {
  const vespera = new Date(Date.parse(`${dia}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const rs = [await coletarPathfind(revendaId, vespera), await coletarPathfind(revendaId, dia)];
  return { rotas: rs.reduce((s, r) => s + r.rotas, 0), simulacoes: rs.flatMap(r => (r.simulacao ? [r.simulacao] : [])) };
}

export async function coletarPathfind(revendaId: number, dia: string): Promise<ResultadoPathfind> {
  const conta = await contaPathfind(revendaId);
  if (!conta) throw new ColetaError("revenda sem conta do Pathfind");
  try {
    const s = await baixarSimulacao(conta, dia);
    await gravarSimulacao(revendaId, dia, s);
    await marcarColeta(revendaId, true, null);
    return { status: "ok", rotas: s.rotas.length, simulacao: s.simulacao };
  } catch (e) {
    const msg = ((e as Error).message ?? String(e)).split("\n")[0].slice(0, 200);
    // Dia sem roteirização não é falha do login nem do Pathfind.
    if (msg === "sem simulação") {
      await marcarColeta(revendaId, true, null);
      return { status: "sem_simulacao", rotas: 0, simulacao: null };
    }
    await marcarColeta(revendaId, false, msg).catch(() => undefined);
    throw e;
  }
}
