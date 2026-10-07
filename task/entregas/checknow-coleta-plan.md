# Coleta automática do CheckNow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buscar a planilha do CheckNow sozinho (botão + agendamento), guardar as entregas no Postgres por revenda e o relatório ler do banco, com contas do CheckNow/Infleet por revenda cadastradas no ⚙.

**Architecture:** `server/services/checknow/` ganha `cofre` (AES-256-GCM), `coletor` (fetch + cookies, 6 passos do portal JSF), `repo` (drizzle: contas, entregas, coletas, trava), `sincronizar` (coleta com trava, tentativas e registro) e `agendador` (setTimeout, ligado por env). O pipeline `processarPlanilha` vira `processarEntregas(entregas, …)`, com o token do Infleet da revenda. A tela troca o upload por revenda + período lidos do banco.

**Tech Stack:** Express + tRPC + drizzle-orm 0.44 (node-postgres), React, vitest, Node 22 (`fetch`, `Headers.getSetCookie`, `crypto`).

**Spec:** `task/entregas/checknow-coleta-design.md`

## Global Constraints

- Nada de `pnpm db:push`: SQL manual em `drizzle/manual/`, aplicado no banco local **só com confirmação do usuário**.
- `.env` fica no checkout principal (`../../../.env`); scripts: `pnpm tsx --env-file=../../../.env …`. Não copiar o `.env`.
- Credenciais reais (do docx) **nunca** em código, teste, fixture, log ou mensagem. O assistente não digita senha em nenhum lugar: o usuário cadastra a conta no ⚙.
- Senha e token: cifrados no banco; nunca voltam para a tela.
- Coleta automática só com `CHECKNOW_COLETA_AUTO=1`.
- Baseline pré-existente: `pnpm test` com 42 falhas (vendedoresRouter, analiseRouter.recorrencia, metricsCalculator); `pnpm check` com 2 erros (`client/src/App.tsx(71,9)`, `server/services/thumbnailService.ts(34,18)`). Não adicionar outros.
- Textos da UI em pt-BR, sem "baixa" (usar "entrega").

## Review Focus

1. Página real do CheckNow diferente das fixtures (ViewState com atributos em outra ordem, login que responde 200 em vez de 302) — o coletor procura o ViewState por regex tolerante e detecta login recusado pela presença de `j_username` na página; Task 11 confere contra o portal real.
2. Arquivo vazio ou falha no meio — nada pode ser apagado (`gravarEntregas` só apaga rotas presentes; `sem_dados` não grava). Teste em `sincronizar.test.ts`.
3. Login recusado não pode ser repetido 3× (risco de bloquear a conta) — teste de `comTentativas`.
4. Datas: timestamps com fuso (`timestamptz`) e `dia` em BRT — ida e volta pelo banco no script da Task 5.
5. Conta sem token do Infleet usa o `INFLEET_TOKEN` do `.env` — Floriano tem de continuar funcionando igual.

---

### Task 1: Schema e SQL das 3 tabelas

**Files:**
- Modify: `drizzle/schema.ts` (depois de `entregasConfig`)
- Create: `drizzle/manual/2026-10-08_checknow_coleta.sql`

**Interfaces:**
- Produces: `entregasContas`, `checknowEntregas`, `checknowColetas` (drizzle tables).

- [ ] **Step 1: Tabelas no schema**

Garantir `boolean`, `date`, `text`, `varchar`, `index`, `uniqueIndex` no import de `drizzle-orm/pg-core` e acrescentar:

```ts
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
  createdAt:        timestamp("createdAt").defaultNow().notNull(),
  updatedAt:        timestamp("updatedAt").defaultNow().notNull(),
});

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
```

- [ ] **Step 2: SQL manual** — `drizzle/manual/2026-10-08_checknow_coleta.sql`:

```sql
-- Coleta automática do CheckNow (spec task/entregas/checknow-coleta-design.md §4).
-- Idempotente; só cria tabelas novas (sem drizzle-kit push).
CREATE TABLE IF NOT EXISTS "entregas_contas" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL UNIQUE REFERENCES "revendas"("id"),
  "ativo" boolean NOT NULL DEFAULT true,
  "checknowUsuario" varchar(120) NOT NULL,
  "checknowSenha" text NOT NULL,
  "infleetToken" text,
  "ultimaColetaEm" timestamptz,
  "ultimaColetaOk" boolean,
  "ultimaColetaErro" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "checknow_entregas" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "dia" date NOT NULL,
  "routeId" varchar(40) NOT NULL,
  "placa" varchar(20) NOT NULL,
  "motorista" varchar(120) NOT NULL,
  "codCliente" varchar(40) NOT NULL,
  "cliente" varchar(200) NOT NULL,
  "lat" double precision,
  "lon" double precision,
  "situacao" varchar(20) NOT NULL,
  "baixaEm" timestamptz,
  "saidaApp" timestamptz,
  "rotaInicio" timestamptz NOT NULL,
  "rotaFim" timestamptz,
  "odoIniInformado" double precision,
  "odoFimInformado" double precision,
  "ordemPlanejada" integer,
  "valor" double precision NOT NULL DEFAULT 0,
  "pesoKg" double precision NOT NULL DEFAULT 0,
  "notas" integer NOT NULL DEFAULT 0,
  "motivoProblema" text,
  "capacidadeKg" double precision,
  "cidade" varchar(120) NOT NULL DEFAULT '',
  "coletadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_checknow_entregas" ON "checknow_entregas" ("revendaId", "routeId", "codCliente");
CREATE INDEX IF NOT EXISTS "ix_checknow_entregas_dia" ON "checknow_entregas" ("revendaId", "dia");
CREATE TABLE IF NOT EXISTS "checknow_coletas" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "origem" varchar(10) NOT NULL,
  "periodoDe" date NOT NULL,
  "periodoAte" date NOT NULL,
  "iniciadoEm" timestamptz NOT NULL DEFAULT now(),
  "terminadoEm" timestamptz,
  "status" varchar(10) NOT NULL,
  "rotas" integer,
  "linhas" integer,
  "erro" text
);
CREATE INDEX IF NOT EXISTS "ix_checknow_coletas" ON "checknow_coletas" ("revendaId", "iniciadoEm");
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check 2>&1 | grep "error TS" | grep -v "App.tsx(71\|thumbnailService"`
Expected: nenhuma linha.

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/manual/2026-10-08_checknow_coleta.sql
git commit -m "feat(entregas): tabelas da coleta do CheckNow (contas, entregas, coletas)"
```

---

### Task 2: Cofre (AES-256-GCM)

**Files:**
- Create: `server/services/checknow/cofre.ts`
- Test: `server/services/checknow/cofre.test.ts`

**Interfaces:**
- Produces: `cifrar(texto: string): string`, `decifrar(cifrado: string): string`, `cofreDisponivel(): boolean`. Lê `process.env.CHECKNOW_CHAVE` a cada chamada (32 bytes em base64).

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "crypto";
import { cifrar, decifrar, cofreDisponivel } from "./cofre";

beforeEach(() => { process.env.CHECKNOW_CHAVE = randomBytes(32).toString("base64"); });

describe("cofre", () => {
  it("ida e volta", () => {
    expect(decifrar(cifrar("s3nh@ çã"))).toBe("s3nh@ çã");
  });
  it("mesmo texto vira cifras diferentes (iv aleatório)", () => {
    expect(cifrar("x")).not.toBe(cifrar("x"));
  });
  it("chave errada não decifra", () => {
    const c = cifrar("x");
    process.env.CHECKNOW_CHAVE = randomBytes(32).toString("base64");
    expect(() => decifrar(c)).toThrow();
  });
  it("sem chave: indisponível e erro claro", () => {
    delete process.env.CHECKNOW_CHAVE;
    expect(cofreDisponivel()).toBe(false);
    expect(() => cifrar("x")).toThrow("CHECKNOW_CHAVE não configurada");
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/checknow/cofre.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
/*
 * MetricFlow — cifra senhas/tokens das contas do CheckNow e do Infleet (AES-256-GCM).
 * Chave: CHECKNOW_CHAVE (32 bytes em base64) só no .env. Formato: iv:tag:dados (base64).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function chave(): Buffer {
  const k = process.env.CHECKNOW_CHAVE ? Buffer.from(process.env.CHECKNOW_CHAVE, "base64") : null;
  if (!k || k.length !== 32) throw new Error("CHECKNOW_CHAVE não configurada (32 bytes em base64 no .env).");
  return k;
}

export function cofreDisponivel(): boolean {
  try { chave(); return true; } catch { return false; }
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map(b => b.toString("base64")).join(":");
}

export function decifrar(cifrado: string): string {
  const [iv, tag, dados] = cifrado.split(":").map(p => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}
```

- [ ] **Step 4: Rodar** — mesmo comando → PASS (4).

- [ ] **Step 5: Commit** — `git add server/services/checknow/cofre*.ts && git commit -m "feat(entregas): cofre AES-256-GCM para credenciais"`

---

### Task 3: Token do Infleet por chamada

**Files:**
- Modify: `server/routers/infleetRouter.ts:18-20` (`infleetQuery`)
- Modify: `server/services/entregas/infleetEntregas.ts` (`consultar`, `mapaVeiculos`, `eventosDoDia`, `buscarGpsLinha`)
- Test: `server/services/entregas/infleetEntregas.test.ts`

**Interfaces:**
- Produces: `infleetQuery<T>(query, variables, token?: string)`; `mapaVeiculos(token?: string)`; `buscarGpsLinha(vehicleId, janela, { cercaId, token }: { cercaId?: string; token?: string } = {})`; `listarCercasInfleet(token?: string): Promise<{ id: string; name: string }[]>`.

- [ ] **Step 1: Teste (novo, em infleetEntregas.test.ts)**

