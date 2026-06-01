import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const roleEnum = pgEnum("mf_role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
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
// Análises escritas pelos gestores
// ---------------------------------------------------------------------------
export const tipoEnum = pgEnum("mf_analise_tipo", ["vendedores", "gas"]);

export const analises = pgTable("analises", {
  id: serial("id").primaryKey(),
  revenda: varchar("revenda", { length: 120 }).notNull(),
  data: varchar("data", { length: 10 }).notNull(),
  tipo: tipoEnum("tipo").notNull(),
  conteudo: text("conteudo").notNull().default(""),
  autorId: integer("autorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Analise = typeof analises.$inferSelect;
export type InsertAnalise = typeof analises.$inferInsert;

// ---------------------------------------------------------------------------
// Recorrência semanal — mapeamento + insight inteligente por revenda/semana
// (módulo Análise → aba "Recorrência semanal").
// mapaJson guarda o RecorrenciaVendedor[] estruturado; insightHtml o texto LLM.
// ---------------------------------------------------------------------------
export const analiseRecorrencia = pgTable(
  "analise_recorrencia",
  {
    id: serial("id").primaryKey(),
    revenda: varchar("revenda", { length: 120 }).notNull(),
    semanaInicio: varchar("semanaInicio", { length: 10 }).notNull(), // YYYY-MM-DD
    semanaFim: varchar("semanaFim", { length: 10 }).notNull(),
    mapaJson: text("mapaJson").notNull().default(""),
    insightHtml: text("insightHtml").notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [unique("uq_analise_recorrencia").on(t.revenda, t.semanaInicio)],
);

export type AnaliseRecorrencia = typeof analiseRecorrencia.$inferSelect;
export type InsertAnaliseRecorrencia = typeof analiseRecorrencia.$inferInsert;

// ---------------------------------------------------------------------------
// Revendas — as 5 unidades do grupo
// ---------------------------------------------------------------------------
export const revendas = pgTable("revendas", {
  id: serial("id").primaryKey(),
  /** Nome completo exibido na UI: "Forte AR", "Duttra MA", etc. */
  nome: varchar("nome", { length: 120 }).notNull().unique(),
  /** Slug usado como chave em mapas/configs: "forte-ar", "duttra-ma" */
  codigo: varchar("codigo", { length: 20 }).notNull().unique(),
  /** ID numérico da operação no sistema legado */
  operacao: integer("operacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Revenda = typeof revendas.$inferSelect;
export type InsertRevenda = typeof revendas.$inferInsert;

// ---------------------------------------------------------------------------
// Colaboradores — equipe de cada revenda
// ---------------------------------------------------------------------------
export const colaboradores = pgTable("colaboradores", {
  id: serial("id").primaryKey(),
  revendaId: integer("revendaId")
    .notNull()
    .references(() => revendas.id),
  nome: varchar("nome", { length: 120 }).notNull(),
  cargo: varchar("cargo", { length: 80 }),
  /** Número com DDI: "5551999999999" */
  whatsapp: varchar("whatsapp", { length: 20 }),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Colaborador = typeof colaboradores.$inferSelect;
export type InsertColaborador = typeof colaboradores.$inferInsert;

// ---------------------------------------------------------------------------
// Assessment — catálogo dos itens (master data, 92 itens)
// ---------------------------------------------------------------------------
export const assessmentItens = pgTable("assessment_itens", {
  id: serial("id").primaryKey(),
  /** ID do indicador: "ADM01", "ARM02", … */
  item: varchar("item", { length: 20 }).notNull().unique(),
  macroArea: varchar("macroArea", { length: 60 }),
  microArea: varchar("microArea", { length: 60 }),
  piramide: varchar("piramide", { length: 60 }),
  descricao: text("descricao"),
  evidenciaObrigatoria: boolean("evidenciaObrigatoria").notNull().default(false),
  /** "Binária" | "Maturidade" */
  tipoResposta: varchar("tipoResposta", { length: 20 }),
  pontoPossivel: integer("pontoPossivel").notNull().default(0),
  pontosEvidencia: integer("pontosEvidencia").notNull().default(0),
  pontosAutoavaliacao: integer("pontosAutoavaliacao").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AssessmentItem = typeof assessmentItens.$inferSelect;
export type InsertAssessmentItem = typeof assessmentItens.$inferInsert;

// ---------------------------------------------------------------------------
// Assessment — responsabilidades por item × revenda
// Mapeia quem é o responsável direto e quem dá apoio (padrinho) para cada
// item do assessment em cada revenda.
// ---------------------------------------------------------------------------
export const assessmentResponsabilidades = pgTable(
  "assessment_responsabilidades",
  {
    id: serial("id").primaryKey(),
    revendaId: integer("revendaId")
      .notNull()
      .references(() => revendas.id),
    /** Deve corresponder a assessmentItens.item */
    item: varchar("item", { length: 20 }).notNull(),
    /** Pessoa responsável pelo item nesta revenda */
    responsavelId: integer("responsavelId").references(() => colaboradores.id),
    /** Pessoa de apoio / padrinho */
    apoioId: integer("apoioId").references(() => colaboradores.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [unique("uq_responsabilidade").on(t.revendaId, t.item)],
);

export type AssessmentResponsabilidade = typeof assessmentResponsabilidades.$inferSelect;
export type InsertAssessmentResponsabilidade = typeof assessmentResponsabilidades.$inferInsert;

// ---------------------------------------------------------------------------
// Assessment — respostas (populado pelo check.py via upsert)
// ---------------------------------------------------------------------------
export const statusFinalEnum = pgEnum("mf_assessment_status", ["Sim", "Parcial", "Não"]);

export const assessmentRespostas = pgTable(
  "assessment_respostas",
  {
    id: serial("id").primaryKey(),
    ano: integer("ano").notNull(),
    mes: integer("mes").notNull(),
    data: varchar("data", { length: 10 }),
    operacao: integer("operacao"),
    /** Nome da revenda — espelho do HTML_FILES key em check.py */
    revenda: varchar("revenda", { length: 120 }).notNull(),
    item: varchar("item", { length: 20 }).notNull(),
    autoavaliacao: varchar("autoavaliacao", { length: 10 }),
    evidencia: varchar("evidencia", { length: 10 }),
    /** Calculado em check.py: Sim | Parcial | Não */
    statusFinal: statusFinalEnum("statusFinal"),
    /** Nome do padrinho (texto livre vindo do HTML) */
    padrinho: varchar("padrinho", { length: 120 }),
    horaCheck: varchar("horaCheck", { length: 10 }),
    macroArea: varchar("macroArea", { length: 60 }),
    microArea: varchar("microArea", { length: 60 }),
    piramide: varchar("piramide", { length: 60 }),
    descricao: text("descricao"),
    tipoResposta: varchar("tipoResposta", { length: 20 }),
    pontoPossivel: integer("pontoPossivel").default(0),
    pontosEvidencia: integer("pontosEvidencia").default(0),
    pontosAutoavaliacao: integer("pontosAutoavaliacao").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [unique("uq_assessment_resposta").on(t.revenda, t.item, t.ano, t.mes)],
);

export type AssessmentResposta = typeof assessmentRespostas.$inferSelect;
export type InsertAssessmentResposta = typeof assessmentRespostas.$inferInsert;
