/*
 * MetricFlow — produtividade da rota (spec rota-produtividade §3–4): a linha do dia vira RotaDia; o ranking soma os dias
 * de cada rota (hL/h ponderado pelas horas dos dias com hL/h) e as entregas por dia vão para o gráfico de colunas.
 */
import type { LinhaProcessada } from "../entregas/cruzarDia";
import type { Entrega } from "../entregas/parseCheckNow";

export interface RotaDia {
  routeId: string; dia: string; placa: string; motorista: string; saida: Date | null; retorno: Date | null;
  jornadaMin: number | null; rodandoMin: number | null; emClienteMin: number | null; paradoSemClienteMin: number | null;
  idaMin: number | null; voltaMin: number | null; entregas: number; aEntregar: number; totalRota: number;
  hl: number; hlPorHora: number | null; devPct: number | null; kmGps: number | null; semGps: string | null;
  parcial: boolean; incompleto: boolean; rotaInicio: Date; rotaFim: Date | null;
}
export interface RotaRanking {
  routeId: string; placa: string; motorista: string; inicio: Date; fim: Date | null; dias: number; emAndamento: boolean;
  clientes: number; entregues: number; entreguePct: number | null; hl: number; hlPorHora: number | null; entregasPorHora: number | null;
  jornadaMin: number; rodandoMin: number; emClienteMin: number; paradoSemClienteMin: number;
  kmGps: number | null; hlPorKm: number | null; kmPorEntrega: number | null; idaMedia: number | null; voltaMedia: number | null;
  diasSemGps: number; incompleto: boolean; semJornada: boolean;
}
export interface Ranking { rotas: RotaRanking[]; emAndamento: RotaRanking[]; resumo: { rotas: number; hlPorHora: number | null; entregasPorHora: number | null; tempoMedioMin: number | null } }

const DIA_MS = 86_400_000;
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const media = (xs: number[]) => (xs.length ? Math.round(soma(xs) / xs.length) : null);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const naoNulos = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);

export function rotaDiaDe(l: LinhaProcessada, entregasDaRota: Entrega[]): RotaDia {
  const fim = l.retorno ?? l.gpsClientes.ultimaSaida;
  const e0 = entregasDaRota[0];
  return {
    routeId: l.linha.routeId, dia: l.linha.data, placa: l.linha.placa, motorista: l.linha.motorista, saida: l.saida, retorno: l.retorno,
    // Mesma jornada do hL/h da produtividade: saída → retorno (sem retorno, saída do último cliente).
    jornadaMin: l.saida && fim ? Math.round((fim.getTime() - l.saida.getTime()) / 60000) : null,
    rodandoMin: l.tempo?.rodandoMin ?? null, emClienteMin: l.tempo?.emClienteMin ?? null, paradoSemClienteMin: l.tempo?.paradoSemClienteMin ?? null,
    idaMin: l.ida?.min ?? null, voltaMin: l.volta?.min ?? null,
    entregas: l.entregasDia, aEntregar: l.aEntregar, totalRota: l.totalRota,
    hl: l.produtividade.hl, hlPorHora: l.produtividade.hlPorHora, devPct: l.produtividade.devPct, kmGps: l.kmGps,
    semGps: l.semGps, parcial: l.produtividade.parcial, incompleto: l.produtividade.incompleto,
    rotaInicio: e0?.rotaInicio ?? l.linha.janela?.inicio ?? new Date(`${l.linha.data}T00:00:00-03:00`), rotaFim: e0?.rotaFim ?? null,
  };
}

