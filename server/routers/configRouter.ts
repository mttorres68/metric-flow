import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { metricasConfig } from "../../drizzle/schema";
import { CONFIG_METRICAS_DEFAULT } from "@shared/const";
import { getConfigMetricas, invalidateConfigCache } from "../services/configService";

const timeRegex = /^\d{2}:\d{2}$/;

const inputSchema = z.object({
    // ── Parâmetros base ──────────────────────────────────────────────────────
    raioPDV:                z.number().int().min(1).max(1000),
    minutosCurta:           z.number().int().min(1).max(30),
    // ── Análise Diária ───────────────────────────────────────────────────────
    limiteInicioTardio:     z.string().regex(timeRegex),
    alertaCurtasPerc:       z.number().int().min(0).max(100),
    alertaCoberturaPerc:    z.number().int().min(0).max(200),
    alertaTardePerc:        z.number().int().min(0).max(100),
    // ── Recorrência Semanal ──────────────────────────────────────────────────
    recLimiteInicioTardio:  z.string().regex(timeRegex),
    recAlertaCurtasPerc:    z.number().int().min(0).max(100),
    recAlertaCoberturaPerc: z.number().int().min(0).max(200),
    recAlertaTardePerc:     z.number().int().min(0).max(100),
    recorrenciaMinDias:     z.number().int().min(1).max(7),
    recorrenciaMinPerc:     z.number().min(0).max(1),
    ociosidadeMin:          z.number().int().min(0).max(480),
    percursoMax:            z.number().int().min(0).max(120),
    almocoMax:              z.number().int().min(0).max(20),
    tempoAtendMin:          z.number().int().min(0).max(480),
    fimCedo:                z.string().regex(timeRegex),
});

export const configRouter = router({

    getMetricasConfig: publicProcedure.query(async () => {
        return getConfigMetricas();
    }),

    saveMetricasConfig: publicProcedure
        .input(inputSchema)
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Banco de dados indisponível.");

            const dbValues = {
                ...input,
                recorrenciaMinPerc: String(input.recorrenciaMinPerc),
                updatedAt: new Date(),
            };

            const existing = await db.select({ id: metricasConfig.id }).from(metricasConfig).limit(1);
            if (existing.length > 0) {
                await db.update(metricasConfig).set(dbValues).where(eq(metricasConfig.id, existing[0].id));
            } else {
                await db.insert(metricasConfig).values({ ...dbValues });
            }

            invalidateConfigCache();
            return { ok: true } as const;
        }),

    resetMetricasConfig: publicProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados indisponível.");
        await db.delete(metricasConfig);
        invalidateConfigCache();
        return { ok: true, defaults: CONFIG_METRICAS_DEFAULT } as const;
    }),
});
