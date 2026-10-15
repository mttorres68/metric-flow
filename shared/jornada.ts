/* MetricFlow — calendário de jornada (estilo contribuições do GitHub): grade de semanas e nível de cor por horas. */
const DIA_MS = 86_400_000;
const somaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

/** `n` semanas (domingo→sábado) terminando na semana de `fim`; os dias depois de `fim` são null. */
export function semanasAte(fim: string, n = 53): (string | null)[][] {
  const inicio = somaDias(fim, -new Date(`${fim}T12:00:00Z`).getUTCDay() - (n - 1) * 7);
  return Array.from({ length: n }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const dia = somaDias(inicio, w * 7 + d);
    return dia <= fim ? dia : null;
  }));
}

/** 0 = sem jornada; 1 = até 4 h; 2 = até 8 h; 3 = até 10 h; 4 = 10 h ou mais. */
export const nivelJornada = (min: number): 0 | 1 | 2 | 3 | 4 =>
  !min ? 0 : min < 240 ? 1 : min < 480 ? 2 : min < 600 ? 3 : 4;
