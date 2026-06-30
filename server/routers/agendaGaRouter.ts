import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agendaGa, gasCode } from "../../drizzle/schema";

const ATIVIDADES = ["Outra Atividade", "Rota Coaching", "Rota GA", "Administrativo", "Treinamento"] as const;
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;

export const agendaGaRouter = router({

    // ── Codes ────────────────────────────────────────────────────────────────

    listCodes: publicProcedure
        .input(z.object({ revenda: z.string().optional() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return [];
            const rows = await db.select().from(gasCode);
            if (input.revenda) return rows.filter(r => r.revenda === input.revenda);
            return rows;
        }),

    upsertCode: publicProcedure
        .input(z.object({ revenda: z.string().min(1), code: z.string().min(1) }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB indisponível");
            await db.insert(gasCode).values(input).onConflictDoNothing();
            return { ok: true };
        }),

    deleteCode: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB indisponível");
            await db.delete(gasCode).where(eq(gasCode.id, input.id));
            return { ok: true };
        }),

    // ── Agenda entries ───────────────────────────────────────────────────────

    getAgenda: publicProcedure
        .input(z.object({
            dateStart: z.string(), // YYYY-MM-DD
            dateEnd: z.string(),
            revenda: z.string().optional(),
            code: z.string().optional(),
        }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return [];
            const conditions = [
                gte(agendaGa.data, input.dateStart),
                lte(agendaGa.data, input.dateEnd),
            ];
            if (input.revenda) conditions.push(eq(agendaGa.revenda, input.revenda));
            if (input.code) conditions.push(eq(agendaGa.code, input.code));
            return db.select().from(agendaGa).where(and(...conditions)).orderBy(agendaGa.data, agendaGa.code);
        }),

    saveSemana: publicProcedure
        .input(z.object({
            entries: z.array(z.object({
                revenda: z.string().min(1),
                semanaInicio: z.string().length(10),
                code: z.string().min(1),
                data: z.string().length(10),
                diaSemana: z.enum(DIAS_SEMANA),
                atividade: z.string().default("Outra Atividade"),
                vendedor: z.string().optional(),
                descricao: z.string().optional(),
            })),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB indisponível");
            for (const entry of input.entries) {
                await db.insert(agendaGa)
                    .values(entry)
                    .onConflictDoUpdate({
                        target: [agendaGa.semanaInicio, agendaGa.code, agendaGa.data],
                        set: {
                            atividade: entry.atividade,
                            vendedor: entry.vendedor ?? null,
                            descricao: entry.descricao ?? null,
                            updatedAt: new Date(),
                        },
                    });
            }
            return { ok: true, count: input.entries.length };
        }),

    updateEntry: publicProcedure
        .input(z.object({
            id: z.number(),
            atividade: z.string().optional(),
            vendedor: z.string().optional().nullable(),
            descricao: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB indisponível");
            const { id, ...set } = input;
            await db.update(agendaGa).set({ ...set, updatedAt: new Date() }).where(eq(agendaGa.id, id));
            return { ok: true };
        }),

    deleteEntry: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB indisponível");
            await db.delete(agendaGa).where(eq(agendaGa.id, input.id));
            return { ok: true };
        }),

    constants: publicProcedure.query(() => ({ atividades: ATIVIDADES, diasSemana: DIAS_SEMANA })),
});
