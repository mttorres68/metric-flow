/*
 * MetricFlow — busca do GPS no Infleet para uma linha do relatório de entregas.
 * Posições sempre em blocos de 6 h (limite de listVehiclePositions não documentado).
 * buscarGpsLinha nunca lança: falhas viram GpsLinha.erro e a linha sai "sem GPS".
 */
import { infleetQuery } from "../../routers/infleetRouter";
import { detectarParadas, type Posicao } from "./detectarParadas";
import type { GpsLinha } from "./cruzar";

/** Fator do `speed` do Infleet para km/h — medido na sonda (spec §2): já vem em km/h. */
export const SPEED_PARA_KMH = 1;
const BLOCO_MS = 6 * 3600000;

export const normalizarPlaca = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function mapaVeiculos(): Promise<Map<string, string>> {
  const { listVehicles } = await infleetQuery<{ listVehicles: { id: string; plate: string }[] }>(
    `query { listVehicles { id plate } }`, {});
  return new Map(listVehicles.map(v => [normalizarPlaca(v.plate), v.id]));
}

export function blocos(inicio: Date, fim: Date): { startAt: string; endAt: string }[] {
  const out: { startAt: string; endAt: string }[] = [];
  for (let t = inicio.getTime(); t < fim.getTime(); t += BLOCO_MS) {
    out.push({ startAt: new Date(t).toISOString(), endAt: new Date(Math.min(t + BLOCO_MS, fim.getTime())).toISOString() });
  }
  return out;
}

export const gpsErro = (erro: string): GpsLinha =>
  ({ erro, paradas: [], saida: null, saidaOrigem: "gps", retorno: null, kmGps: null });

const Q_SAIDA_CERCA = `query($filter: ListEventsFilterInput!) {
  listEvents(filter: $filter) { reportedAt geofenceId }
}`;

/** 1ª saída do veículo da cerca escolhida dentro da janela (evento "Saiu da cerca" do Infleet). */
async function saidaDaCerca(vehicleId: string, janela: { inicio: Date; fim: Date }, cercaId: string): Promise<Date | null> {
  const { listEvents } = await infleetQuery<{ listEvents: { reportedAt: string; geofenceId: string | null }[] }>(Q_SAIDA_CERCA, {
    filter: {
      vehicleIds: [vehicleId],
      slugNames: ["geofenceExit"],
      reportedAt: { startAt: janela.inicio.toISOString(), endAt: janela.fim.toISOString() },
    },
  });
  const tempos = listEvents.filter(e => e.geofenceId === cercaId).map(e => new Date(e.reportedAt).getTime());
  return tempos.length ? new Date(Math.min(...tempos)) : null;
}

const Q_POSICOES = `query($filter: ListVehiclePositionsFilterInput!) {
  listVehiclePositions(filter: $filter) { latitude longitude fixTime speed valid }
}`;
const Q_KM = `query($filter: ListVehiclePositionsFilterInput!) {
  routeVehicleDetails(filter: $filter) { totalDistanceTraveled }
}`;

type PosicaoInfleet = { latitude: number; longitude: number; fixTime: string; speed: number; valid: boolean };

/** cercaId: quando informado, a saída é a 1ª saída dessa cerca na janela (se houver); senão, o GPS. */
export async function buscarGpsLinha(vehicleId: string, janela: { inicio: Date; fim: Date }, cercaId?: string): Promise<GpsLinha> {
  try {
    const posicoes: Posicao[] = [];
    for (const fixTime of blocos(janela.inicio, janela.fim)) {
      const r = await infleetQuery<{ listVehiclePositions: PosicaoInfleet[] }>(Q_POSICOES, { filter: { vehicleId, fixTime } });
      for (const p of r.listVehiclePositions) {
        posicoes.push({ lat: p.latitude, lon: p.longitude, em: new Date(p.fixTime), kmh: p.speed * SPEED_PARA_KMH, valida: p.valid });
      }
    }
    if (!posicoes.length) return gpsErro("sem sinal GPS");

    const km = await infleetQuery<{ routeVehicleDetails: { totalDistanceTraveled: number } | null }>(Q_KM, {
      filter: { vehicleId, fixTime: { startAt: janela.inicio.toISOString(), endAt: janela.fim.toISOString() } },
    });
    const raw = km.routeVehicleDetails?.totalDistanceTraveled ?? null;
    // Mesma conversão de unidade do resumoDiario (infleetRouter.ts).
    const kmGps = raw === null ? null : Math.round((raw > 1000 ? raw / 1000 : raw) * 10) / 10;

    const gps = detectarParadas(posicoes);
    const pelaCerca = cercaId ? await saidaDaCerca(vehicleId, janela, cercaId) : null;
    return pelaCerca
      ? { erro: null, ...gps, saida: pelaCerca, saidaOrigem: "cerca", kmGps }
      : { erro: null, ...gps, saidaOrigem: "gps", kmGps };
  } catch (e) {
    return gpsErro(`falha no Infleet: ${(e as Error).message}`);
  }
}
