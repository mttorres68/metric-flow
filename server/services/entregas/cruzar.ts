/*
 * MetricFlow — cruzamento CheckNow × GPS.
 * Linha do relatório = placa · motorista · dia; a janela de GPS é o dia
 * recortado pelo início/fim realizados da rota (separa troca de motorista).
 */
import type { Entrega } from "./parseCheckNow";
import { distM, kmEntre, type Parada, type Trajeto } from "./detectarParadas";
import { CONFIG_ENTREGAS_PADRAO, LIMITES, diaBRT, horaBRT, type ConfigEntregas } from "@shared/entregas";

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

/**
 * Evento do Infleet relevante para a rota. A "ignição" do rastreador é a chave, não o motor:
 * "Marcha lenta excessiva" (deviceIdle) sai junto do desligar e traz quanto tempo a chave ficou ligada parada.
 */
export type TipoEvento = "geofenceExit" | "geofenceEnter" | "deviceIdle" | "ignitionOn" | "ignitionOff" | "deviceStopped" | "deviceMoving";
export interface EventoGps {
  tipo: TipoEvento;
  em: Date;
  endereco: string | null;
  lat: number;
  lon: number;
  cercaId: string | null;
  cerca: string | null;
  duracaoMin: number | null; // só em deviceIdle
}

export interface GpsLinha {
  erro: string | null; // "sem rastreador" | "sem sinal GPS" | "falha no Infleet: ..."
  paradas: Parada[];
  saida: Date | null;
  saidaOrigem: "gps" | "cerca"; // "cerca" = evento Saiu da cerca; "gps" = 1º trecho em movimento
  retornoOrigem: "gps" | "cerca"; // "cerca" = evento Entrou na cerca (depois da saída); "gps" = fim do último trecho
  retorno: Date | null;
  kmGps: number | null;
  eventos: EventoGps[]; // eventos do Infleet no dia (cerca, chave, marcha lenta, parado/andando), em ordem
  trajeto: Trajeto; // km acumulado pela estrada (posições em movimento)
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
  trecho: Trecho | null; // deslocamento até este cliente (do cliente anterior visitado, ou da saída)
}

