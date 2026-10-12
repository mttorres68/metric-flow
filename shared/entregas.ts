/*
 * MetricFlow — relatório de entregas: limites e formatação compartilhados
 * entre servidor (cruzamento + PDF) e a tela.
 */

// Único lugar dos limites (v1: constantes; v2: configService).
export const LIMITES = {
  raioM: 300,
  relampagoMin: 3,
  paradaSemClienteMin: 10,
  saidaAte: "08:00",
  saidaMinima: "04:00", // movimento que termina antes disso não é saída (madrugada fora da base)
  pernoiteMaxKm: 80, // pernoite "na malícia": dormiu até esta distância da Sede (estrada estimada)…
  pernoiteChegarAte: "21:00", // …quando dava para chegar na Sede até este horário…
  pernoiteFatorEstrada: 1.3, // linha reta × fator = distância pela estrada (estimada)
  pernoiteVelKmh: 60, // velocidade média para estimar a chegada na Sede
  pernoiteParouCedo: "17:00", // "cozinhando o galo": parou de vez antes deste horário
  pernoiteFinalLentoX: 2, // "cozinhando o galo": 3 últimas entregas mais lentas que este múltiplo do dia
  apos14h: "14:00",
  apos14hMinPct: 25,
  relampagoMaxPct: 10,
  momentoTolMin: 15, // baixa até 15 min antes da chegada ou depois da saída do caminhão ainda conta como "na parada"
  descansoMinH: 11, // descanso entre jornadas (Lei 13.103/2015) — alerta abaixo disso
  noturnoDe: "22:00", // chave ligada ou caminhão andando neste intervalo = atividade fora de hora
  noturnoAte: "05:00",
  desvioFator: 1.8, // trecho entre clientes: km pela estrada acima de 1,8× a linha reta…
  desvioMinKm: 3, // …e pelo menos 3 km a mais = desvio
  lentoMinMin: 20, // trecho com mais de 20 min…
  lentoMaxKmh: 15, // …a menos de 15 km/h de média = parou no caminho
  cercaManobraMin: 15, // saiu e entrou na cerca em menos disso = manobra na borda, não saída/retorno
} as const;

const H3 = 3 * 3600000;
/** Dia em BRT (-03:00, sem horário de verão): "aaaa-mm-dd". */
export const diaBRT = (d: Date) => new Date(d.getTime() - H3).toISOString().slice(0, 10);
/** Hora em BRT: "hh:mm". */
export const horaBRT = (d: Date) => new Date(d.getTime() - H3).toISOString().slice(11, 16);

/** Minutos → "hh:mm". */
export function minParaHM(min: number): string {
  const t = Math.round(min);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Limites que a tela deixa ajustar (modal ⚙, tabela entregas_config). */
export interface ConfigEntregas {
  raioM: number;
  desvioFator: number;
  desvioMinKm: number;
  lentoMinMin: number;
  lentoMaxKmh: number;
  saidaMinima: string; // "hh:mm" BRT
  pernoiteMaxKm: number;
  pernoiteChegarAte: string; // "hh:mm"
  pernoiteFatorEstrada: number;
  pernoiteVelKmh: number;
  pernoiteParouCedo: string; // "hh:mm"
  pernoiteFinalLentoX: number;
}
export const CONFIG_ENTREGAS_PADRAO: ConfigEntregas = {
  raioM: LIMITES.raioM,
  desvioFator: LIMITES.desvioFator,
  desvioMinKm: LIMITES.desvioMinKm,
  lentoMinMin: LIMITES.lentoMinMin,
  lentoMaxKmh: LIMITES.lentoMaxKmh,
  saidaMinima: LIMITES.saidaMinima,
  pernoiteMaxKm: LIMITES.pernoiteMaxKm,
  pernoiteChegarAte: LIMITES.pernoiteChegarAte,
  pernoiteFatorEstrada: LIMITES.pernoiteFatorEstrada,
  pernoiteVelKmh: LIMITES.pernoiteVelKmh,
  pernoiteParouCedo: LIMITES.pernoiteParouCedo,
  pernoiteFinalLentoX: LIMITES.pernoiteFinalLentoX,
};
