/*
 * MetricFlow — Clientes Router
 * Resta apenas a lista de vendedores usada pelo filtro da Análise.
 * (listar/revendas e a tela de Clientes foram removidos.)
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getVisitasData } from "../services/dataCache";

export const clientesRouter = router({

    // ── UTIL: lista de vendedores filtrados por revenda ───────────────────
    vendedores: publicProcedure
        .input(z.object({ revenda: z.string().optional() }))
        .query(async ({ input }) => {
            const visitas = await getVisitasData({ revenda: input.revenda });

            const mapa: Record<string, { id: number, revenda: string, nome: string }> = {};
            for (const v of visitas) {
                const key = `${v.revenda}__${v.vendedor}`;
                mapa[key] = {
                    id: v.vendedor,
                    revenda: v.revenda,
                    nome: input.revenda ? `V0${v.vendedor}` : `${v.revenda} - V0${v.vendedor}`
                };
            }
            return Object.values(mapa).sort((a, b) => a.id - b.id);
        }),
});
