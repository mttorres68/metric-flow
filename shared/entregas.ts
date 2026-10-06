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
  apos14h: "14:00",
  apos14hMinPct: 25,
  relampagoMaxPct: 10,
  momentoTolMin: 15, // baixa até 15 min antes da chegada ou depois da saída do caminhão ainda conta como "na parada"
  descansoMinH: 11, // descanso entre jornadas (Lei 13.103/2015) — alerta abaixo disso
  noturnoDe: "22:00", // chave ligada ou caminhão andando neste intervalo = atividade fora de hora
  noturnoAte: "05:00",
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
