import { and, eq, sql } from "drizzle-orm";
import { crmAgendaCiclo, crmMemberConfig } from "../../drizzle/schema";
import { getDb } from "../db";

export async function getMapeamento() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crmMemberConfig).orderBy(crmMemberConfig.revenda, crmMemberConfig.role);
}

export async function getMapeamentoPorRevenda(revenda: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crmMemberConfig).where(eq(crmMemberConfig.revenda, revenda));
}

export async function salvarMapeamento(
  revenda: string,
  mapeamentos: { role: string; trelloMemberId: string; trelloMemberName: string }[],
) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  for (const m of mapeamentos) {
    await db
      .insert(crmMemberConfig)
      .values({ revenda, role: m.role, trelloMemberId: m.trelloMemberId, trelloMemberName: m.trelloMemberName })
      .onConflictDoUpdate({
        target: [crmMemberConfig.revenda, crmMemberConfig.role],
        set: {
          trelloMemberId: m.trelloMemberId,
          trelloMemberName: m.trelloMemberName,
          updatedAt: new Date(),
        },
      });
  }
}

export async function removerMapeamento(revenda: string, role: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");
  await db
    .delete(crmMemberConfig)
    .where(and(eq(crmMemberConfig.revenda, revenda), eq(crmMemberConfig.role, role)));
}

export async function listarCiclos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crmAgendaCiclo).orderBy(crmAgendaCiclo.criadoEm);
}

export async function getCrmConfig(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(sql`SELECT value FROM crm_config WHERE key = ${key} LIMIT 1`);
  const row = (rows as any).rows?.[0] ?? (rows as any)[0];
  return row?.value ?? null;
}

export async function setCrmConfig(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");
  await db.execute(sql`
    INSERT INTO crm_config (key, value, "updatedAt")
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, "updatedAt" = NOW()
  `);
}

export async function registrarCiclo(revenda: string, mes: number, ano: number, totalCards: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");
  await db
    .insert(crmAgendaCiclo)
    .values({ revenda, mes, ano, totalCards, status })
    .onConflictDoUpdate({
      target: [crmAgendaCiclo.revenda, crmAgendaCiclo.mes, crmAgendaCiclo.ano],
      set: { totalCards, status, criadoEm: new Date() },
    });
}
