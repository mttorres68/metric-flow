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
  saida: Date | null;
  saidaOrigem: "gps" | "cerca"; // "cerca" = evento Saiu da cerca; "gps" = 1º trecho em movimento
  retornoOrigem: "gps" | "cerca"; // "cerca" = evento Entrou na cerca (depois da saída); "gps" = fim do último trecho
  retorno: Date | null;
  kmGps: number | null;
}

export interface ParadaNoCliente { inicio: Date; fim: Date; distM: number }

export interface EntregaCruzada {
  entrega: Entrega;
  status: Status;
  permanenciaMin: number;
  distMaisProximaM: number | null;
  paradasNoRaio: ParadaNoCliente[]; // a "entrega de fato": quando o caminhão esteve a até raioM do cliente
  maisProxima: ParadaNoCliente | null; // parada mais próxima do cliente, a qualquer distância
  momentoBaixa: { tipo: "na_parada" | "depois" | "antes"; min: number } | null; // null sem parada no raio
}

/** Compara a hora da baixa no app com as passagens do caminhão pelo cliente. */
function momentoDaBaixa(baixa: Date, paradas: ParadaNoCliente[]): EntregaCruzada["momentoBaixa"] {
  if (!paradas.length) return null;
  const t = baixa.getTime(), tol = LIMITES.momentoTolMin * 60000;
  if (paradas.some(p => t >= p.inicio.getTime() - tol && t <= p.fim.getTime() + tol)) return { tipo: "na_parada", min: 0 };
  const anteriores = paradas.filter(p => p.fim.getTime() <= t);
  if (anteriores.length) return { tipo: "depois", min: Math.round((t - anteriores[anteriores.length - 1].fim.getTime()) / 60000) };
  return { tipo: "antes", min: Math.round((paradas[0].inicio.getTime() - t) / 60000) };
}