```ts
describe("token por revenda", () => {
  it("repassa o token da conta em todas as consultas", async () => {
    q.mockResolvedValueOnce({ listVehicles: [] });
    await mapaVeiculos("tok-fl");
    expect(q.mock.calls[0][2]).toBe("tok-fl");
  });
});
```

E trocar as chamadas existentes `buscarGpsLinha("v1", janela, "sede")` por `buscarGpsLinha("v1", janela, { cercaId: "sede" })`.

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/entregas/infleetEntregas.test.ts` → FAIL (`q.mock.calls[0][2]` undefined).

- [ ] **Step 3: Implementar**

`infleetRouter.ts`:
```ts
export async function infleetQuery<T>(query: string, variables: Record<string, any>, token = process.env.INFLEET_TOKEN): Promise<T> {
    if (!token) throw new Error("INFLEET_TOKEN não configurado no ambiente.");
```

`infleetEntregas.ts`: `consultar<T>(query, variables, token?: string)` repassa `token` às duas chamadas de `infleetQuery`; `mapaVeiculos(token?: string)` e `eventosDoDia(vehicleId, janela, token?: string)` repassam; `buscarGpsLinha(vehicleId, janela, { cercaId, token }: { cercaId?: string; token?: string } = {})` repassa `token` a todas as `consultar` e a `eventosDoDia`. Novo:

```ts
export async function listarCercasInfleet(token?: string): Promise<{ id: string; name: string }[]> {
  const { listGeofences } = await consultar<{ listGeofences: { id: string; name: string }[] }>(`query { listGeofences { id name } }`, {}, token);
  return listGeofences;
}
```

`processar.ts`: `buscarGpsLinha(vId, l.janela, { cercaId })` (a Task 4 acrescenta o token). `processar.test.ts`: a asserção da cerca vira `expect((buscarGpsLinha as Mock).mock.calls[0][2]).toEqual({ cercaId: "sede", token: undefined })` — ajustada de novo na Task 4.

- [ ] **Step 4: Rodar** — `pnpm vitest run server/services/entregas` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(entregas): token do Infleet por chamada (conta da revenda)"`

---

### Task 4: `processarEntregas` (parse fora do pipeline)

**Files:**
- Modify: `server/services/entregas/processar.ts`
- Test: `server/services/entregas/processar.test.ts`

**Interfaces:**
- Consumes: Task 3 `buscarGpsLinha(…, { cercaId, token })`, `mapaVeiculos(token)`.
- Produces: `processarEntregas(entregas: Entrega[], agora: Date, opts?: { cercaId?: string; token?: string; config?: Partial<ConfigEntregas> }): Promise<{ linhas: ResultadoLinha[]; rotas: AnaliseRota[] }>`. `processarPlanilha` deixa de existir (callers trocados nas Tasks 9).

- [ ] **Step 1: Teste** — em `processar.test.ts`, trocar o import para `processarEntregas` e `parseCheckNow`, e cada `processarPlanilha(planilha([...]), agora, opts)` por `processarEntregas(parseCheckNow(planilha([...])), agora, opts)`. Novo caso:

```ts
it("usa o token do Infleet da revenda", async () => {
  (mapaVeiculos as Mock).mockResolvedValue(new Map([["SOL6B13", "v1"]]));
  (buscarGpsLinha as Mock).mockResolvedValue(gpsNoCliente);
  await processarEntregas(parseCheckNow(planilha([linha({})])), new Date("2026-10-06T12:00:00-03:00"), { cercaId: "sede", token: "tok" });
  expect((mapaVeiculos as Mock).mock.calls[0][0]).toBe("tok");
  expect((buscarGpsLinha as Mock).mock.calls[0][2]).toEqual({ cercaId: "sede", token: "tok" });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/entregas/processar.test.ts` → FAIL (`processarEntregas` não exportado).

- [ ] **Step 3: Implementar**

```ts
/** Linhas por dia (ordenadas por dia, placa e motorista) e análise por rota. cercaId: cerca da base; token: conta Infleet da revenda (sem = INFLEET_TOKEN); config: limites do ⚙. */
export async function processarEntregas(
  entregas: Entrega[], agora: Date,
  { cercaId, token, config }: { cercaId?: string; token?: string; config?: Partial<ConfigEntregas> } = {},
): Promise<{ linhas: ResultadoLinha[]; rotas: AnaliseRota[] }> {
  const linhas = montarLinhas(entregas, agora);
  if (!linhas.length) return { linhas: [], rotas: [] };

  const veiculos = await mapaVeiculos(token);
  const porRota = agruparPorRota(entregas);
  const resultados = await emParalelo(linhas, 3, async l => {
    const vId = veiculos.get(normalizarPlaca(l.placa));
    const gps = vId ? await buscarGpsLinha(vId, l.janela, { cercaId, token }) : gpsErro("sem rastreador");
    return cruzar(l, porRota.get(l.routeId)!, gps, config);
  });
  // (ordenação e retorno iguais aos de hoje)
}
```

Import: `import type { Entrega } from "./parseCheckNow";` (remover `parseCheckNow`). Cabeçalho: "entregas → linhas → GPS → cruzamento".

- [ ] **Step 4: Rodar** — `pnpm vitest run server/services/entregas` → PASS. (`pnpm check` acusa `entregasRouter`/`relatorioEntregas` — corrigidos na Task 9.)

- [ ] **Step 5: Commit** — `git commit -am "refactor(entregas): processarEntregas recebe entregas já lidas e o token da revenda"`

---

### Task 5: Repositório (contas, entregas, coletas, trava)

**Files:**
- Create: `server/services/checknow/repo.ts`
- Create: `server/services/checknow/repo.test.ts` (conversão pura)
- Create: `script/validarRepoCheckNow.ts` (contra o banco local; `git add -f`)

**Interfaces:**
- Consumes: Task 1 tabelas; Task 2 `cifrar`/`decifrar`.
- Produces:
  - `class ColetaError extends Error` (exportada daqui; o coletor importa)
  - `paraLinha(revendaId: number, e: Entrega)`, `deLinha(row): Entrega`
  - `gravarEntregas(revendaId: number, entregas: Entrega[]): Promise<{ rotas: number; linhas: number }>`
  - `entregasDoPeriodo(revendaId: number, de: string, ate: string): Promise<Entrega[]>`
  - `comTrava<T>(revendaId: number, fn: () => Promise<T>): Promise<T>`
  - `abrirColeta(revendaId, origem: Origem, de, ate): Promise<number>`
  - `fecharColeta(id, revendaId, r: { status: "ok" | "sem_dados" | "erro"; rotas?: number; linhas?: number; erro?: string }): Promise<void>`
  - `ultimasColetas(revendaId, n = 10)`, `ultimoPeriodoOk(revendaId): Promise<string | null>`
  - `contaComSegredos(revendaId): Promise<{ revendaId: number; ativo: boolean; usuario: string; senha: string; infleetToken: string | null } | null>`
  - `listarContas()`, `salvarConta(c: SalvarConta)`, `ativarConta(revendaId, ativo)`, `revendasSemConta()`, `contasAtivas(): Promise<number[]>`
  - `type Origem = "auto" | "botao" | "upload"`

- [ ] **Step 1: Teste da conversão**

```ts
import { describe, it, expect } from "vitest";
import { paraLinha, deLinha } from "./repo";
import type { Entrega } from "../entregas/parseCheckNow";

const e: Entrega = {
  routeId: "77", placa: "SOL-6B13", motorista: "ANTONIO", codCliente: "10", cliente: "MERCADO X",
  lat: -7, lon: -43, situacao: "ENTREGUE", baixaEm: new Date("2026-10-05T13:00:00Z"), saidaApp: null,
  rotaInicio: new Date("2026-10-05T02:30:00Z"), rotaFim: null, odoIniInformado: 100, odoFimInformado: null,
  ordemPlanejada: 3, valor: 10.5, pesoKg: 2, notas: 1, motivoProblema: null, capacidadeKg: null, cidade: "FLORIANO",
};

describe("repo — conversão", () => {
  it("dia é a data BRT do início da rota (23:30 BRT continua no dia anterior)", () => {
    expect(paraLinha(5, e).dia).toBe("2026-10-04");
  });
  it("ida e volta preserva a entrega", () => {
    const { revendaId, dia, ...resto } = paraLinha(5, e);
    expect(revendaId).toBe(5);
    expect(deLinha({ ...resto, id: 1, revendaId, dia, coletadoEm: new Date() })).toEqual(e);
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/checknow/repo.test.ts` → FAIL.

- [ ] **Step 3: Implementar `repo.ts`**

```ts
/*
 * MetricFlow — acesso ao banco da coleta do CheckNow (spec checknow-coleta §4–5).
 * Contas (segredos cifrados), entregas por revenda, registro de coletas e trava por revenda.
 */
import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type { Pool } from "pg";
import { getDb } from "../../db";
import { checknowColetas, checknowEntregas, entregasContas, revendas } from "../../../drizzle/schema";
import type { Entrega, Situacao } from "../entregas/parseCheckNow";
import { diaBRT } from "@shared/entregas";
import { cifrar, decifrar } from "./cofre";

export class ColetaError extends Error {}
export type Origem = "auto" | "botao" | "upload";
const CHAVE_TRAVA = 7301;

async function exigirDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

type Linha = typeof checknowEntregas.$inferSelect;

export function paraLinha(revendaId: number, e: Entrega) {
  return { ...e, revendaId, dia: diaBRT(e.rotaInicio!), rotaInicio: e.rotaInicio! };
}

export function deLinha(r: Linha): Entrega {
  const { id, revendaId, dia, coletadoEm, ...e } = r;
  return { ...e, situacao: e.situacao as Situacao };
}

/** Troca só as rotas presentes em `entregas` (transação). Entregas sem início de rota ficam de fora. */
export async function gravarEntregas(revendaId: number, entregas: Entrega[]): Promise<{ rotas: number; linhas: number }> {
  const unicas = new Map(entregas.filter(e => e.rotaInicio).map(e => [`${e.routeId}|${e.codCliente}`, e]));
  if (!unicas.size) return { rotas: 0, linhas: 0 };
  const rotas = [...new Set([...unicas.values()].map(e => e.routeId))];
  const linhas = [...unicas.values()].map(e => paraLinha(revendaId, e));
  const db = await exigirDb();
  await db.transaction(async tx => {
    await tx.delete(checknowEntregas).where(and(eq(checknowEntregas.revendaId, revendaId), inArray(checknowEntregas.routeId, rotas)));
    for (let i = 0; i < linhas.length; i += 500) await tx.insert(checknowEntregas).values(linhas.slice(i, i + 500));
  });
  return { rotas: rotas.length, linhas: linhas.length };
}

export async function entregasDoPeriodo(revendaId: number, de: string, ate: string): Promise<Entrega[]> {
  const db = await exigirDb();
  const rows = await db.select().from(checknowEntregas)
    .where(and(eq(checknowEntregas.revendaId, revendaId), gte(checknowEntregas.dia, de), lte(checknowEntregas.dia, ate)));
  return rows.map(deLinha);
}

/** Uma coleta por revenda por vez (advisory lock de sessão numa conexão dedicada). */
export async function comTrava<T>(revendaId: number, fn: () => Promise<T>): Promise<T> {
  const db = await exigirDb();
  const client = await (db.$client as Pool).connect();
  try {
    const { rows } = await client.query("select pg_try_advisory_lock($1, $2) as ok", [CHAVE_TRAVA, revendaId]);
    if (!rows[0].ok) throw new ColetaError("coleta já em andamento");
    try { return await fn(); }
    finally { await client.query("select pg_advisory_unlock($1, $2)", [CHAVE_TRAVA, revendaId]); }
  } finally {
    client.release();
  }
}

export async function abrirColeta(revendaId: number, origem: Origem, de: string, ate: string): Promise<number> {
  const db = await exigirDb();
  const [r] = await db.insert(checknowColetas).values({ revendaId, origem, periodoDe: de, periodoAte: ate, status: "rodando" }).returning({ id: checknowColetas.id });
  return r.id;
}

export async function fecharColeta(id: number, revendaId: number, r: { status: "ok" | "sem_dados" | "erro"; rotas?: number; linhas?: number; erro?: string }) {
  const db = await exigirDb();
  const agora = new Date();
  await db.update(checknowColetas).set({ status: r.status, rotas: r.rotas ?? null, linhas: r.linhas ?? null, erro: r.erro ?? null, terminadoEm: agora }).where(eq(checknowColetas.id, id));
  await db.update(entregasContas).set({ ultimaColetaEm: agora, ultimaColetaOk: r.status !== "erro", ultimaColetaErro: r.erro ?? null }).where(eq(entregasContas.revendaId, revendaId));
}

export async function ultimasColetas(revendaId: number, n = 10) {
  const db = await exigirDb();
  return db.select().from(checknowColetas).where(eq(checknowColetas.revendaId, revendaId)).orderBy(desc(checknowColetas.iniciadoEm)).limit(n);
}

/** Data final da última coleta que deu certo (ok ou sem dados). */
export async function ultimoPeriodoOk(revendaId: number): Promise<string | null> {
  const db = await exigirDb();
  const [r] = await db.select({ ate: checknowColetas.periodoAte }).from(checknowColetas)
    .where(and(eq(checknowColetas.revendaId, revendaId), inArray(checknowColetas.status, ["ok", "sem_dados"]), ne(checknowColetas.origem, "upload")))
    .orderBy(desc(checknowColetas.periodoAte)).limit(1);
  return r?.ate ?? null;
}

export async function contaComSegredos(revendaId: number) {
  const db = await exigirDb();
  const [c] = await db.select().from(entregasContas).where(eq(entregasContas.revendaId, revendaId));
  if (!c) return null;
  return { revendaId, ativo: c.ativo, usuario: c.checknowUsuario, senha: decifrar(c.checknowSenha), infleetToken: c.infleetToken ? decifrar(c.infleetToken) : null };
}

/** Para a tela: nunca devolve senha nem token. */
export async function listarContas() {
  const db = await exigirDb();
  const rows = await db.select({ c: entregasContas, revenda: revendas.nome }).from(entregasContas)
    .innerJoin(revendas, eq(revendas.id, entregasContas.revendaId)).orderBy(revendas.nome);
  return rows.map(({ c, revenda }) => ({
    revendaId: c.revendaId, revenda, ativo: c.ativo, checknowUsuario: c.checknowUsuario,
    senhaDefinida: !!c.checknowSenha, infleetDefinido: !!c.infleetToken,
    ultimaColetaEm: c.ultimaColetaEm, ultimaColetaOk: c.ultimaColetaOk, ultimaColetaErro: c.ultimaColetaErro,
  }));
}

export interface SalvarConta {
  revendaId: number; checknowUsuario: string;
  checknowSenha?: string;          // vazio/ausente = mantém (obrigatória ao criar)
  infleetToken?: string | null;    // ausente = mantém; null = remove (usa o .env)
}

export async function salvarConta(c: SalvarConta) {
  const db = await exigirDb();
  const [atual] = await db.select({ id: entregasContas.id }).from(entregasContas).where(eq(entregasContas.revendaId, c.revendaId));
  const segredos = {
    ...(c.checknowSenha ? { checknowSenha: cifrar(c.checknowSenha) } : {}),
    ...(c.infleetToken === null ? { infleetToken: null } : c.infleetToken ? { infleetToken: cifrar(c.infleetToken) } : {}),
  };
  if (atual) {
    await db.update(entregasContas).set({ checknowUsuario: c.checknowUsuario, ...segredos, updatedAt: new Date() }).where(eq(entregasContas.id, atual.id));
  } else {
    if (!c.checknowSenha) throw new ColetaError("informe a senha do CheckNow");
    await db.insert(entregasContas).values({ revendaId: c.revendaId, checknowUsuario: c.checknowUsuario, checknowSenha: cifrar(c.checknowSenha), infleetToken: segredos.infleetToken ?? null });
  }
}

export async function ativarConta(revendaId: number, ativo: boolean) {
  const db = await exigirDb();
  await db.update(entregasContas).set({ ativo, updatedAt: new Date() }).where(eq(entregasContas.revendaId, revendaId));
}

export async function revendasSemConta() {
  const db = await exigirDb();
  const comConta = (await db.select({ id: entregasContas.revendaId }).from(entregasContas)).map(r => r.id);
  const todas = await db.select({ id: revendas.id, nome: revendas.nome }).from(revendas).orderBy(revendas.nome);
  return todas.filter(r => !comConta.includes(r.id));
}

export async function contasAtivas(): Promise<number[]> {
  const db = await exigirDb();
  return (await db.select({ id: entregasContas.revendaId }).from(entregasContas).where(eq(entregasContas.ativo, true))).map(r => r.id);
}
```

- [ ] **Step 4: Rodar** — `pnpm vitest run server/services/checknow/repo.test.ts` → PASS (2). `pnpm check` sem erro novo em `repo.ts`.

- [ ] **Step 5: Script de validação no banco local** — `script/validarRepoCheckNow.ts` (roda só depois do SQL da Task 1 aplicado, com confirmação; recusa banco que não é localhost):

```ts
import { randomBytes } from "crypto";
const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "localhost") throw new Error(`Recusado: banco não é local (${url.hostname}).`);
process.env.CHECKNOW_CHAVE ??= randomBytes(32).toString("base64");
const { getDb } = await import("../server/db");
const { revendas, checknowEntregas } = await import("../drizzle/schema");
const repo = await import("../server/services/checknow/repo");
const { eq } = await import("drizzle-orm");

const db = (await getDb())!;
const [rev] = await db.select().from(revendas).limit(1);
const base = { placa: "TST-0001", motorista: "TESTE", cliente: "C", lat: -7, lon: -43, situacao: "ENTREGUE" as const, baixaEm: null, saidaApp: null,
  rotaFim: null, odoIniInformado: null, odoFimInformado: null, ordemPlanejada: null, valor: 0, pesoKg: 0, notas: 1, motivoProblema: null, capacidadeKg: null, cidade: "" };
const ini = new Date("2026-01-01T10:00:00-03:00");
try {
  await repo.gravarEntregas(rev.id, [
    { ...base, routeId: "T1", codCliente: "1", rotaInicio: ini },
    { ...base, routeId: "T2", codCliente: "1", rotaInicio: ini },
  ]);
  await repo.gravarEntregas(rev.id, [{ ...base, routeId: "T1", codCliente: "2", rotaInicio: ini }]);
  const lidas = await repo.entregasDoPeriodo(rev.id, "2026-01-01", "2026-01-01");
  console.log("esperado T1/2 e T2/1:", lidas.map(e => `${e.routeId}/${e.codCliente}`).sort());
  console.log("rotaInicio volta igual:", lidas[0].rotaInicio.getTime() === ini.getTime());
  console.log("gravar vazio não apaga:", await repo.gravarEntregas(rev.id, []), (await repo.entregasDoPeriodo(rev.id, "2026-01-01", "2026-01-01")).length === 2);
  await repo.comTrava(rev.id, async () => {
    await repo.comTrava(rev.id, async () => null).then(() => console.log("ERRO: trava não segurou"), e => console.log("trava ocupada:", e.message));
  });
} finally {
  await db.delete(checknowEntregas).where(eq(checknowEntregas.placa, "TST-0001"));
  process.exit(0);
}
```

Expected (após Task 11 Step 1): `esperado T1/2 e T2/1: [ 'T1/2', 'T2/1' ]`, `rotaInicio volta igual: true`, `gravar vazio não apaga: { rotas: 0, linhas: 0 } true`, `trava ocupada: coleta já em andamento`.

- [ ] **Step 6: Commit** — `git add server/services/checknow/repo*.ts && git add -f script/validarRepoCheckNow.ts && git commit -m "feat(entregas): repositório da coleta (contas, entregas, coletas, trava)"`

---

### Task 6: Coletor do portal

**Files:**
- Create: `server/services/checknow/coletor.ts`
- Test: `server/services/checknow/coletor.test.ts`

**Interfaces:**
- Consumes: `ColetaError` (Task 5).
- Produces: `baixarCheckNow(conta: { usuario: string; senha: string }, de: string, ate: string, f?: typeof fetch): Promise<Buffer[]>`; `testarLogin(conta, f?): Promise<{ filial: string }>`; `blocosDeDias(de, ate, n = 7): { de: string; ate: string }[]`.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from "vitest";
import { baixarCheckNow, blocosDeDias, testarLogin } from "./coletor";
import { ColetaError } from "./repo";

const conta = { usuario: "usuario-teste", senha: "senha-teste" };
const TELA_OK = `<html><form id="formTemplate"><span>3722-DUTTRA PI DISTRIBUIDORA (FLORIANO)</span>
<input type="hidden" id="j_id1:javax.faces.ViewState:0" value="-66:29" name="javax.faces.ViewState" autocomplete="off"/></form></html>`;
const LOGIN = `<form><input name="j_username" id="j_username"></form>`;
const EXCEL = Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.alloc(100)]);

