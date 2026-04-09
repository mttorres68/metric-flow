import { integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const roleEnum = pgEnum("mf_role", ["user", "admin"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// Análises escritas pelos gestores (vendedores e GAs) por revenda + data
// Substitui o localStorage do monitor-rota com persistência real.
// ---------------------------------------------------------------------------
export const tipoEnum = pgEnum("mf_analise_tipo", ["vendedores", "gas"]);

export const analises = pgTable("analises", {
  id: serial("id").primaryKey(),
  /** Nome da revenda — deve corresponder ao valor em ProcessedVisita.revenda */
  revenda: varchar("revenda", { length: 120 }).notNull(),
  /** Data de referência da análise (YYYY-MM-DD) */
  data: varchar("data", { length: 10 }).notNull(),
  /** Tipo: 'vendedores' ou 'gas' */
  tipo: tipoEnum("tipo").notNull(),
  /** Conteúdo em texto puro (pode conter HTML básico do editor rich-text) */
  conteudo: text("conteudo").notNull().default(""),
  /** Referência ao usuário que criou/editou por último */
  autorId: integer("autorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Analise = typeof analises.$inferSelect;
export type InsertAnalise = typeof analises.$inferInsert;
