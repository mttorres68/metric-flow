/*
 * MetricFlow — Clientes Router
 * Endpoints tRPC para análise individual de clientes.
 *
 * Diferença em relação ao complianceRouter:
 *   - Não filtra por status — mostra TODAS as visitas (convertidas, não convertidas, sem visita)
 *   - O foco é no histórico completo do cliente, não nos motivos de não conversão
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getVisitasData } from "../services/dataCache";

// Input de filtros compartilhado entre os endpoints
const filtrosSchema = z.object({
    revenda: z.string().optional(),
    vendedor: z.number().optional(),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
});

export const clientesRouter = router({

    // ── LISTA: tabela principal de clientes com resumo ────────────────────
    listar: publicProcedure
        .input(filtrosSchema)
        .query(async ({ input }) => {
            let visitas = await getVisitasData();

            if (input.revenda) visitas = visitas.filter(v => v.revenda === input.revenda);
            if (input.vendedor) visitas = visitas.filter(v => v.vendedor === input.vendedor);
            if (input.dataInicio) visitas = visitas.filter(v => v.data >= input.dataInicio!);
            if (input.dataFim) visitas = visitas.filter(v => v.data <= input.dataFim!);

            // Agrupa todas as visitas por cliente
            const mapa: Record<number, {
                codCliente: number;
                cliente: string;
                revenda: string;
                totalVisitas: number;
                convertidas: number;
                naoConvertidas: number;
                semVisita: number;
                vendedores: Set<number>;
                ultimaVisita: string;
                motivoFrequente: Record<string, number>; // acumulador temporário
                visitas: Array<{
                    data: string;
                    vendedor: number;
                    horaInicio: string;
                    horaFim: string;
                    duracao: string;
                    distPV: string;
                    status: string;
                    motivo: string;
                }>;
            }> = {};

            for (const v of visitas) {
                if (!mapa[v.codCliente]) {
                    mapa[v.codCliente] = {
                        codCliente: v.codCliente,
                        cliente: v.cliente,
                        revenda: v.revenda,
                        totalVisitas: 0,
                        convertidas: 0,
                        naoConvertidas: 0,
                        semVisita: 0,
                        vendedores: new Set(),
                        ultimaVisita: v.data,
                        motivoFrequente: {},
                        visitas: [],
                    };
                }

                const c = mapa[v.codCliente];
                c.totalVisitas++;
                c.vendedores.add(v.vendedor);
                if (v.data > c.ultimaVisita) c.ultimaVisita = v.data;

                if (v.status === "convertido") c.convertidas++;
                else if (v.status === "sem_visita") c.semVisita++;
                else c.naoConvertidas++;

                // Acumula motivos (ignora os padrões de convertido/sem_visita)
                if (v.status === "nao_convertido") {
                    c.motivoFrequente[v.motivo] = (c.motivoFrequente[v.motivo] || 0) + 1;
                }

                c.visitas.push({
                    data: v.data,
                    vendedor: v.vendedor,
                    horaInicio: v.horaInicio,
                    horaFim: v.horaFim,
                    duracao: v.tempoVisita,
                    distPV: v.distPV,
                    status: v.status,
                    motivo: v.motivo,
                });
            }

            return Object.values(mapa).map(c => {
                // Determina o motivo mais frequente de não conversão
                const motivoFrequente = Object.entries(c.motivoFrequente).length > 0
                    ? Object.entries(c.motivoFrequente).sort((a, b) => b[1] - a[1])[0][0]
                    : null;

                // Status predominante: o que mais aparece
                const statusPred = c.convertidas >= c.naoConvertidas && c.convertidas >= c.semVisita
                    ? "convertido"
                    : c.naoConvertidas >= c.semVisita
                        ? "nao_convertido"
                        : "sem_visita";

                return {
                    codCliente: c.codCliente,
                    cliente: c.cliente,
                    revenda: c.revenda,
                    totalVisitas: c.totalVisitas,
                    convertidas: c.convertidas,
                    naoConvertidas: c.naoConvertidas,
                    semVisita: c.semVisita,
                    vendedoresList: Array.from(c.vendedores).sort().map(v => `V0${v}`),
                    ultimaVisita: c.ultimaVisita,
                    motivoFrequente,
                    statusPredominante: statusPred,
                    // Visitas mais recentes primeiro
                    visitas: c.visitas.sort((a, b) => {
                        const dataDiff = b.data.localeCompare(a.data);
                        if (dataDiff !== 0) return dataDiff;
                        return b.horaInicio.localeCompare(a.horaInicio);
                    }),
                };
            }).sort((a, b) => b.totalVisitas - a.totalVisitas);
        }),

    // ── UTIL: lista de revendas ───────────────────────────────────────────
    revendas: publicProcedure.query(async () => {
        const visitas = await getVisitasData();
        return [...new Set(visitas.map(v => v.revenda))].sort();
    }),

    // ── UTIL: lista de vendedores filtrados por revenda ───────────────────
    vendedores: publicProcedure
        .input(z.object({ revenda: z.string().optional() }))
        .query(async ({ input }) => {
            let visitas = await getVisitasData();
            if (input.revenda) visitas = visitas.filter(v => v.revenda === input.revenda);
            const mapa: Record<number, string> = {};
            for (const v of visitas) mapa[v.vendedor] = `V0${v.vendedor}`;
            return Object.entries(mapa)
                .map(([id, nome]) => ({ id: Number(id), nome }))
                .sort((a, b) => a.id - b.id);
        }),
});