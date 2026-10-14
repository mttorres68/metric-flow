/* MetricFlow — intervalos de datas "aaaa-mm-dd" (calendário do Relatório de Entregas e validação das rotas). */

const DIA_MS = 86_400_000;
const meio = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

export const somaDiasIso = (iso: string, n: number) => new Date(meio(iso) + n * DIA_MS).toISOString().slice(0, 10);

/** Quantos dias há no intervalo, contando as duas pontas. */
export const diasEntre = (de: string, ate: string) => Math.round((meio(ate) - meio(de)) / DIA_MS) + 1;

export interface Atalho { rotulo: string; de: string; ate: string }

/**
 * Atalhos do calendário: terminam no último dia permitido (hoje, ou ontem onde o dia ainda não fechou);
 * "Hoje" só aparece se hoje for permitido; os que passam de `maxDias` saem.
 */
export function atalhos(hoje: string, ultimoDia: string, maxDias = Infinity): Atalho[] {
  const ontem = somaDiasIso(hoje, -1);
  const ultimos = (n: number): Atalho => ({ rotulo: `Últimos ${n} dias`, de: somaDiasIso(ultimoDia, -(n - 1)), ate: ultimoDia });
  const inicioMes = `${ultimoDia.slice(0, 7)}-01`;
  const fimMesPassado = somaDiasIso(inicioMes, -1);
  const lista: Atalho[] = [
    ...(ultimoDia >= hoje ? [{ rotulo: "Hoje", de: hoje, ate: hoje }] : []),
    { rotulo: "Ontem", de: ontem, ate: ontem },
    ultimos(7), ultimos(14), ultimos(30),
    { rotulo: "Este mês", de: inicioMes, ate: ultimoDia },
    { rotulo: "Mês passado", de: `${fimMesPassado.slice(0, 7)}-01`, ate: fimMesPassado },
  ];
  return lista.filter(a => diasEntre(a.de, a.ate) <= maxDias);
}