export interface ResultadoLinha {
  linha: LinhaDia;
  semGps: string | null;
  saida: Date | null;
  saidaOrigem: "gps" | "cerca";
  retornoOrigem: "gps" | "cerca";
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

/**
 * Uma linha por rota e dia. Janela de GPS = o dia inteiro (00:00–23:59, ou até `agora`),
 * para pegar a saída real mesmo que o motorista inicie a rota no app depois. Só é cortada
 * quando o mesmo caminhão troca de motorista no dia: no fim da rota anterior, ou no início
 * da seguinte se a anterior não tiver fim registrado.
 */
export function montarLinhas(entregas: Entrega[], agora: Date): LinhaDia[] {
  const linhas: (LinhaDia & { rotaInicio: Date; rotaFim: Date | null })[] = [];
  for (const [routeId, es] of agruparPorRota(entregas)) {
    const baixas = es.map(e => e.baixaEm?.getTime()).filter((t): t is number => t !== undefined);
    const inicio = es[0].rotaInicio ?? (baixas.length ? new Date(Math.min(...baixas)) : null);
    if (!inicio) continue; // rota não iniciada
    const fimRota = es[0].rotaFim;
    const ultimo = fimRota ?? (baixas.length ? new Date(Math.max(...baixas)) : inicio);

    for (let dia = diaBRT(inicio); dia <= diaBRT(ultimo); dia = diaBRT(new Date(inicioDia(dia).getTime() + DIA))) {
      linhas.push({
        data: dia,
        placa: es[0].placa,
        motorista: es[0].motorista,
        routeId,
        janela: { inicio: inicioDia(dia), fim: new Date(Math.min(fimDia(dia).getTime(), agora.getTime())) },
        fechaRota: fimRota !== null && dia === diaBRT(fimRota),
        rotaInicio: inicio,
        rotaFim: fimRota,
      });
    }
  }

  // Troca de motorista no mesmo caminhão e dia: divide a janela entre as rotas.
  const porCaminhaoDia = new Map<string, typeof linhas>();
  for (const l of linhas) {
    const k = `${l.placa}|${l.data}`;
    porCaminhaoDia.set(k, [...(porCaminhaoDia.get(k) ?? []), l]);
  }
  for (const ls of porCaminhaoDia.values()) {
    ls.sort((a, b) => a.rotaInicio.getTime() - b.rotaInicio.getTime());
    for (let i = 1; i < ls.length; i++) {
      // Rotas sobrepostas no CheckNow (fim da anterior depois do início da seguinte): vale o início.
      const corte = new Date(Math.min(ls[i - 1].rotaFim?.getTime() ?? Infinity, ls[i].rotaInicio.getTime()));
      ls[i - 1].janela.fim = corte;
      ls[i].janela.inicio = corte;
    }
  }
  return linhas.map(({ rotaInicio, rotaFim, ...l }) => l);
}

function kmInformado(e: Entrega): number | null {
  return e.odoIniInformado !== null && e.odoFimInformado !== null ? e.odoFimInformado - e.odoIniInformado : null;
}

/** raioM: raio do cliente em metros (configurável na tela; padrão LIMITES.raioM). */
export function cruzar(linha: LinhaDia, entregasRota: Entrega[], gps: GpsLinha, raioM: number = LIMITES.raioM): ResultadoLinha {
  const baixasDia = entregasRota.filter(e =>
    e.situacao !== "AGUARDANDO" && e.baixaEm !== null && diaBRT(e.baixaEm) === linha.data);
  const entregues = baixasDia.filter(e => e.situacao === "ENTREGUE");

  const r: ResultadoLinha = {
    linha,
    semGps: gps.erro,
    saida: null,
    saidaOrigem: gps.saidaOrigem,
    retornoOrigem: gps.retornoOrigem,
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

  r.saida = gps.saida;
  r.retorno = gps.retorno;
  r.kmGps = gps.kmGps;

  for (const e of baixasDia) {
    if (!temCoord(e)) {
      r.baixas.push({
        entrega: e, status: "sem_coordenada", permanenciaMin: 0, distMaisProximaM: null,
        paradasNoRaio: [], maisProxima: null, momentoBaixa: null,
      });
      continue;
    }
    r.baixasComCoord++;
    const comDist = gps.paradas.map(p => ({ inicio: p.inicio, fim: p.fim, min: p.min, distM: distM(p.lat, p.lon, e.lat, e.lon) }));
    const noRaio = comDist.filter(p => p.distM <= raioM).sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    const perm = noRaio.reduce((s, p) => s + p.min, 0);
    const maisProxima = comDist.reduce<(typeof comDist)[number] | null>((m, p) => (!m || p.distM < m.distM ? p : m), null);
    const status: Status = perm >= LIMITES.relampagoMin ? "no_raio" : perm > 0 ? "relampago" : "sem_parada";
    if (status === "no_raio") r.noRaio++;
    else if (status === "relampago") r.relampago++;
    else r.semParada++;
    const semMin = ({ inicio, fim, distM }: ParadaNoCliente): ParadaNoCliente => ({ inicio, fim, distM });
    const paradasNoRaio = noRaio.map(semMin);
    r.baixas.push({
      entrega: e, status, permanenciaMin: perm, distMaisProximaM: maisProxima?.distM ?? null,
      paradasNoRaio,
      maisProxima: maisProxima && semMin(maisProxima),
      momentoBaixa: momentoDaBaixa(e.baixaEm!, paradasNoRaio),
    });
  }

  const clientes = entregasRota.filter(temCoord);
  const { saida, retorno } = r;
  if (saida && retorno) {
    for (const p of gps.paradas) {
      if (p.min < LIMITES.paradaSemClienteMin || p.inicio <= saida || p.inicio >= retorno) continue;
      if (clientes.some(c => distM(p.lat, p.lon, c.lat, c.lon) <= raioM)) continue;
      r.paradasSemCliente.qtd++;
      r.paradasSemCliente.min += p.min;
    }
  }
  return r;
}