type Chamada = { url: string; method: string; body: string; cookie: string | null };
function portal({ loginOk = true, tela = TELA_OK, arquivo = EXCEL as Buffer | string } = {}) {
  const chamadas: Chamada[] = [];
  const f = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input), method = init.method ?? "GET", body = String(init.body ?? "");
    chamadas.push({ url, method, body, cookie: new Headers(init.headers).get("Cookie") });
    if (url.endsWith("/publico/login.jsf")) return new Response(LOGIN, { headers: { "set-cookie": "JSESSIONID=abc; Path=/" } });
    if (url.endsWith("/j_spring_security_check")) return new Response(null, { status: 302, headers: { location: loginOk ? "/checknow/index.jsf" : "/checknow/publico/login.jsf?erro=true" } });
    if (url.endsWith("/index.jsf")) return new Response("<html>home</html>");
    if (url.includes("login.jsf?erro")) return new Response(LOGIN);
    if (url.endsWith("geracao_dado_bi_periodo_rel.jsf") && method === "GET") return new Response(loginOk ? tela : LOGIN);
    if (body.includes("commandLinkExporta")) return new Response(arquivo);
    return new Response("<partial-response/>");
  }) as typeof fetch;
  return { f, chamadas };
}

describe("blocosDeDias", () => {
  it("10 dias viram 2 blocos de até 7", () => {
    expect(blocosDeDias("2026-10-01", "2026-10-10")).toEqual([{ de: "2026-10-01", ate: "2026-10-07" }, { de: "2026-10-08", ate: "2026-10-10" }]);
  });
});