/** Deslocamento entre dois pontos da jornada, pelo GPS. */
export interface Trecho {
  deCodCliente: string | null; // null = desde a saída
  min: number;
  km: number | null; // pela estrada (trajeto do GPS)
  retaKm: number | null; // linha reta entre os clientes (null quando parte da saída)
  desvio: boolean; // km bem acima da linha reta (config: desvioFator e desvioMinKm)
  lento: boolean; // demorado e devagar: parou no caminho (config: lentoMinMin e lentoMaxKmh)
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
  /** Parado com a chave ligada dentro da jornada (eventos "Marcha lenta excessiva"). */
  chaveLigadaMin: number | null;
  marchasLentas: number;
  eventos: EventoGps[];
  /** Divisão da jornada (saída → retorno). null sem GPS ou sem saída/retorno. */
  tempo: { jornadaMin: number; rodandoMin: number; emClienteMin: number; paradoSemClienteMin: number } | null;
  /** Onde o caminhão estacionou no fim do dia (parada que começa no retorno) — base do pernoite. */
  ultimaParada: { lat: number; lon: number; inicio: Date } | null;
  pendentes: number | null;
  kmInformado: number | null;
  baixas: EntregaCruzada[]; // todas as baixas do dia com status (vazio quando a linha está sem GPS)
  /** O que o app do CheckNow diz: 1ª e última baixa do dia e tempo em cliente (saída − chegada). */
  app: { primeira: Date | null; ultima: Date | null; emClienteMin: number };
  /** O que o GPS diz: chegada ao 1º cliente e saída do último. */
  gpsClientes: { primeiraChegada: Date | null; ultimaSaida: Date | null };
  ida: { min: number; km: number | null } | null; // saída → 1º cliente
  volta: { min: number; km: number | null } | null; // último cliente → retorno
  desvios: number;
  trechosLentos: number;
  cidades: string[]; // cidades das baixas do dia, na ordem
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

/** O que o app diz no dia: 1ª e última baixa e tempo em cliente (saída − chegada no app). */
function appDoDia(baixas: Entrega[]): ResultadoLinha["app"] {
  const ts = baixas.map(e => e.baixaEm!.getTime());
  const emCliente = baixas.reduce((s, e) => s + (e.saidaApp ? Math.max(0, e.saidaApp.getTime() - e.baixaEm!.getTime()) : 0), 0);
  return {
    primeira: ts.length ? new Date(Math.min(...ts)) : null,
    ultima: ts.length ? new Date(Math.max(...ts)) : null,
    emClienteMin: Math.round(emCliente / 60000),
  };
}

const umaCasa = (km: number | null) => (km === null ? null : Math.round(km * 10) / 10);

/**
 * Ordem real de visita (chegada da parada mais próxima de cada cliente) → trecho até cada cliente,
 * ida (saída → 1º) e volta (último → retorno), com km pela estrada e os gatilhos de desvio e lentidão.
 */
function percursos(r: ResultadoLinha, trajeto: Trajeto, cfg: ConfigEntregas) {
  const visitas = r.baixas
    .filter(b => b.paradasNoRaio.length)
    .map(b => ({ b, p: b.paradasNoRaio.reduce((m, x) => (x.distM < m.distM ? x : m)) }))
    .sort((x, y) => x.p.inicio.getTime() - y.p.inicio.getTime());
  if (!visitas.length) return;

  const chegada = visitas[0].p.inicio;
  const ultimaSaida = new Date(Math.max(...visitas.map(v => v.p.fim.getTime())));
  r.gpsClientes = { primeiraChegada: chegada, ultimaSaida };
  const min = (de: Date, ate: Date) => Math.max(0, Math.round((ate.getTime() - de.getTime()) / 60000));
  if (r.saida && r.saida <= chegada) {
    r.ida = { min: min(r.saida, chegada), km: umaCasa(kmEntre(trajeto, r.saida, chegada)) };
  }
  if (r.retorno && r.retorno > ultimaSaida) {
    r.volta = { min: min(ultimaSaida, r.retorno), km: umaCasa(kmEntre(trajeto, ultimaSaida, r.retorno)) };
  }

  let anterior: { fim: Date; e: Entrega } | null = null;
  for (const { b, p } of visitas) {
    const desde = anterior ? anterior.fim : r.saida;
    if (desde) {
      const ate = p.inicio > desde ? p.inicio : desde; // clientes vizinhos na mesma parada: trecho zero
      const t = min(desde, ate);
      const km = umaCasa(kmEntre(trajeto, desde, ate));
      const retaKm = anterior && anterior.e.lat !== null && anterior.e.lon !== null
        ? distM(anterior.e.lat, anterior.e.lon, b.entrega.lat!, b.entrega.lon!) / 1000 : null;
      const desvio = km !== null && retaKm !== null && km > retaKm * cfg.desvioFator && km - retaKm > cfg.desvioMinKm;
      const lento = t > cfg.lentoMinMin && (km ?? 0) / (t / 60) < cfg.lentoMaxKmh;
      b.trecho = { deCodCliente: anterior?.e.codCliente ?? null, min: t, km, retaKm, desvio, lento };
      if (desvio) r.desvios++;
      if (lento) r.trechosLentos++;
    }
    if (!anterior || p.fim > anterior.fim) anterior = { fim: p.fim, e: b.entrega };
    else anterior = { fim: anterior.fim, e: b.entrega };
  }
}

function kmInformado(e: Entrega): number | null {
  return e.odoIniInformado !== null && e.odoFimInformado !== null ? e.odoFimInformado - e.odoIniInformado : null;
}

/** config: raio do cliente e limites de desvio/lentidão (modal ⚙); o que faltar usa CONFIG_ENTREGAS_PADRAO. */
export function cruzar(linha: LinhaDia, entregasRota: Entrega[], gps: GpsLinha, config: Partial<ConfigEntregas> = {}): ResultadoLinha {
  const cfg = { ...CONFIG_ENTREGAS_PADRAO, ...config };
  const raioM = cfg.raioM;
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
    chaveLigadaMin: null,
    marchasLentas: 0,
    eventos: gps.eventos,
    tempo: null,
    ultimaParada: null,
    pendentes: linha.fechaRota ? entregasRota.filter(e => e.situacao === "AGUARDANDO").length : null,
    kmInformado: linha.fechaRota ? kmInformado(entregasRota[0]) : null,
    baixas: [],
    app: appDoDia(baixasDia),
    gpsClientes: { primeiraChegada: null, ultimaSaida: null },
    ida: null,
    volta: null,
    desvios: 0,
    trechosLentos: 0,
    cidades: [...new Set([...baixasDia].sort((a, b) => a.baixaEm!.getTime() - b.baixaEm!.getTime()).map(e => e.cidade).filter(Boolean))],
  };
  if (gps.erro) return r;

