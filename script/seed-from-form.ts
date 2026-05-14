/**
 * Importa colaboradores e responsabilidades a partir do CSV do Google Forms.
 * Fonte: arquivo CSV baixado do Google Sheets (Assessment Revendas - Responsáveis).
 *
 * Regra de conflito: quando mais de uma pessoa marcou o mesmo nível para o mesmo
 * item, a primeira por timestamp fica no slot (Principal ou Apoio); a segunda
 * pessoa com nivel=Principal é promovida para Apoio se esse slot estiver livre.
 *
 * Executar:
 *   npx tsx script/seed-from-form.ts <caminho-para-o-csv>
 *
 * Exemplo:
 *   npx tsx script/seed-from-form.ts "C:/path/Assessment Revendas - Responsáveis - Respostas.csv"
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { eq, and } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  revendas,
  colaboradores,
  assessmentResponsabilidades,
} from "../drizzle/schema";

// ── Mapeamento nome do form → codigo no BD ─────────────────────────────────
const REVENDA_MAP: Record<string, string> = {
  "DUTTRA FLORIANO": "duttra-fl",
  "DUTTRA MA":       "duttra-ma",
  "FORTE ARACATI":   "forte-ar",
  "FORTE QUIXADÁ":   "forte-qx",
  "DUTTRA SRN":      "duttra-srn",
};

function extractItemCode(indicador: string): string {
  const m = indicador.match(/^([A-Z]+\d+)/);
  return m ? m[1] : indicador.split(" - ")[0].trim();
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Uso: npx tsx script/seed-from-form.ts <caminho-do-csv>");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) { console.error("Banco não disponível — verifique DATABASE_URL"); process.exit(1); }

  // Carrega CSV
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  console.log(`CSV lido: ${rows.length} linhas`);

  // Carrega revendas do BD e constrói mapa codigo → id
  const revendasDB = await db.select().from(revendas);
  const revendaIdByCodigo = new Map(revendasDB.map(r => [r.codigo, r.id]));
  console.log("Revendas no BD:", revendasDB.map(r => r.codigo).join(", "));

  // ── Passo 1: upsert de colaboradores ─────────────────────────────────────
  // Agrupa por (revendaCodigo, nome) para deduplicar
  type PessoaInfo = { nome: string; cargo: string; whatsapp: string; revendaCodigo: string };
  const pessoasMap = new Map<string, PessoaInfo>();

  for (const row of rows) {
    const revendaFormName = row["Revenda"]?.trim() ?? "";
    const codigo = REVENDA_MAP[revendaFormName];
    if (!codigo) { console.warn(`  Revenda desconhecida: "${revendaFormName}"`); continue; }

    const nome = row["Responsavel"]?.trim() ?? "";
    if (!nome) continue;

    const key = `${codigo}||${nome.toLowerCase()}`;
    if (!pessoasMap.has(key)) {
      pessoasMap.set(key, {
        nome,
        cargo:    row["Cargo"]?.trim() ?? "",
        whatsapp: normalizePhone(row["WhatsApp"] ?? ""),
        revendaCodigo: codigo,
      });
    }
  }

  // Map nome normalizado → colaborador id (por revenda)
  const colaboradorIdMap = new Map<string, number>(); // key = `${codigo}||${nomeNorm}`

  for (const [key, p] of pessoasMap) {
    const revendaId = revendaIdByCodigo.get(p.revendaCodigo);
    if (!revendaId) { console.warn(`  revendaId não encontrado para ${p.revendaCodigo}`); continue; }

    // Verifica se já existe
    const existing = await db
      .select({ id: colaboradores.id })
      .from(colaboradores)
      .where(and(eq(colaboradores.revendaId, revendaId), eq(colaboradores.nome, p.nome)))
      .limit(1);

    let id: number;
    if (existing.length > 0) {
      id = existing[0].id;
      // Atualiza cargo/whatsapp
      await db
        .update(colaboradores)
        .set({ cargo: p.cargo || undefined, whatsapp: p.whatsapp || undefined })
        .where(eq(colaboradores.id, id));
      console.log(`  ~ colaborador existente: ${p.nome} (${p.revendaCodigo}) id=${id}`);
    } else {
      const ins = await db
        .insert(colaboradores)
        .values({ revendaId, nome: p.nome, cargo: p.cargo, whatsapp: p.whatsapp, ativo: true })
        .returning({ id: colaboradores.id });
      id = ins[0].id;
      console.log(`  + colaborador novo: ${p.nome} (${p.revendaCodigo}) id=${id}`);
    }

    colaboradorIdMap.set(key, id);
  }

  // ── Passo 2: mapear responsabilidades ────────────────────────────────────
  // Para cada (revenda, item): coleta o primeiro Principal e primeiro Apoio por timestamp.
  // Quando há dois Principais, o segundo vira Apoio (se o slot estiver livre).
  type Slot = { pessoaKey: string; data: string };
  type ItemSlots = { principal: Slot | null; apoio: Slot | null };
  const itemMap = new Map<string, ItemSlots>(); // key = `${codigo}||${itemCode}`

  // Ordena por data para garantir "primeiro submetido ganha"
  const sorted = [...rows].sort((a, b) =>
    (a["Data"] ?? "").localeCompare(b["Data"] ?? "")
  );

  for (const row of sorted) {
    const revendaFormName = row["Revenda"]?.trim() ?? "";
    const codigo = REVENDA_MAP[revendaFormName];
    if (!codigo) continue;

    const nome = row["Responsavel"]?.trim() ?? "";
    if (!nome) continue;

    const itemCode = extractItemCode(row["Indicador"]?.trim() ?? "");
    if (!itemCode) continue;

    const nivel = row["Nivel de responsabilidade"]?.trim();
    const pessoaKey = `${codigo}||${nome.toLowerCase()}`;
    const itemKey = `${codigo}||${itemCode}`;
    const data = row["Data"] ?? "";

    if (!itemMap.has(itemKey)) {
      itemMap.set(itemKey, { principal: null, apoio: null });
    }
    const slots = itemMap.get(itemKey)!;

    if (nivel === "Principal") {
      if (!slots.principal) {
        slots.principal = { pessoaKey, data };
      } else if (!slots.apoio) {
        // Segundo Principal → promove para Apoio
        slots.apoio = { pessoaKey, data };
      }
    } else if (nivel === "Apoio") {
      if (!slots.apoio) {
        slots.apoio = { pessoaKey, data };
      }
    }
  }

  // ── Passo 3: upsert de responsabilidades ────────────────────────────────
  let ok = 0;
  let erros = 0;

  for (const [itemKey, slots] of itemMap) {
    const [codigo, itemCode] = itemKey.split("||");
    const revendaId = revendaIdByCodigo.get(codigo);
    if (!revendaId) continue;

    const responsavelId = slots.principal
      ? (colaboradorIdMap.get(slots.principal.pessoaKey) ?? null)
      : null;
    const apoioId = slots.apoio
      ? (colaboradorIdMap.get(slots.apoio.pessoaKey) ?? null)
      : null;

    try {
      await db
        .insert(assessmentResponsabilidades)
        .values({ revendaId, item: itemCode, responsavelId, apoioId })
        .onConflictDoUpdate({
          target: [assessmentResponsabilidades.revendaId, assessmentResponsabilidades.item],
          set: { responsavelId, apoioId },
        });
      ok++;
    } catch (err) {
      console.error(`  ERRO ${codigo}/${itemCode}:`, err);
      erros++;
    }
  }

  console.log(`\nResponsabilidades: ${ok} upserts, ${erros} erros`);
  console.log("Seed concluído.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