describe("baixarCheckNow", () => {
  it("faz login, marca período e Excel e baixa o arquivo com o cookie da sessão", async () => {
    const { f, chamadas } = portal();
    const [buf] = await baixarCheckNow(conta, "2026-10-01", "2026-10-07", f);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const final = chamadas.find(c => c.body.includes("commandLinkExporta"))!;
    const p = new URLSearchParams(final.body);
    expect(p.get("dtInicio_input")).toBe("01/10/2026 00:00:00");
    expect(p.get("dtFim_input")).toBe("07/10/2026 23:59:59");
    expect(p.get("tipoRelatorioId")).toBe("11");
    expect(p.get("javax.faces.ViewState")).toBe("-66:29");
    expect(final.cookie).toContain("JSESSIONID=abc");
    expect(chamadas.some(c => c.body.includes("javax.faces.source=dtInicio"))).toBe(true);
    expect(chamadas.some(c => c.body.includes("javax.faces.source=tipoRelatorioId"))).toBe(true);
  });

  it("login recusado", async () => {
    await expect(baixarCheckNow(conta, "2026-10-01", "2026-10-01", portal({ loginOk: false }).f)).rejects.toThrow("login recusado");
  });

  it("tela sem ViewState", async () => {
    await expect(baixarCheckNow(conta, "2026-10-01", "2026-10-01", portal({ tela: "<html>nada</html>" }).f)).rejects.toThrow("ViewState não encontrado");
  });

  it("HTML no lugar do Excel", async () => {
    const e = await baixarCheckNow(conta, "2026-10-01", "2026-10-01", portal({ arquivo: "<html>erro</html>" }).f).catch(x => x);
    expect(e).toBeInstanceOf(ColetaError);
    expect(e.message).toBe("resposta não é Excel");
  });

  it("período de 10 dias baixa 2 arquivos", async () => {
    expect(await baixarCheckNow(conta, "2026-10-01", "2026-10-10", portal().f)).toHaveLength(2);
  });

  it("a senha não aparece em mensagem de erro", async () => {
    const e = await baixarCheckNow(conta, "2026-10-01", "2026-10-01", portal({ loginOk: false }).f).catch(x => x);
    expect(e.message).not.toContain("senha-teste");
  });
});

