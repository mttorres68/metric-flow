/*
 * MetricFlow — WhatsApp DB
 * Destinatários e associações com revendas no PostgreSQL (mesmo Docker da Evolution API)
 */

import { Pool } from "pg";

// ─── Pool ─────────────────────────────────────────────────────────────────────

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      host:     process.env.WA_DB_HOST     || "localhost",
      port:     Number(process.env.WA_DB_PORT || 5432),
      database: process.env.WA_DB_NAME     || "evolution",
      user:     process.env.WA_DB_USER     || "evolution_user",
      password: process.env.WA_DB_PASSWORD || "",
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    _pool.on("error", (err) => {
      console.error("[WA DB] pool error:", err.message);
    });
  }
  return _pool;
}

// ─── Normalização de nomes de revenda ────────────────────────────────────────
//
// O xlsx usa nomes completos ("Duttra Floriano"), o TRELLO_BOARDS usa abreviados
// ("Duttra FL"). Esta tabela mapeia qualquer variante para o nome canônico.
// Adicione novas entradas conforme necessário.
//
const REVENDA_ALIASES: Record<string, string> = {
  // xlsx → canônico (TRELLO_BOARDS)
  "duttra floriano": "Duttra FL",
  "duttra fl":       "Duttra FL",
  "duttra ma":       "Duttra MA",
  "duttra srn":      "Duttra SR",
  "duttra sr":       "Duttra SR",
  "forte aracati":   "FORTE AR",
  "forte ar":        "FORTE AR",
  "forte quixada":   "FORTE QX",
  "forte qx":        "FORTE QX",
};

/** Retorna o nome canônico (TRELLO_BOARDS) para qualquer variante conhecida. */
export function canonicalRevenda(name: string): string {
  return REVENDA_ALIASES[name.toLowerCase().trim()] ?? name;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Destinatario {
  id: string;
  nome: string;
  apelido: string;
  telefone: string;
  revendas: string[];
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initWATables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mf_wa_destinatarios (
      id          VARCHAR(64)  PRIMARY KEY,
      nome        VARCHAR(255) NOT NULL,
      apelido     VARCHAR(255) NOT NULL DEFAULT '',
      telefone    VARCHAR(20)  NOT NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mf_wa_dest_revendas (
      destinatario_id VARCHAR(64)  NOT NULL
        REFERENCES mf_wa_destinatarios(id) ON DELETE CASCADE,
      revenda         VARCHAR(255) NOT NULL,
      PRIMARY KEY (destinatario_id, revenda)
    );

    CREATE TABLE IF NOT EXISTS mf_config (
      key        VARCHAR(255) PRIMARY KEY,
      value      JSONB        NOT NULL,
      updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);
  console.log("[WA DB] tabelas prontas");
}

// ─── Config genérica (key-value) ─────────────────────────────────────────────

export async function getConfigValue<T>(key: string): Promise<T | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ value: T }>(
    `SELECT value FROM mf_config WHERE key = $1`,
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function setConfigValue<T>(key: string, value: T): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO mf_config (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listDestinatarios(): Promise<Destinatario[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string; nome: string; apelido: string; telefone: string; revendas: string | null;
  }>(`
    SELECT d.id, d.nome, d.apelido, d.telefone,
           STRING_AGG(r.revenda, ',' ORDER BY r.revenda) AS revendas
    FROM   mf_wa_destinatarios d
    LEFT JOIN mf_wa_dest_revendas r ON r.destinatario_id = d.id
    GROUP BY d.id, d.nome, d.apelido, d.telefone
    ORDER BY d.nome
  `);
  return rows.map((r) => ({
    ...r,
    revendas: r.revendas ? r.revendas.split(",") : [],
  }));
}

export async function getDestinatariosByRevenda(revenda: string): Promise<Destinatario[]> {
  const pool = getPool();
  // Normaliza o nome recebido (ex: "Duttra Floriano" → "Duttra FL")
  // e também compara case-insensitive com o que está guardado
  const canonical = canonicalRevenda(revenda);
  const { rows } = await pool.query<{ id: string }>(
    `SELECT destinatario_id AS id
     FROM   mf_wa_dest_revendas
     WHERE  LOWER(revenda) = LOWER($1)
        OR  LOWER(revenda) = LOWER($2)`,
    [revenda, canonical]
  );
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.id))];
  const all = await listDestinatarios();
  return all.filter((d) => ids.includes(d.id));
}

export async function addDestinatario(
  data: Omit<Destinatario, "id">
): Promise<Destinatario> {
  const pool = getPool();
  const id = Date.now().toString();
  await pool.query(
    `INSERT INTO mf_wa_destinatarios (id, nome, apelido, telefone) VALUES ($1,$2,$3,$4)`,
    [id, data.nome, data.apelido, data.telefone]
  );
  if (data.revendas.length > 0) {
    await setRevendas(id, data.revendas);
  }
  return { id, ...data };
}

export async function updateDestinatario(
  id: string,
  data: Omit<Destinatario, "id">
): Promise<Destinatario> {
  const pool = getPool();
  await pool.query(
    `UPDATE mf_wa_destinatarios
     SET nome=$2, apelido=$3, telefone=$4, updated_at=NOW()
     WHERE id=$1`,
    [id, data.nome, data.apelido, data.telefone]
  );
  await setRevendas(id, data.revendas);
  return { id, ...data };
}

export async function setRevendas(id: string, revendas: string[]): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM mf_wa_dest_revendas WHERE destinatario_id = $1`, [id]);
    for (const rev of revendas) {
      await client.query(
        `INSERT INTO mf_wa_dest_revendas (destinatario_id, revenda) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id, rev]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function removeDestinatario(id: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM mf_wa_destinatarios WHERE id = $1`, [id]);
}