function rota(ds: RotaDia[]): RotaRanking {
  const comHl = ds.filter(d => d.hlPorHora !== null && (d.jornadaMin ?? 0) > 0);
  const comJornada = ds.filter(d => (d.jornadaMin ?? 0) > 0);
  const comKm = ds.filter(d => d.kmGps !== null && d.kmGps > 0);
  const horasHl = soma(comHl.map(d => d.jornadaMin!)) / 60, horas = soma(comJornada.map(d => d.jornadaMin!)) / 60;
  const km = soma(comKm.map(d => d.kmGps!));
  const clientes = Math.max(...ds.map(d => d.totalRota)), entregues = soma(ds.map(d => d.entregas));
  const fim = ds.find(d => d.rotaFim)?.rotaFim ?? null;
  return {
    routeId: ds[0].routeId, placa: ds[0].placa, motorista: ds.at(-1)!.motorista, inicio: ds[0].rotaInicio, fim, dias: new Set(ds.map(d => d.dia)).size,
    emAndamento: !fim, clientes, entregues, entreguePct: clientes ? Math.round((entregues / clientes) * 1000) / 10 : null,
    hl: r3(soma(ds.map(d => d.hl))),
    hlPorHora: horasHl > 0 ? r3(soma(comHl.map(d => d.hl)) / horasHl) : null,
    entregasPorHora: horas > 0 ? r3(soma(comJornada.map(d => d.entregas)) / horas) : null,
    jornadaMin: soma(comJornada.map(d => d.jornadaMin!)),
    rodandoMin: soma(naoNulos(ds.map(d => d.rodandoMin))), emClienteMin: soma(naoNulos(ds.map(d => d.emClienteMin))),
    paradoSemClienteMin: soma(naoNulos(ds.map(d => d.paradoSemClienteMin))),
    kmGps: comKm.length ? Math.round(km) : null,
    hlPorKm: km > 0 ? r3(soma(comKm.map(d => d.hl)) / km) : null,
    kmPorEntrega: km > 0 && soma(comKm.map(d => d.entregas)) > 0 ? r3(km / soma(comKm.map(d => d.entregas))) : null,
    idaMedia: media(naoNulos(ds.map(d => d.idaMin))), voltaMedia: media(naoNulos(ds.map(d => d.voltaMin))),
    diasSemGps: ds.filter(d => d.semGps !== null).length, incompleto: ds.some(d => d.incompleto), semJornada: !comJornada.length,
  };
}

export function agregarRotas(dias: RotaDia[]): Ranking {
  const porRota = new Map<string, RotaDia[]>();
  for (const d of [...dias].sort((a, b) => a.dia.localeCompare(b.dia))) porRota.set(d.routeId, [...(porRota.get(d.routeId) ?? []), d]);
  const todas = [...porRota.values()].map(rota);
  const fechadas = todas.filter(r => !r.emAndamento);
  // Menos produtiva primeiro; sem hL/h depois; sem jornada no fim.
  const peso = (r: RotaRanking) => (r.semJornada ? 2 : r.hlPorHora === null ? 1 : 0);
  fechadas.sort((a, b) => peso(a) - peso(b) || (a.hlPorHora ?? 0) - (b.hlPorHora ?? 0));
  const diasFechadas = dias.filter(d => porRota.has(d.routeId) && fechadas.some(r => r.routeId === d.routeId));
  const resumoRota = fechadas.length ? rota(diasFechadas.map(d => ({ ...d, routeId: "*" }))) : null;
  return {
    rotas: fechadas,
    emAndamento: todas.filter(r => r.emAndamento),
    resumo: {
      rotas: fechadas.length, hlPorHora: resumoRota?.hlPorHora ?? null, entregasPorHora: resumoRota?.entregasPorHora ?? null,
      tempoMedioMin: media(fechadas.filter(r => !r.semJornada).map(r => r.jornadaMin)),
    },
  };
}

export function entregasPorDia(dias: RotaDia[], de: string, ate: string, routeIds: string[] = []): { dia: string; total: number; porRota: Record<string, number> }[] {
  const r: { dia: string; total: number; porRota: Record<string, number> }[] = [];
  for (let t = Date.parse(`${de}T12:00:00Z`); t <= Date.parse(`${ate}T12:00:00Z`); t += DIA_MS) {
    const d = new Date(t).toISOString().slice(0, 10);
    const doDia = dias.filter(x => x.dia === d);
    r.push({ dia: d, total: soma(doDia.map(x => x.entregas)), porRota: Object.fromEntries(routeIds.map(id => [id, soma(doDia.filter(x => x.routeId === id).map(x => x.entregas))])) });
  }
  return r;
}
