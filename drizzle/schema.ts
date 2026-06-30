import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  time,
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

// ---------------------------------------------------------------------------
// CRM — mapeamento de papéis → membros Trello por revenda
// ---------------------------------------------------------------------------
export const crmMemberConfig = pgTable(
  "crm_member_config",
  {
    id:               serial("id").primaryKey(),
    revenda:          varchar("revenda", { length: 100 }).notNull(),
    role:             varchar("role", { length: 100 }).notNull(),
    trelloMemberId:   varchar("trelloMemberId", { length: 100 }).notNull(),
    trelloMemberName: varchar("trelloMemberName", { length: 200 }).notNull(),
    createdAt:        timestamp("createdAt").defaultNow().notNull(),
    updatedAt:        timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [unique("uq_crm_member_config").on(t.revenda, t.role)],
);

export type CrmMemberConfig = typeof crmMemberConfig.$inferSelect;
export type InsertCrmMemberConfig = typeof crmMemberConfig.$inferInsert;

// ---------------------------------------------------------------------------
// CRM — histórico de ciclos de agenda criados
// ---------------------------------------------------------------------------
export const crmAgendaCiclo = pgTable(
  "crm_agenda_ciclo",
  {
    id:         serial("id").primaryKey(),
    revenda:    varchar("revenda", { length: 100 }).notNull(),
    mes:        integer("mes").notNull(),
    ano:        integer("ano").notNull(),
    totalCards: integer("totalCards").default(0),
    status:     varchar("status", { length: 50 }).default("criado"),
    criadoEm:   timestamp("criadoEm").defaultNow().notNull(),
  },
  (t) => [unique("uq_crm_ciclo").on(t.revenda, t.mes, t.ano)],
);

export type CrmAgendaCiclo = typeof crmAgendaCiclo.$inferSelect;
export type InsertCrmAgendaCiclo = typeof crmAgendaCiclo.$inferInsert;

// ---------------------------------------------------------------------------
// Rota Coaching — resultado do processamento por GA + vendedor + dia
// Arrays de clientes e geo_detalhes armazenados como JSONB (não filtrados no banco).
// UNIQUE: (data, revenda, gaId, vendedorId) — vendedorId '' quando ausente.
// ---------------------------------------------------------------------------
export const rotaCoaching = pgTable(
  "rota_coaching",
  {
    id: serial("id").primaryKey(),
    data: date("data").notNull(),
    revenda: varchar("revenda", { length: 50 }).notNull(),
    gaId: varchar("gaId", { length: 20 }).notNull(),
    /** Código do vendedor ou '' quando não há vendedor associado */
    vendedorId: varchar("vendedorId", { length: 20 }).notNull().default(""),
    atividade: varchar("atividade", { length: 100 }),
    tipoAtividade: varchar("tipoAtividade", { length: 30 }).notNull().default(""),
    fonte: varchar("fonte", { length: 10 }),
    agendado: boolean("agendado").default(true),
    // KPIs numéricos
    pdvsProgramados: integer("pdvsProgramados").default(0),
    pdvsVisitados: integer("pdvsVisitados").default(0),
    visitasGa: integer("visitasGa").default(0),
    pctConformidade: numeric("pctConformidade", { precision: 5, scale: 2 }),
    pctVisitados: numeric("pctVisitados", { precision: 5, scale: 2 }),
    pctGeoConfirmado: numeric("pctGeoConfirmado", { precision: 5, scale: 2 }),
    /** Cobertura: |GA ∩ visitados válidos| / pdvsVisitados (regra 12/06/2026) */
    pctCobertura: numeric("pctCobertura", { precision: 5, scale: 2 }),
    /** Setor declarado na agenda (preenchido mesmo na linha de outro vendedor visto no app) */
    setorAgendado: varchar("setorAgendado", { length: 20 }),
    /** Todos os setores que o GA registrou no app no dia (caso multi-setor) */
    setoresApp: jsonb("setoresApp"),
    // Status
    status: varchar("status", { length: 10 }),
    statusPy: varchar("statusPy", { length: 20 }),
    gaFezCoaching: boolean("gaFezCoaching"),
    mesmoVendedor: boolean("mesmoVendedor"),
    vendedorAgenda: varchar("vendedorAgenda", { length: 20 }),
    vendedorNoApp: varchar("vendedorNoApp", { length: 20 }),
    // Arrays e objetos complexos como JSONB
    clientesVendedor: jsonb("clientesVendedor"),
    clientesGa: jsonb("clientesGa"),
    clientesComuns: jsonb("clientesComuns"),
    clientesSoVend: jsonb("clientesSoVend"),
    clientesSoGa: jsonb("clientesSoGa"),
    clientesDentroRaio: jsonb("clientesDentroRaio"),
    clientesForaRaio: jsonb("clientesForaRaio"),
    clientesSemCoords: jsonb("clientesSemCoords"),
    geoDetalhes: jsonb("geoDetalhes"),
    criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  },
  (t) => [unique("uq_rota_coaching").on(t.data, t.revenda, t.gaId, t.vendedorId, t.tipoAtividade)],
);

export type RotaCoaching = typeof rotaCoaching.$inferSelect;
export type InsertRotaCoaching = typeof rotaCoaching.$inferInsert;

// ---------------------------------------------------------------------------
// Configuração de métricas — thresholds das flags de análise/recorrência.
// Tabela single-row (id=1 sempre); gerenciada via modal de config na UI.
// Os valores aqui sobrepõem os defaults de shared/const.ts em runtime.
// ---------------------------------------------------------------------------
export const metricasConfig = pgTable("metricas_config", {
  id:                   serial("id").primaryKey(),
  // ── Parâmetros base (compartilhados) ─────────────────────────────────────
  raioPDV:              integer("raioPDV").notNull().default(300),
  minutosCurta:         integer("minutosCurta").notNull().default(3),
  janelaInicioVisitas:  varchar("janelaInicioVisitas", { length: 5 }).notNull().default("07:00"),
  janelaFimVisitas:     varchar("janelaFimVisitas",    { length: 5 }).notNull().default("17:00"),
  // ── Análise Diária — thresholds de alerta ────────────────────────────────
  limiteInicioTardio:   varchar("limiteInicioTardio",    { length: 5 }).notNull().default("08:45"),
  alertaCurtasPerc:     integer("alertaCurtasPerc").notNull().default(10),
  alertaCoberturaPerc:  integer("alertaCoberturaPerc").notNull().default(100),
  alertaTardePerc:      integer("alertaTardePerc").notNull().default(25),
  // ── Recorrência Semanal — thresholds das flags ────────────────────────────
  recLimiteInicioTardio:   varchar("recLimiteInicioTardio", { length: 5 }).notNull().default("09:30"),
  recAlertaCurtasPerc:     integer("recAlertaCurtasPerc").notNull().default(10),
  recAlertaCoberturaPerc:  integer("recAlertaCoberturaPerc").notNull().default(100),
  recAlertaTardePerc:      integer("recAlertaTardePerc").notNull().default(25),
  recorrenciaMinDias:      integer("recorrenciaMinDias").notNull().default(2),
  recorrenciaMinPerc:      numeric("recorrenciaMinPerc", { precision: 4, scale: 2 }).notNull().default("0.40"),
  ociosidadeMin:           integer("ociosidadeMin").notNull().default(120),
  percursoMax:             integer("percursoMax").notNull().default(30),
  almocoMax:               integer("almocoMax").notNull().default(4),
  tempoAtendMin:           integer("tempoAtendMin").notNull().default(120),
  fimCedo:                 varchar("fimCedo", { length: 5 }).notNull().default("14:00"),
  updatedAt:               timestamp("updatedAt").defaultNow().notNull(),
});

export type MetricasConfig = typeof metricasConfig.$inferSelect;
export type InsertMetricasConfig = typeof metricasConfig.$inferInsert;

// ---------------------------------------------------------------------------
// Análise Diária — flags de ocorrência por vendedor × dia
// Persistidas ao marcar "Desl." (início tardio) ou "Prob." (pathtracker).
// ---------------------------------------------------------------------------
export const analiseFlagsDiarias = pgTable(
  "analise_flags_diarias",
  {
    id: serial("id").primaryKey(),
    revenda: varchar("revenda", { length: 120 }).notNull(),
    vendedor: varchar("vendedor", { length: 20 }).notNull(),
    data: varchar("data", { length: 10 }).notNull(), // YYYY-MM-DD
    deslocamento: boolean("deslocamento").notNull().default(false),
    problema: boolean("problema").notNull().default(false),
    naoIniciouRota: boolean("naoIniciouRota").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [unique("uq_analise_flag_diaria").on(t.revenda, t.vendedor, t.data)],
);

export type AnaliseFlagDiaria = typeof analiseFlagsDiarias.$inferSelect;
export type InsertAnaliseFlagDiaria = typeof analiseFlagsDiarias.$inferInsert;

// ---------------------------------------------------------------------------
// PathTracker — lookup de PDVs / clientes visitados
// ---------------------------------------------------------------------------
export const pathtrackerClientes = pgTable("pathtracker_clientes", {
  id: serial("id").primaryKey(),
  codigoCliente: integer("codigoCliente").notNull().unique(),
  razaoSocial: varchar("razaoSocial", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PathtrackerCliente = typeof pathtrackerClientes.$inferSelect;
export type InsertPathtrackerCliente = typeof pathtrackerClientes.$inferInsert;

// ---------------------------------------------------------------------------
// PathTracker — hierarquia (gerentes, supervisores, vendedores) por revenda
// ---------------------------------------------------------------------------
export const nivelHierarquiaEnum = pgEnum("mf_pt_nivel", ["gerente", "supervisor", "vendedor"]);

export const pathtrackerHierarquia = pgTable(
  "pathtracker_hierarquia",
  {
    id: serial("id").primaryKey(),
    revendaId: integer("revendaId").notNull().references(() => revendas.id),
    codigo: integer("codigo").notNull(),
    nivel: nivelHierarquiaEnum("nivel").notNull(),
    /** Login do usuário no portal PathTracker (associado ao vendedor) */
    user: varchar("user", { length: 50 }),
    ativo: boolean("ativo").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [unique("uq_pt_hierarquia").on(t.revendaId, t.codigo, t.nivel)],
);

export type PathtrackerHierarquia = typeof pathtrackerHierarquia.$inferSelect;
export type InsertPathtrackerHierarquia = typeof pathtrackerHierarquia.$inferInsert;

// ---------------------------------------------------------------------------
// PathTracker — visitas de vendedores a PDVs (fato principal, ~206k registros)
// Campos "ND" do JSON são armazenados como NULL.
// Valor Ped. numérico vai em valorPedido; textos livres em obsPedido.
// ---------------------------------------------------------------------------
export const pathtrackerVisitas = pgTable(
  "pathtracker_visitas",
  {
    id: serial("id").primaryKey(),
    revendaId: integer("revendaId").notNull().references(() => revendas.id),
    clienteId: integer("clienteId").notNull().references(() => pathtrackerClientes.id),
    vendedorId: integer("vendedorId").notNull().references(() => pathtrackerHierarquia.id),
    supervisorId: integer("supervisorId").references(() => pathtrackerHierarquia.id),
    gerenteId: integer("gerenteId").references(() => pathtrackerHierarquia.id),
    data: date("data").notNull(),
    dataColeta: timestamp("dataColeta"),
    sequenciaErp: integer("sequenciaErp"),
    sequenciaPt: integer("sequenciaPt"),
    distanciaPdv: numeric("distanciaPdv", { precision: 12, scale: 2 }),
    distanciaRota: numeric("distanciaRota", { precision: 12, scale: 2 }),
    velocidadeMedia: numeric("velocidadeMedia", { precision: 12, scale: 2 }),
    tempoPercorrido: varchar("tempoPercorrido", { length: 10 }),
    horaInicio: time("horaInicio"),
    horaFim: time("horaFim"),
    tempoVisita: varchar("tempoVisita", { length: 10 }),
    valorPedido: numeric("valorPedido", { precision: 10, scale: 2 }),
    /** Preenchido quando Valor Ped. não é numérico (ex: "COMPROU EM ADEGA") */
    obsPedido: text("obsPedido"),
    tipoCobranca: varchar("tipoCobranca", { length: 20 }),
    statusVisita: varchar("statusVisita", { length: 20 }),
    latPdv: numeric("latPdv", { precision: 10, scale: 6 }),
    lonPdv: numeric("lonPdv", { precision: 10, scale: 6 }),
    latVendedor: numeric("latVendedor", { precision: 10, scale: 6 }),
    lonVendedor: numeric("lonVendedor", { precision: 10, scale: 6 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  // Chave natural inclui horaInicio E sequenciaPt para preservar múltiplas visitas
  // do mesmo vendedor ao mesmo PDV no mesmo dia. Nenhuma das duas isolada basta:
  //  - visita física + emissão remota à noite → mesma Seq. PT, horaInicio diferente
  //  - registros duplicados de uma mesma parada → mesmo horaInicio, Seq. PT diferente
  // As duas juntas são únicas em toda a tabela. nullsNotDistinct: clientes
  // não-visitados têm ambos NULL e ainda precisam ser únicos por (rev,data,vend,cli).
  (t) => [
    unique("uq_pt_visita")
      .on(t.revendaId, t.data, t.vendedorId, t.clienteId, t.horaInicio, t.sequenciaPt)
      .nullsNotDistinct(),
  ],
);

export type PathtrackerVisita = typeof pathtrackerVisitas.$inferSelect;
export type InsertPathtrackerVisita = typeof pathtrackerVisitas.$inferInsert;

// ---------------------------------------------------------------------------
// Agenda GA — códigos disponíveis por revenda (tabela de referência)
// Cada revenda tem vários codes (ex: FL004, FL005, FLGV).
// ---------------------------------------------------------------------------
export const gasCode = pgTable(
  "gas_code",
  {
    id: serial("id").primaryKey(),
    revenda: varchar("revenda", { length: 120 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [unique("uq_gas_code").on(t.revenda, t.code)],
);

export type GasCode = typeof gasCode.$inferSelect;
export type InsertGasCode = typeof gasCode.$inferInsert;

// ---------------------------------------------------------------------------
// Agenda GA — entradas de agenda semanal por code × dia
// Geradas pelo form: uma linha por dia útil (Seg–Sab) por code × semana.
// ---------------------------------------------------------------------------
export const agendaGa = pgTable(
  "agenda_ga",
  {
    id: serial("id").primaryKey(),
    revenda: varchar("revenda", { length: 120 }).notNull(),
    semanaInicio: varchar("semanaInicio", { length: 10 }).notNull(), // YYYY-MM-DD (segunda-feira)
    code: varchar("code", { length: 20 }).notNull(),
    data: varchar("data", { length: 10 }).notNull(), // YYYY-MM-DD
    diaSemana: varchar("diaSemana", { length: 10 }).notNull(), // Seg, Ter, Qua, Qui, Sex, Sab
    atividade: varchar("atividade", { length: 100 }).notNull().default("Outra Atividade"),
    vendedor: varchar("vendedor", { length: 100 }),
    descricao: text("descricao"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [unique("uq_agenda_ga").on(t.semanaInicio, t.code, t.data)],
);

export type AgendaGa = typeof agendaGa.$inferSelect;
export type InsertAgendaGa = typeof agendaGa.$inferInsert;
