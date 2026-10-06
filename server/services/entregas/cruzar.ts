/*
 * MetricFlow — cruzamento CheckNow × GPS.
 * Linha do relatório = placa · motorista · dia; a janela de GPS é o dia
 * recortado pelo início/fim realizados da rota (separa troca de motorista).
 */
import type { Entrega } from "./parseCheckNow";
import { distM, type Parada } from "./detectarParadas";
import { LIMITES, diaBRT, horaBRT } from "@shared/entregas";

export { LIMITES, diaBRT, horaBRT };

export type Status = "no_raio" | "relampago" | "sem_parada" | "sem_coordenada";

export interface LinhaDia {
  data: string; // "aaaa-mm-dd" (BRT)
  placa: string;
  motorista: string;
  routeId: string;
  janela: { inicio: Date; fim: Date };
  fechaRota: boolean;
}

export interface GpsLinha {
  erro: string | null; // "sem rastreador" | "sem sinal GPS" | "falha no Infleet: ..."
  paradas: Parada[];
  primeiroMovimento: Date | null;
  ultimoMovimento: Date | null;
  kmGps: number | null;
}

export interface EntregaCruzada {
  entrega: Entrega;
  status: Status;
  permanenciaMin: number;
  distMaisProximaM: number | null;
}

export interface ResultadoLinha {
  linha: LinhaDia;
  semGps: string | null;
  saida: Date | null;
  retorno: Date | null;
  entregasDia: number;
  totalRota: number;
  apos14h: number;
  baixasComCoord: number;
  noRaio: number;
  relampago: number;
  semParada: number;
  paradasSemCliente: { qtd: number; min: number };
  kmGps: number | null;
  pendentes: number | null;
  kmInformado: number | null;
  baixas: EntregaCruzada[]; // todas as baixas do dia com status (vazio quando a linha está sem GPS)
}

/** Baixas que o GPS não confirma (status diferente de no_raio). */
export const excecoes = (r: ResultadoLinha) => r.baixas.filter(b => b.status !== "no_raio");

const DIA = 24 * 3600000;
const inicioDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);
const fimDia = (dia: string) => new Date(`${dia}T23:59:59-03:00`);

type ComCoord = Entrega & { lat: number; lon: number };
const temCoord = (e: Entrega): e is ComCoord => e.lat !== null && e.lon !== null;

export function agruparPorRota(entregas: Entrega[]): Map<string, Entrega[]> {
  const m = new Map<string, Entrega[]>();
  for (const e of entregas) m.set(e.routeId, [...(m.get(e.routeId) ?? []), e]);
  return m;
}

export function montarLinhas(entregas: Entrega[], agora: Date): LinhaDia[] {
  const linhas: LinhaDia[] = [];
  for (const [routeId, es] of agruparPorRota(entregas)) {
    const baixas = es.map(e => e.baixaEm?.getTime()).filter((t): t is number => t !== undefined);
    const inicio = es[0].rotaInicio ?? (baixas.length ? new Date(Math.min(...baixas)) : null);
    if (!inicio) continue; // rota não iniciada
    const fimRota = es[0].rotaFim;
    const ultimo = fimRota ?? (baixas.length ? new Date(Math.max(...baixas)) : inicio);
    const fimJanela = fimRota ?? agora;

    for (let dia = diaBRT(inicio); dia <= diaBRT(ultimo); dia = diaBRT(new Date(inicioDia(dia).getTime() + DIA))) {
      linhas.push({
        data: dia,
        placa: es[0].placa,
        motorista: es[0].motorista,
        routeId,
        janela: {
          inicio: new Date(Math.max(inicioDia(dia).getTime(), inicio.getTime())),
          fim: new Date(Math.min(fimDia(dia).getTime(), fimJanela.getTime())),
        },
        fechaRota: fimRota !== null && dia === diaBRT(fimRota),
      });
    }
  }
  return linhas;
}

function kmInformado(e: Entrega): number | null {
  return e.odoIniInformado !== null && e.odoFimInformado !== null ? e.odoFimInformado - e.odoIniInformado : null;
}

export function cruzar(linha: LinhaDia, entregasRota: Entrega[], gps: GpsLinha): ResultadoLinha {
  const baixasDia = entregasRota.filter(e =>
    e.situacao !== "AGUARDANDO" && e.baixaEm !== null && diaBRT(e.baixaEm) === linha.data);
  const entregues = baixasDia.filter(e => e.situacao === "ENTREGUE");

  const r: ResultadoLinha = {
    linha,
    semGps: gps.erro,
    saida: null,
    retorno: null,
    entregasDia: entregues.length,
    totalRota: entregasRota.length,
    apos14h: entregues.filter(e => horaBRT(e.baixaEm!) >= LIMITES.apos14h).length,
    baixasComCoord: 0,
    noRaio: 0,
    relampago: 0,
    semParada: 0,
    paradasSemCliente: { qtd: 0, min: 0 },
    kmGps: null,
    pendentes: linha.fechaRota ? entregasRota.filter(e => e.situacao === "AGUARDANDO").length : null,
    kmInformado: linha.fechaRota ? kmInformado(entregasRota[0]) : null,
    baixas: [],
  };
  if (gps.erro) return r;

  r.saida = gps.primeiroMovimento;
  r.retorno = gps.ultimoMovimento;
  r.kmGps = gps.kmGps;

  for (const e of baixasDia) {
    if (!temCoord(e)) {
      r.baixas.push({ entrega: e, status: "sem_coordenada", permanenciaMin: 0, distMaisProximaM: null });
      continue;
    }
    r.baixasComCoord++;
    const dists = gps.paradas.map(p => distM(p.lat, p.lon, e.lat, e.lon));
    const perm = gps.paradas.reduce((s, p, i) => (dists[i] <= LIMITES.raioM ? s + p.min : s), 0);
    const status: Status = perm >= LIMITES.relampagoMin ? "no_raio" : perm > 0 ? "relampago" : "sem_parada";
    if (status === "no_raio") r.noRaio++;
    else if (status === "relampago") r.relampago++;
    else r.semParada++;
    r.baixas.push({ entrega: e, status, permanenciaMin: perm, distMaisProximaM: dists.length ? Math.min(...dists) : null });
  }

  const clientes = entregasRota.filter(temCoord);
  const { saida, retorno } = r;
  if (saida && retorno) {
    for (const p of gps.paradas) {
      if (p.min < LIMITES.paradaSemClienteMin || p.inicio <= saida || p.inicio >= retorno) continue;
      if (clientes.some(c => distM(p.lat, p.lon, c.lat, c.lon) <= LIMITES.raioM)) continue;
      r.paradasSemCliente.qtd++;
      r.paradasSemCliente.min += p.min;
    }
  }
  return r;
}
