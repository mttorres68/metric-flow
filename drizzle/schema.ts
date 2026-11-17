import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  date,
  index,
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
  uniqueIndex,
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
// Configuração do Relatório de Entregas — tabela single-row, editada no modal
// ⚙ da tela de entregas. Separada de metricas_config porque o "Restaurar padrão"
// de vendas apaga aquela linha inteira.
// ---------------------------------------------------------------------------
export const entregasConfig = pgTable("entregas_config", {
  id:        serial("id").primaryKey(),
  raioM:       integer("raioM").notNull().default(300),
  desvioFator: doublePrecision("desvioFator").notNull().default(1.8), // trecho com km > fator × linha reta…
  desvioMinKm: doublePrecision("desvioMinKm").notNull().default(3),  // …e pelo menos estes km a mais = desvio
  lentoMinMin: integer("lentoMinMin").notNull().default(20),         // trecho com mais que estes minutos…
  lentoMaxKmh: integer("lentoMaxKmh").notNull().default(15),         // …a menos que esta média = lento
  saidaMinima: varchar("saidaMinima", { length: 5 }).notNull().default("04:00"), // movimento antes disso não é saída
  almocoDe: varchar("almocoDe", { length: 5 }).notNull().default("12:00"), // intervalo de almoço (informativo)
  almocoAte: varchar("almocoAte", { length: 5 }).notNull().default("13:45"),
  pernoiteMaxKm:        doublePrecision("pernoiteMaxKm").notNull().default(80),
  pernoiteChegarAte:    varchar("pernoiteChegarAte", { length: 5 }).notNull().default("21:00"),
  pernoiteFatorEstrada: doublePrecision("pernoiteFatorEstrada").notNull().default(1.3),
  pernoiteVelKmh:       doublePrecision("pernoiteVelKmh").notNull().default(60),
  pernoiteParouCedo:    varchar("pernoiteParouCedo", { length: 5 }).notNull().default("17:00"),
  pernoiteFinalLentoX:  doublePrecision("pernoiteFinalLentoX").notNull().default(2),
  previstoToleranciaMin: integer("previstoToleranciaMin").notNull().default(15), // previsto do Pathfind: "no prazo" até
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Relatório de Entregas — coleta do CheckNow por revenda (spec checknow-coleta §4).
// Senha e token cifrados (server/services/checknow/cofre.ts).
// ---------------------------------------------------------------------------
export const entregasContas = pgTable("entregas_contas", {
  id:               serial("id").primaryKey(),
  revendaId:        integer("revendaId").notNull().unique().references(() => revendas.id),
  ativo:            boolean("ativo").notNull().default(true),
  checknowUsuario:  varchar("checknowUsuario", { length: 120 }).notNull(),
  checknowSenha:    text("checknowSenha").notNull(),
  infleetToken:     text("infleetToken"),
  ultimaColetaEm:   timestamp("ultimaColetaEm", { withTimezone: true }),
  ultimaColetaOk:   boolean("ultimaColetaOk"),
  ultimaColetaErro: text("ultimaColetaErro"),
  // Pathfind (roteirizador): hora prevista por cliente (spec pathfind-previsto §4). Senha cifrada no cofre.
  pathfindBase:             varchar("pathfindBase", { length: 200 }),
  pathfindUsuario:          varchar("pathfindUsuario", { length: 120 }),
  pathfindSenha:            text("pathfindSenha"),
  pathfindUltimaColetaEm:   timestamp("pathfindUltimaColetaEm", { withTimezone: true }),
  pathfindUltimaColetaOk:   boolean("pathfindUltimaColetaOk"),
  pathfindUltimaColetaErro: text("pathfindUltimaColetaErro"),
  createdAt:        timestamp("createdAt").defaultNow().notNull(),
  updatedAt:        timestamp("updatedAt").defaultNow().notNull(),
});

/** Rota planejada no Pathfind: uma linha por rota de uma simulação. */
export const pathfindRotas = pgTable("pathfind_rotas", {
  id:            serial("id").primaryKey(),
  revendaId:     integer("revendaId").notNull().references(() => revendas.id),
  dataSimulacao: date("dataSimulacao", { mode: "string" }).notNull(),
  simulacao:     varchar("simulacao", { length: 20 }).notNull(),
  rota:          varchar("rota", { length: 20 }).notNull(),
  placa:         varchar("placa", { length: 20 }).notNull(),
  motorista:     varchar("motorista", { length: 120 }).notNull(),
  tempoMin:      integer("tempoMin"),
  km:            doublePrecision("km"),
  coletadoEm:    timestamp("coletadoEm", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("uq_pathfind_rotas").on(t.revendaId, t.simulacao, t.rota),
  index("ix_pathfind_rotas_data").on(t.revendaId, t.dataSimulacao),
]);

/** Pedido de uma rota do Pathfind com chegada/saída previstas ("HH:MM"; a data sai do cruzamento). */
export const pathfindParadas = pgTable("pathfind_paradas", {
  id:              serial("id").primaryKey(),
  rotaId:          integer("rotaId").notNull().references(() => pathfindRotas.id, { onDelete: "cascade" }),
  sequencia:       integer("sequencia").notNull(),
  pedido:          varchar("pedido", { length: 20 }).notNull(),
  codCliente:      varchar("codCliente", { length: 40 }).notNull(),
  cliente:         varchar("cliente", { length: 200 }).notNull(),
  cidade:          varchar("cidade", { length: 120 }).notNull(),
  chegadaPrevista: varchar("chegadaPrevista", { length: 5 }).notNull(),
  saidaPrevista:   varchar("saidaPrevista", { length: 5 }).notNull(),
  km:              doublePrecision("km"),
}, t => [uniqueIndex("uq_pathfind_paradas").on(t.rotaId, t.sequencia, t.pedido)]);

export const checknowEntregas = pgTable("checknow_entregas", {
  id:              serial("id").primaryKey(),
  revendaId:       integer("revendaId").notNull().references(() => revendas.id),
  dia:             date("dia", { mode: "string" }).notNull(),
  routeId:         varchar("routeId", { length: 40 }).notNull(),
  placa:           varchar("placa", { length: 20 }).notNull(),
  motorista:       varchar("motorista", { length: 120 }).notNull(),
  codCliente:      varchar("codCliente", { length: 40 }).notNull(),
  cliente:         varchar("cliente", { length: 200 }).notNull(),
  lat:             doublePrecision("lat"),
  lon:             doublePrecision("lon"),
  latApp:          doublePrecision("latApp"),   // onde o motorista registrou a entrega no app
  lonApp:          doublePrecision("lonApp"),
  documentos:      text("documentos").array().notNull().default(sql`'{}'::text[]`), // = Pedido do ERP
  situacao:        varchar("situacao", { length: 20 }).notNull(),
  baixaEm:         timestamp("baixaEm", { withTimezone: true }),
  saidaApp:        timestamp("saidaApp", { withTimezone: true }),
  rotaInicio:      timestamp("rotaInicio", { withTimezone: true }).notNull(),
  rotaFim:         timestamp("rotaFim", { withTimezone: true }),
  odoIniInformado: doublePrecision("odoIniInformado"),
  odoFimInformado: doublePrecision("odoFimInformado"),
  ordemPlanejada:  integer("ordemPlanejada"),
  valor:           doublePrecision("valor").notNull().default(0),
  pesoKg:          doublePrecision("pesoKg").notNull().default(0),
  notas:           integer("notas").notNull().default(0),
  motivoProblema:  text("motivoProblema"),
  capacidadeKg:    doublePrecision("capacidadeKg"),
  cidade:          varchar("cidade", { length: 120 }).notNull().default(""),
  coletadoEm:      timestamp("coletadoEm", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("uq_checknow_entregas").on(t.revendaId, t.routeId, t.codCliente),
  index("ix_checknow_entregas_dia").on(t.revendaId, t.dia),
]);

export const checknowColetas = pgTable("checknow_coletas", {
  id:          serial("id").primaryKey(),
  revendaId:   integer("revendaId").notNull().references(() => revendas.id),
  origem:      varchar("origem", { length: 10 }).notNull(),   // auto | botao | upload
  periodoDe:   date("periodoDe", { mode: "string" }).notNull(),
  periodoAte:  date("periodoAte", { mode: "string" }).notNull(),
  iniciadoEm:  timestamp("iniciadoEm", { withTimezone: true }).defaultNow().notNull(),
  terminadoEm: timestamp("terminadoEm", { withTimezone: true }),
  status:      varchar("status", { length: 10 }).notNull(),   // rodando | ok | sem_dados | erro
  rotas:       integer("rotas"),
  linhas:      integer("linhas"),
  erro:        text("erro"),
}, t => [index("ix_checknow_coletas").on(t.revendaId, t.iniciadoEm)]);

// ---------------------------------------------------------------------------
// Produtividade em hL (spec produtividade §4): cadastro de produtos (global),
// itens dos pedidos do ERP (por revenda) e pontos do "4 semanas".
// ---------------------------------------------------------------------------
export const produtos = pgTable("produtos", {
  codigo:      varchar("codigo", { length: 20 }).primaryKey(),
  descricao:   varchar("descricao", { length: 200 }).notNull(),
  familia:     varchar("familia", { length: 120 }).notNull().default(""),
  categoria:   varchar("categoria", { length: 120 }).notNull().default(""),
  marca:       varchar("marca", { length: 120 }).notNull().default(""),
  embalagem:   varchar("embalagem", { length: 4 }).notNull().default(""),   // CX | EB | BR | UN
  tipo:        varchar("tipo", { length: 12 }),                             // retornavel | descartavel | barril | null
  unPorEmb:    integer("unPorEmb").notNull().default(1),
  litrosEmb:   doublePrecision("litrosEmb"),                                // null = sem volume
  litrosUn:    doublePrecision("litrosUn"),
  ativo:       boolean("ativo").notNull().default(true),
  atualizadoEm: timestamp("atualizadoEm", { withTimezone: true }).defaultNow().notNull(),
});

export const erpPedidoItens = pgTable("erp_pedido_itens", {
  id:           serial("id").primaryKey(),
  revendaId:    integer("revendaId").notNull().references(() => revendas.id),
  pedido:       varchar("pedido", { length: 20 }).notNull(),
  item:         integer("item").notNull(),
  romaneio:     varchar("romaneio", { length: 20 }).notNull().default(""),
  cliente:      varchar("cliente", { length: 20 }).notNull().default(""),
  placa:        varchar("placa", { length: 12 }).notNull().default(""),
  motoristaCod: varchar("motoristaCod", { length: 12 }).notNull().default(""),
  dataPedido:   date("dataPedido", { mode: "string" }),
  codProduto:   varchar("codProduto", { length: 20 }).notNull(),
  qtdCx:        doublePrecision("qtdCx").notNull().default(0),
  qtdUn:        doublePrecision("qtdUn").notNull().default(0),
  retCx:        doublePrecision("retCx").notNull().default(0),
  retUn:        doublePrecision("retUn").notNull().default(0),
  liqCx:        doublePrecision("liqCx").notNull().default(0),
  liqUn:        doublePrecision("liqUn").notNull().default(0),
  motivoDev:    varchar("motivoDev", { length: 10 }),
  valor:        doublePrecision("valor").notNull().default(0),
  cancelado:    boolean("cancelado").notNull().default(false),
  importadoEm:  timestamp("importadoEm", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("uq_erp_pedido_itens").on(t.revendaId, t.pedido, t.item),
  index("ix_erp_pedido_itens_pedido").on(t.revendaId, t.pedido),
]);

export const produtividadeParadas = pgTable("produtividade_paradas", {
  id:          serial("id").primaryKey(),
  revendaId:   integer("revendaId").notNull().references(() => revendas.id),
  dia:         date("dia", { mode: "string" }).notNull(),
  placa:       varchar("placa", { length: 20 }).notNull(),
  motorista:   varchar("motorista", { length: 120 }).notNull(),
  routeId:     varchar("routeId", { length: 40 }).notNull(),
  codCliente:  varchar("codCliente", { length: 40 }).notNull(),
  hl:          doublePrecision("hl").notNull(),
  minDescarga: doublePrecision("minDescarga").notNull(),
}, t => [
  uniqueIndex("uq_produtividade_paradas").on(t.revendaId, t.routeId, t.codCliente, t.dia),
  index("ix_produtividade_paradas_motorista").on(t.revendaId, t.motorista, t.dia),
]);

// Pernoite de cada caminhão por noite (spec pernoite §6): classificação e sinais com os números que os explicam.
export const pernoites = pgTable("pernoites", {
  id:                 serial("id").primaryKey(),
  revendaId:          integer("revendaId").notNull().references(() => revendas.id),
  placa:              varchar("placa", { length: 20 }).notNull(),
  motorista:          varchar("motorista", { length: 120 }).notNull(),
  dia:                date("dia", { mode: "string" }).notNull(),
  lat:                doublePrecision("lat"),
  lon:                doublePrecision("lon"),
  endereco:           text("endereco"),
  cidade:             varchar("cidade", { length: 120 }),
  distSedeKm:         doublePrecision("distSedeKm"),
  chegada:            timestamp("chegada", { withTimezone: true }),
  saidaManha:         timestamp("saidaManha", { withTimezone: true }),
  descansoMin:        integer("descansoMin"),
  ultimoClienteSaida: timestamp("ultimoClienteSaida", { withTimezone: true }),
  chaveLigadaMin:     integer("chaveLigadaMin"),
  madrugadaEventos:   integer("madrugadaEventos").notNull().default(0),
  classificacao:      varchar("classificacao", { length: 12 }).notNull(), // na_malicia | evitavel | normal | na_base | sem_parada
  sinais:             jsonb("sinais").notNull(),
  galo:               integer("galo").notNull().default(0),
  calculadoEm:        timestamp("calculadoEm", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("uq_pernoites").on(t.revendaId, t.placa, t.dia),
  index("ix_pernoites_dia").on(t.revendaId, t.dia),
  index("ix_pernoites_motorista").on(t.revendaId, t.motorista, t.dia),
]);

export const erpPedidos = pgTable("erp_pedidos", {
  id:                serial("id").primaryKey(),
  revendaId:         integer("revendaId").notNull().references(() => revendas.id),
  pedido:            varchar("pedido", { length: 20 }).notNull(),
  romaneio:          varchar("romaneio", { length: 20 }).notNull().default(""),
  cliente:           varchar("cliente", { length: 20 }).notNull().default(""),
  vendedor:          varchar("vendedor", { length: 12 }).notNull().default(""),
  canal:             varchar("canal", { length: 12 }).notNull().default(""),
  origem:            varchar("origem", { length: 4 }).notNull().default(""),
  placa:             varchar("placa", { length: 12 }).notNull().default(""),
  motoristaCod:      varchar("motoristaCod", { length: 12 }).notNull().default(""),
  dataPedido:        date("dataPedido", { mode: "string" }),
  tipoCobranca:      varchar("tipoCobranca", { length: 4 }).notNull().default(""), // T.C.: 1 = à vista
  condicaoPagamento: varchar("condicaoPagamento", { length: 4 }).notNull().default(""),
  banco:             varchar("banco", { length: 6 }).notNull().default(""),
  vencimento1:       date("vencimento1", { mode: "string" }),
  situacao:          varchar("situacao", { length: 10 }).notNull(), // aberto | acertado | cancelado (Canc 000/008/009)
  dataAcerto:        date("dataAcerto", { mode: "string" }),
  flagRomaneio:      varchar("flagRomaneio", { length: 2 }).notNull().default(""),
  valor:             doublePrecision("valor").notNull().default(0),
  valorRetorno:      doublePrecision("valorRetorno").notNull().default(0),
  itens:             integer("itens").notNull().default(0),
  produtos:          integer("produtos").notNull().default(0),
  atualizadoEm:      timestamp("atualizadoEm", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("uq_erp_pedidos").on(t.revendaId, t.pedido),
  index("ix_erp_pedidos_data").on(t.revendaId, t.dataPedido),
  index("ix_erp_pedidos_cliente").on(t.revendaId, t.cliente),
  index("ix_erp_pedidos_romaneio").on(t.revendaId, t.romaneio),
]);

/** Evidência de GPS por entrega (gravada pelo processamento diário do pernoite). Spec desvio §4. */
export const entregasEvidencias = pgTable("entregas_evidencias", {
  id:           serial("id").primaryKey(),
  revendaId:    integer("revendaId").notNull().references(() => revendas.id),
  dia:          date("dia", { mode: "string" }).notNull(),
  routeId:      varchar("routeId", { length: 40 }).notNull(),
  codCliente:   varchar("codCliente", { length: 40 }).notNull(),
  placa:        varchar("placa", { length: 20 }).notNull(),
  motorista:    varchar("motorista", { length: 120 }).notNull(),
  documentos:   text("documentos").array().notNull().default(sql`'{}'::text[]`),
  status:       varchar("status", { length: 20 }).notNull(),
  distParadaM:  doublePrecision("distParadaM"),
  paradaLat:    doublePrecision("paradaLat"),
  paradaLon:    doublePrecision("paradaLon"),
  paradaInicio: timestamp("paradaInicio", { withTimezone: true }),
  paradaFim:    timestamp("paradaFim", { withTimezone: true }),
  distAppM:     doublePrecision("distAppM"),
  clienteLat:   doublePrecision("clienteLat"),
  clienteLon:   doublePrecision("clienteLon"),
  calculadoEm:  timestamp("calculadoEm", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("uq_entregas_evidencias").on(t.revendaId, t.routeId, t.codCliente, t.dia),
  index("ix_entregas_evidencias_dia").on(t.revendaId, t.dia),
]);

export const desvioRevisoes = pgTable("desvio_revisoes", {
  id:         serial("id").primaryKey(),
  revendaId:  integer("revendaId").notNull().references(() => revendas.id),
  pedido:     varchar("pedido", { length: 20 }).notNull(),
  situacao:   varchar("situacao", { length: 12 }).notNull(), // ok | suspeito | investigando
  observacao: text("observacao").notNull().default(""),
  revisadoEm: timestamp("revisadoEm", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("uq_desvio_revisoes").on(t.revendaId, t.pedido)]);

/** Produtividade da rota por dia (spec rota-produtividade §3): gravada pela tela "Por dia" e pelo processamento diário. */
export const rotasDia = pgTable("rotas_dia", {
  id:                  serial("id").primaryKey(),
  revendaId:           integer("revendaId").notNull().references(() => revendas.id),
  routeId:             varchar("routeId", { length: 40 }).notNull(),
  dia:                 date("dia", { mode: "string" }).notNull(),
  placa:               varchar("placa", { length: 20 }).notNull(),
  motorista:           varchar("motorista", { length: 120 }).notNull(),
  saida:               timestamp("saida", { withTimezone: true }),
  retorno:             timestamp("retorno", { withTimezone: true }),
  jornadaMin:          integer("jornadaMin"),
  rodandoMin:          integer("rodandoMin"),
  emClienteMin:        integer("emClienteMin"),
  paradoSemClienteMin: integer("paradoSemClienteMin"),
  idaMin:              integer("idaMin"),
  voltaMin:            integer("voltaMin"),
  entregas:            integer("entregas").notNull().default(0),
  entregasAlmoco:      integer("entregasAlmoco").notNull().default(0),
  aEntregar:           integer("aEntregar").notNull().default(0),
  totalRota:           integer("totalRota").notNull().default(0),
  hl:                  doublePrecision("hl").notNull().default(0),
  hlPorHora:           doublePrecision("hlPorHora"),
  devPct:              doublePrecision("devPct"),
  kmGps:               doublePrecision("kmGps"),
  semGps:              varchar("semGps", { length: 80 }),
  parcial:             boolean("parcial").notNull().default(false),
  incompleto:          boolean("incompleto").notNull().default(false),
  rotaInicio:          timestamp("rotaInicio", { withTimezone: true }).notNull(),
  rotaFim:             timestamp("rotaFim", { withTimezone: true }),
  calculadoEm:         timestamp("calculadoEm", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("uq_rotas_dia").on(t.revendaId, t.routeId, t.dia),
  index("ix_rotas_dia_dia").on(t.revendaId, t.dia),
  index("ix_rotas_dia_inicio").on(t.revendaId, t.rotaInicio),
]);

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
