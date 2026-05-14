import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  assessmentItens,
  assessmentRespostas,
  assessmentResponsabilidades,
  colaboradores,
  revendas,
  InsertAssessmentResposta,
  InsertColaborador,
  InsertRevenda,
  InsertAssessmentResponsabilidade,
} from "../../drizzle/schema";

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------
export async function listAllRespostas(ano: number, mes: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(assessmentRespostas)
      .where(and(eq(assessmentRespostas.ano, ano), eq(assessmentRespostas.mes, mes)));
  } catch {
    return [];
  }
}

export async function listRespostas(revenda: string, ano: number, mes: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(assessmentRespostas)
      .where(
        and(
          eq(assessmentRespostas.revenda, revenda),
          eq(assessmentRespostas.ano, ano),
          eq(assessmentRespostas.mes, mes),
        ),
      );
  } catch {
    return [];
  }
}

export async function upsertResposta(input: InsertAssessmentResposta) {
  const db = await getDb();
  if (!db) return null;
  try {
    return await db
      .insert(assessmentRespostas)
      .values(input)
      .onConflictDoUpdate({
        target: [
          assessmentRespostas.revenda,
          assessmentRespostas.item,
          assessmentRespostas.ano,
          assessmentRespostas.mes,
        ],
        set: {
          autoavaliacao: input.autoavaliacao,
          evidencia: input.evidencia,
          statusFinal: input.statusFinal,
          padrinho: input.padrinho,
          horaCheck: input.horaCheck,
          macroArea: input.macroArea,
          microArea: input.microArea,
          piramide: input.piramide,
          descricao: input.descricao,
          tipoResposta: input.tipoResposta,
          pontoPossivel: input.pontoPossivel,
          pontosEvidencia: input.pontosEvidencia,
          pontosAutoavaliacao: input.pontosAutoavaliacao,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error("[Assessment] upsertResposta failed:", err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Catálogo de itens
// ---------------------------------------------------------------------------
export async function listAssessmentItens() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(assessmentItens);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Revendas
// ---------------------------------------------------------------------------
export async function listRevendas() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(revendas);
  } catch {
    return [];
  }
}

export async function upsertRevenda(input: InsertRevenda) {
  const db = await getDb();
  if (!db) return null;
  return await db
    .insert(revendas)
    .values(input)
    .onConflictDoUpdate({
      target: revendas.codigo,
      set: { nome: input.nome, operacao: input.operacao, updatedAt: new Date() },
    });
}

// ---------------------------------------------------------------------------
// Colaboradores
// ---------------------------------------------------------------------------
export async function listColaboradores(revendaId?: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const query = db
      .select({
        id: colaboradores.id,
        revendaId: colaboradores.revendaId,
        revendaNome: revendas.nome,
        nome: colaboradores.nome,
        cargo: colaboradores.cargo,
        whatsapp: colaboradores.whatsapp,
        ativo: colaboradores.ativo,
      })
      .from(colaboradores)
      .leftJoin(revendas, eq(colaboradores.revendaId, revendas.id));

    if (revendaId !== undefined) {
      return await query.where(eq(colaboradores.revendaId, revendaId));
    }
    return await query;
  } catch {
    return [];
  }
}

export async function upsertColaborador(input: InsertColaborador) {
  const db = await getDb();
  if (!db) return null;
  if (input.id) {
    return await db
      .update(colaboradores)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(colaboradores.id, input.id));
  }
  return await db.insert(colaboradores).values(input);
}

// ---------------------------------------------------------------------------
// Responsabilidades
// ---------------------------------------------------------------------------
export async function listResponsabilidades(revendaId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({
        id: assessmentResponsabilidades.id,
        revendaId: assessmentResponsabilidades.revendaId,
        item: assessmentResponsabilidades.item,
        responsavelId: assessmentResponsabilidades.responsavelId,
        apoioId: assessmentResponsabilidades.apoioId,
      })
      .from(assessmentResponsabilidades)
      .where(eq(assessmentResponsabilidades.revendaId, revendaId));
  } catch {
    return [];
  }
}

export async function listAllResponsabilidades() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({
        id: assessmentResponsabilidades.id,
        revendaId: assessmentResponsabilidades.revendaId,
        item: assessmentResponsabilidades.item,
        responsavelId: assessmentResponsabilidades.responsavelId,
        apoioId: assessmentResponsabilidades.apoioId,
      })
      .from(assessmentResponsabilidades);
  } catch {
    return [];
  }
}

export async function upsertResponsabilidade(input: InsertAssessmentResponsabilidade) {
  const db = await getDb();
  if (!db) return null;
  return await db
    .insert(assessmentResponsabilidades)
    .values(input)
    .onConflictDoUpdate({
      target: [assessmentResponsabilidades.revendaId, assessmentResponsabilidades.item],
      set: {
        responsavelId: input.responsavelId,
        apoioId: input.apoioId,
        updatedAt: new Date(),
      },
    });
}
