# Produtividade em hL e aba "Por dia new" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cruzar as entregas do CheckNow com os pedidos do ERP (quantidades) e o cadastro de produtos (hL por embalagem) para medir produtividade em hectolitros, e mostrar o dia numa aba nova "Por dia new" com cartões por caminhão.

**Architecture:** Dois leitores puros (`parseProdutos`, `parsePedidosErp`) e um repositório ERP (`server/services/erp/`). O CheckNow passa a guardar os `documentos` de cada entrega. Um módulo puro `produtividade.ts` calcula volume por entrega e as medidas por motorista·dia a partir do `ResultadoLinha` + itens do ERP; o router `entregas.processar` anexa isso ao resultado e grava os pontos do "4 semanas". O `cruzar` passa a devolver o trilho do dia (paradas no cliente / sem cliente). A tela ganha a aba `PainelDiaNew`.

**Tech Stack:** Express + tRPC + drizzle-orm 0.44 (node-postgres), xlsx, React, vitest.

**Spec:** `task/entregas/produtividade-design.md`

## Global Constraints

- Nada de `pnpm db:push`: SQL manual em `drizzle/manual/`, aplicado no banco local **só com confirmação do usuário**.
- `.env` no checkout principal (`../../../.env`); scripts com `pnpm tsx --env-file=../../../.env …`.
- Produtos: tabela global (código = chave). Pedidos: por revenda.
- Pedido com `Canc = 009` não soma. Produto sem cadastro ou sem volume não soma (é listado).
- Textos em pt-BR; "entrega", não "baixa".
- Baseline: `pnpm test` com 42 falhas pré-existentes; `pnpm check` com 2 erros (`client/src/App.tsx(71,9)`, `server/services/thumbnailService.ts(34,18)`). Não adicionar outros.
- Cores do trilho: rodando #2a78d6, no cliente #eb6834, sem cliente #1baf7a (escuro #3987e5, #d95926, #199e70).

## Review Focus

1. CSV real: cabeçalho com `Desc` repetido e `||Item`, latin1, linhas vazias no fim, CRLF — o leitor usa a 1ª ocorrência de cada nome e ignora linhas sem Pedido. Teste em Task 4.
2. Entrega com vários documentos e item repetido em dois documentos — soma por documento, sem contar duas vezes o mesmo (pedido, item). Teste em Task 7.
3. Dia sem retorno (caminhão na rua) — hL/h "parcial" até a última saída de cliente; sem saída → null. Teste em Task 7.
4. Reta com pontos insuficientes ou inclinação negativa não pode mostrar número. Teste em Task 7.
5. Entregas coletadas antes da coluna `documentos` (`[]`) — contam como "sem volume" e não quebram a tela.

---

### Task 1: Schema e SQL

**Files:**
- Modify: `drizzle/schema.ts` (depois de `checknowColetas`; coluna nova em `checknowEntregas`)
- Create: `drizzle/manual/2026-10-10_produtividade.sql`

**Interfaces:**
- Produces: `produtos`, `erpPedidoItens`, `produtividadeParadas`; `checknowEntregas.documentos: string[]`.

- [ ] **Step 1: Schema** — em `checknowEntregas`, depois de `lonApp`:

```ts
  documentos:      text("documentos").array().notNull().default(sql`'{}'::text[]`), // = Pedido do ERP
```

(importar `sql` de `drizzle-orm` se ainda não estiver). Depois de `checknowColetas`:

```ts
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
```

- [ ] **Step 2: SQL** — `drizzle/manual/2026-10-10_produtividade.sql`:

```sql
-- Produtividade em hL (spec task/entregas/produtividade-design.md §4). Idempotente; sem drizzle-kit push.
ALTER TABLE "checknow_entregas" ADD COLUMN IF NOT EXISTS "documentos" text[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS "produtos" (
  "codigo" varchar(20) PRIMARY KEY,
  "descricao" varchar(200) NOT NULL,
  "familia" varchar(120) NOT NULL DEFAULT '',
  "categoria" varchar(120) NOT NULL DEFAULT '',
  "marca" varchar(120) NOT NULL DEFAULT '',
  "embalagem" varchar(4) NOT NULL DEFAULT '',
  "tipo" varchar(12),
  "unPorEmb" integer NOT NULL DEFAULT 1,
  "litrosEmb" double precision,
  "litrosUn" double precision,
  "ativo" boolean NOT NULL DEFAULT true,
  "atualizadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "erp_pedido_itens" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "pedido" varchar(20) NOT NULL,
  "item" integer NOT NULL,
  "romaneio" varchar(20) NOT NULL DEFAULT '',
  "cliente" varchar(20) NOT NULL DEFAULT '',
  "placa" varchar(12) NOT NULL DEFAULT '',
  "motoristaCod" varchar(12) NOT NULL DEFAULT '',
  "dataPedido" date,
  "codProduto" varchar(20) NOT NULL,
  "qtdCx" double precision NOT NULL DEFAULT 0,
  "qtdUn" double precision NOT NULL DEFAULT 0,
  "retCx" double precision NOT NULL DEFAULT 0,
  "retUn" double precision NOT NULL DEFAULT 0,
  "liqCx" double precision NOT NULL DEFAULT 0,
  "liqUn" double precision NOT NULL DEFAULT 0,
  "motivoDev" varchar(10),
  "valor" double precision NOT NULL DEFAULT 0,
  "cancelado" boolean NOT NULL DEFAULT false,
  "importadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_erp_pedido_itens" ON "erp_pedido_itens" ("revendaId", "pedido", "item");
CREATE INDEX IF NOT EXISTS "ix_erp_pedido_itens_pedido" ON "erp_pedido_itens" ("revendaId", "pedido");
CREATE TABLE IF NOT EXISTS "produtividade_paradas" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "dia" date NOT NULL,
  "placa" varchar(20) NOT NULL,
  "motorista" varchar(120) NOT NULL,
  "routeId" varchar(40) NOT NULL,
  "codCliente" varchar(40) NOT NULL,
  "hl" double precision NOT NULL,
  "minDescarga" double precision NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_produtividade_paradas" ON "produtividade_paradas" ("revendaId", "routeId", "codCliente", "dia");
CREATE INDEX IF NOT EXISTS "ix_produtividade_paradas_motorista" ON "produtividade_paradas" ("revendaId", "motorista", "dia");
```

- [ ] **Step 3: Typecheck** — `pnpm check 2>&1 | grep "error TS" | grep -v "App.tsx(71\|thumbnailService"` → Expected: só erros de objetos `Entrega`/linhas sem `documentos` (resolvidos na Task 2) ou nenhum.

- [ ] **Step 4: Commit** — `git add drizzle/schema.ts drizzle/manual/2026-10-10_produtividade.sql && git commit -m "feat(entregas): tabelas de produtos, pedidos do ERP e pontos de produtividade"`

---

### Task 2: Documentos de cada entrega no CheckNow

**Files:**
- Modify: `server/services/entregas/parseCheckNow.ts` (interface `Entrega`, laço de linhas)
- Test: `server/services/entregas/parseCheckNow.test.ts`
- Modify (fixtures): `cruzar.test.ts`, `rota.test.ts`, `server/services/checknow/repo.test.ts`, `script/validarRepoCheckNow.ts` — acrescentar `documentos: []` (repo.test: `["202610070129"]`).

**Interfaces:**
- Produces: `Entrega.documentos: string[]` (distintos, na ordem em que aparecem; sem vazios).

- [ ] **Step 1: Teste**

```ts
  it("guarda os documentos distintos da entrega (= Pedido do ERP)", () => {
    const [e] = parseCheckNow(planilha([
      { ...base, "Documento": "202610070129" },
      { ...base, "Documento": "202610070129" }, // linha repetida
      { ...base, "Documento": "202610070130" },
    ]));
    expect(e.documentos).toEqual(["202610070129", "202610070130"]);
    expect(parseCheckNow(planilha([base]))[0].documentos).toEqual([]);
  });
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/entregas/parseCheckNow.test.ts` → FAIL (`documentos` undefined).

- [ ] **Step 3: Implementar** — na interface: `documentos: string[]; // números dos documentos (= Pedido do ERP)`. No laço: no ramo `existente`, `if (notaNova && doc) { existente.documentos.push(doc); … }`; na criação: `documentos: doc ? [doc] : [],`. Acrescentar `documentos: []` nos fixtures listados (o tipo exige).

