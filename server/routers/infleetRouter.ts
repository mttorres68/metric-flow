/*
 * MetricFlow — Infleet Router
 * Wrapper tRPC para a API GraphQL do Infleet.
 *
 * Autenticação: Bearer token via variável de ambiente INFLEET_TOKEN
 * Endpoint:     https://api.infleet.com.br/v1/graphql
 *
 * Queries implementadas:
 *   veiculos          — lista todos os veículos ativos (nome, placa, id)
 *   resumoDiario      — km, tempo ligado, parado, ocioso por veículo/dia
 *   eventosGeocerca   — entradas/saídas em cercas por veículo/período
 *   viagens           — lista de viagens (trips) por veículo/período
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

const INFLEET_ENDPOINT = "https://api.infleet.com.br/v1/graphql";

// ── Helper: executa query GraphQL no Infleet ──────────────────────────────────
async function infleetQuery<T>(query: string, variables: Record<string, any>): Promise<T> {
    const token = process.env.INFLEET_TOKEN;
    if (!token) throw new Error("INFLEET_TOKEN não configurado no ambiente.");

    const res = await fetch(INFLEET_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) throw new Error(`Infleet API HTTP ${res.status}: ${await res.text()}`);

    const json = await res.json() as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join("; "));
    if (!json.data) throw new Error("Resposta vazia da API Infleet");

    return json.data;
}

// ── Schema de período reutilizável ────────────────────────────────────────────
const periodoSchema = z.object({
    inicio: z.string(), // ISO 8601 com timezone: "2026-03-18T00:00:00-03:00"
    fim: z.string(), // ISO 8601 com timezone: "2026-03-18T23:59:59-03:00"
});

// ─────────────────────────────────────────────────────────────────────────────

export const infleetRouter = router({

    // ── Lista veículos ──────────────────────────────────────────────────────────
    // Retorna id, placa e nome para popular o select de veículos.
    veiculos: publicProcedure.query(async () => {
        const data = await infleetQuery<{
            listVehicles: Array<{ id: string; plate: string; displayName: string | null }>
        }>(
            `query {
        listVehicles {
          id
          plate
          displayName
        }
      }`,
            {}
        );
        return data.listVehicles.map(v => ({
            id: v.id,
            placa: v.plate,
            nome: v.displayName || v.plate,
        }));
    }),

    // ── Resumo diário por veículo ───────────────────────────────────────────────
    // Agrega km rodado, tempo ligado, parado e ocioso.
    // Permite cruzar com quem estava dirigindo cada carro no dia (GV/GA/TRD/motorista).
    resumoDiario: publicProcedure
        .input(z.object({
            vehicleIds: z.array(z.string()).min(1),
            periodo: periodoSchema,
        }))
        .query(async ({ input }) => {
            const filter = {
                vehicleIds: input.vehicleIds,
                occurredAt: { startAt: input.periodo.inicio, endAt: input.periodo.fim },
            };

            // Dispara as 4 queries de indicadores em paralelo
            const [distData, ignData, stoppedData, idleData] = await Promise.all([
                infleetQuery<{ totalDistance: Array<{ vehicleId: string; total: number }> }>(
                    `query($f: IndicatorInput!) { totalDistance(filter: $f) { vehicleId total } }`,
                    { f: filter }
                ),
                infleetQuery<{ totalTimeWithIgnitionOn: Array<{ vehicleId: string; total: number }> }>(
                    `query($f: IndicatorInput!) { totalTimeWithIgnitionOn(filter: $f) { vehicleId total } }`,
                    { f: filter }
                ),
                infleetQuery<{ totalTimeStopped: Array<{ vehicleId: string; total: number }> }>(
                    `query($f: IndicatorInput!) { totalTimeStopped(filter: $f) { vehicleId total } }`,
                    { f: filter }
                ),
                infleetQuery<{ totalTimeIdle: Array<{ vehicleId: string; total: number }> }>(
                    `query($f: IndicatorInput!) { totalTimeIdle(filter: $f) { vehicleId total } }`,
                    { f: filter }
                ),
            ]);

            // Indexa por vehicleId para merge rápido
            const idx = <T extends { vehicleId: string; value: number }>(arr: T[]) =>
                Object.fromEntries(arr.map(r => [r.vehicleId, r.total ?? 0]));

            const dist = idx(distData.totalDistance);
            const ign = idx(ignData.totalTimeWithIgnitionOn);
            const stopped = idx(stoppedData.totalTimeStopped);
            const idle = idx(idleData.totalTimeIdle);

            return input.vehicleIds.map(id => ({
                vehicleId: id,
                kmRodado: parseFloat(((dist[id] ?? 0) / 1000).toFixed(1)),  // metros → km
                tempoLigadoMin: Math.round((ign[id] ?? 0) / 60),                // segundos → min
                tempoParadoMin: Math.round((stopped[id] ?? 0) / 60),
                tempoOciosoMin: Math.round((idle[id] ?? 0) / 60),
            }));
        }),

    // ── Eventos de geocerca ─────────────────────────────────────────────────────
    // Retorna entradas e saídas por veículo em cercas específicas (ex: sede).
    eventosGeocerca: publicProcedure
        .input(z.object({
            vehicleIds: z.array(z.string()).min(1),
            geofenceIds: z.array(z.string()).optional(),
            periodo: periodoSchema,
        }))
        .query(async ({ input }) => {
            const data = await infleetQuery<{
                listGeofenceEvents: Array<{
                    id: string;
                    type: string;
                    occurredAt: string;
                    vehicle: { id: string; displayName: string | null; plate: string };
                    geofence: { id: string; name: string };
                }>
            }>(
                `query($f: ListGeofencesFilterInput) {
          listGeofenceEvents(filter: $f) {
            id type occurredAt
            vehicle { id displayName plate }
            geofence { id name }
          }
        }`,
                {
                    f: {
                        vehicleIds: input.vehicleIds,
                        geofenceIds: input.geofenceIds,
                        occurredAt: { gte: input.periodo.inicio, lte: input.periodo.fim },
                    },
                }
            );

            return data.listGeofenceEvents.map(e => ({
                id: e.id,
                tipo: e.type === "entry" ? "entrada" : "saída",
                ocorridoEm: e.occurredAt,
                vehicleId: e.vehicle.id,
                veiculo: e.vehicle.displayName || e.vehicle.plate,
                geocercaId: e.geofence.id,
                geocerca: e.geofence.name,
            }));
        }),

    // ── Viagens do período ──────────────────────────────────────────────────────
    // Lista viagens (início/fim de ignição) para análise de movimentação do dia.
    viagens: publicProcedure
        .input(z.object({
            vehicleIds: z.array(z.string()).min(1),
            periodo: periodoSchema,
        }))
        .query(async ({ input }) => {
            const data = await infleetQuery<{
                trips: Array<{
                    id: string;
                    startedAt: string;
                    endedAt: string;
                    distance: number;
                    vehicle: { id: string; displayName: string | null; plate: string };
                    driver?: { id: string; name: string } | null;
                }>
            }>(
                `query($f: ListVehicleTripsFilterInput!) {
          trips(filter: $f) {
            id startedAt endedAt distance
            vehicle { id displayName plate }
            driver  { id name }
          }
        }`,
                {
                    f: {
                        vehicleIds: input.vehicleIds,
                        startedAt: { gte: input.periodo.inicio, lte: input.periodo.fim },
                    },
                }
            );

            return data.trips.map(t => ({
                id: t.id,
                inicio: t.startedAt,
                fim: t.endedAt,
                kmRodado: parseFloat(((t.distance ?? 0) / 1000).toFixed(1)),
                vehicleId: t.vehicle.id,
                veiculo: t.vehicle.displayName || t.vehicle.plate,
                motorista: t.driver?.name ?? null,
            }));
        }),
});