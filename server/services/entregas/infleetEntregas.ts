/*
 * MetricFlow — busca do GPS no Infleet para uma linha do relatório de entregas.
 * Posições sempre em blocos de 6 h (limite de listVehiclePositions não documentado).
 * buscarGpsLinha nunca lança: falhas viram GpsLinha.erro e a linha sai "sem GPS".
 */
import { infleetQuery } from "../../routers/infleetRouter";
import { detectarParadas, trajetoAcumulado, type Posicao } from "./detectarParadas";
import type { EventoGps, GpsLinha, TipoEvento } from "./cruzar";
import { LIMITES } from "@shared/entregas";

/** Fator do `speed` do Infleet para km/h — medido na sonda (spec §2): já vem em km/h. */
export const SPEED_PARA_KMH = 1;
const BLOCO_MS = 6 * 3600000;

/** infleetQuery com uma nova tentativa: o Infleet às vezes devolve 502 passageiro. */
async function consultar<T>(query: string, variables: Record<string, unknown>, token?: string): Promise<T> {
  try {
    return await infleetQuery<T>(query, variables, token);
  } catch {
    await new Promise(r => setTimeout(r, 500)); // ponytail: 1 nova tentativa fixa; backoff se o Infleet piorar
    return infleetQuery<T>(query, variables, token);
  }
}