- [ ] **Step 4: Rodar** — `pnpm vitest run server/services/entregas server/services/checknow` → PASS; `pnpm check` sem erro novo.

- [ ] **Step 5: Commit** — `git commit -am "feat(entregas): guarda os documentos de cada entrega do CheckNow"` (+ `git add -f script/validarRepoCheckNow.ts`).

---

### Task 3: Leitor do cadastro de produtos

**Files:**
- Create: `server/services/erp/parseProdutos.ts`
- Test: `server/services/erp/parseProdutos.test.ts`

**Interfaces:**
- Produces: `interface Produto { codigo; descricao; familia; categoria; marca; embalagem; tipo: "retornavel" | "descartavel" | "barril" | null; unPorEmb: number; litrosEmb: number | null; litrosUn: number | null; ativo: boolean }`; `parseProdutos(buffer: Buffer): Produto[]`; `class ArquivoErpInvalidoError extends Error { faltando: string[] }`; `COLUNAS_PRODUTOS`.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseProdutos, ArquivoErpInvalidoError } from "./parseProdutos";

const xlsx = (linhas: Record<string, unknown>[]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "PRODUTOS");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
const p = (o: Record<string, unknown>) => ({
  "Familia": "021-CERVEJA HEINEKEN 600ML", "Reduzido": "0000903482", "Descricao": "CERV HEINEKEN PIL 0,60GFA RT 24UN",
  "Categoria": "07-600ML RETORNAVEL", "Marca": "01-HEINEKEN", "Un": "CX ", "Qtd/Un": "00024", "Fat.Conv1": 0.144, "Ativo": 1, ...o,
});

