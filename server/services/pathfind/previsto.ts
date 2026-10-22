/*
 * MetricFlow — previsto (Pathfind) × realizado (CheckNow + GPS) de uma linha do "Por dia" (spec pathfind-previsto §6).
 * O Pathfind planeja em horas corridas, sem pernoite: o 1º dia usa a hora do plano; nos dias seguintes o relógio
 * recomeça na 1ª chegada real do dia e segue o ritmo do plano. Puro.
 */
import type { ResultadoLinha } from "../entregas/cruzar";
import { normalizarPlaca } from "../entregas/infleetEntregas";
import type { ParadaPf } from "./ler";
import type { RotaGravada } from "./repo";

const DIA_MIN = 1440;
const minutos = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const semZeros = (cod: string) => cod.replace(/^0+/, "") || "0";
const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const meiaNoite = (dia: string) => new Date(`${dia}T00:00:00-03:00`).getTime();

/** Minutos corridos desde a meia-noite do dia 0: chegada menor que a anterior soma 24 h; saída menor que a chegada também. */
export function planoEmMinutos(paradas: ParadaPf[]): { parada: ParadaPf; chegadaMin: number; saidaMin: number }[] {
  let dias = 0, anterior = -1;
  return paradas.map(parada => {
    let chegadaMin = minutos(parada.chegada) + dias * DIA_MIN;
    if (chegadaMin < anterior) { dias++; chegadaMin += DIA_MIN; }
    anterior = chegadaMin;
    let saidaMin = minutos(parada.saida) + dias * DIA_MIN;
    if (saidaMin < chegadaMin) saidaMin += DIA_MIN;
    return { parada, chegadaMin, saidaMin };
  });
}

/**
 * Rota do Pathfind da mesma placa simulada até 3 dias antes do início (fim de semana) ou no dia. A simulação é feita na
 * véspera, e a do próprio dia já é a de amanhã: com os clientes da rota do CheckNow, vale a que mais tem clientes em
 * comum (nenhum em comum = não é esta rota); empate ou sem clientes, a de maior código.
 */
export function escolherRota(rotas: RotaGravada[], placa: string, diaInicio: string, clientesDaRota?: string[]): RotaGravada | null {
  const alvo = normalizarPlaca(placa), desde = somaDias(diaInicio, -3);
  const daRota = clientesDaRota && new Set(clientesDaRota.map(semZeros));
  const comuns = (r: RotaGravada) => (daRota ? r.paradas.filter(p => daRota.has(semZeros(p.codCliente))).length : 0);
  const melhor = rotas.filter(r => normalizarPlaca(r.placa) === alvo && r.dataSimulacao >= desde && r.dataSimulacao <= diaInicio)
    .map(r => ({ r, n: comuns(r) }))
    .sort((a, b) => b.n - a.n || Number(b.r.simulacao) - Number(a.r.simulacao))[0];
  return !melhor || (daRota && melhor.n === 0) ? null : melhor.r;
}

export interface Previsto {
  rota: string; simulacao: string;
  reancorado: boolean; // dia 2+: relógio recomeçado na 1ª chegada real do dia
  fimPrevisto: Date | null; fimRealizado: Date | null; atrasoMin: number | null;
  clientes: Record<string, { chegadaPrevista: Date; atrasoMin: number | null }>; // chave: código do cliente sem zeros à esquerda
}

const atraso = (real: Date | null, previsto: Date | null) => (real && previsto ? Math.round((real.getTime() - previsto.getTime()) / 60000) : null);

/** Da rota do CheckNow: todos os clientes (para escolher a simulação) e as baixas do dia no app (linha sem GPS). */
export interface DaRotaCheckNow { clientesDaRota?: string[]; baixasApp?: { codCliente: string; baixaEm: Date | null }[] }

export function previstoDaLinha(l: ResultadoLinha, diaInicio: string, rotas: RotaGravada[], daRota: DaRotaCheckNow = {}): Previsto | null {
  const r = escolherRota(rotas, l.linha.placa, diaInicio, daRota.clientesDaRota);
  if (!r) return null;
  const plano = new Map<string, { chegadaMin: number; saidaMin: number }>();
  for (const x of planoEmMinutos(r.paradas)) if (!plano.has(semZeros(x.parada.codCliente))) plano.set(semZeros(x.parada.codCliente), x);
  // Clientes atendidos no dia que estão no plano, com a chegada real (GPS; sem parada no raio, a baixa do app).
  // Linha sem GPS não tem baixas cruzadas: vale a hora da baixa no app.
  const reais = l.baixas.length
    ? l.baixas.map(b => ({ cod: semZeros(b.entrega.codCliente), real: b.paradasNoRaio[0]?.inicio ?? b.entrega.baixaEm }))
    : (daRota.baixasApp ?? []).map(b => ({ cod: semZeros(b.codCliente), real: b.baixaEm }));
  const atendidos = reais.filter((c): c is { cod: string; real: Date } => !!c.real && plano.has(c.cod));
  const reancorado = l.linha.data !== diaInicio;
  const ancora = reancorado ? [...atendidos].sort((a, b) => a.real.getTime() - b.real.getTime())[0] : null;
  const quando = (min: number): Date => ancora
    ? new Date(ancora.real.getTime() + (min - plano.get(ancora.cod)!.chegadaMin) * 60000)
    : new Date(meiaNoite(diaInicio) + min * 60000);

  const clientes: Previsto["clientes"] = {};
  for (const c of atendidos) {
    if (clientes[c.cod]) continue;
    const chegadaPrevista = quando(plano.get(c.cod)!.chegadaMin);
    clientes[c.cod] = { chegadaPrevista, atrasoMin: atraso(c.real, chegadaPrevista) };
  }
  const maisAdiante = atendidos.map(c => plano.get(c.cod)!).sort((a, b) => b.saidaMin - a.saidaMin)[0];
  const fimPrevisto = maisAdiante ? quando(maisAdiante.saidaMin) : null;
  const fimRealizado = l.gpsClientes.ultimaSaida ?? l.app.ultima;
  return { rota: r.rota, simulacao: r.simulacao, reancorado, fimPrevisto, fimRealizado, atrasoMin: atraso(fimRealizado, fimPrevisto), clientes };
}