  r.saida = gps.saida;
  r.retorno = gps.retorno;
  r.kmGps = gps.kmGps;

  for (const e of baixasDia) {
    if (!temCoord(e)) {
      r.baixas.push({
        entrega: e, status: "sem_coordenada", permanenciaMin: 0, distMaisProximaM: null,
        paradasNoRaio: [], maisProxima: null, momentoBaixa: null, trecho: null,
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
      trecho: null,
    });
  }
  percursos(r, gps.trajeto, cfg);

  const clientes = entregasRota.filter(temCoord);
  const { saida, retorno } = r;
  if (saida && retorno) {
    for (const p of gps.paradas) {
      if (p.min < LIMITES.paradaSemClienteMin || p.inicio <= saida || p.inicio >= retorno) continue;
      if (clientes.some(c => distM(p.lat, p.lon, c.lat, c.lon) <= raioM)) continue;
      r.paradasSemCliente.qtd++;
      r.paradasSemCliente.min += p.min;
    }

    // Divisão da jornada: cada parada conta só a parte dentro de [saída, retorno].
    const minDentro = (p: Parada) =>
      Math.max(0, (Math.min(p.fim.getTime(), retorno.getTime()) - Math.max(p.inicio.getTime(), saida.getTime())) / 60000);
    let emCliente = 0, semCliente = 0;
    for (const p of gps.paradas) {
      const m = minDentro(p);
      if (!m) continue;
      if (clientes.some(c => distM(p.lat, p.lon, c.lat, c.lon) <= raioM)) emCliente += m;
      else semCliente += m;
    }
    const jornada = (retorno.getTime() - saida.getTime()) / 60000;
    r.tempo = {
      jornadaMin: Math.round(jornada),
      rodandoMin: Math.round(Math.max(0, jornada - emCliente - semCliente)),
      emClienteMin: Math.round(emCliente),
      paradoSemClienteMin: Math.round(semCliente),
    };
    // Chave ligada parado: cada marcha lenta cobre [evento − duração, evento]; conta a parte na jornada.
    let chave = 0;
    for (const e of gps.eventos) {
      if (e.tipo !== "deviceIdle" || !e.duracaoMin) continue;
      const fim = Math.min(e.em.getTime(), retorno.getTime());
      const ini = Math.max(e.em.getTime() - e.duracaoMin * 60000, saida.getTime());
      if (fim <= ini) continue;
      chave += (fim - ini) / 60000;
      r.marchasLentas++;
    }
    r.chaveLigadaMin = Math.round(chave);

    const ultima = gps.paradas.filter(p => p.inicio >= retorno).pop();
    r.ultimaParada = ultima ? { lat: ultima.lat, lon: ultima.lon, inicio: ultima.inicio } : null;
  }
  return r;
}
