/*
 * MetricFlow — Infleet Router
 * Wrapper tRPC para a API GraphQL do Infleet.
 *
 * Queries mapeadas conforme documentação "infleet_telemetria_mapeamento.docx":
 *   - dailyVehicleEventSummary  → contagem de paradas por dia
 *   - routeVehicleDetails       → tempo parado/ligado no período
 *   - listGeofenceEvents        → tempo na sede (geocerca)
 *   - listVehicles / listGeofences → inventário
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

const periodoSchema = z.object({
    inicio: z.string(),
    fim: z.string(),
});

export const infleetRouter = router({

    // ── Inventário ────────────────────────────────────────────────────────────

    veiculos: publicProcedure.query(async () => {
        const data = await infleetQuery<{
            listVehicles: Array<{ id: string; plate: string; displayName: string | null }>
        }>(`query { listVehicles { id plate displayName } }`, {});
        return data.listVehicles.map(v => ({ id: v.id, placa: v.plate, nome: v.displayName || v.plate }));
    }),

    listarCercas: publicProcedure.query(async () => {
        const data = await infleetQuery<{
            listGeofences: Array<{ id: string; name: string }>
        }>(`query { listGeofences { id name } }`, {});
        return data.listGeofences;
    }),

    // ── Tipos de evento disponíveis (slugNames) ───────────────────────────────
    // Usar antes de filtrar countEvents por slugName — slugs variam por organização.

    tiposEventos: publicProcedure.query(async () => {
        const data = await infleetQuery<{
            listAvailableEventTypes: Array<{ eventType: string; slugName: string; label: string; tags: string[] }>
        }>(`query { listAvailableEventTypes { eventType slugName label tags } }`, {});
        return data.listAvailableEventTypes;
    }),

    // ── Resumo Diário ─────────────────────────────────────────────────────────
    // Combina:
    //   dailyVehicleEventSummary → qtdParadas (deviceStopped), ignições, ociosidade
    //   routeVehicleDetails      → tempoParadoMin, tempoLigadoMin, kmRodado
    //   listGeofenceEvents       → tempoNaSedeMin (opcional, requer sedeGeofenceId)

    resumoDiario: publicProcedure
        .input(z.object({
            vehicleIds: z.array(z.string()).min(1),
            periodo: periodoSchema,
            sedeGeofenceId: z.string().optional(),
        }))
        .query(async ({ input }) => {
            const validGeofenceId = input.sedeGeofenceId && input.sedeGeofenceId !== "undefined"
                ? input.sedeGeofenceId
                : null;
            const diaInicio = new Date(input.periodo.inicio).getTime();
            const diaFim = Math.min(new Date(input.periodo.fim).getTime(), Date.now());

            const promises = input.vehicleIds.map(async vId => {

                // 1. dailyVehicleEventSummary — KPIs de paradas por dia
                //    Campos-chave: deviceStopped, deviceIdle, ignitionOn, ignitionOff,
                //                  stoppedOutsideGeofence, totalDistance, totalDuration
                const summaryRes = await infleetQuery<{
                    dailyVehicleEventSummary: Array<{
                        date: string;
                        deviceStopped: number;
                        deviceIdle: number;
                        ignitionOff: number;
                        ignitionOn: number;
                        stoppedOutsideGeofence: number;
                        totalDistance: number;
                        totalDuration: number;
                    }>
                }>(
                    `query($filter: VehicleEventSummaryFilterInput!) {
                        dailyVehicleEventSummary(filter: $filter) {
                            date
                            deviceStopped
                            deviceIdle
                            ignitionOff
                            ignitionOn
                            stoppedOutsideGeofence
                            totalDistance
                            totalDuration
                        }
                    }`,
                    {
                        filter: {
                            occurredAt: { startAt: input.periodo.inicio, endAt: input.periodo.fim },
                            vehicleIds: [vId],
                        }
                    }
                ).catch(e => {
                    console.error(`[Infleet] dailyVehicleEventSummary ${vId}:`, e.message);
                    return { dailyVehicleEventSummary: [] };
                });

                // 2. routeVehicleDetails — tempo parado/ligado no período
                //    Campos-chave: totalTimeStopped (s), totalTimeStoppedWithIgnitionOn (s),
                //                  totalTimeWithIgnitionOn (s), totalDistanceTraveled
                const routeRes = await infleetQuery<{
                    routeVehicleDetails: {
                        totalTimeStopped: number;
                        totalTimeStoppedWithIgnitionOn: number;
                        totalTimeWithIgnitionOn: number;
                        totalDistanceTraveled: number;
                        averageSpeed: number;
                        maximumSpeed: number;
                    } | null
                }>(
                    `query($filter: ListVehiclePositionsFilterInput!) {
                        routeVehicleDetails(filter: $filter) {
                            totalTimeStopped
                            totalTimeStoppedWithIgnitionOn
                            totalTimeWithIgnitionOn
                            totalDistanceTraveled
                            averageSpeed
                            maximumSpeed
                        }
                    }`,
                    {
                        filter: {
                            fixTime: { startAt: input.periodo.inicio, endAt: input.periodo.fim },
                            vehicleId: vId,
                        }
                    }
                ).catch(e => {
                    console.error(`[Infleet] routeVehicleDetails ${vId}:`, e.message);
                    return { routeVehicleDetails: null };
                });

                // 3. listGeofenceEvents — tempo na sede (geocerca selecionada)
                const geoRes = validGeofenceId
                    ? await infleetQuery<{
                        listGeofenceEvents: Array<{ slugName: string; reportedAt: string; vehicleId: string }>
                    }>(
                        `query($gId: ID!, $p: PeriodInput!, $limit: Int) {
                            listGeofenceEvents(geofenceId: $gId, period: $p, limit: $limit) {
                                reportedAt
                                slugName
                                vehicleId
                            }
                        }`,
                        {
                            gId: validGeofenceId,
                            p: { startAt: input.periodo.inicio, endAt: input.periodo.fim },
                            limit: 5000,
                        }
                    ).catch(e => {
                        console.error(`[Infleet] listGeofenceEvents ${vId}:`, e.message);
                        return { listGeofenceEvents: [] };
                    })
                    : { listGeofenceEvents: [] };

                // ── Agregações do sumário diário ─────────────────────────────────
                const summary = summaryRes.dailyVehicleEventSummary || [];
                let totalDeviceStopped    = summary.reduce((s, d) => s + (d.deviceStopped || 0), 0);
                let totalDeviceIdle       = summary.reduce((s, d) => s + (d.deviceIdle || 0), 0);
                let totalIgnitionOn       = summary.reduce((s, d) => s + (d.ignitionOn || 0), 0);
                let totalIgnitionOff      = summary.reduce((s, d) => s + (d.ignitionOff || 0), 0);
                let totalParadasForaCerca = summary.reduce((s, d) => s + (d.stoppedOutsideGeofence || 0), 0);

                // Fallback: dailyVehicleEventSummary só agrega dias encerrados.
                // Se hoje está no período, usa countEvents (tempo real) para cobrir o dia atual.
                const todayStr = new Date().toISOString().slice(0, 10);
                const endDateStr  = input.periodo.fim.slice(0, 10);
                const startDateStr = input.periodo.inicio.slice(0, 10);
                const includeToday = endDateStr >= todayStr && startDateStr <= todayStr;
                const summaryTemToday = summary.some(d => d.date?.slice(0, 10) === todayStr);

                if (includeToday && !summaryTemToday) {
                    // Período do dia corrente (respeita o fuso -03:00 do periodoIntervalo)
                    const todayStart = `${todayStr}T00:00:00-03:00`;
                    const todayEnd   = `${todayStr}T23:59:59-03:00`;

                    const countSlug = async (slugName: string): Promise<number> => {
                        try {
                            const r = await infleetQuery<{ countEvents: number }>(
                                `query($filter: CountEventsFilterInput!) { countEvents(filter: $filter) }`,
                                { filter: { slugNames: [slugName], vehicleIds: [vId], reportedAt: { startAt: todayStart, endAt: todayEnd } } }
                            );
                            return r.countEvents ?? 0;
                        } catch { return 0; }
                    };

                    const [cStopped, cIdle, cIgnOn, cIgnOff, cOutside] = await Promise.all([
                        countSlug("device_stopped"),
                        countSlug("device_idle"),
                        countSlug("ignition_on"),
                        countSlug("ignition_off"),
                        countSlug("stopped_outside_geofence"),
                    ]);

                    totalDeviceStopped    += cStopped;
                    totalDeviceIdle       += cIdle;
                    totalIgnitionOn       += cIgnOn;
                    totalIgnitionOff      += cIgnOff;
                    totalParadasForaCerca += cOutside;
                }

                // ── Métricas de rota (routeVehicleDetails) ───────────────────────
                const route = routeRes.routeVehicleDetails;

                // KM: prefere routeVehicleDetails; fallback para soma do sumário diário
                const rawKm = route?.totalDistanceTraveled
                    ?? summary.reduce((s, d) => s + (d.totalDistance || 0), 0);
                const kmRodado = parseFloat((rawKm > 1000 ? rawKm / 1000 : rawKm).toFixed(1));

                // Tempos em minutos (routeVehicleDetails retorna segundos)
                const tempoLigadoMin  = route ? Math.round((route.totalTimeWithIgnitionOn || 0) / 60) : 0;
                const tempoParadoMin  = route ? Math.round((route.totalTimeStopped || 0) / 60) : 0;
                // Tempo parado COM ignição ligada = ociosidade real
                const tempoOciosoMin  = route ? Math.round((route.totalTimeStoppedWithIgnitionOn || 0) / 60) : 0;

                const velMediaKmh = route?.averageSpeed ?? 0;
                const velMaxKmh   = route?.maximumSpeed  ?? 0;

                // ── Geocerca (sede): tempo dentro da cerca no período ────────────
                const events = (geoRes.listGeofenceEvents || []).filter(e => e.vehicleId === vId);
                events.sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime());

                let tempoNaSedeMin = 0;
                let lastEntryTime: number | null = null;

                for (const ev of events) {
                    const time = new Date(ev.reportedAt).getTime();
                    if (ev.slugName === "geofenceEnter") {
                        lastEntryTime = time;
                    } else if (ev.slugName === "geofenceExit") {
                        const start = lastEntryTime !== null ? lastEntryTime : diaInicio;
                        tempoNaSedeMin += Math.round((time - start) / 60000);
                        lastEntryTime = null;
                    }
                }
                // Veículo ainda dentro da cerca ao fim do período
                if (lastEntryTime !== null) {
                    const limite = Math.min(diaFim, Date.now());
                    if (limite >= lastEntryTime) {
                        tempoNaSedeMin += Math.round((limite - lastEntryTime) / 60000);
                    }
                }

                return {
                    vehicleId: vId,
                    // ── Métricas de rota ─────────────────────────────────────────
                    kmRodado,
                    tempoLigadoMin,
                    tempoParadoMin,
                    tempoOciosoMin,
                    velMediaKmh: parseFloat(velMediaKmh.toFixed(1)),
                    velMaxKmh:   parseFloat(velMaxKmh.toFixed(1)),
                    // ── Contadores de paradas (dailyVehicleEventSummary) ─────────
                    qtdParadas:          totalDeviceStopped,    // deviceStopped: transições → parado
                    qtdOciosas:          totalDeviceIdle,       // deviceIdle: parado c/ motor ligado
                    qtdIgnicoes:         totalIgnitionOn,       // ignitionOn: partidas
                    qtdIgnicoesOff:      totalIgnitionOff,      // ignitionOff: desligamentos
                    qtdParadasForaCerca: totalParadasForaCerca, // stoppedOutsideGeofence
                    // ── Geocerca ─────────────────────────────────────────────────
                    tempoNaSedeMin,
                    dormiuNaSede: tempoNaSedeMin >= 720,
                    // Compatibilidade com coluna legada "Maior Parada"
                    maiorTempoParadoMin: tempoParadoMin,
                };
            });

            return await Promise.all(promises);
        }),

    // ── Viagens: ignitionOn → ignitionOff com cidade ─────────────────────────
    // Lista todos os eventos de ignição no período para os veículos selecionados,
    // pareia cada ignitionOn com o próximo ignitionOff e extrai a cidade do address.

    viagens: publicProcedure
        .input(z.object({
            vehicleIds: z.array(z.string()).min(1),
            periodo: periodoSchema,
        }))
        .query(async ({ input }) => {
            const QUERY = `
                query($filter: ListEventsFilterInput!, $limit: Int) {
                    listEvents(filter: $filter, limit: $limit) {
                        id
                        reportedAt
                        slugName
                        address
                    }
                }
            `;

            // Extrai cidade do endereço brasileiro: "Rua X, Cidade, Estado, Brasil"
            const extractCity = (address: string | null): string => {
                if (!address) return "—";
                const parts = address.split(",");
                return parts[1]?.trim() ?? parts[0]?.trim() ?? "—";
            };

            type Viagem = {
                ignitionOn: { time: string; city: string };
                ignitionOff: { time: string; city: string } | null;
                duracaoMin: number | null;
            };

            // Uma query por veículo para garantir separação correta dos eventos
            const promises = input.vehicleIds.map(async (vId) => {
                const data = await infleetQuery<{
                    listEvents: Array<{
                        id: string;
                        reportedAt: string;
                        slugName: string;
                        address: string | null;
                    }>
                }>(QUERY, {
                    filter: {
                        vehicleIds: [vId],
                        slugNames: ["ignitionOn", "ignitionOff"],
                        reportedAt: { startAt: input.periodo.inicio, endAt: input.periodo.fim },
                    },
                    limit: 5000,
                }).catch(e => {
                    console.error(`[Infleet] listEvents viagens ${vId}:`, e.message);
                    return { listEvents: [] };
                });

                const events = (data.listEvents ?? []).sort(
                    (a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()
                );

                const viagens: Viagem[] = [];
                let pendingOn: { reportedAt: string; address: string | null } | null = null;

                for (const ev of events) {
                    if (ev.slugName === "ignitionOn") {
                        pendingOn = ev;
                    } else if (ev.slugName === "ignitionOff" && pendingOn) {
                        const onMs  = new Date(pendingOn.reportedAt).getTime();
                        const offMs = new Date(ev.reportedAt).getTime();
                        viagens.push({
                            ignitionOn:  { time: pendingOn.reportedAt, city: extractCity(pendingOn.address) },
                            ignitionOff: { time: ev.reportedAt,        city: extractCity(ev.address) },
                            duracaoMin:  Math.round((offMs - onMs) / 60_000),
                        });
                        pendingOn = null;
                    }
                }

                // ignitionOn sem ignitionOff correspondente (veículo ainda ligado)
                if (pendingOn) {
                    viagens.push({
                        ignitionOn:  { time: pendingOn.reportedAt, city: extractCity(pendingOn.address) },
                        ignitionOff: null,
                        duracaoMin:  null,
                    });
                }

                return { vehicleId: vId, viagens };
            });

            return await Promise.all(promises);
        }),

    // ── Debug: introspecção do schema da API ──────────────────────────────────
    debugSchema: publicProcedure.query(async () => {
        const query = `
        query {
            queryType: __type(name: "RootQueryType") {
                fields(includeDeprecated: true) { name }
            }
            summaryFilter: __type(name: "VehicleEventSummaryFilterInput") {
                inputFields { name type { name kind ofType { name } } }
            }
            routeFilter: __type(name: "ListVehiclePositionsFilterInput") {
                inputFields { name type { name kind ofType { name } } }
            }
        }`;
        const data = await infleetQuery<any>(query, {});
        console.log("==================================================");
        console.log("📋 SCHEMA INFLEET — Queries disponíveis:");
        console.log(data.queryType.fields.map((f: any) => f.name).join(", "));
        console.log("--------------------------------------------------");
        console.log("VehicleEventSummaryFilterInput fields:");
        console.log(data.summaryFilter?.inputFields?.map((f: any) => f.name).join(", ") ?? "não encontrado");
        console.log("--------------------------------------------------");
        console.log("ListVehiclePositionsFilterInput fields:");
        console.log(data.routeFilter?.inputFields?.map((f: any) => f.name).join(", ") ?? "não encontrado");
        console.log("==================================================");
        return "Verifique o terminal do backend.";
    }),
});
