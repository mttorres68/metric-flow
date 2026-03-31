/*
 * MetricFlow — Infleet Router
 * Wrapper tRPC para a API GraphQL do Infleet.
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

    listarCercas: publicProcedure.query(async () => {
        const data = await infleetQuery<{ listGeofences: Array<{ id: string; name: string }> }>(
            `query { listGeofences { id name } }`, {}
        );
        return data.listGeofences;
    }),
    // ── ROTA TEMPORÁRIA DE DEBUG (Lê a documentação de dentro da API) ──
    debugSchema: publicProcedure.query(async () => {
        const query = `
        query {
            event: __type(name: "Event") {
                fields { name }
            }
            trip: __type(name: "Trip") {
                fields { name }
            }
            queryType: __type(name: "RootQueryType") {
                fields(includeDeprecated: true) {
                    name
                    args { name type { name kind ofType { name } } }
                }
            }
        }`;

        const data = await infleetQuery<any>(query, {});

        const listGeofenceEvents = data.queryType.fields.find((f: any) => f.name === "listGeofenceEvents");

        console.log("==================================================");
        console.log("📋 DOCUMENTAÇÃO EXTRAÍDA DA INFLEET");
        console.log("==================================================");
        console.log("Campos do tipo EVENT (Geocercas):");
        console.log(data.event.fields.map((f: any) => f.name).join(", "));
        console.log("--------------------------------------------------");
        console.log("Campos do tipo TRIP (Viagens):");
        console.log(data.trip.fields.map((f: any) => f.name).join(", "));
        console.log("--------------------------------------------------");
        console.log("Argumentos exigidos pela query listGeofenceEvents:");
        console.log(listGeofenceEvents?.args.map((a: any) => `${a.name} (${a.type.kind})`).join(", "));
        console.log("==================================================");

        return "Olhe o terminal do Node/Backend!";
    }),
    veiculos: publicProcedure.query(async () => {
        const data = await infleetQuery<{ listVehicles: Array<{ id: string; plate: string; displayName: string | null }> }>(
            `query { listVehicles { id plate displayName } }`, {}
        );
        return data.listVehicles.map(v => ({ id: v.id, placa: v.plate, nome: v.displayName || v.plate }));
    }),

    resumoDiario: publicProcedure
        .input(z.object({
            vehicleIds: z.array(z.string()).min(1),
            periodo: periodoSchema,
            sedeGeofenceId: z.string().optional(),
        }))
        .query(async ({ input }) => {
            const validGeofenceId = input.sedeGeofenceId && input.sedeGeofenceId !== "undefined" ? input.sedeGeofenceId : null;

            const promises = input.vehicleIds.map(async vId => {

                // 1. Viagens: Usando distanceTraveled e os campos exatos do schema
                const tripsRes = await infleetQuery<{ trips: Array<{ startedAt: string, finishedAt: string, distanceTraveled: number }> }>(
                    `query($f: ListVehicleTripsFilterInput!) { trips(filter: $f) { startedAt finishedAt distanceTraveled } }`,
                    { f: { vehicleId: vId, fixTime: { startAt: input.periodo.inicio, endAt: input.periodo.fim } } }
                ).catch(e => {
                    console.error(`[Infleet] Erro ao buscar viagens do veículo ${vId}:`, e.message);
                    return { trips: [] };
                });


                // 2. Geocercas: Query exata do período selecionado (Sem peso morto)
                const geoRes = validGeofenceId ? await infleetQuery<{ listGeofenceEvents: Array<{ slugName: string, reportedAt: string, vehicleId: string }> }>(
                    `query($gId: ID!, $p: PeriodInput!, $limit: Int) { 
                        listGeofenceEvents(geofenceId: $gId, period: $p, limit: $limit) { 
                            reportedAt 
                            slugName
                            vehicleId
                        } 
                    }`,
                    {
                        gId: validGeofenceId,
                        // Agora respeita estritamente o que vem do frontend (sem voltar 7 dias)
                        p: { startAt: input.periodo.inicio, endAt: input.periodo.fim },
                        limit: 5000
                    }
                ).catch(e => {
                    console.error(`[Infleet] Erro ao buscar geocercas do veículo ${vId}:`, e.message);
                    return { listGeofenceEvents: [] };
                }) : { listGeofenceEvents: [] };
                

                const trips = tripsRes.trips || [];
                const events = (geoRes.listGeofenceEvents || []).filter(e => e.vehicleId === vId);

                // ── Cálculos a partir das Viagens ────────────────────────────────────
                trips.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

                let calcKm = 0;
                let calcLigadoMs = 0;

                trips.forEach(t => {
                    const dist = t.distanceTraveled ?? 0;
                    calcKm += dist > 1000 ? (dist / 1000) : dist;
                    const ms = new Date(t.finishedAt).getTime() - new Date(t.startedAt).getTime();
                    if (ms > 0) calcLigadoMs += ms;
                });

                let maiorTempoParadoMin = 0;
                let calcParadoMs = 0;
                const diaInicio = new Date(input.periodo.inicio).getTime();
                const diaFim = Math.min(new Date(input.periodo.fim).getTime(), Date.now());

                if (trips.length > 0) {
                    const preMs = new Date(trips[0].startedAt).getTime() - diaInicio;
                    if (preMs > 0) { calcParadoMs += preMs; maiorTempoParadoMin = Math.max(maiorTempoParadoMin, preMs / 60000); }

                    for (let i = 0; i < trips.length - 1; i++) {
                        const gapMs = new Date(trips[i + 1].startedAt).getTime() - new Date(trips[i].finishedAt).getTime();
                        if (gapMs > 0) { calcParadoMs += gapMs; maiorTempoParadoMin = Math.max(maiorTempoParadoMin, gapMs / 60000); }
                    }

                    const posMs = diaFim - new Date(trips[trips.length - 1].finishedAt).getTime();
                    if (posMs > 0) { calcParadoMs += posMs; maiorTempoParadoMin = Math.max(maiorTempoParadoMin, posMs / 60000); }
                } else {
                    const totalMs = diaFim - diaInicio;
                    if (totalMs > 0) { calcParadoMs += totalMs; maiorTempoParadoMin = totalMs / 60000; }
                }

                // ── Cálculos da Geocerca (COM OS SLUGS EXATOS DA INFLEET) ────────────
                events.sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime());

                let tempoNaSedeMin = 0;
                let lastEntryTime: number | null = null;

                // Agora usamos os nomes exatos que descobrimos no log!
                const isEntry = (ev: any) => ev.slugName === "geofenceEnter";
                const isExit = (ev: any) => ev.slugName === "geofenceExit";

                for (const ev of events) {
                    const time = new Date(ev.reportedAt).getTime();
                    if (isEntry(ev)) {
                        lastEntryTime = time;
                    } else if (isExit(ev)) {
                        // Se houve uma saída sem entrada no período, ele já estava na sede (considera inicio do dia)
                        const start = lastEntryTime !== null ? lastEntryTime : diaInicio;
                        tempoNaSedeMin += Math.round((time - start) / 60000);
                        lastEntryTime = null;
                    }
                }

                // Se teve entrada e ainda não saiu (está na sede até o momento limite)
                if (lastEntryTime !== null) {
                    const limite = Math.min(diaFim, Date.now());
                    if (limite >= lastEntryTime) {
                        tempoNaSedeMin += Math.round((limite - lastEntryTime) / 60000);
                    }
                }

                return {
                    vehicleId: vId,
                    kmRodado: parseFloat(calcKm.toFixed(1)),
                    tempoLigadoMin: Math.round(calcLigadoMs / 60000),
                    tempoParadoMin: Math.round(calcParadoMs / 60000),
                    tempoOciosoMin: 0,
                    qtdIgnicoes: trips.length,
                    maiorTempoParadoMin: Math.round(maiorTempoParadoMin),
                    tempoNaSedeMin,
                    dormiuNaSede: tempoNaSedeMin >= 720
                };
            });

            return await Promise.all(promises);
        }),
});