describe("testarLogin", () => {
  it("devolve o nome da filial", async () => {
    expect(await testarLogin(conta, portal().f)).toEqual({ filial: "3722-DUTTRA PI DISTRIBUIDORA (FLORIANO)" });
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/checknow/coletor.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
/*
 * MetricFlow — coletor do portal CheckNow (JSF/PrimeFaces), sem navegador (spec checknow-coleta §3).
 * login → tela do relatório (ViewState) → datas → Excel → "Gerar Arquivo" (POST normal, devolve o xlsx).
 * A senha nunca entra em log nem em mensagem de erro.
 */
import { ColetaError } from "./repo";

const BASE = "https://checknowsistema.com.br/checknow";
const TELA = `${BASE}/relatorio/geracao_dado_bi_periodo_rel.jsf`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const TIMEOUT_MS = 120_000;
const DIA_MS = 86_400_000;

/** Sessão com pote de cookies próprio; segue redirecionamentos guardando os cookies de cada passo. */
class Sessao {
  private cookies = new Map<string, string>();
  constructor(private f: typeof fetch) {}

  async req(url: string, init: RequestInit = {}, saltos = 5): Promise<{ url: string; res: Response }> {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", UA);
    headers.set("Accept-Language", "pt-BR,pt;q=0.9");
    if (this.cookies.size) headers.set("Cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    let res: Response;
    try {
      res = await this.f(url, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new ColetaError(`CheckNow não respondeu (${(e as Error).name === "TimeoutError" ? "tempo esgotado" : "falha de rede"})`);
    }
    for (const c of res.headers.getSetCookie()) {
      const par = c.split(";")[0];
      const i = par.indexOf("=");
      if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
    const destino = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && destino && saltos > 0) return this.req(new URL(destino, url).toString(), {}, saltos - 1);
    if (res.status >= 400) throw new ColetaError(`CheckNow não respondeu (HTTP ${res.status})`);
    return { url, res };
  }

  async post(url: string, campos: Record<string, string>, ajax: boolean) {
    return this.req(url, {
      method: "POST",
      body: new URLSearchParams(campos).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: TELA,
        ...(ajax ? { "Faces-Request": "partial/ajax", "X-Requested-With": "XMLHttpRequest" } : {}),
      },
    });
  }
}

const naTelaDeLogin = (html: string) => /name="j_username"/.test(html);
const dataBR = (iso: string, fim: boolean) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${fim ? "23:59:59" : "00:00:00"}`;
const somaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

export function blocosDeDias(de: string, ate: string, n = 7): { de: string; ate: string }[] {
  const out: { de: string; ate: string }[] = [];
  for (let d = de; d <= ate; d = somaDias(d, n)) {
    const fim = somaDias(d, n - 1);
    out.push({ de: d, ate: fim < ate ? fim : ate });
  }
  return out;
}

async function entrar(s: Sessao, conta: { usuario: string; senha: string }): Promise<string> {
  await s.req(`${BASE}/publico/login.jsf`);
  await s.post(`${BASE}/publico/j_spring_security_check`, { j_username: conta.usuario, j_password: conta.senha }, false);
  return abrirTela(s);
}

/** HTML da tela do relatório; login recusado quando o portal devolve a tela de login. */
async function abrirTela(s: Sessao): Promise<string> {
  const html = await (await s.req(TELA)).res.text();
  if (naTelaDeLogin(html)) throw new ColetaError("login recusado");
  return html;
}

function viewState(html: string): string {
  const input = html.match(/<input[^>]*javax\.faces\.ViewState[^>]*>/)?.[0];
  const v = input?.match(/value="([^"]*)"/)?.[1];
  if (!v) throw new ColetaError("tela do relatório mudou (ViewState não encontrado)");
  return v;
}

export async function testarLogin(conta: { usuario: string; senha: string }, f: typeof fetch = fetch): Promise<{ filial: string }> {
  const html = await entrar(new Sessao(f), conta);
  viewState(html);
  return { filial: html.match(/\d+-[^<>]*?\([^()<>]+\)/)?.[0].trim() ?? "login ok" };
}

export async function baixarCheckNow(conta: { usuario: string; senha: string }, de: string, ate: string, f: typeof fetch = fetch): Promise<Buffer[]> {
  const s = new Sessao(f);
  let html = await entrar(s, conta);
  const arquivos: Buffer[] = [];
  for (const b of blocosDeDias(de, ate)) {
    if (arquivos.length) html = await abrirTela(s);
    const vs = viewState(html);
    const datas = { formTemplate: "formTemplate", dtInicio_input: dataBR(b.de, false), dtFim_input: dataBR(b.ate, true) };
    const ajax = (fonte: string, evento: string, extra: Record<string, string> = {}) => s.post(TELA, {
      "javax.faces.partial.ajax": "true", "javax.faces.source": fonte, "javax.faces.partial.execute": fonte,
      "javax.faces.behavior.event": evento, "javax.faces.partial.event": evento === "valueChange" ? "change" : evento,
      ...datas, ...extra, "javax.faces.ViewState": vs,
    }, true);
    await ajax("dtInicio", "dateSelect");
    await ajax("tipoRelatorioId", "valueChange", { tipoRelatorioId: "11" });
    const { res } = await s.post(TELA, { ...datas, tipoRelatorioId: "11", commandLinkExporta: "commandLinkExporta", "javax.faces.ViewState": vs }, false);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 2).toString("latin1") !== "PK") throw new ColetaError("resposta não é Excel");
    arquivos.push(buf);
  }
  return arquivos;
}
```

- [ ] **Step 4: Rodar** — mesmo comando → PASS (8). Se `new Response(..., { headers: { "set-cookie" } })` não expuser `getSetCookie()` no Node do projeto, trocar a fixture por `const h = new Headers(); h.append("set-cookie", "JSESSIONID=abc; Path=/")` e ledgerar o ruling.

- [ ] **Step 5: Commit** — `git add server/services/checknow/coletor*.ts && git commit -m "feat(entregas): coletor do portal CheckNow (login, período, Excel)"`

---

### Task 7: Sincronização (trava, tentativas, registro)

**Files:**
- Create: `server/services/checknow/sincronizar.ts`
- Test: `server/services/checknow/sincronizar.test.ts`

**Interfaces:**
- Consumes: Task 5 repo, Task 6 `baixarCheckNow`, `parseCheckNow`.
- Produces:
  - `comTentativas<T>(fn: () => Promise<T>, esperasMs: number[]): Promise<T>` (não repete "login recusado")
  - `coletarRevenda(revendaId: number, de: string, ate: string, origem: "auto" | "botao", esperasMs?: number[]): Promise<ResultadoColeta>`
  - `importarPlanilha(revendaId: number, buffer: Buffer): Promise<ResultadoColeta>`
  - `type ResultadoColeta = { status: "ok" | "sem_dados"; rotas: number; linhas: number }`

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("./repo", async importOriginal => ({
  ColetaError: (await importOriginal<typeof import("./repo")>()).ColetaError,
  comTrava: vi.fn((_id: number, fn: () => unknown) => fn()),
  contaComSegredos: vi.fn(),
  abrirColeta: vi.fn(async () => 99),
  fecharColeta: vi.fn(),
  gravarEntregas: vi.fn(),
}));
vi.mock("./coletor", () => ({ baixarCheckNow: vi.fn() }));
vi.mock("../entregas/parseCheckNow", async importOriginal => ({
  ...(await importOriginal<typeof import("../entregas/parseCheckNow")>()),
  parseCheckNow: vi.fn(),
}));
import * as repo from "./repo";
import { baixarCheckNow } from "./coletor";
import { parseCheckNow } from "../entregas/parseCheckNow";
import { coletarRevenda, comTentativas, importarPlanilha } from "./sincronizar";

const conta = { revendaId: 5, ativo: true, usuario: "u", senha: "s", infleetToken: null };
beforeEach(() => {
  vi.clearAllMocks();
  (repo.contaComSegredos as Mock).mockResolvedValue(conta);
  (baixarCheckNow as Mock).mockResolvedValue([Buffer.from("x")]);
});

describe("comTentativas", () => {
  it("repete até dar certo", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("502")).mockResolvedValue("ok");
    expect(await comTentativas(fn, [0, 0])).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("não repete login recusado", async () => {
    const fn = vi.fn().mockRejectedValue(new repo.ColetaError("login recusado"));
    await expect(comTentativas(fn, [0, 0, 0])).rejects.toThrow("login recusado");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("coletarRevenda", () => {
  it("grava e fecha a coleta como ok", async () => {
    (parseCheckNow as Mock).mockReturnValue([{ routeId: "1" }]);
    (repo.gravarEntregas as Mock).mockResolvedValue({ rotas: 1, linhas: 1 });
    expect(await coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).toEqual({ status: "ok", rotas: 1, linhas: 1 });
    expect(repo.fecharColeta).toHaveBeenCalledWith(99, 5, { status: "ok", rotas: 1, linhas: 1 });
  });
  it("arquivo vazio: sem_dados e nada gravado", async () => {
    (parseCheckNow as Mock).mockReturnValue([]);
    expect((await coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).status).toBe("sem_dados");
    expect(repo.gravarEntregas).not.toHaveBeenCalled();
  });
  it("falha: registra o erro, não grava e repassa a mensagem", async () => {
    (baixarCheckNow as Mock).mockRejectedValue(new repo.ColetaError("resposta não é Excel"));
    await expect(coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).rejects.toThrow("resposta não é Excel");
    expect(repo.fecharColeta).toHaveBeenCalledWith(99, 5, { status: "erro", erro: "resposta não é Excel" });
    expect(repo.gravarEntregas).not.toHaveBeenCalled();
  });
  it("revenda sem conta", async () => {
    (repo.contaComSegredos as Mock).mockResolvedValue(null);
    await expect(coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).rejects.toThrow("revenda sem conta do CheckNow");
  });
  it("trava ocupada não abre coleta", async () => {
    (repo.comTrava as Mock).mockRejectedValueOnce(new repo.ColetaError("coleta já em andamento"));
    await expect(coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).rejects.toThrow("coleta já em andamento");
    expect(repo.abrirColeta).not.toHaveBeenCalled();
  });
});

describe("importarPlanilha", () => {
  it("registra como upload no período das rotas", async () => {
    (parseCheckNow as Mock).mockReturnValue([{ routeId: "1", rotaInicio: new Date("2026-10-05T10:00:00-03:00") }]);
    (repo.gravarEntregas as Mock).mockResolvedValue({ rotas: 1, linhas: 1 });
    await importarPlanilha(5, Buffer.from("x"));
    expect(repo.abrirColeta).toHaveBeenCalledWith(5, "upload", "2026-10-05", "2026-10-05");
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/checknow/sincronizar.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
/*
 * MetricFlow — uma coleta do CheckNow: trava → registro → download (com tentativas) → leitura → gravação.
 * Falha nunca apaga dados; arquivo vazio vira "sem_dados" (spec checknow-coleta §5, §7).
 */
import { parseCheckNow, type Entrega } from "../entregas/parseCheckNow";
import { diaBRT } from "@shared/entregas";
import { baixarCheckNow } from "./coletor";
import * as repo from "./repo";

export type ResultadoColeta = { status: "ok" | "sem_dados"; rotas: number; linhas: number };
const ESPERAS = { auto: [60_000, 300_000, 900_000], botao: [5_000] };
const curta = (e: unknown) => ((e as Error).message ?? String(e)).split("\n")[0].slice(0, 200);

export async function comTentativas<T>(fn: () => Promise<T>, esperasMs: number[]): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= esperasMs.length || (e as Error).message === "login recusado") throw e;
      await new Promise(r => setTimeout(r, esperasMs[i]));
    }
  }
}

async function registrar(revendaId: number, origem: repo.Origem, de: string, ate: string, obter: () => Promise<Entrega[]>): Promise<ResultadoColeta> {
  const id = await repo.abrirColeta(revendaId, origem, de, ate);
  try {
    const entregas = await obter();
    const r = entregas.length ? await repo.gravarEntregas(revendaId, entregas) : { rotas: 0, linhas: 0 };
    const res: ResultadoColeta = { status: r.linhas ? "ok" : "sem_dados", ...r };
    await repo.fecharColeta(id, revendaId, res);
    return res;
  } catch (e) {
    await repo.fecharColeta(id, revendaId, { status: "erro", erro: curta(e) });
    throw e;
  }
}

export function coletarRevenda(revendaId: number, de: string, ate: string, origem: "auto" | "botao", esperasMs = ESPERAS[origem]): Promise<ResultadoColeta> {
  return repo.comTrava(revendaId, async () => {
    const conta = await repo.contaComSegredos(revendaId);
    if (!conta) throw new repo.ColetaError("revenda sem conta do CheckNow");
    return registrar(revendaId, origem, de, ate, async () =>
      (await comTentativas(() => baixarCheckNow(conta, de, ate), esperasMs)).flatMap(b => parseCheckNow(b)));
  });
}

/** Upload manual: mesma gravação, período = dias das rotas da planilha. Lança PlanilhaInvalidaError antes de registrar. */
export function importarPlanilha(revendaId: number, buffer: Buffer): Promise<ResultadoColeta> {
  const entregas = parseCheckNow(buffer);
  const dias = entregas.flatMap(e => (e.rotaInicio ? [diaBRT(e.rotaInicio)] : [])).sort();
  const hoje = diaBRT(new Date());
  return repo.comTrava(revendaId, () => registrar(revendaId, "upload", dias[0] ?? hoje, dias.at(-1) ?? hoje, async () => entregas));
}
```

- [ ] **Step 4: Rodar** — mesmo comando → PASS (8).

- [ ] **Step 5: Commit** — `git add server/services/checknow/sincronizar*.ts && git commit -m "feat(entregas): coleta com trava, tentativas e registro"`

---

### Task 8: Agendador

**Files:**
- Create: `server/services/checknow/agendador.ts`
- Test: `server/services/checknow/agendador.test.ts`
- Modify: `server/_core/index.ts` (chamar `iniciarAgendador()` após `server.listen`)

**Interfaces:**
- Consumes: Task 5 `contasAtivas`, `ultimoPeriodoOk`; Task 7 `coletarRevenda`.
- Produces: `proximaExecucao(agora: Date): { em: Date; tipo: "hora" | "noite" }`, `periodoRecuperacao(ultimoOk: string | null, hoje: string): { de: string; ate: string }`, `periodoDoTipo(tipo, hoje)`, `iniciarAgendador(): void`.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("./repo", () => ({}));
vi.mock("./sincronizar", () => ({}));
import { periodoDoTipo, periodoRecuperacao, proximaExecucao } from "./agendador";

const brt = (s: string) => new Date(`${s}-03:00`);

describe("proximaExecucao", () => {
  it("antes das 6h → 06:05", () => expect(proximaExecucao(brt("2026-10-07T05:50:00"))).toEqual({ em: brt("2026-10-07T06:05:00"), tipo: "hora" }));
  it("no meio do dia → próxima hora :05", () => expect(proximaExecucao(brt("2026-10-07T10:05:00")).em).toEqual(brt("2026-10-07T11:05:00")));
  it("depois das 22:05 → 23:30 (noite)", () => expect(proximaExecucao(brt("2026-10-07T22:10:00"))).toEqual({ em: brt("2026-10-07T23:30:00"), tipo: "noite" }));
  it("depois das 23:30 → 06:05 do dia seguinte", () => expect(proximaExecucao(brt("2026-10-07T23:40:00")).em).toEqual(brt("2026-10-08T06:05:00")));
});

describe("períodos", () => {
  it("hora: ontem e hoje; noite: últimos 3 dias", () => {
    expect(periodoDoTipo("hora", "2026-10-07")).toEqual({ de: "2026-10-06", ate: "2026-10-07" });
    expect(periodoDoTipo("noite", "2026-10-07")).toEqual({ de: "2026-10-05", ate: "2026-10-07" });
  });
  it("recuperação: desde o último ok, no máximo 7 dias", () => {
    expect(periodoRecuperacao("2026-10-05", "2026-10-07")).toEqual({ de: "2026-10-05", ate: "2026-10-07" });
    expect(periodoRecuperacao("2026-09-01", "2026-10-07")).toEqual({ de: "2026-09-30", ate: "2026-10-07" });
    expect(periodoRecuperacao(null, "2026-10-07")).toEqual({ de: "2026-09-30", ate: "2026-10-07" });
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/checknow/agendador.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
/*
 * MetricFlow — coleta automática do CheckNow (só com CHECKNOW_COLETA_AUTO=1).
 * :05 de 06h a 22h → ontem e hoje; 23:30 → últimos 3 dias; ao subir → desde o último ok (máx. 7 dias).
 * ponytail: setTimeout em processo único (produção = 1 réplica); com várias réplicas a trava por revenda evita coleta dupla.
 */
import { diaBRT } from "@shared/entregas";
import { contasAtivas, ultimoPeriodoOk } from "./repo";
import { coletarRevenda } from "./sincronizar";

type Tipo = "hora" | "noite";
const DIA_MS = 86_400_000;
const menosDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) - n * DIA_MS).toISOString().slice(0, 10);
const em = (dia: string, hm: string) => new Date(`${dia}T${hm}:00-03:00`);

export function proximaExecucao(agora: Date): { em: Date; tipo: Tipo } {
  const hoje = diaBRT(agora);
  for (const dia of [hoje, menosDias(hoje, -1)]) {
    const slots: { em: Date; tipo: Tipo }[] = [
      ...Array.from({ length: 17 }, (_, i) => ({ em: em(dia, `${String(6 + i).padStart(2, "0")}:05`), tipo: "hora" as const })),
      { em: em(dia, "23:30"), tipo: "noite" },
    ];
    const prox = slots.find(s => s.em > agora);
    if (prox) return prox;
  }
  throw new Error("inalcançável");
}

export const periodoDoTipo = (tipo: Tipo, hoje: string) => ({ de: menosDias(hoje, tipo === "hora" ? 1 : 2), ate: hoje });

export function periodoRecuperacao(ultimoOk: string | null, hoje: string): { de: string; ate: string } {
  const limite = menosDias(hoje, 7);
  return { de: ultimoOk && ultimoOk > limite ? ultimoOk : limite, ate: hoje };
}

async function rodar(periodo: (revendaId: number) => Promise<{ de: string; ate: string }>) {
  for (const revendaId of await contasAtivas().catch(() => [] as number[])) {
    try {
      const { de, ate } = await periodo(revendaId);
      const r = await coletarRevenda(revendaId, de, ate, "auto");
      console.log(`[CheckNow] revenda ${revendaId} ${de}..${ate}: ${r.status} (${r.linhas} linhas)`);
    } catch (e) {
      console.warn(`[CheckNow] revenda ${revendaId}: ${(e as Error).message}`);
    }
  }
}

export function iniciarAgendador(): void {
  if (process.env.CHECKNOW_COLETA_AUTO !== "1") return;
  console.log("[CheckNow] coleta automática ligada");
  setTimeout(() => rodar(async id => periodoRecuperacao(await ultimoPeriodoOk(id), diaBRT(new Date()))), 60_000);
  const agendar = () => {
    const p = proximaExecucao(new Date());
    setTimeout(async () => {
      await rodar(async () => periodoDoTipo(p.tipo, diaBRT(new Date())));
      agendar();
    }, p.em.getTime() - Date.now());
  };
  agendar();
}
```

`server/_core/index.ts`: `import { iniciarAgendador } from "../services/checknow/agendador";` e, dentro do callback de `server.listen` em `startServer`, `iniciarAgendador();`.

- [ ] **Step 4: Rodar** — mesmo comando → PASS (6).

- [ ] **Step 5: Commit** — `git add server/services/checknow/agendador*.ts server/_core/index.ts && git commit -m "feat(entregas): agendador da coleta (hora, noite e recuperação)"`

---

### Task 9: API (tRPC + PDF)

**Files:**
- Modify: `server/routers/entregasRouter.ts`
- Modify: `server/routes/relatorioEntregas.ts`

**Interfaces:**
- Consumes: Tasks 3–7.
- Produces (tRPC `entregas.*`): `processar({ revendaId, de, ate, cercaId? })` (mutation) → `{ linhas, rotas }`; `importar({ revendaId, xlsxBase64 })`; `coletar({ revendaId, de, ate })`; `coletas({ revendaId })` (query); `cercas({ revendaId })` (query); `contas.listar` (query), `contas.salvar(SalvarConta)`, `contas.ativar({ revendaId, ativo })`, `contas.testarCheckNow({ revendaId })` → `{ filial }`, `contas.testarInfleet({ revendaId })` → `{ veiculos }`, `contas.revendasSemConta` (query), `contas.cofre` (query) → `{ disponivel }`.
- REST: `POST /api/relatorio-entregas/gerar` body `{ revendaId, de, ate, data?, analise?, cercaId? }`.

- [ ] **Step 1: Implementar o router**

```ts
/*
 * MetricFlow — Entregas Router: lê as entregas do CheckNow guardadas por revenda, cruza com o GPS
 * (Infleet da revenda), coleta/importa e cadastra as contas (spec checknow-coleta §5).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { PlanilhaInvalidaError } from "../services/entregas/parseCheckNow";
import { processarEntregas } from "../services/entregas/processar";
import { listarCercasInfleet, mapaVeiculos } from "../services/entregas/infleetEntregas";
import { getConfigEntregas } from "../services/configService";
import * as repo from "../services/checknow/repo";
import { coletarRevenda, importarPlanilha } from "../services/checknow/sincronizar";
import { testarLogin } from "../services/checknow/coletor";
import { cofreDisponivel } from "../services/checknow/cofre";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodo = z.object({ revendaId: z.number().int(), de: dia, ate: dia })
  .refine(p => p.de <= p.ate && Date.parse(p.ate) - Date.parse(p.de) <= 30 * 86_400_000, "Período de no máximo 31 dias.");

/** ColetaError e planilha inválida viram BAD_REQUEST com a mensagem; o resto sobe. */
async function amigavel<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (e instanceof repo.ColetaError || e instanceof PlanilhaInvalidaError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
    throw e;
  }
}

async function tokenDa(revendaId: number) {
  return (await repo.contaComSegredos(revendaId))?.infleetToken ?? undefined;
}

const contas = router({
  cofre: publicProcedure.query(() => ({ disponivel: cofreDisponivel() })),
  listar: publicProcedure.query(() => repo.listarContas()),
  revendasSemConta: publicProcedure.query(() => repo.revendasSemConta()),
  salvar: publicProcedure
    .input(z.object({
      revendaId: z.number().int(), checknowUsuario: z.string().trim().min(1).max(120),
      checknowSenha: z.string().max(200).optional(), infleetToken: z.string().max(4000).nullable().optional(),
    }))
    .mutation(({ input }) => amigavel(() => repo.salvarConta(input))),
  ativar: publicProcedure.input(z.object({ revendaId: z.number().int(), ativo: z.boolean() }))
    .mutation(({ input }) => repo.ativarConta(input.revendaId, input.ativo)),
  testarCheckNow: publicProcedure.input(z.object({ revendaId: z.number().int() })).mutation(({ input }) => amigavel(async () => {
    const c = await repo.contaComSegredos(input.revendaId);
    if (!c) throw new repo.ColetaError("revenda sem conta do CheckNow");
    return testarLogin(c);
  })),
  testarInfleet: publicProcedure.input(z.object({ revendaId: z.number().int() })).mutation(async ({ input }) =>
    ({ veiculos: (await mapaVeiculos(await tokenDa(input.revendaId))).size })),
});

export const entregasRouter = router({
  contas,
  processar: publicProcedure.input(periodo.and(z.object({ cercaId: z.string().optional() }))).mutation(async ({ input }) => {
    const [entregas, token, config] = await Promise.all([repo.entregasDoPeriodo(input.revendaId, input.de, input.ate), tokenDa(input.revendaId), getConfigEntregas()]);
    return processarEntregas(entregas, new Date(), { cercaId: input.cercaId, token, config });
  }),
  importar: publicProcedure.input(z.object({ revendaId: z.number().int(), xlsxBase64: z.string().min(1) }))
    .mutation(({ input }) => amigavel(() => importarPlanilha(input.revendaId, Buffer.from(input.xlsxBase64, "base64")))),
  coletar: publicProcedure.input(periodo).mutation(({ input }) => amigavel(() => coletarRevenda(input.revendaId, input.de, input.ate, "botao"))),
  coletas: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(({ input }) => repo.ultimasColetas(input.revendaId)),
  cercas: publicProcedure.input(z.object({ revendaId: z.number().int() })).query(async ({ input }) => listarCercasInfleet(await tokenDa(input.revendaId))),
});
```

- [ ] **Step 2: PDF** — em `relatorioEntregas.ts`: comentário do topo com o novo body; ler `{ revendaId, de, ate, analise, data: soData, cercaId }`; validar `Number.isInteger(revendaId)` e `de`/`ate` no formato `aaaa-mm-dd` (400 "Informe revenda e período."); trocar `processarPlanilha(Buffer…)` por:

```ts
const [entregas, conta] = await Promise.all([entregasDoPeriodo(revendaId, de, ate), contaComSegredos(revendaId)]);
let { linhas: resultados } = await processarEntregas(entregas, new Date(), {
  cercaId: typeof cercaId === "string" && cercaId ? cercaId : undefined,
  token: conta?.infleetToken ?? undefined,
  config,
});
```
Mensagem de vazio: "Nenhuma rota iniciada no período pedido." Remover o import e o catch de `PlanilhaInvalidaError`.

- [ ] **Step 3: Verificar** — `pnpm check 2>&1 | grep "error TS" | grep -v "App.tsx(71\|thumbnailService"` → só erros do client (`index.tsx`, corrigidos na Task 10). `pnpm vitest run server/services` → PASS.

- [ ] **Step 4: Commit** — `git commit -am "feat(entregas): API por revenda e período (processar, coletar, importar, contas)"`

---

### Task 10: Tela (topo, situação da coleta, contas no ⚙)

**Files:**
- Modify: `client/src/pages/relatorio-entregas/index.tsx`
- Create: `client/src/pages/relatorio-entregas/SituacaoColeta.tsx`
- Create: `client/src/pages/relatorio-entregas/ContasEntregas.tsx`
- Modify: `client/src/pages/relatorio-entregas/ConfigEntregasModal.tsx` (abas Limites | Contas)

**Interfaces:**
- Consumes: Task 9 tRPC.

- [ ] **Step 1: Estado e carga em `index.tsx`**

Trocar `arquivo`/`carregar` por:

```tsx
const contasQ = trpc.entregas.contas.listar.useQuery();
const contasAtivas = (contasQ.data ?? []).filter(c => c.ativo);
const hoje = diaBRT(new Date());
const [revendaId, setRevendaId] = useState<number | null>(() => { try { return Number(localStorage.getItem("entregas.revenda")) || null; } catch { return null; } });
const revenda = contasAtivas.find(c => c.revendaId === revendaId) ?? contasAtivas[0] ?? null;
const [periodo, setPeriodo] = useState({ de: hoje, ate: hoje });
const cercasQ = trpc.entregas.cercas.useQuery({ revendaId: revenda?.revendaId ?? 0 }, { enabled: !!revenda, staleTime: Infinity });
const utils = trpc.useUtils();

const recalcular = (cerca = cercaId) => revenda && processar.mutate({ revendaId: revenda.revendaId, ...periodo, cercaId: cerca || undefined });
// Revenda, período ou lista de cercas mudou: recarrega (a cerca padrão "Sede" depende da lista).
useEffect(() => { if (revenda && cercasQ.isFetched) recalcular(); }, [revenda?.revendaId, periodo.de, periodo.ate, cercasQ.isFetched]);

const coletar = trpc.entregas.coletar.useMutation({
  onSuccess: r => { toast.success(r.status === "ok" ? `${r.rotas} rotas, ${r.linhas} entregas atualizadas` : "CheckNow sem entregas no período"); recalcular(); },
  onError: e => toast.error(e.message),
  onSettled: () => utils.entregas.coletas.invalidate(),
});
const importar = trpc.entregas.importar.useMutation({
  onSuccess: r => { toast.success(`Planilha importada: ${r.linhas} entregas`); recalcular(); },
  onError: e => toast.error(e.message),
  onSettled: () => utils.entregas.coletas.invalidate(),
});
async function importarArquivo(file: File | undefined) {
  if (file && revenda) importar.mutate({ revendaId: revenda.revendaId, xlsxBase64: await blobToBase64(file) });
}
function escolherRevenda(id: number) {
  setRevendaId(id); setCercaSel(null);
  try { localStorage.setItem("entregas.revenda", String(id)); } catch { /* sem storage: só não lembra */ }
}
```

`onSuccess` do `processar`: mensagem de vazio vira `toast.info(\`Nenhuma entrega de ${revenda?.revenda} no período.\`)` só quando não for recálculo — simplificar: remover o toast (o estado vazio da tela já explica).
`baixar`: body `{ revendaId: revenda.revendaId, ...periodo, analise, cercaId: cercaId || undefined, ...(tipo === "dia" ? { data: dia } : {}) }`.
Select de cerca: `onChange={e => { setCercaSel(e.target.value); recalcular(e.target.value); }}`. `ConfigEntregasModal onSalvo={() => { contasQ.refetch(); recalcular(); }}`.
Trocar todo `arquivo &&` por `revenda &&`; "Planilha: {arquivo.nome}" vira "Revenda: {revenda.revenda}".

- [ ] **Step 2: Topo** — substituir o bloco `{arquivo && (<>…</>)}` do header por:

```tsx
{revenda && (
  <>
    <select value={revenda.revendaId} onChange={e => escolherRevenda(Number(e.target.value))} aria-label="Revenda"
      className="text-xs font-semibold bg-transparent border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200">
      {contasAtivas.map(c => <option key={c.revendaId} value={c.revendaId}>{c.revenda}</option>)}
    </select>
    <input type="date" value={periodo.de} max={periodo.ate} aria-label="De" onChange={e => e.target.value && setPeriodo(p => ({ ...p, de: e.target.value }))}
      className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-transparent text-slate-700 dark:text-slate-200" />
    <input type="date" value={periodo.ate} min={periodo.de} max={hoje} aria-label="Até" onChange={e => e.target.value && setPeriodo(p => ({ ...p, ate: e.target.value }))}
      className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-transparent text-slate-700 dark:text-slate-200" />
    <button onClick={() => coletar.mutate({ revendaId: revenda.revendaId, ...periodo })} disabled={coletar.isPending}
      className={`${botao} bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-500`}>
      <CloudDownload size={12} className={coletar.isPending ? "animate-pulse" : ""} /> {coletar.isPending ? "Buscando…" : "Buscar do CheckNow"}
    </button>
    <label className={`${botao} border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer`}>
      <FileUp size={12} /> Importar planilha
      <input type="file" accept=".xlsx" className="hidden" onChange={e => { importarArquivo(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
    <button onClick={() => recalcular()} disabled={processar.isPending} title="Busca o GPS de novo"
      className={`${botao} bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700`}>
      <RefreshCw size={12} className={processar.isPending ? "animate-spin" : ""} /> Atualizar GPS
    </button>
    <button onClick={() => baixar("zip")} disabled={!dias.length || baixando !== null}
      className={`${botao} border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20`}>
      <Printer size={12} /> {baixando === "zip" ? "Gerando..." : "Baixar todos (ZIP)"}
    </button>
  </>
)}
```

Abaixo do header, quando `revenda`: `<SituacaoColeta revendaId={revenda.revendaId} />` numa faixa `px-6 pt-3`.

- [ ] **Step 3: Estados vazios** — no lugar do `<label>` de upload:
  - `contasQ.isFetched && !contasAtivas.length`: cartão "Nenhuma conta do CheckNow cadastrada." + botão "Cadastrar conta" (`setConfigAberto(true)` com aba Contas: prop `abaInicial="contas"`).
  - `revenda && !processar.isPending && processar.data && !resultados.length`: "Nenhuma entrega de {revenda.revenda} entre {fmtDia(periodo.de)} e {fmtDia(periodo.ate)}." + botão "Buscar do CheckNow".
  - carregando: "Cruzando as entregas de {revenda.revenda} com o GPS...".

- [ ] **Step 4: `SituacaoColeta.tsx`**

```tsx
/* Situação da coleta do CheckNow da revenda: última coleta, falha e atraso (> 3 h sem sucesso entre 06h e 22h). */
import { useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { diaBRT, horaBRT } from "@shared/entregas";

const ORIGEM = { auto: "automática", botao: "botão", upload: "planilha" } as Record<string, string>;
const quando = (d: Date) => `${diaBRT(d) === diaBRT(new Date()) ? "hoje" : diaBRT(d).split("-").reverse().slice(0, 2).join("/")} ${horaBRT(d)}`;

export function SituacaoColeta({ revendaId }: { revendaId: number }) {
  const [aberto, setAberto] = useState(false);
  const { data: coletas = [] } = trpc.entregas.coletas.useQuery({ revendaId }, { refetchInterval: 60_000 });
  const ultima = coletas.find(c => c.status !== "rodando");
  const ultimoOk = coletas.find(c => c.status === "ok" || c.status === "sem_dados");
  const hora = Number(horaBRT(new Date()).slice(0, 2));
  const atrasada = hora >= 6 && hora <= 22 && (!ultimoOk || Date.now() - new Date(ultimoOk.iniciadoEm).getTime() > 3 * 3600_000);
  const falhou = ultima?.status === "erro";
  const ruim = falhou || atrasada;
  const texto = !ultima ? "Nenhuma coleta ainda"
    : falhou ? `Falhou ${quando(new Date(ultima.iniciadoEm))}: ${ultima.erro}`
    : `Última coleta: ${quando(new Date(ultima.iniciadoEm))}${atrasada ? " (mais de 3 h sem sucesso)" : ""}`;

  return (
    <div className="relative inline-block">
      <button onClick={() => setAberto(a => !a)} aria-expanded={aberto}
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${ruim ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}>
        {ruim ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} className="text-green-600 dark:text-green-400" />} {texto}
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1 w-[34rem] max-w-[90vw] bg-white dark:bg-[var(--card)] border border-slate-200 dark:border-[var(--border)] rounded-xl shadow-lg p-3">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400 text-left"><th className="py-1">Quando</th><th>Origem</th><th>Período</th><th>Resultado</th><th className="text-right">Entregas</th></tr></thead>
            <tbody>
              {coletas.map(c => (
                <tr key={c.id} className="border-t border-slate-100 dark:border-[var(--border)] text-slate-600 dark:text-slate-300">
                  <td className="py-1">{quando(new Date(c.iniciadoEm))}</td>
                  <td>{ORIGEM[c.origem] ?? c.origem}</td>
                  <td>{c.periodoDe.split("-").reverse().join("/")}{c.periodoAte !== c.periodoDe ? ` – ${c.periodoAte.split("-").reverse().join("/")}` : ""}</td>
                  <td className={c.status === "erro" ? "text-red-600 dark:text-red-400" : ""} title={c.erro ?? undefined}>
                    {{ ok: "ok", sem_dados: "sem dados", erro: `erro: ${c.erro}`, rodando: "rodando…" }[c.status] ?? c.status}
                  </td>
                  <td className="text-right">{c.linhas ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `ContasEntregas.tsx`** — lista e formulário:

```tsx
/* Contas do CheckNow e do Infleet por revenda. Senha/token só entram (nunca voltam do servidor). */
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Form = { revendaId: number; nova: boolean; checknowUsuario: string; checknowSenha: string; infleetToken: string; limparInfleet: boolean };
const campo = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-[var(--background)] text-sm text-slate-800 dark:text-slate-100";

export function ContasEntregas({ onMudou }: { onMudou: () => void }) {
  const utils = trpc.useUtils();
  const cofre = trpc.entregas.contas.cofre.useQuery();
  const contas = trpc.entregas.contas.listar.useQuery();
  const livres = trpc.entregas.contas.revendasSemConta.useQuery();
  const salvar = trpc.entregas.contas.salvar.useMutation();
  const ativar = trpc.entregas.contas.ativar.useMutation();
  const testarCN = trpc.entregas.contas.testarCheckNow.useMutation();
  const testarIF = trpc.entregas.contas.testarInfleet.useMutation();
  const [form, setForm] = useState<Form | null>(null);

  const recarregar = async () => { await Promise.all([utils.entregas.contas.listar.invalidate(), utils.entregas.contas.revendasSemConta.invalidate()]); onMudou(); };

  async function gravar() {
    if (!form) return;
    try {
      await salvar.mutateAsync({
        revendaId: form.revendaId, checknowUsuario: form.checknowUsuario,
        checknowSenha: form.checknowSenha || undefined,
        infleetToken: form.limparInfleet ? null : form.infleetToken || undefined,
      });
      toast.success("Conta salva.");
      setForm(null);
      await recarregar();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function testar(tipo: "cn" | "if", revendaId: number) {
    try {
      if (tipo === "cn") toast.success(`CheckNow ok — ${(await testarCN.mutateAsync({ revendaId })).filial}`);
      else toast.success(`Infleet ok — ${(await testarIF.mutateAsync({ revendaId })).veiculos} veículos`);
    } catch (e) { toast.error((e as Error).message); }
  }

  if (cofre.data && !cofre.data.disponivel) {
    return <p className="text-xs text-red-500">Cadastro bloqueado: falta a CHECKNOW_CHAVE no .env do servidor (32 bytes em base64).</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {(contas.data ?? []).map(c => (
        <div key={c.revendaId} className="rounded-xl border border-slate-100 dark:border-[var(--border)] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.revenda}</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={c.ativo} onChange={async e => { await ativar.mutateAsync({ revendaId: c.revendaId, ativo: e.target.checked }); await recarregar(); }} /> Ativa
            </label>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            CheckNow: <b>{c.checknowUsuario}</b> · senha definida · Infleet: {c.infleetDefinido ? "token definido" : "vazio — usa o padrão do servidor"}
          </div>
          <div className="text-[11px] text-slate-400">
            {c.ultimaColetaEm ? `Última coleta: ${new Date(c.ultimaColetaEm).toLocaleString("pt-BR")} ${c.ultimaColetaOk ? "✓" : `— erro: ${c.ultimaColetaErro}`}` : "Sem coleta ainda"}
          </div>
          <div className="flex gap-2">
            <button className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600" onClick={() => setForm({ revendaId: c.revendaId, nova: false, checknowUsuario: c.checknowUsuario, checknowSenha: "", infleetToken: "", limparInfleet: false })}>Editar</button>
            <button className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600" disabled={testarCN.isPending} onClick={() => testar("cn", c.revendaId)}>Testar CheckNow</button>
            <button className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600" disabled={testarIF.isPending} onClick={() => testar("if", c.revendaId)}>Testar Infleet</button>
          </div>
        </div>
      ))}

      {!form && !!livres.data?.length && (
        <button className="self-start flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white"
          onClick={() => setForm({ revendaId: livres.data![0].id, nova: true, checknowUsuario: "", checknowSenha: "", infleetToken: "", limparInfleet: false })}>
          <Plus size={12} /> Adicionar conta
        </button>
      )}

      {form && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 p-3 flex flex-col gap-2">
          {form.nova && (
            <select className={campo} value={form.revendaId} onChange={e => setForm({ ...form, revendaId: Number(e.target.value) })}>
              {(livres.data ?? []).map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          )}
          <input className={campo} placeholder="Usuário do CheckNow" value={form.checknowUsuario} onChange={e => setForm({ ...form, checknowUsuario: e.target.value })} autoComplete="off" />
          <input className={campo} type="password" placeholder={form.nova ? "Senha do CheckNow" : "Nova senha (vazio = mantém)"} value={form.checknowSenha} onChange={e => setForm({ ...form, checknowSenha: e.target.value })} autoComplete="new-password" />
          <input className={campo} type="password" placeholder="Token do Infleet (vazio = mantém / usa o padrão)" value={form.infleetToken} disabled={form.limparInfleet} onChange={e => setForm({ ...form, infleetToken: e.target.value })} autoComplete="off" />
          {!form.nova && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={form.limparInfleet} onChange={e => setForm({ ...form, limparInfleet: e.target.checked })} /> Remover o token (usar o padrão do servidor)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600" onClick={() => setForm(null)}>Cancelar</button>
            <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white disabled:opacity-50"
              disabled={salvar.isPending || !form.checknowUsuario.trim() || (form.nova && !form.checknowSenha)} onClick={gravar}>
              {salvar.isPending && <Loader2 size={12} className="animate-spin" />} Salvar conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Abas no `ConfigEntregasModal`** — props `abaInicial?: "limites" | "contas"`; estado `aba`; abaixo do título, duas abas (mesmo estilo das abas Por dia/Por rota); `aba === "contas"` renderiza `<ContasEntregas onMudou={onSalvo} />` e esconde o rodapé Salvar/Restaurar; `aba === "limites"` é o conteúdo atual. `useEffect(() => { if (open) setAba(abaInicial ?? "limites"); }, [open])`. Largura `max-w-lg`.

- [ ] **Step 7: Verificar** — `pnpm check 2>&1 | grep "error TS" | grep -v "App.tsx(71\|thumbnailService"` → nenhuma linha. `pnpm vitest run server/services` → PASS.

- [ ] **Step 8: Commit** — `git add client/src/pages/relatorio-entregas && git commit -m "feat(entregas): tela por revenda e período, situação da coleta e contas no ⚙"`

---

### Task 11: Banco local, validação e verificação real

**Files:**
- Modify: `task/entregas/checknow-coleta-design.md` (ajustes que surgirem)
- Modify: `task/entregas/relatorio-entregas-design.md` (§11: persistência feita)

- [ ] **Step 1: SQL no banco local — PARAR e pedir confirmação ao usuário** mostrando `drizzle/manual/2026-10-08_checknow_coleta.sql`. Com o sim: rodar `.superpowers/sdd/relatorio-entregas-plan/aplicaSql.ts` apontando para o arquivo novo (checagem de localhost já existe).
Expected: as 3 tabelas listadas.

- [ ] **Step 2: Validar o repositório** — `pnpm tsx --env-file=../../../.env script/validarRepoCheckNow.ts`
Expected: as 4 linhas da Task 5 Step 5.

- [ ] **Step 3: Chave e conta — o usuário faz** — pedir ao usuário para gerar a chave (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), pôr `CHECKNOW_CHAVE=…` no `.env` do checkout principal, reiniciar o dev server e cadastrar a conta de Floriano no ⚙ › Contas (o assistente não digita a senha). Depois, o usuário clica "Testar CheckNow".
Expected: toast "CheckNow ok — 3722-DUTTRA PI DISTRIBUIDORA (FLORIANO)". Se falhar, ajustar o coletor contra a resposta real (sem logar a senha) e ledgerar o ruling.

- [ ] **Step 4: Coleta real e conferência** — na tela: revenda Floriano, período 05/10–06/10, "Buscar do CheckNow".
Expected: toast com rotas/entregas; "Última coleta: hoje hh:mm ✓"; Por dia de 06/10 com os mesmos números do upload da planilha usada antes (SOO8D21: saída 06:17, retorno 11:33 pela cerca). Recarregar a página: os dados continuam.

- [ ] **Step 5: Upload** — "Importar planilha" com a planilha antiga → toast "Planilha importada" e a lista de coletas mostra "planilha".

- [ ] **Step 6: Agendador local (opcional, só observação)** — não ligar `CHECKNOW_COLETA_AUTO` no `.env` local; produção recebe `CHECKNOW_COLETA_AUTO=1` e `CHECKNOW_CHAVE` no `.env.prod` + o SQL no deploy (anotar no resumo final).

- [ ] **Step 7: Suíte e commit** — `pnpm test 2>&1 | tail -5` → só as 42 falhas da baseline. Atualizar as specs e `git commit -am "docs(entregas): coleta do CheckNow implantada no local"`.