describe("parseProdutos", () => {
  it("volume da embalagem e da unidade a partir do Fat.Conv1 (hL por embalagem)", () => {
    const [x] = parseProdutos(xlsx([p({})]));
    expect(x).toMatchObject({ codigo: "0000903482", embalagem: "CX", unPorEmb: 24, tipo: "retornavel", ativo: true });
    expect(x.litrosEmb).toBeCloseTo(14.4, 6);
    expect(x.litrosUn).toBeCloseTo(0.6, 6);
  });
  it("tipo: barril (BR ou LITROS) e descartável; sem Fat.Conv1 = sem volume", () => {
    const [barril, desc, palete] = parseProdutos(xlsx([
      p({ "Reduzido": "0000904142", "Un": "BR", "Qtd/Un": "00001", "Categoria": "86-29.3 LITROS", "Fat.Conv1": 0.293 }),
      p({ "Reduzido": "0000903478", "Un": "EB", "Categoria": "17-330ML LN 24UN", "Fat.Conv1": 0.0792 }),
      p({ "Reduzido": "0000000474", "Categoria": "99-OUTROS", "Fat.Conv1": 0, "Ativo": 0 }),
    ]));
    expect([barril.tipo, barril.litrosEmb]).toEqual(["barril", 29.3]);
    expect(desc.tipo).toBe("descartavel");
    expect(palete).toMatchObject({ tipo: null, litrosEmb: null, litrosUn: null, ativo: false });
  });
  it("código numérico vira texto com 10 dígitos", () => {
    expect(parseProdutos(xlsx([p({ "Reduzido": 903482 })]))[0].codigo).toBe("0000903482");
  });
  it("colunas faltando", () => {
    const e = (() => { try { parseProdutos(xlsx([{ "Reduzido": "1" }])); } catch (x) { return x; } })();
    expect(e).toBeInstanceOf(ArquivoErpInvalidoError);
    expect((e as ArquivoErpInvalidoError).faltando).toContain("Fat.Conv1");
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/erp/parseProdutos.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
/*
 * MetricFlow — leitura do cadastro de produtos do ERP (PRODUTOS.xlsx). Fat.Conv1 = hL por embalagem
 * (0,144 = 24 × 0,6 L); 0 = sem volume (palete, mesa, caixa plástica…). Spec produtividade §3.
 */
import * as XLSX from "xlsx";

export type TipoEmbalagem = "retornavel" | "descartavel" | "barril";
export interface Produto {
  codigo: string; descricao: string; familia: string; categoria: string; marca: string;
  embalagem: string; tipo: TipoEmbalagem | null; unPorEmb: number;
  litrosEmb: number | null; litrosUn: number | null; ativo: boolean;
}

export class ArquivoErpInvalidoError extends Error {
  constructor(public faltando: string[], arquivo: string) {
    super(`${arquivo} sem as colunas: ${faltando.join(", ")}`);
  }
}

export const COLUNAS_PRODUTOS = ["Reduzido", "Descricao", "Familia", "Categoria", "Marca", "Un", "Qtd/Un", "Fat.Conv1", "Ativo"] as const;

const texto = (v: unknown) => String(v ?? "").trim();
const numero = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
export const codigoProduto = (v: unknown) => texto(v).replace(/\D/g, "").padStart(10, "0");

export function tipoEmbalagem(categoria: string, embalagem: string, litrosEmb: number | null): TipoEmbalagem | null {
  if (litrosEmb === null) return null;
  if (/RETORNAVEL/i.test(categoria)) return "retornavel";
  if (embalagem === "BR" || /LITROS|BARRIL/i.test(categoria)) return "barril";
  return "descartavel";
}

export function parseProdutos(buffer: Buffer): Produto[] {
  let ws: XLSX.WorkSheet;
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    ws = wb.Sheets[wb.SheetNames[0]];
  } catch {
    throw new ArquivoErpInvalidoError([...COLUNAS_PRODUTOS], "Cadastro de produtos");
  }
  const header = ((XLSX.utils.sheet_to_json(ws, { header: 1 })[0] ?? []) as unknown[]).map(texto);
  const faltando = COLUNAS_PRODUTOS.filter(c => !header.includes(c));
  if (faltando.length) throw new ArquivoErpInvalidoError(faltando, "Cadastro de produtos");

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
    .filter(r => texto(r["Reduzido"]))
    .map(r => {
      const embalagem = texto(r["Un"]).toUpperCase();
      const unPorEmb = Math.max(1, numero(r["Qtd/Un"]));
      const hl = numero(r["Fat.Conv1"]);
      const litrosEmb = hl > 0 ? Math.round(hl * 100 * 1e6) / 1e6 : null;
      const categoria = texto(r["Categoria"]);
      return {
        codigo: codigoProduto(r["Reduzido"]), descricao: texto(r["Descricao"]), familia: texto(r["Familia"]),
        categoria, marca: texto(r["Marca"]), embalagem, unPorEmb,
        tipo: tipoEmbalagem(categoria, embalagem, litrosEmb),
        litrosEmb, litrosUn: litrosEmb === null ? null : litrosEmb / unPorEmb,
        ativo: numero(r["Ativo"]) === 1,
      };
    });
}
```

- [ ] **Step 4: Rodar** — mesmo comando → PASS (4).

- [ ] **Step 5: Commit** — `git add server/services/erp && git commit -m "feat(entregas): leitor do cadastro de produtos do ERP"`

---

### Task 4: Leitor do CSV de pedidos do ERP

**Files:**
- Create: `server/services/erp/parsePedidosErp.ts`
- Test: `server/services/erp/parsePedidosErp.test.ts`

**Interfaces:**
- Consumes: `ArquivoErpInvalidoError`, `codigoProduto` (Task 3).
- Produces: `interface ItemPedido { pedido; item: number; romaneio; cliente; placa; motoristaCod; dataPedido: string | null; codProduto; qtdCx; qtdUn; retCx; retUn; liqCx; liqUn; motivoDev: string | null; valor: number; cancelado: boolean }`; `parsePedidosErp(buffer: Buffer): ItemPedido[]`; `COLUNAS_PEDIDOS`.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from "vitest";
import { parsePedidosErp } from "./parsePedidosErp";
import { ArquivoErpInvalidoError } from "./parseProdutos";

const CAB = "Pedido;Origem do Pedido;Lote;Romaneio;Cliente;Desc;Placa;Mot;Canc;Mot Dev;Dt.Pedido;||Item;Cod Red;Desc;Vlr Total;Quant CX;Quant UN;Retorno CX;Retorno UN;Qtd.CX Liq.;Qtd.Un Liq.";
const linha = (o: Partial<Record<string, string>> = {}) => {
  const v = { Pedido: "202605010001", Romaneio: "20260501001", Cliente: "0016-0199", Placa: "SOL6B13 ", Mot: "729", Canc: "008",
    "Mot Dev": "", "Dt.Pedido": "01/05/2026", Item: "001", Cod: "0000904113", Vlr: "328,1700",
    QCX: "00010", QUN: "00000", RCX: "00000", RUN: "00000", LCX: "00010", LUN: "00000", ...o };
  return [v.Pedido, "D", "5053", v.Romaneio, v.Cliente, "0,00", v.Placa, v.Mot, v.Canc, v["Mot Dev"], v["Dt.Pedido"], v.Item, v.Cod, "0,00", v.Vlr, v.QCX, v.QUN, v.RCX, v.RUN, v.LCX, v.LUN].join(";");
};
const csv = (...ls: string[]) => Buffer.from([CAB, ...ls, "", ""].join("\r\n"), "latin1");

describe("parsePedidosErp", () => {
  it("lê o item com quantidades, cliente sem traço e data ISO", () => {
    const [i] = parsePedidosErp(csv(linha()));
    expect(i).toEqual({
      pedido: "202605010001", item: 1, romaneio: "20260501001", cliente: "00160199", placa: "SOL6B13", motoristaCod: "729",
      dataPedido: "2026-05-01", codProduto: "0000904113", qtdCx: 10, qtdUn: 0, retCx: 0, retUn: 0, liqCx: 10, liqUn: 0,
      motivoDev: null, valor: 328.17, cancelado: false,
    });
  });
  it("Canc 009 = cancelado; retorno e motivo", () => {
    const [c, d] = parsePedidosErp(csv(linha({ Canc: "009", Romaneio: "00000000000" }), linha({ Item: "002", RCX: "00002", LCX: "00008", "Mot Dev": "Z11" })));
    expect(c.cancelado).toBe(true);
    expect(d).toMatchObject({ retCx: 2, liqCx: 8, motivoDev: "Z11" });
  });
  it("acentos em latin1 não quebram; linhas sem pedido são ignoradas", () => {
    expect(parsePedidosErp(csv(linha(), ";;;;")).length).toBe(1);
  });
  it("colunas faltando", () => {
    expect(() => parsePedidosErp(Buffer.from("Pedido;Cliente\r\n1;2", "latin1"))).toThrow(ArquivoErpInvalidoError);
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/erp/parsePedidosErp.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
/*
 * MetricFlow — leitura do CSV de pedidos do ERP ("PEDIDOS <MÊS><AA>.CSV"): `;`, latin1, decimais com vírgula,
 * uma linha por item. O cabeçalho repete "Desc" e traz "||Item" — vale a 1ª ocorrência de cada nome.
 * Pedido = Documento do CheckNow. Canc 009 = cancelado/não saiu. Spec produtividade §3.
 */
import { ArquivoErpInvalidoError, codigoProduto } from "./parseProdutos";

export interface ItemPedido {
  pedido: string; item: number; romaneio: string; cliente: string; placa: string; motoristaCod: string;
  dataPedido: string | null; codProduto: string;
  qtdCx: number; qtdUn: number; retCx: number; retUn: number; liqCx: number; liqUn: number;
  motivoDev: string | null; valor: number; cancelado: boolean;
}

export const COLUNAS_PEDIDOS = [
  "Pedido", "Romaneio", "Cliente", "Placa", "Mot", "Canc", "Mot Dev", "Dt.Pedido", "||Item", "Cod Red",
  "Vlr Total", "Quant CX", "Quant UN", "Retorno CX", "Retorno UN", "Qtd.CX Liq.", "Qtd.Un Liq.",
] as const;

const num = (s: string | undefined) => { const n = Number((s ?? "").trim().replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const dataIso = (s: string | undefined) => { const m = (s ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m && m[3] !== "0000" ? `${m[3]}-${m[2]}-${m[1]}` : null; };

export function parsePedidosErp(buffer: Buffer): ItemPedido[] {
  const linhas = buffer.toString("latin1").split(/\r?\n/);
  const cab = (linhas[0] ?? "").split(";").map(c => c.trim());
  const faltando = COLUNAS_PEDIDOS.filter(c => !cab.includes(c));
  if (faltando.length) throw new ArquivoErpInvalidoError(faltando, "CSV de pedidos");
  const col = Object.fromEntries(COLUNAS_PEDIDOS.map(c => [c, cab.indexOf(c)])) as Record<(typeof COLUNAS_PEDIDOS)[number], number>;

  const itens: ItemPedido[] = [];
  for (const l of linhas.slice(1)) {
    const v = l.split(";");
    const pedido = (v[col["Pedido"]] ?? "").trim();
    if (!pedido) continue;
    const g = (c: (typeof COLUNAS_PEDIDOS)[number]) => (v[col[c]] ?? "").trim();
    itens.push({
      pedido, item: num(g("||Item")), romaneio: g("Romaneio"), cliente: g("Cliente").replace(/\D/g, ""),
      placa: g("Placa"), motoristaCod: g("Mot"), dataPedido: dataIso(g("Dt.Pedido")), codProduto: codigoProduto(g("Cod Red")),
      qtdCx: num(g("Quant CX")), qtdUn: num(g("Quant UN")), retCx: num(g("Retorno CX")), retUn: num(g("Retorno UN")),
      liqCx: num(g("Qtd.CX Liq.")), liqUn: num(g("Qtd.Un Liq.")),
      motivoDev: g("Mot Dev") && g("Mot Dev") !== "0" ? g("Mot Dev") : null,
      valor: num(g("Vlr Total")), cancelado: g("Canc") === "009",
    });
  }
  return itens;
}
```

Nota: `num` tira pontos de milhar — os campos de quantidade vêm zero-padded sem ponto ("00010"), e os valores com vírgula decimal ("328,1700").

- [ ] **Step 4: Rodar** — mesmo comando → PASS (4). Conferir também contra o arquivo real (sem commitar o arquivo):

```bash
pnpm tsx -e "import('./server/services/erp/parsePedidosErp').then(async m => { const fs = await import('fs'); const i = m.parsePedidosErp(fs.readFileSync('C:/Users/duttr/Documents/2026/01 - Revendas/01 - Floriano - PI/BI/FATOS/PEDIDOS POR MES - ANO/PEDIDOS MAI26.CSV')); console.log(i.length, new Set(i.map(x => x.pedido)).size, i.filter(x => x.cancelado).length) })"
```
Expected: `11027 3677 677`. (Se `tsx -e` recusar top-level, gravar o mesmo em `.superpowers/sdd/<plano>/conferePedidos.ts`.)

- [ ] **Step 5: Commit** — `git add server/services/erp && git commit -m "feat(entregas): leitor do CSV de pedidos do ERP"`

---

### Task 5: Repositório ERP e importações

**Files:**
- Create: `server/services/erp/repo.ts`
- Create: `server/services/erp/importar.ts`
- Test: `server/services/erp/importar.test.ts`
- Modify: `server/services/checknow/repo.ts` — `Origem` ganha `"erp"`; `paraLinha` já espalha `documentos`.
- Create: `script/validarRepoErp.ts` (`git add -f`)

**Interfaces:**
- Consumes: Tasks 1–4; `repo.comTrava`, `abrirColeta`, `fecharColeta` (checknow).
- Produces:
  - `salvarProdutos(ps: Produto[]): Promise<number>`
  - `gravarPedidos(revendaId, itens: ItemPedido[]): Promise<{ pedidos: number; itens: number }>` (troca só os pedidos do arquivo, transação, lotes de 500)
  - `itensDosDocumentos(revendaId, docs: string[]): Promise<ItemComProduto[]>` com `ItemComProduto = ItemPedido & { produto: Pick<Produto, "litrosEmb" | "litrosUn" | "tipo" | "descricao"> | null }`
  - `codigosSemCadastro(codigos: string[]): Promise<string[]>`
  - `gravarPontos(revendaId, pontos: PontoProdutividade[])`, `pontosDoMotorista(revendaId, motorista, desde: string, ate: string): Promise<{ hl: number; minDescarga: number; dia: string }[]>`
  - `PontoProdutividade = { dia; placa; motorista; routeId; codCliente; hl; minDescarga }`
  - `importarProdutos(buffer): Promise<{ produtos: number; comVolume: number }>`; `importarPedidos(revendaId, buffer): Promise<{ pedidos: number; itens: number; semCadastro: string[] }>`

- [ ] **Step 1: Teste (`importar.test.ts`, repo simulado)**

```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
vi.mock("./repo", () => ({ salvarProdutos: vi.fn(async (ps: unknown[]) => ps.length), gravarPedidos: vi.fn(), codigosSemCadastro: vi.fn() }));
vi.mock("../checknow/repo", async o => ({
  ColetaError: (await o<typeof import("../checknow/repo")>()).ColetaError,
  comTrava: vi.fn((_: number, fn: () => unknown) => fn()), abrirColeta: vi.fn(async () => 7), fecharColeta: vi.fn(),
}));
vi.mock("./parsePedidosErp", () => ({ parsePedidosErp: vi.fn() }));
import * as repo from "./repo";
import * as cn from "../checknow/repo";
import { parsePedidosErp } from "./parsePedidosErp";
import { importarPedidos } from "./importar";

beforeEach(() => vi.clearAllMocks());

describe("importarPedidos", () => {
  it("grava, registra como coleta 'erp' no período dos pedidos e lista produtos sem cadastro", async () => {
    (parsePedidosErp as Mock).mockReturnValue([
      { pedido: "1", item: 1, dataPedido: "2026-05-01", codProduto: "A" },
      { pedido: "2", item: 1, dataPedido: "2026-05-03", codProduto: "B" },
    ]);
    (repo.gravarPedidos as Mock).mockResolvedValue({ pedidos: 2, itens: 2 });
    (repo.codigosSemCadastro as Mock).mockResolvedValue(["B"]);
    expect(await importarPedidos(5, Buffer.from(""))).toEqual({ pedidos: 2, itens: 2, semCadastro: ["B"] });
    expect(cn.abrirColeta).toHaveBeenCalledWith(5, "erp", "2026-05-01", "2026-05-03");
    expect(cn.fecharColeta).toHaveBeenCalledWith(7, 5, { status: "ok", rotas: 2, linhas: 2 });
  });
  it("arquivo sem itens: sem_dados e nada gravado", async () => {
    (parsePedidosErp as Mock).mockReturnValue([]);
    await importarPedidos(5, Buffer.from(""));
    expect(repo.gravarPedidos).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/erp/importar.test.ts` → FAIL.

- [ ] **Step 3: Implementar `repo.ts`**

```ts
/* MetricFlow — banco do ERP: cadastro de produtos (global), itens dos pedidos (por revenda) e pontos do "4 semanas". */
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { erpPedidoItens, produtividadeParadas, produtos } from "../../../drizzle/schema";
import type { Produto } from "./parseProdutos";
import type { ItemPedido } from "./parsePedidosErp";

export type ItemComProduto = ItemPedido & { produto: Pick<Produto, "litrosEmb" | "litrosUn" | "tipo" | "descricao"> | null };
export interface PontoProdutividade { dia: string; placa: string; motorista: string; routeId: string; codCliente: string; hl: number; minDescarga: number }

async function exigirDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}
const lotes = <T>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function salvarProdutos(ps: Produto[]): Promise<number> {
  const db = await exigirDb();
  const unicos = [...new Map(ps.map(p => [p.codigo, p])).values()];
  for (const lote of lotes(unicos)) {
    await db.insert(produtos).values(lote.map(p => ({ ...p, atualizadoEm: new Date() }))).onConflictDoUpdate({
      target: produtos.codigo,
      set: {
        descricao: sql`excluded."descricao"`, familia: sql`excluded."familia"`, categoria: sql`excluded."categoria"`,
        marca: sql`excluded."marca"`, embalagem: sql`excluded."embalagem"`, tipo: sql`excluded."tipo"`,
        unPorEmb: sql`excluded."unPorEmb"`, litrosEmb: sql`excluded."litrosEmb"`, litrosUn: sql`excluded."litrosUn"`,
        ativo: sql`excluded."ativo"`, atualizadoEm: sql`excluded."atualizadoEm"`,
      },
    });
  }
  return unicos.length;
}

/** Troca, numa transação, todos os itens dos pedidos presentes no arquivo; os outros pedidos ficam. */
export async function gravarPedidos(revendaId: number, itens: ItemPedido[]): Promise<{ pedidos: number; itens: number }> {
  const unicos = [...new Map(itens.map(i => [`${i.pedido}|${i.item}`, i])).values()];
  const pedidos = [...new Set(unicos.map(i => i.pedido))];
  const db = await exigirDb();
  await db.transaction(async tx => {
    for (const lote of lotes(pedidos)) await tx.delete(erpPedidoItens).where(and(eq(erpPedidoItens.revendaId, revendaId), inArray(erpPedidoItens.pedido, lote)));
    for (const lote of lotes(unicos)) await tx.insert(erpPedidoItens).values(lote.map(i => ({ ...i, revendaId })));
  });
  return { pedidos: pedidos.length, itens: unicos.length };
}

export async function codigosSemCadastro(codigos: string[]): Promise<string[]> {
  const unicos = [...new Set(codigos)];
  if (!unicos.length) return [];
  const db = await exigirDb();
  const achados = new Set((await db.select({ c: produtos.codigo }).from(produtos).where(inArray(produtos.codigo, unicos))).map(r => r.c));
  return unicos.filter(c => !achados.has(c)).sort();
}

export async function itensDosDocumentos(revendaId: number, docs: string[]): Promise<ItemComProduto[]> {
  const unicos = [...new Set(docs)];
  if (!unicos.length) return [];
  const db = await exigirDb();
  const rows = await db.select({ i: erpPedidoItens, p: produtos }).from(erpPedidoItens)
    .leftJoin(produtos, eq(produtos.codigo, erpPedidoItens.codProduto))
    .where(and(eq(erpPedidoItens.revendaId, revendaId), inArray(erpPedidoItens.pedido, unicos)));
  return rows.map(({ i, p }) => {
    const { id, revendaId: _r, importadoEm, ...item } = i;
    return { ...item, produto: p ? { litrosEmb: p.litrosEmb, litrosUn: p.litrosUn, tipo: p.tipo as Produto["tipo"], descricao: p.descricao } : null };
  });
}

export async function gravarPontos(revendaId: number, pontos: PontoProdutividade[]) {
  if (!pontos.length) return;
  const db = await exigirDb();
  await db.insert(produtividadeParadas).values(pontos.map(p => ({ ...p, revendaId }))).onConflictDoUpdate({
    target: [produtividadeParadas.revendaId, produtividadeParadas.routeId, produtividadeParadas.codCliente, produtividadeParadas.dia],
    set: { hl: sql`excluded."hl"`, minDescarga: sql`excluded."minDescarga"`, placa: sql`excluded."placa"`, motorista: sql`excluded."motorista"` },
  });
}

export async function pontosDoMotorista(revendaId: number, motorista: string, desde: string, ate: string) {
  const db = await exigirDb();
  return db.select({ hl: produtividadeParadas.hl, minDescarga: produtividadeParadas.minDescarga, dia: produtividadeParadas.dia })
    .from(produtividadeParadas)
    .where(and(eq(produtividadeParadas.revendaId, revendaId), eq(produtividadeParadas.motorista, motorista),
      gte(produtividadeParadas.dia, desde), lte(produtividadeParadas.dia, ate)));
}
```

- [ ] **Step 4: Implementar `importar.ts`**

```ts
/* MetricFlow — importação dos arquivos do ERP (upload no ⚙). Pedidos registram uma coleta de origem "erp". */
import { parseProdutos } from "./parseProdutos";
import { parsePedidosErp } from "./parsePedidosErp";
import * as repo from "./repo";
import * as cn from "../checknow/repo";

export async function importarProdutos(buffer: Buffer): Promise<{ produtos: number; comVolume: number }> {
  const ps = parseProdutos(buffer);
  return { produtos: await repo.salvarProdutos(ps), comVolume: ps.filter(p => p.litrosEmb !== null).length };
}

export async function importarPedidos(revendaId: number, buffer: Buffer): Promise<{ pedidos: number; itens: number; semCadastro: string[] }> {
  const itens = parsePedidosErp(buffer);
  const datas = itens.flatMap(i => (i.dataPedido ? [i.dataPedido] : [])).sort();
  const hoje = new Date().toISOString().slice(0, 10);
  return cn.comTrava(revendaId, async () => {
    const id = await cn.abrirColeta(revendaId, "erp", datas[0] ?? hoje, datas.at(-1) ?? hoje);
    try {
      if (!itens.length) {
        await cn.fecharColeta(id, revendaId, { status: "sem_dados" });
        return { pedidos: 0, itens: 0, semCadastro: [] };
      }
      const r = await repo.gravarPedidos(revendaId, itens);
      await cn.fecharColeta(id, revendaId, { status: "ok", rotas: r.pedidos, linhas: r.itens });
      return { ...r, semCadastro: await repo.codigosSemCadastro(itens.map(i => i.codProduto)) };
    } catch (e) {
      await cn.fecharColeta(id, revendaId, { status: "erro", erro: (e as Error).message.split("\n")[0].slice(0, 200) });
      throw e;
    }
  });
}
```

Em `checknow/repo.ts`: `export type Origem = "auto" | "botao" | "upload" | "erp";` e `ultimoPeriodoOk` passa a ignorar também `"erp"` (`notInArray(checknowColetas.origem, ["upload", "erp"])`). `SituacaoColeta.tsx`: `ORIGEM` ganha `erp: "ERP"`.

- [ ] **Step 5: Rodar** — `pnpm vitest run server/services/erp server/services/checknow` → PASS; `pnpm check` sem erro novo.

- [ ] **Step 6: Script de validação** — `script/validarRepoErp.ts` (localhost; usa a 1ª revenda; grava pedidos `TSTERP…` e o produto `TST0000001`, confere e apaga):

```ts
const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "localhost") throw new Error(`Recusado: banco não é local (${url.hostname}).`);
const { getDb } = await import("../server/db");
const { revendas, erpPedidoItens, produtos } = await import("../drizzle/schema");
const repo = await import("../server/services/erp/repo");
const { eq, like } = await import("drizzle-orm");
const db = (await getDb())!;
const [rev] = await db.select().from(revendas).limit(1);
const item = (pedido: string, n: number, liqCx: number) => ({ pedido, item: n, romaneio: "", cliente: "1", placa: "", motoristaCod: "", dataPedido: "2026-01-01",
  codProduto: "TST0000001", qtdCx: liqCx, qtdUn: 0, retCx: 0, retUn: 0, liqCx, liqUn: 0, motivoDev: null, valor: 0, cancelado: false });
try {
  await repo.salvarProdutos([{ codigo: "TST0000001", descricao: "TESTE", familia: "", categoria: "", marca: "", embalagem: "CX", tipo: "descartavel", unPorEmb: 24, litrosEmb: 14.4, litrosUn: 0.6, ativo: true }]);
  await repo.gravarPedidos(rev.id, [item("TSTERP1", 1, 10), item("TSTERP1", 2, 5), item("TSTERP2", 1, 1)]);
  await repo.gravarPedidos(rev.id, [item("TSTERP1", 1, 3)]); // reenvio do pedido 1 com 1 item só
  const it = await repo.itensDosDocumentos(rev.id, ["TSTERP1", "TSTERP2"]);
  console.log("esperado TSTERP1/1=3 e TSTERP2/1=1:", it.map(i => `${i.pedido}/${i.item}=${i.liqCx}`).sort(), "| com produto:", it.every(i => i.produto?.litrosEmb === 14.4));
  console.log("sem cadastro:", await repo.codigosSemCadastro(["TST0000001", "TST0000002"]));
} finally {
  await db.delete(erpPedidoItens).where(like(erpPedidoItens.pedido, "TSTERP%"));
  await db.delete(produtos).where(eq(produtos.codigo, "TST0000001"));
  process.exit(0);
}
```

Expected (após o SQL da Task 1, na Task 10): `esperado …: [ 'TSTERP1/1=3', 'TSTERP2/1=1' ] | com produto: true` e `sem cadastro: [ 'TST0000002' ]`.

- [ ] **Step 7: Commit** — `git add server/services/erp server/services/checknow/repo.ts client/src/pages/relatorio-entregas/SituacaoColeta.tsx && git add -f script/validarRepoErp.ts && git commit -m "feat(entregas): repositório e importação dos arquivos do ERP"`

---

### Task 6: Trilho do dia no cruzamento

**Files:**
- Modify: `server/services/entregas/cruzar.ts` (`ResultadoLinha`, laço das paradas da jornada)
- Test: `server/services/entregas/cruzar.test.ts`

**Interfaces:**
- Produces: `ResultadoLinha.trilho: { inicio: Date; fim: Date; noCliente: boolean }[]` — paradas recortadas em [saída, retorno], em ordem; `[]` sem saída/retorno.

- [ ] **Step 1: Teste** (no `describe` que já cobre `tempo`/paradas sem cliente — usar os helpers `parada`, `gps`, `linha`, `entrega` existentes):

```ts
  it("trilho do dia: paradas dentro da jornada, marcando as no cliente", () => {
    const r = cruzar(linha(), [entrega({ baixaEm: brt("2026-10-05T10:00") })], gps(
      [parada(-7, -43, "2026-10-05T09:55", 10), parada(LONGE, -43, "2026-10-05T12:00", 30), parada(-7, -43, "2026-10-05T05:00", 60)],
      { saida: brt("2026-10-05T08:00"), retorno: brt("2026-10-05T17:00") },
    ));
    expect(r.trilho.map(t => [hhmm(t.inicio), hhmm(t.fim), t.noCliente])).toEqual([["09:55", "10:05", true], ["12:00", "12:30", false]]);
  });
```

(`hhmm` e `LONGE` já existem no arquivo; se `gps()` não aceitar `saida/retorno`, usar o mesmo formato dos testes de `tempo`.)

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/entregas/cruzar.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `ResultadoLinha`: `trilho: { inicio: Date; fim: Date; noCliente: boolean }[]; // paradas da jornada (linha do dia)`; valor inicial `trilho: []`. No laço "Divisão da jornada" (`for (const p of gps.paradas)`), depois de `if (!m) continue;`:

```ts
      const noCliente = clientes.some(c => distM(p.lat, p.lon, c.lat, c.lon) <= raioM);
      r.trilho.push({ inicio: new Date(Math.max(p.inicio.getTime(), saida.getTime())), fim: new Date(Math.min(p.fim.getTime(), retorno.getTime())), noCliente });
      if (noCliente) emCliente += m;
      else semCliente += m;
```
(substitui o `if/else` atual, sem recalcular a distância duas vezes).

- [ ] **Step 4: Rodar** — `pnpm vitest run server/services/entregas` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(entregas): trilho do dia (paradas no cliente e fora) no cruzamento"`

---

### Task 7: Cálculo da produtividade (módulo puro)

**Files:**
- Create: `server/services/entregas/produtividade.ts`
- Test: `server/services/entregas/produtividade.test.ts`

**Interfaces:**
- Consumes: `ResultadoLinha`, `EntregaCruzada` (cruzar), `ItemComProduto` (Task 5), `distM` (detectarParadas), `LIMITES`, `diaBRT`.
- Produces:
  - `volumeItem(i: ItemComProduto): { hl: number; dev: number } | null` (null = cancelado ou sem volume)
  - `interface VolumeEntrega { hl; dev; porTipo: Record<"retornavel" | "descartavel" | "barril", number>; dominante: "retornavel" | "descartavel" | "barril" | "misto" | null; motivos: string[]; semCadastro: string[]; casou: boolean }`
  - `volumeEntrega(docs: string[], itens: ItemComProduto[]): VolumeEntrega`
  - `ajustarReta(pontos: { hl: number; min: number }[]): { fixoMin: number; minPorHl: number; n: number } | null`
  - `interface ProdutividadeLinha { hl; dev; devPct: number | null; hlPorHora: number | null; parcial: boolean; hlPorKm: number | null; hlPorParada: number | null; menorHl: number | null; reta: ReturnType<typeof ajustarReta>; reta4s: (ReturnType<typeof ajustarReta> & { dias: number }) | null; porTipo: { tipo: string; minPorHl: number; hl: number }[]; semVolume: number; etiquetas: { texto: string; nivel: "alerta" | "aviso" }[] }`
  - `produtividadeLinha(r: ResultadoLinha, volumes: (VolumeEntrega | null)[], raioM: number, pontos4s?: { hl: number; minDescarga: number; dia: string }[]): ProdutividadeLinha` (volumes na mesma ordem de `r.baixas`)
  - `pontosDaLinha(r, volumes): PontoProdutividade[]`
  - constantes `DOMINANTE_PCT = 0.7`, `DEV_ALTA_PCT = 10`, `APP_ATRASO_MIN = 30`, `RETA_MIN_PONTOS = 6`

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from "vitest";
import { ajustarReta, produtividadeLinha, volumeEntrega, volumeItem } from "./produtividade";
import type { ItemComProduto } from "../erp/repo";

const prod = (litrosEmb: number, un: number, tipo: "retornavel" | "descartavel" | "barril" = "descartavel") =>
  ({ litrosEmb, litrosUn: litrosEmb / un, tipo, descricao: "P" });
const item = (o: Partial<ItemComProduto>): ItemComProduto => ({
  pedido: "D1", item: 1, romaneio: "", cliente: "", placa: "", motoristaCod: "", dataPedido: null, codProduto: "P1",
  qtdCx: 0, qtdUn: 0, retCx: 0, retUn: 0, liqCx: 0, liqUn: 0, motivoDev: null, valor: 0, cancelado: false, produto: prod(14.4, 24), ...o,
});

describe("volume", () => {
  it("hL do item = caixas × L/emb + unidades × L/un (÷100); devolução pelo retorno", () => {
    expect(volumeItem(item({ liqCx: 10, liqUn: 6, retCx: 1 }))).toEqual({ hl: 1.476, dev: 0.144 });
  });
  it("cancelado ou sem volume não soma", () => {
    expect(volumeItem(item({ liqCx: 10, cancelado: true }))).toBeNull();
    expect(volumeItem(item({ liqCx: 10, produto: null }))).toBeNull();
  });
  it("entrega: soma os documentos dela, tipo dominante (≥70%) e produtos sem cadastro", () => {
    const v = volumeEntrega(["D1", "D2"], [
      item({ pedido: "D1", liqCx: 8, produto: prod(14.4, 24, "retornavel") }),
      item({ pedido: "D2", item: 1, liqCx: 1 }),
      item({ pedido: "D2", item: 2, liqCx: 3, codProduto: "X9", produto: null }),
      item({ pedido: "OUTRO", liqCx: 99 }),
    ]);
    expect(v.hl).toBeCloseTo(1.296, 6);
    expect(v.dominante).toBe("retornavel");
    expect(v.semCadastro).toEqual(["X9"]);
    expect(v.casou).toBe(true);
    expect(volumeEntrega(["D9"], []).casou).toBe(false);
  });
});

describe("ajustarReta", () => {
  it("tempo = fixo + por hL × hL", () => {
    const r = ajustarReta([0.5, 1, 1.5, 2, 3, 4].map(hl => ({ hl, min: 6 + 2 * hl })));
    expect(r!.fixoMin).toBeCloseTo(6, 6);
    expect(r!.minPorHl).toBeCloseTo(2, 6);
  });
  it("menos de 6 pontos, hL igual ou inclinação negativa → null", () => {
    expect(ajustarReta([1, 2, 3].map(hl => ({ hl, min: hl })))).toBeNull();
    expect(ajustarReta(Array(6).fill({ hl: 1, min: 5 }))).toBeNull();
    expect(ajustarReta([1, 2, 3, 4, 5, 6].map(hl => ({ hl, min: 20 - hl })))).toBeNull();
  });
});

describe("produtividadeLinha", () => {
  const baixa = (hl: number, min: number, o: Record<string, unknown> = {}) => ({
    status: "no_raio", permanenciaMin: min, entrega: { lat: -7, lon: -43, latApp: null, lonApp: null, baixaEm: new Date("2026-10-05T13:00:00Z"), situacao: "ENTREGUE" },
    vol: { hl, dev: 0, porTipo: { retornavel: 0, descartavel: hl, barril: 0 }, dominante: "descartavel", motivos: [], semCadastro: [], casou: true }, ...o,
  });
  const linha = (bs: ReturnType<typeof baixa>[], o: Record<string, unknown> = {}) => ({
    r: {
      saida: new Date("2026-10-05T10:00:00Z"), retorno: new Date("2026-10-05T14:00:00Z"), kmGps: 40,
      gpsClientes: { primeiraChegada: new Date("2026-10-05T12:00:00Z"), ultimaSaida: new Date("2026-10-05T13:30:00Z") },
      app: { primeira: new Date("2026-10-05T12:10:00Z"), ultima: null, emClienteMin: 0 },
      baixas: bs, paradasSemCliente: { qtd: 0, min: 0 }, desvios: 0, trechosLentos: 0, semGps: null, ...o,
    } as never,
    vols: bs.map(b => b.vol) as never,
  });

  it("hL/h, hL/km, hL por parada e devolução", () => {
    const { r, vols } = linha([baixa(2, 10), baixa(4, 14, { vol: { ...baixa(4, 14).vol, dev: 1 } })]);
    const p = produtividadeLinha(r, vols, 200);
    expect([p.hl, p.dev, p.hlPorHora, p.hlPorKm, p.hlPorParada, p.menorHl, p.parcial]).toEqual([6, 1, 1.5, 0.15, 3, 2, false]);
    expect(p.devPct).toBeCloseTo(14.29, 2);
    expect(p.etiquetas.map(e => e.texto)).toContain("devolução 14%");
  });
  it("sem retorno: hL/h até a última saída de cliente, parcial", () => {
    const { r, vols } = linha([baixa(3, 10)], { retorno: null });
    const p = produtividadeLinha(r, vols, 200); // 10:00 → última saída 13:30 = 3,5 h
    expect(p.parcial).toBe(true);
    expect(p.hlPorHora).toBeCloseTo(3 / 3.5, 3);
  });
  it("etiquetas: app atrasado, registro longe e entregas sem pedido no ERP", () => {
    const { r, vols } = linha([
      baixa(1, 5, { entrega: { lat: -7, lon: -43, latApp: -7.01, lonApp: -43, baixaEm: new Date(), situacao: "ENTREGUE" } }),
      baixa(0, 5, { vol: null }),
    ], { app: { primeira: new Date("2026-10-05T12:45:00Z"), ultima: null, emClienteMin: 0 } });
    const textos = produtividadeLinha(r, vols, 200).etiquetas.map(e => e.texto);
    expect(textos).toEqual(expect.arrayContaining(["app 45 min depois", "registro longe do cliente", "1 entrega sem pedido no ERP"]));
  });
  it("min/hL por tipo dominante e reta das 4 semanas", () => {
    const bs = [0.5, 1, 1.5, 2, 3, 4].map(hl => baixa(hl, 6 + 2 * hl));
    const { r, vols } = linha(bs);
    const p = produtividadeLinha(r, vols, 200, bs.map((b, i) => ({ hl: b.vol.hl, minDescarga: b.permanenciaMin, dia: `2026-10-0${1 + (i % 3)}` })));
    expect(p.reta!.minPorHl).toBeCloseTo(2, 6);
    expect(p.reta4s).toMatchObject({ dias: 3 });
    expect(p.porTipo).toEqual([{ tipo: "descartavel", hl: 12, minPorHl: expect.closeTo(60 / 12, 6) }]); // Σ(6 + 2·hL) = 60 min
  });
});
```

- [ ] **Step 2: Rodar** — `pnpm vitest run server/services/entregas/produtividade.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
/*
 * MetricFlow — produtividade em hL (spec produtividade §6): volume de cada entrega pelos itens do ERP e
 * medidas por motorista·dia (hL/h, hL/km, hL por parada, devolução, tempo fixo × por hL, min/hL por embalagem)
 * mais as etiquetas da aba "Por dia new". Puro: quem chama busca os itens e os pontos do "4 semanas".
 */
import type { EntregaCruzada, ResultadoLinha } from "./cruzar";
import type { ItemComProduto, PontoProdutividade } from "../erp/repo";
import { distM } from "./detectarParadas";
import { LIMITES, horaBRT } from "@shared/entregas";

export const DOMINANTE_PCT = 0.7, DEV_ALTA_PCT = 10, APP_ATRASO_MIN = 30, RETA_MIN_PONTOS = 6;
type Tipo = "retornavel" | "descartavel" | "barril";
const TIPOS: Tipo[] = ["retornavel", "descartavel", "barril"];
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function volumeItem(i: ItemComProduto): { hl: number; dev: number } | null {
  if (i.cancelado || !i.produto?.litrosEmb || !i.produto.litrosUn) return null;
  const { litrosEmb, litrosUn } = i.produto;
  return { hl: r3((i.liqCx * litrosEmb + i.liqUn * litrosUn) / 100), dev: r3((i.retCx * litrosEmb + i.retUn * litrosUn) / 100) };
}

export interface VolumeEntrega {
  hl: number; dev: number; porTipo: Record<Tipo, number>;
  dominante: Tipo | "misto" | null; motivos: string[]; semCadastro: string[]; casou: boolean;
}

export function volumeEntrega(docs: string[], itens: ItemComProduto[]): VolumeEntrega {
  const meus = itens.filter(i => docs.includes(i.pedido));
  const porTipo: Record<Tipo, number> = { retornavel: 0, descartavel: 0, barril: 0 };
  let hl = 0, dev = 0;
  for (const i of meus) {
    const v = volumeItem(i);
    if (!v) continue;
    hl += v.hl; dev += v.dev;
    if (i.produto?.tipo) porTipo[i.produto.tipo] += v.hl;
  }
  const top = TIPOS.reduce((a, b) => (porTipo[b] > porTipo[a] ? b : a));
  return {
    hl: r3(hl), dev: r3(dev), porTipo,
    dominante: hl > 0 ? (porTipo[top] / hl >= DOMINANTE_PCT ? top : "misto") : null,
    motivos: [...new Set(meus.flatMap(i => (i.motivoDev ? [i.motivoDev] : [])))],
    semCadastro: [...new Set(meus.filter(i => !i.produto && !i.cancelado).map(i => i.codProduto))].sort(),
    casou: meus.length > 0,
  };
}

export function ajustarReta(pontos: { hl: number; min: number }[]): { fixoMin: number; minPorHl: number; n: number } | null {
  const n = pontos.length;
  if (n < RETA_MIN_PONTOS) return null;
  const mx = pontos.reduce((s, p) => s + p.hl, 0) / n, my = pontos.reduce((s, p) => s + p.min, 0) / n;
  const sxx = pontos.reduce((s, p) => s + (p.hl - mx) ** 2, 0);
  if (sxx < 1e-9) return null;
  const minPorHl = pontos.reduce((s, p) => s + (p.hl - mx) * (p.min - my), 0) / sxx;
  const fixoMin = my - minPorHl * mx;
  return fixoMin < 0 || minPorHl < 0 ? null : { fixoMin, minPorHl, n };
}

export interface ProdutividadeLinha {
  hl: number; dev: number; devPct: number | null; hlPorHora: number | null; parcial: boolean;
  hlPorKm: number | null; hlPorParada: number | null; menorHl: number | null;
  reta: ReturnType<typeof ajustarReta>; reta4s: (NonNullable<ReturnType<typeof ajustarReta>> & { dias: number }) | null;
  porTipo: { tipo: Tipo | "misto"; hl: number; minPorHl: number }[];
  semVolume: number; etiquetas: { texto: string; nivel: "alerta" | "aviso" }[];
}

const descarregou = (b: EntregaCruzada, v: VolumeEntrega | null): v is VolumeEntrega =>
  !!v && v.hl > 0 && b.status === "no_raio" && b.permanenciaMin > 0;

export function produtividadeLinha(
  r: ResultadoLinha, volumes: (VolumeEntrega | null)[], raioM: number,
  pontos4s: { hl: number; minDescarga: number; dia: string }[] = [],
): ProdutividadeLinha {
  const vs = volumes.filter((v): v is VolumeEntrega => !!v);
  const hl = r3(vs.reduce((s, v) => s + v.hl, 0)), dev = r3(vs.reduce((s, v) => s + v.dev, 0));
  const fim = r.retorno ?? r.gpsClientes.ultimaSaida;
  const horas = r.saida && fim ? (fim.getTime() - r.saida.getTime()) / 3_600_000 : 0;
  const comHl = vs.filter(v => v.hl > 0);
  const pontos = r.baixas.flatMap((b, i) => (descarregou(b, volumes[i]) ? [{ hl: volumes[i]!.hl, min: b.permanenciaMin }] : []));

  const grupos = new Map<Tipo | "misto", { hl: number; min: number }>();
  r.baixas.forEach((b, i) => {
    const v = volumes[i];
    if (!descarregou(b, v) || !v.dominante) return;
    const g = grupos.get(v.dominante) ?? { hl: 0, min: 0 };
    grupos.set(v.dominante, { hl: g.hl + v.hl, min: g.min + b.permanenciaMin });
  });

  const reta4 = ajustarReta(pontos4s.map(p => ({ hl: p.hl, min: p.minDescarga })));
  const semVolume = r.baixas.filter((b, i) => b.entrega.situacao === "ENTREGUE" && !volumes[i]?.casou).length;
  const devPct = hl + dev > 0 ? Math.round((dev / (hl + dev)) * 10000) / 100 : null;

  const etiquetas: ProdutividadeLinha["etiquetas"] = [];
  const add = (texto: string, nivel: "alerta" | "aviso" = "alerta") => etiquetas.push({ texto, nivel });
  if (r.semGps) add(`sem GPS: ${r.semGps}`, "aviso");
  if (r.saida && horaBRT(r.saida) > LIMITES.saidaAte) add(`saída ${horaBRT(r.saida)}`);
  const atraso = r.app.primeira && r.gpsClientes.primeiraChegada
    ? Math.round((r.app.primeira.getTime() - r.gpsClientes.primeiraChegada.getTime()) / 60000) : 0;
  if (atraso > APP_ATRASO_MIN) add(`app ${atraso >= 60 ? `${Math.floor(atraso / 60)}h${String(atraso % 60).padStart(2, "0")}` : `${atraso} min`} depois`);
  if (r.baixas.some(b => b.entrega.lat !== null && b.entrega.lon !== null && b.entrega.latApp !== null && b.entrega.lonApp !== null
    && distM(b.entrega.lat, b.entrega.lon, b.entrega.latApp, b.entrega.lonApp) > raioM)) add("registro longe do cliente");
  if (devPct !== null && devPct > DEV_ALTA_PCT) add(`devolução ${Math.round(devPct)}%`);
  if (r.paradasSemCliente.qtd) add(`${r.paradasSemCliente.qtd} parada(s) sem cliente`, "aviso");
  if (r.desvios) add(`${r.desvios} desvio(s)`, "aviso");
  if (r.trechosLentos) add(`${r.trechosLentos} trecho(s) lento(s)`, "aviso");
  if (semVolume) add(`${semVolume} entrega${semVolume > 1 ? "s" : ""} sem pedido no ERP`, "aviso");

  return {
    hl, dev, devPct,
    hlPorHora: horas > 0 ? r3(hl / horas) : null, parcial: !r.retorno,
    hlPorKm: r.kmGps ? r3(hl / r.kmGps) : null,
    hlPorParada: comHl.length ? r3(hl / comHl.length) : null,
    menorHl: comHl.length ? Math.min(...comHl.map(v => v.hl)) : null,
    reta: ajustarReta(pontos),
    reta4s: reta4 && { ...reta4, dias: new Set(pontos4s.map(p => p.dia)).size },
    porTipo: [...grupos].map(([tipo, g]) => ({ tipo, hl: r3(g.hl), minPorHl: g.min / g.hl })),
    semVolume, etiquetas,
  };
}

export function pontosDaLinha(r: ResultadoLinha, volumes: (VolumeEntrega | null)[]): PontoProdutividade[] {
  return r.baixas.flatMap((b, i) => (descarregou(b, volumes[i])
    ? [{ dia: r.linha.data, placa: r.linha.placa, motorista: r.linha.motorista, routeId: r.linha.routeId, codCliente: b.entrega.codCliente, hl: volumes[i]!.hl, minDescarga: b.permanenciaMin }]
    : []));
}
```

Conferência dos números do teste: "hL/h…" = 6 hL em 4 h, 40 km, 2 paradas; etiquetas usa `latApp -7.01` (~1,1 km do cliente) e app 45 min depois da chegada.

- [ ] **Step 4: Rodar** — mesmo comando → PASS (9). `pnpm check` sem erro novo.

- [ ] **Step 5: Commit** — `git add server/services/entregas/produtividade*.ts && git commit -m "feat(entregas): cálculo da produtividade em hL (volume, hL/h, reta, embalagem, etiquetas)"`

---

### Task 8: API

**Files:**
- Modify: `server/routers/entregasRouter.ts`

**Interfaces:**
- Consumes: Tasks 5 e 7.
- Produces: `entregas.processar` devolve `{ linhas: (ResultadoLinha & { produtividade: ProdutividadeLinha; volumes: (VolumeEntrega | null)[] })[]; rotas }` (`volumes[i]` alinhado a `baixas[i]`); `entregas.erp.importarProdutos({ xlsxBase64 })` → `{ produtos, comVolume }`; `entregas.erp.importarPedidos({ revendaId, csvBase64 })` → `{ pedidos, itens, semCadastro }`.

- [ ] **Step 1: Implementar** — em `processar`, depois de `processarEntregas(...)`:

```ts
    const res = await processarEntregas(entregas, new Date(), { cercaId: input.cercaId, token, config, periodo: { de: input.de, ate: input.ate } });
    const docs = res.linhas.flatMap(l => l.baixas.flatMap(b => b.entrega.documentos));
    const itens = await erpRepo.itensDosDocumentos(input.revendaId, docs).catch(() => []);
    const desde = new Date(Date.parse(`${input.de}T12:00:00Z`) - 28 * 86_400_000).toISOString().slice(0, 10);
    const linhas = await Promise.all(res.linhas.map(async l => {
      const volumes = l.baixas.map(b => (b.entrega.documentos.length ? volumeEntrega(b.entrega.documentos, itens) : null));
      await erpRepo.gravarPontos(input.revendaId, pontosDaLinha(l, volumes)).catch(() => undefined);
      const p4 = await erpRepo.pontosDoMotorista(input.revendaId, l.linha.motorista, desde, l.linha.data).catch(() => []);
      return { ...l, volumes, produtividade: produtividadeLinha(l, volumes, config.raioM, p4) };
    }));
    return { ...res, linhas };
```

E o sub-router:

```ts
const erp = router({
  importarProdutos: publicProcedure.input(z.object({ xlsxBase64: z.string().min(1) }))
    .mutation(({ input }) => amigavel(() => importarProdutos(Buffer.from(input.xlsxBase64, "base64")))),
  importarPedidos: publicProcedure.input(z.object({ revendaId: z.number().int(), csvBase64: z.string().min(1) }))
    .mutation(({ input }) => amigavel(() => importarPedidos(input.revendaId, Buffer.from(input.csvBase64, "base64")))),
});
```

`amigavel` passa a tratar também `ArquivoErpInvalidoError`. Imports: `* as erpRepo from "../services/erp/repo"`, `importarProdutos, importarPedidos`, `ArquivoErpInvalidoError`, `volumeEntrega, produtividadeLinha, pontosDaLinha`. Registrar `erp` em `entregasRouter`.

- [ ] **Step 2: Verificar** — `pnpm check` sem erro novo; `pnpm vitest run server/services` → só as 2 da baseline.

- [ ] **Step 3: Commit** — `git commit -am "feat(entregas): API da produtividade e das importações do ERP"`

---

### Task 9: Tela — importação no ⚙ e aba "Por dia new"

**Files:**
- Modify: `client/src/pages/relatorio-entregas/ContasEntregas.tsx` (seção "Arquivos do ERP")
- Create: `client/src/pages/relatorio-entregas/PainelDiaNew.tsx`
- Modify: `client/src/pages/relatorio-entregas/index.tsx` (aba nova)

**Interfaces:**
- Consumes: Task 8; `MapaEntrega`; `blobToBase64`.

- [ ] **Step 1: Importação** — no fim de `ContasEntregas`, uma seção "Arquivos do ERP" com dois `label` de arquivo (mesmo estilo de `botaoSec`): **Importar produtos (todas as revendas)** (`accept=".xlsx"`, chama `trpc.entregas.erp.importarProdutos`, toast "997 produtos (322 com volume)") e **Importar pedidos** com um `select` de revenda das contas (padrão: a 1ª ativa) (`accept=".csv"`, chama `importarPedidos`, toast "11.027 itens · 3.677 pedidos" + ", N produtos sem cadastro: …" quando houver; `utils.entregas.coletas.invalidate()`). Erros no toast.

- [ ] **Step 2: Aba** — em `index.tsx`: `aba` vira `"dia" | "rota" | "dianew"`; botão `["dianew", "Por dia new"]` nas abas; `{revenda && !processar.isPending && !!resultados.length && aba === "dianew" && <PainelDiaNew linhas={linhas} raioM={raioM} dia={dia} />}` (`linhas` = resultados do dia visto).

- [ ] **Step 3: `PainelDiaNew.tsx`** — componentes no mesmo arquivo:
  - `type Linha = inferRouterOutputs<AppRouter>["entregas"]["processar"]["linhas"][number]`.
  - **Resumo** (4 cartões `bg-white dark:bg-[var(--card)] rounded-xl`): hL entregues (soma), hL/h (soma hL ÷ soma das horas das linhas com hL/h), devolução % (soma dev ÷ soma (hL+dev)), hL por parada (soma hL ÷ soma das paradas com hL). Números com `toLocaleString("pt-BR", { maximumFractionDigits: 1/2 })`.
  - **Cartões** (`grid grid-cols-1 xl:grid-cols-2 gap-3`), ordenados por `produtividade.hlPorHora` crescente (null por último): cabeçalho placa · motorista e cidades; à direita hL/h grande (`text-2xl font-bold`, "parcial" pequeno quando `parcial`); linha `hL · hL dev. · hL/km · entregasDia/totalRota`; `<Trilho linha={l} altura={16} />`; etiquetas (alerta = `bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300`, aviso = `bg-amber-50 text-amber-700 …`). Cartão aberto ganha `ring-2 ring-indigo-400`.
  - **Detalhe** (renderizado depois do cartão aberto, `col-span-full`): `<Trilho linha={l} altura={36} comApp />`; lista de clientes na ordem de visita (mesma ordem de `TabelaBaixas`: chegada da parada mais próxima, depois hora do app) com nome (clique alterna `<MapaEntrega>`), barra de hL (largura ∝ hL ÷ maior hL do dia) colorida por min/hL (verde ≤ mediana, âmbar ≤ 2×, vermelho > 2×; cinza sem volume), texto "x,x hL · y min/hL"; `<Dispersao pontos reta />` em SVG (eixo x hL, y minutos, pontos, reta quando houver) com "fixo X min · Y min por hL" e "4 semanas (n dias): …" ou "poucas entregas para calcular"; pílulas min/hL por embalagem (retornável, descartável, barril, misto).
  - **`Trilho`** (SVG, largura 100%, eixo das 05:00 às 20:00 BRT ou do início/fim da jornada se fora disso): fundo `#2a78d6` entre saída e retorno (rodando), retângulos das paradas do `trilho` (`#eb6834` no cliente, `#1baf7a` sem cliente; no escuro as cores da Global Constraints via `dark:` em classes `fill-[…]`), e com `comApp` um traço `#534AB7` por entrega em `b.entrega.baixaEm`, com `<title>` "Entrega no app hh:mm — cliente". Horas no eixo só no tamanho grande.
  - Legenda do trilho embaixo do resumo (rodando, no cliente, sem cliente, registro no app).

- [ ] **Step 4: Verificar** — `pnpm check` sem erro novo. Abrir no navegador (Task 10).

- [ ] **Step 5: Commit** — `git add client/src/pages/relatorio-entregas && git commit -m "feat(entregas): aba Por dia new com produtividade em hL e importação do ERP no ⚙"`

---

### Task 10: Banco local, importação real e conferência

- [ ] **Step 1: SQL — PARAR e pedir confirmação ao usuário** mostrando `drizzle/manual/2026-10-10_produtividade.sql`; com o sim, aplicar com o `aplicaSql.ts` (checagem de localhost).
- [ ] **Step 2:** `pnpm tsx --env-file=../../../.env script/validarRepoErp.ts` → Expected da Task 5 Step 6.
- [ ] **Step 3: Importações pela tela** — ⚙ › Contas › Arquivos do ERP: o usuário (ou o assistente, com os arquivos que o usuário indicou) importa `PRODUTOS.xlsx` e o CSV do mês corrente de Floriano. Expected: toasts com as contagens.
- [ ] **Step 4: Documentos** — "Buscar do CheckNow" dos últimos dias (preenche `documentos`).
- [ ] **Step 5: Conferência** — aba "Por dia new" num dia com pedidos importados: cartões com hL/h e hL; abrir um cartão, conferir um cliente: hL = soma manual dos itens do pedido no CSV × litros do cadastro ÷ 100.
- [ ] **Step 6:** `pnpm test 2>&1 | tail -5` → só a baseline. Atualizar `produtividade-design.md` se algo mudou e commitar.