export const normalizarPlaca =(p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** token: conta Infleet da revenda (sem = INFLEET_TOKEN do .env). */
export async function mapaVeiculos(token?: string): Promise<Map<string, string>> {
  const { listVehicles } = await consultar<{ listVehicles: { id: string; plate: string }[] }>(
    `query { listVehicles { id plate } }`, {}, token);
  return new Map(listVehicles.map(v => [normalizarPlaca(v.plate), v.id]));
}

export function blocos(inicio: Date, fim: Date): { startAt: string; endAt: string }[] {
  const out: { startAt: string; endAt: string }[] = [];
  for (let t = inicio.getTime(); t < fim.getTime(); t += BLOCO_MS) {
    out.push({ startAt: new Date(t).toISOString(), endAt: new Date(Math.min(t + BLOCO_MS, fim.getTime())).toISOString() });
  }
  return out;
}

/** Km rodado pelo veículo no período (aceita vários dias numa consulta só). */
export async function kmNoPeriodo(vehicleId: string, inicio: Date, fim: Date, token?: string): Promise<number | null> {
  const km = await consultar<{ routeVehicleDetails: { totalDistanceTraveled: number } | null }>(Q_KM, {
    filter: { vehicleId, fixTime: { startAt: inicio.toISOString(), endAt: fim.toISOString() } },
  }, token);
  const raw = km.routeVehicleDetails?.totalDistanceTraveled ?? null;
  // Mesma conversão de unidade do resumoDiario (infleetRouter.ts).
  return raw === null ? null : Math.round((raw > 1000 ? raw / 1000 : raw) * 10) / 10;
}

/** Cercas da conta Infleet da revenda (sem token = INFLEET_TOKEN). */
export async function listarCercasInfleet(token?: string): Promise<{ id: string; name: string }[]> {
  const { listGeofences } = await consultar<{ listGeofences: { id: string; name: string }[] }>(`query { listGeofences { id name } }`, {}, token);
  return listGeofences;
}

export const gpsErro = (erro: string): GpsLinha =>
  ({ erro, paradas: [], saida: null, saidaOrigem: "gps", retorno: null, retornoOrigem: "gps", kmGps: null, eventos: [], trajeto: { t: [], km: [] } });

const TIPOS_EVENTO: TipoEvento[] = ["geofenceExit", "geofenceEnter", "deviceIdle", "ignitionOn", "ignitionOff", "deviceStopped", "deviceMoving"];
const Q_EVENTOS = `query($filter: ListEventsFilterInput!) {
  listEvents(filter: $filter) { slugName reportedAt address latitude longitude geofenceId geofence { name } attributes }
}`;
type EventoInfleet = {
  slugName: string; reportedAt: string; address?: string | null; latitude?: number; longitude?: number;
  geofenceId?: string | null; geofence?: { name: string } | null; attributes?: Record<string, unknown> | null;
};

/** Eventos do veículo na janela (só os tipos que a análise usa), em ordem de horário. */
async function eventosDoDia(vehicleId: string, janela: { inicio: Date; fim: Date }, token?: string): Promise<EventoGps[]> {
  const { listEvents } = await consultar<{ listEvents: EventoInfleet[] }>(Q_EVENTOS, {
    filter: {
      vehicleIds: [vehicleId],
      slugNames: TIPOS_EVENTO,
      reportedAt: { startAt: janela.inicio.toISOString(), endAt: janela.fim.toISOString() },
    },
  }, token);
  return (listEvents ?? [])
    .filter(e => (TIPOS_EVENTO as string[]).includes(e.slugName))
    .map(e => {
      const dur = Number(e.attributes?.duration);
      return {
        tipo: e.slugName as TipoEvento,
        em: new Date(e.reportedAt),
        endereco: e.address ?? null,
        lat: e.latitude ?? 0,
        lon: e.longitude ?? 0,
        cercaId: e.geofenceId ?? null,
        cerca: e.geofence?.name ?? null,
        duracaoMin: e.slugName === "deviceIdle" && Number.isFinite(dur) ? Math.round(dur / 60) : null, // segundos → min
      };
    })
    .sort((a, b) => a.em.getTime() - b.em.getTime());
}

const Q_POSICOES = `query($filter: ListVehiclePositionsFilterInput!) {
  listVehiclePositions(filter: $filter) { latitude longitude fixTime speed valid }
}`;
const Q_KM = `query($filter: ListVehiclePositionsFilterInput!) {
  routeVehicleDetails(filter: $filter) { totalDistanceTraveled }
}`;

type PosicaoInfleet = { latitude: number; longitude: number; fixTime: string; speed: number; valid: boolean };

/**
 * Períodos do caminhão dentro da cerca no dia (ms; `ate` null = ainda dentro no fim da janela).
 * Uma saída sem entrada antes = o dia começou dentro. Saídas de menos de LIMITES.cercaManobraMin
 * (manobra na borda da cerca) são juntadas ao período.
 */
function periodosNaCerca(eventos: EventoGps[], cercaId: string, inicioJanela: Date) {
  const ps: { de: number; ate: number | null }[] = [];
  for (const e of eventos) {
    if (e.cercaId !== cercaId) continue;
    const t = e.em.getTime(), atual = ps[ps.length - 1];
    if (e.tipo === "geofenceEnter" && (!atual || atual.ate !== null)) ps.push({ de: t, ate: null });
    else if (e.tipo === "geofenceExit") {
      if (!atual) ps.push({ de: inicioJanela.getTime(), ate: t });
      else if (atual.ate === null) atual.ate = t;
    }
  }
  const tol = LIMITES.cercaManobraMin * 60000;
  const juntos: typeof ps = [];
  for (const p of ps) {
    const ant = juntos[juntos.length - 1];
    if (ant && ant.ate !== null && p.de - ant.ate < tol) ant.ate = p.ate;
    else juntos.push({ ...p });
  }
  return juntos;
}

/**
 * cercaId: quando informado, saída = quando saiu da cerca, se o dia começou dentro dela (dormiu na revenda);
 * retorno = entrada do período em que o caminhão termina o dia dentro da cerca. Manobras na borda
 * (saiu e entrou em menos de LIMITES.cercaManobraMin) não contam. Sem o evento, vale o GPS.
 */
export async function buscarGpsLinha(
  vehicleId: string, janela: { inicio: Date; fim: Date }, { cercaId, token }: { cercaId?: string; token?: string } = {},
): Promise<GpsLinha> {
  try {
    const posicoes: Posicao[] = [];
    for (const fixTime of blocos(janela.inicio, janela.fim)) {
      const r = await consultar<{ listVehiclePositions: PosicaoInfleet[] }>(Q_POSICOES, { filter: { vehicleId, fixTime } }, token);
      for (const p of r.listVehiclePositions) {
        posicoes.push({ lat: p.latitude, lon: p.longitude, em: new Date(p.fixTime), kmh: p.speed * SPEED_PARA_KMH, valida: p.valid });
      }
    }
    if (!posicoes.length) return gpsErro("sem sinal GPS");

    const kmGps = await kmNoPeriodo(vehicleId, janela.inicio, janela.fim, token);

    const gps = detectarParadas(posicoes);
    const eventos = await eventosDoDia(vehicleId, janela, token);
    const r: GpsLinha = { erro: null, ...gps, saidaOrigem: "gps", retornoOrigem: "gps", kmGps, eventos, trajeto: trajetoAcumulado(posicoes) };
    if (!cercaId) return r;

    const ps = periodosNaCerca(eventos, cercaId, janela.inicio);
    const primeiro = ps[0], ultimo = ps[ps.length - 1];
    // Saída pela cerca só se o dia começou dentro dela (dormiu na revenda).
    if (primeiro && primeiro.de === janela.inicio.getTime() && primeiro.ate !== null) {
      r.saida = new Date(primeiro.ate);
      r.saidaOrigem = "cerca";
    }
    // Retorno pela cerca: a entrada do período em que o caminhão termina o dia dentro dela.
    if (ultimo && ultimo.ate === null && (!r.saida || ultimo.de > r.saida.getTime())) {
      r.retorno = new Date(ultimo.de);
      r.retornoOrigem = "cerca";
    }
    return r;
  } catch (e) {
    // Só a 1ª linha, sem a página HTML que o Infleet devolve em erro de gateway.
    const msg = (e as Error).message.split("\n")[0].replace(/:\s*<.*$/, "").slice(0, 160);
    return gpsErro(`falha no Infleet: ${msg}`);
  }
}
