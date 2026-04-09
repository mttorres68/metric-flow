/*
 * MetricFlow — Análise Gestor Router
 * CRUD para análises escritas pelos gestores por revenda + data.
 * Substitui o localStorage do monitor-rota com persistência real no banco.
 *
 * Procedimentos:
 *   buscar({ revenda, data, tipo })        → Análise | null
 *   salvar({ revenda, data, tipo, conteudo }) → { ok: true }
 *   listarPorData({ data })               → Analise[]
 */

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { analises } from "../../drizzle/schema";

export const analiseGestorRouter = router({

  /**
   * Busca a análise de um tipo específico para uma revenda+data.
   * Retorna null se não existir.
   */
  buscar: publicProcedure
    .input(
      z.object({
        revenda: z.string(),
        data: z.string(), // YYYY-MM-DD
        tipo: z.enum(["vendedores", "gas"]),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db
        .select()
        .from(analises)
        .where(
          and(
            eq(analises.revenda, input.revenda),
            eq(analises.data, input.data),
            eq(analises.tipo, input.tipo)
          )
        )
        .limit(1);

      return result[0] ?? null;
    }),

  /**
   * Salva (insere ou atualiza) a análise para uma revenda+data+tipo.
   * Usa select-then-insert/update pois não há unique constraint definido.
   */
  salvar: publicProcedure
    .input(
      z.object({
        revenda: z.string(),
        data: z.string(),
        tipo: z.enum(["vendedores", "gas"]),
        conteudo: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível.");

      const existing = await db
        .select({ id: analises.id })
        .from(analises)
        .where(
          and(
            eq(analises.revenda, input.revenda),
            eq(analises.data, input.data),
            eq(analises.tipo, input.tipo)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(analises)
          .set({ conteudo: input.conteudo })
          .where(eq(analises.id, existing[0].id));
      } else {
        await db.insert(analises).values({
          revenda: input.revenda,
          data: input.data,
          tipo: input.tipo,
          conteudo: input.conteudo,
        });
      }

      return { ok: true } as const;
    }),

  /**
   * Lista todas as análises de uma data específica (todas as revendas + tipos).
   * Útil para pré-carregar tudo de uma vez na página de relatório.
   */
  listarPorData: publicProcedure
    .input(z.object({ data: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(analises)
        .where(eq(analises.data, input.data));
    }),
});
