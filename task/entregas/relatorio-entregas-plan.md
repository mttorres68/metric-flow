# Relatório Gerencial de Entregas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a partir do upload da planilha do CheckNow, gerar um PDF diário com uma linha por placa · motorista · dia, comprovando cada baixa com as paradas do GPS do Infleet, mais uma página de exceções.

**Architecture:** três funções puras fazem o trabalho:
- `parseCheckNow`: xlsx → entregas;
- `detectarParadas`: posições → paradas;
- `cruzar`: entregas + paradas → KPIs e exceções.

Em volta delas:
- um adaptador do Infleet (`infleetEntregas`) reaproveita o `infleetQuery` existente;
- um gerador de PDF (`pdfEntregas.tsx`) reaproveita os estilos de `pdfService.tsx`;
- uma rota express orquestra tudo e uma tela no client faz o upload.

Não há banco.

**Tech Stack:** TypeScript, Express, `xlsx` 0.18, `@react-pdf/renderer` v4, JSZip, vitest 2, React + wouter + shadcn (client), pnpm.

**Spec:** `task/entregas/relatorio-entregas-design.md`

## Global Constraints

- Limites (único lugar: `LIMITES` em `cruzar.ts`): raio 300 m; relâmpago < 3 min; parada sem cliente ≥ 10 min; saída até 08:00; após 14h ≥ 14:00; vermelho "Após 14h" < 25%; vermelho "Relâmpago" > 10%.
- Detecção de parada: parado < 5 km/h; descarta parada < 1 min; funde paradas a < 50 m separadas por < 2 min.
- Horários do CheckNow são BRT fixo (-03:00). Datas ISO do Infleet são convertidas com `new Date()`.
- Linha do relatório = placa · motorista · dia. A janela de GPS é recortada pelo início e fim realizados da rota.
- Unidade de entrega = `RouteId` + `Código do Cliente` (deduplicada).
- Sem banco nesta versão; nenhuma migração.
- Testes só com dados sintéticos; nenhum dado real de cliente no repositório.
- A base já tem falhas antigas: `pnpm test` (42 falhas em vendedoresRouter, metricsCalculator e analiseRouter.recorrencia) e `pnpm check` (2 erros: `client/src/App.tsx(69,9)` e `server/services/thumbnailService.ts(34,18)`). O código novo não pode acrescentar falhas nem erros. Rode os testes por arquivo.
- O `.env` fica na checkout principal (`../../../.env` a partir da worktree). Não copie o `.env` para a worktree. Use `--env-file=../../../.env` (tsx) ou `DOTENV_CONFIG_PATH=../../../.env` (servidor).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Datas exportadas como data do Excel (número serial) em vez de texto**: as baixas devem continuar sendo lidas e não podem sumir em silêncio. → teste na Task 2.
2. **Arquivo que não é a planilha do CheckNow** (outro xlsx, csv, texto): deve voltar HTTP 400 com as colunas faltantes, e não 500. → teste na Task 2.
3. **Placa em formato diferente entre CheckNow e Infleet** (`SOL-6B13`, `sol6b13`, `SOL 6B13`): tem que casar igual. → teste na Task 5.
4. **Caminhão parado o dia inteiro** (sem nenhuma posição em movimento): saída e retorno ficam "—", sem quebrar e sem inventar parada sem cliente. → teste na Task 4.
5. **Denominadores zero e limite exato**: baixa às 14:00:00 conta como após 14h; um dia sem entregas não fica vermelho em "Após 14h"; o PDF sem linhas ou com linha sem GPS renderiza sem `NaN`. → testes nas Tasks 4 e 6.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `server/routers/infleetRouter.ts` | Modificar (linha 18) | exportar `infleetQuery` |
| `script/sondaInfleet.ts` | Criar | sonda: unidade do `speed`, volume, formato de `plate` |
| `server/services/entregas/parseCheckNow.ts` | Criar | xlsx → `Entrega[]` |
| `server/services/entregas/detectarParadas.ts` | Criar | `Posicao[]` → `ResultadoParadas`; `distM` |
| `server/services/entregas/cruzar.ts` | Criar | `LIMITES`, `montarLinhas`, `agruparPorRota`, `cruzar`, `diaBRT`, `horaBRT` |
| `server/services/entregas/infleetEntregas.ts` | Criar | placa → id; posições em blocos de 6 h; km → `GpsLinha` |
| `server/services/pdfService.tsx` | Modificar (8 `export`) | expor estilos e helpers para reuso |
| `server/services/pdfEntregas.tsx` | Criar | PDF: página de linhas + página de exceções |
| `server/routes/relatorioEntregas.ts` | Criar | `POST /api/relatorio-entregas/gerar` |
| `server/_core/index.ts` | Modificar | registrar a rota |
| `client/src/pages/relatorio-entregas/index.tsx` | Criar | tela de upload |
| `client/src/components/Sidebar.tsx`, `client/src/App.tsx` | Modificar | menu e rota |
| `script/validarEntregas.ts` | Criar | validação com dados reais |

Os testes ficam ao lado de cada arquivo: `*.test.ts`. O vitest inclui `server/**/*.test.ts`.

---

### Task 1: Sonda do Infleet + exportar `infleetQuery`

**Files:**
- Modify: `server/routers/infleetRouter.ts:18`
- Create: `script/sondaInfleet.ts`
- Modify: `task/entregas/relatorio-entregas-design.md` (§2, resultados)

**Interfaces:**
- Produces: `export async function infleetQuery<T>(query: string, variables: Record<string, any>): Promise<T>` (assinatura inalterada, só passa a ser exportada).
- Produces: o valor de `SPEED_PARA_KMH` usado na Task 5, registrado na spec §2.

- [ ] **Step 1: Exportar `infleetQuery`**

Em `server/routers/infleetRouter.ts`, linha 18, troque:

```ts
async function infleetQuery<T>(query: string, variables: Record<string, any>): Promise<T> {
```

por:

```ts
export async function infleetQuery<T>(query: string, variables: Record<string, any>): Promise<T> {
```

- [ ] **Step 2: Criar a sonda**

Crie `script/sondaInfleet.ts`:

```ts
/*
 * Sonda do Infleet (Task 1 do plano de entregas) — só leitura.
 * Confirma: unidade do `speed`, volume de posições por janela e formato de `plate`.
 * Uso (a partir da worktree): pnpm tsx --env-file=../../../.env script/sondaInfleet.ts
 */
import { infleetQuery } from "../server/routers/infleetRouter";

const PLACA = "SOO8D21";
const INICIO = "2026-10-05T06:00:00-03:00";
const FIM = "2026-10-05T12:00:00-03:00";

type Pos = { latitude: number; longitude: number; fixTime: string; speed: number; ignition: boolean | null; valid: boolean };

function distM(a: Pos, b: Pos): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const { listVehicles } = await infleetQuery<{ listVehicles: { id: string; plate: string }[] }>(
  `query { listVehicles { id plate } }`, {});
console.log("Veículos:", listVehicles.length, "| exemplos de plate:", listVehicles.slice(0, 5).map(v => v.plate));

const v = listVehicles.find(x => x.plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === PLACA);
if (!v) { console.log("Placa não encontrada:", PLACA); process.exit(1); }

const filter = { vehicleId: v.id, fixTime: { startAt: INICIO, endAt: FIM } };
const { listVehiclePositions: pos } = await infleetQuery<{ listVehiclePositions: Pos[] }>(
  `query($filter: ListVehiclePositionsFilterInput!) {
     listVehiclePositions(filter: $filter) { latitude longitude fixTime speed ignition valid }
   }`, { filter });

console.log("Posições em 6h:", pos.length, "(número redondo como 1000/5000/10000 sugere truncamento)");
console.log("Primeiras 3:", pos.slice(0, 3));
console.log("speed máximo:", Math.max(...pos.map(p => p.speed)));

const ordenadas = [...pos].sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());
const razoes: number[] = [];
for (let i = 1; i < ordenadas.length; i++) {
  const a = ordenadas[i - 1], b = ordenadas[i];
  const horas = (new Date(b.fixTime).getTime() - new Date(a.fixTime).getTime()) / 3600000;
  if (horas <= 0 || horas > 0.05 || b.speed < 10) continue;
  razoes.push((distM(a, b) / 1000 / horas) / b.speed);
}
razoes.sort((x, y) => x - y);
console.log("Mediana (km/h calculado ÷ speed):", razoes[Math.floor(razoes.length / 2)]?.toFixed(2),
  "→ ~1.00 = km/h | ~1.85 = nós | amostras:", razoes.length);

const { routeVehicleDetails } = await infleetQuery<{ routeVehicleDetails: unknown }>(
  `query($filter: ListVehiclePositionsFilterInput!) {
     routeVehicleDetails(filter: $filter) { totalDistanceTraveled totalTimeStopped }
   }`, { filter });
console.log("routeVehicleDetails:", routeVehicleDetails);
```

- [ ] **Step 3: Rodar a sonda**

Run: `pnpm tsx --env-file=../../../.env script/sondaInfleet.ts`

Expected: a sonda imprime a quantidade de veículos, exemplos de `plate`, a contagem de posições, as primeiras 3 posições, o `speed` máximo, a mediana da razão e o `routeVehicleDetails`, sem erro de GraphQL.

Se der `INFLEET_TOKEN não configurado`, confira se `../../../.env` tem a variável.

- [ ] **Step 4: Registrar os resultados na spec**

Em `task/entregas/relatorio-entregas-design.md` §2, troque o bullet que começa com `**A confirmar na sonda (§9):**` pelos valores observados, neste formato:

```md
- **Sonda (2026-10-05, SOO-8D21, 06:00–12:00):** <N> posições em 6 h (sem
  sinal de truncamento | possível truncamento em <N>); `speed` em <km/h | nós>
  (mediana da razão <x.xx>) → `SPEED_PARA_KMH = <1 | 1.852>`; `plate` no
  formato `<exemplo>`; `routeVehicleDetails.totalDistanceTraveled` = <valor>
  (<km | m>).
```

Regras de decisão:
- mediana entre 0,8 e 1,2 → `SPEED_PARA_KMH = 1`;
- mediana entre 1,6 e 2,1 → `SPEED_PARA_KMH = 1.852`;
- qualquer outro valor → **pare e reporte**, porque a regra de parada (§5) depende disso;
- contagem de posições redonda (1000, 5000, 10000) → **pare e reporte**, porque o bloco de 6 h da Task 5 precisa ser menor.

- [ ] **Step 5: Commit**

```bash
git add server/routers/infleetRouter.ts script/sondaInfleet.ts task/entregas/relatorio-entregas-design.md
git commit -m "chore(entregas): sonda do Infleet e export de infleetQuery" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `parseCheckNow`

**Files:**
- Create: `server/services/entregas/parseCheckNow.ts`
- Test: `server/services/entregas/parseCheckNow.test.ts`

**Interfaces:**
- Produces:

```ts
export type Situacao = "ENTREGUE" | "PROBLEMA" | "AGUARDANDO";
export interface Entrega {
  routeId: string; placa: string; motorista: string;
  codCliente: string; cliente: string;
  lat: number | null; lon: number | null;      // null = sem coordenada (0 na planilha)
  situacao: Situacao;
  baixaEm: Date | null;                         // Data/Hora de Chegada (BRT)
  rotaInicio: Date | null; rotaFim: Date | null;
  odoIniInformado: number | null; odoFimInformado: number | null;
}
export const COLUNAS_CHECKNOW: readonly string[];
export class PlanilhaInvalidaError extends Error { faltando: string[] }
export function dataHoraBRT(data: unknown, hora: unknown): Date | null;
export function parseCheckNow(buffer: Buffer): Entrega[];
```

- [ ] **Step 1: Escrever os testes que falham**

Crie `server/services/entregas/parseCheckNow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseCheckNow, PlanilhaInvalidaError, dataHoraBRT } from "./parseCheckNow";

function planilha(linhas: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Geracao_Dado_BI");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

const base: Record<string, unknown> = {
  "RouteId": 1791041162179,
  "Placa": "SOL-6B13",
  "Motorista": "ANTONIO",
  "Código do Cliente": 160089,
  "Descrição do Ponto": "CLIENTE A",
  "Latitude": -7.093788,
  "Longitude": -43.510433,
  "Situação": "ENTREGUE",
  "Data de Chegada": "05/10/2026",
  "Hora de Chegada": "09:28:07",
  "Data Rota Inicio Realizada": "05/10/2026",
  "Hora Rota Inicio Realizada": "08:44:41",
  "Data Rota Fim Realizada": "",
  "Hora Rota Fim Realizada": "",
  "Odometro Inicial Real. Informado": 101625,
  "Odometro Final Real. Informado": "",
};

describe("parseCheckNow", () => {
  it("converte uma linha em Entrega com datas em BRT", () => {
    const [e] = parseCheckNow(planilha([base]));
    expect(e).toMatchObject({
      routeId: "1791041162179", placa: "SOL-6B13", motorista: "ANTONIO",
      codCliente: "160089", cliente: "CLIENTE A",
      lat: -7.093788, lon: -43.510433, situacao: "ENTREGUE",
      rotaFim: null, odoIniInformado: 101625, odoFimInformado: null,
    });
    expect(e.baixaEm?.toISOString()).toBe("2026-10-05T12:28:07.000Z");
    expect(e.rotaInicio?.toISOString()).toBe("2026-10-05T11:44:41.000Z");
  });

  it("deduplica por RouteId + Código do Cliente (várias notas e linhas repetidas)", () => {
    const outroCliente = { ...base, "Código do Cliente": 340007 };
    const entregas = parseCheckNow(planilha([base, base, { ...base, "Descrição do Ponto": "NF 2" }, outroCliente]));
    expect(entregas.map(e => e.codCliente)).toEqual(["160089", "340007"]);
  });

  it("coordenada zero vira null", () => {
    const [e] = parseCheckNow(planilha([{ ...base, "Latitude": -0, "Longitude": 0 }]));
    expect(e.lat).toBeNull();
    expect(e.lon).toBeNull();
  });

  it("AGUARDANDO sem baixa tem baixaEm null", () => {
    const [e] = parseCheckNow(planilha([{ ...base, "Situação": "AGUARDANDO", "Data de Chegada": "", "Hora de Chegada": "" }]));
    expect(e.situacao).toBe("AGUARDANDO");
    expect(e.baixaEm).toBeNull();
  });

  it("lista as colunas faltantes", () => {
    const semDuas = Object.fromEntries(Object.entries(base).filter(([k]) => k !== "Placa" && k !== "Latitude"));
    try {
      parseCheckNow(planilha([semDuas]));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PlanilhaInvalidaError);
      expect((e as PlanilhaInvalidaError).faltando).toEqual(["Placa", "Latitude"]);
    }
  });

  // Review Focus 2
  it("arquivo que não é a planilha do CheckNow vira PlanilhaInvalidaError", () => {
    expect(() => parseCheckNow(Buffer.from("isto não é uma planilha"))).toThrow(PlanilhaInvalidaError);
  });

  // Review Focus 1
  it("aceita data e hora como número serial do Excel", () => {
    const serial = Date.UTC(2026, 9, 5) / 86400000 + 25569; // 05/10/2026
    const [e] = parseCheckNow(planilha([{ ...base, "Data de Chegada": serial, "Hora de Chegada": 0.5 }]));
    expect(e.baixaEm?.toISOString()).toBe("2026-10-05T15:00:00.000Z"); // 12:00 BRT
  });
});

describe("dataHoraBRT", () => {
  it("retorna null quando falta data ou hora", () => {
    expect(dataHoraBRT("05/10/2026", "")).toBeNull();
    expect(dataHoraBRT(null, "09:00:00")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run server/services/entregas/parseCheckNow.test.ts`
Expected: FAIL com `Failed to resolve import "./parseCheckNow"`.

- [ ] **Step 3: Implementar**

Crie `server/services/entregas/parseCheckNow.ts`:

```ts
/*
 * MetricFlow — leitura da planilha "Geracao_Dado_BI" do CheckNow.
 * Uma Entrega = RouteId + Código do Cliente (várias notas do mesmo cliente
 * na mesma rota viram uma entrega; a planilha também repete linhas idênticas).
 */
import * as XLSX from "xlsx";

export type Situacao = "ENTREGUE" | "PROBLEMA" | "AGUARDANDO";

export interface Entrega {
  routeId: string;
  placa: string;
  motorista: string;
  codCliente: string;
  cliente: string;
  lat: number | null; // null = sem coordenada (0 na planilha)
  lon: number | null;
  situacao: Situacao;
  baixaEm: Date | null; // Data/Hora de Chegada (BRT)
  rotaInicio: Date | null;
  rotaFim: Date | null;
  odoIniInformado: number | null;
  odoFimInformado: number | null;
}

export const COLUNAS_CHECKNOW = [
  "RouteId", "Placa", "Motorista", "Código do Cliente", "Descrição do Ponto",
  "Latitude", "Longitude", "Situação", "Data de Chegada", "Hora de Chegada",
  "Data Rota Inicio Realizada", "Hora Rota Inicio Realizada",
  "Data Rota Fim Realizada", "Hora Rota Fim Realizada",
  "Odometro Inicial Real. Informado", "Odometro Final Real. Informado",
] as const;

export class PlanilhaInvalidaError extends Error {
  constructor(public faltando: string[]) {
    super(`Planilha do CheckNow sem as colunas: ${faltando.join(", ")}`);
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "dd/mm/aaaa" ou serial do Excel → "aaaa-mm-dd". */
function isoData(v: unknown): string | null {
  if (typeof v === "number" && v > 0) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const m = typeof v === "string" ? v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/) : null;
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "hh:mm[:ss]" ou fração de dia do Excel → "hh:mm:ss". */
function isoHora(v: unknown): string | null {
  if (typeof v === "number" && v >= 0) {
    const seg = Math.round((v % 1) * 86400);
    return `${pad(Math.floor(seg / 3600))}:${pad(Math.floor((seg % 3600) / 60))}:${pad(seg % 60)}`;
  }
  const m = typeof v === "string" ? v.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/) : null;
  return m ? `${m[1]}:${m[2]}:${m[3] ?? "00"}` : null;
}

/** Data + hora do CheckNow (BRT, -03:00) → Date. null se faltar qualquer uma. */
export function dataHoraBRT(data: unknown, hora: unknown): Date | null {
  const d = isoData(data), h = isoHora(hora);
  return d && h ? new Date(`${d}T${h}-03:00`) : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v
    : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", "."))
    : NaN;
  return Number.isFinite(n) ? n : null;
}

function situacao(v: unknown): Situacao {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "ENTREGUE" || s === "PROBLEMA" ? s : "AGUARDANDO";
}

export function parseCheckNow(buffer: Buffer): Entrega[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    throw new PlanilhaInvalidaError([...COLUNAS_CHECKNOW]); // arquivo ilegível = nenhuma coluna encontrada
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const header = ((XLSX.utils.sheet_to_json(ws, { header: 1 })[0] ?? []) as unknown[]).map(h => String(h).trim());
  const faltando = COLUNAS_CHECKNOW.filter(c => !header.includes(c));
  if (faltando.length) throw new PlanilhaInvalidaError(faltando);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const entregas = new Map<string, Entrega>();
  for (const r of rows) {
    const routeId = String(r["RouteId"] ?? "").trim();
    const codCliente = String(r["Código do Cliente"] ?? "").trim();
    if (!routeId || !codCliente) continue;
    const chave = `${routeId}|${codCliente}`;
    if (entregas.has(chave)) continue;

    const lat = num(r["Latitude"]), lon = num(r["Longitude"]);
    const temCoord = lat !== null && lon !== null && Math.abs(lat) > 0.001 && Math.abs(lon) > 0.001;
    entregas.set(chave, {
      routeId,
      placa: String(r["Placa"] ?? "").trim(),
      motorista: String(r["Motorista"] ?? "").trim(),
      codCliente,
      cliente: String(r["Descrição do Ponto"] ?? "").trim(),
      lat: temCoord ? lat : null,
      lon: temCoord ? lon : null,
      situacao: situacao(r["Situação"]),
      baixaEm: dataHoraBRT(r["Data de Chegada"], r["Hora de Chegada"]),
      rotaInicio: dataHoraBRT(r["Data Rota Inicio Realizada"], r["Hora Rota Inicio Realizada"]),
      rotaFim: dataHoraBRT(r["Data Rota Fim Realizada"], r["Hora Rota Fim Realizada"]),
      odoIniInformado: num(r["Odometro Inicial Real. Informado"]),
      odoFimInformado: num(r["Odometro Final Real. Informado"]),
    });
  }
  return [...entregas.values()];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run server/services/entregas/parseCheckNow.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add server/services/entregas/parseCheckNow.ts server/services/entregas/parseCheckNow.test.ts
git commit -m "feat(entregas): leitura da planilha do CheckNow" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `detectarParadas`

**Files:**
- Create: `server/services/entregas/detectarParadas.ts`
- Test: `server/services/entregas/detectarParadas.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Posicao { lat: number; lon: number; em: Date; kmh: number; valida: boolean }
export interface Parada { lat: number; lon: number; inicio: Date; fim: Date; min: number }
export interface ResultadoParadas { paradas: Parada[]; primeiroMovimento: Date | null; ultimoMovimento: Date | null }
export const PARADA: { velMaxKmh: 5; minDuracaoMin: 1; fundirDistM: 50; fundirGapMin: 2 };
export function distM(lat1: number, lon1: number, lat2: number, lon2: number): number;
export function detectarParadas(posicoes: Posicao[]): ResultadoParadas;
```

- [ ] **Step 1: Escrever os testes que falham**

Crie `server/services/entregas/detectarParadas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { detectarParadas, distM, type Posicao } from "./detectarParadas";

const T0 = Date.UTC(2026, 9, 5, 12, 0); // 05/10 09:00 BRT
const pos = (min: number, kmh: number, lat = -7, lon = -43, valida = true): Posicao =>
  ({ lat, lon, em: new Date(T0 + min * 60000), kmh, valida });
const minDe = (d: Date | null) => (d ? (d.getTime() - T0) / 60000 : null);

describe("distM", () => {
  it("0,001° de longitude no equador ≈ 111 m", () => {
    expect(distM(0, 0, 0, 0.001)).toBeCloseTo(111.2, 0);
  });
});

describe("detectarParadas", () => {
  it("parada simples entre dois movimentos", () => {
    const r = detectarParadas([pos(0, 40), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(m => pos(m, 0)), pos(11, 40)]);
    expect(r.paradas).toHaveLength(1);
    expect(minDe(r.paradas[0].inicio)).toBe(1);
    expect(minDe(r.paradas[0].fim)).toBe(11);
    expect(r.paradas[0].min).toBe(10);
    expect(minDe(r.primeiroMovimento)).toBe(0);
    expect(minDe(r.ultimoMovimento)).toBe(11);
  });

  it("descarta parada com menos de 1 min", () => {
    const r = detectarParadas([pos(0, 40), pos(1, 0), pos(1.5, 0), pos(1.8, 40)]);
    expect(r.paradas).toHaveLength(0);
  });

  it("funde paradas a menos de 50 m separadas por menos de 2 min", () => {
    const vinteM = -7 + 0.00018; // ≈ 20 m ao norte
    const r = detectarParadas([
      pos(0, 40), pos(1, 0), pos(5, 0), pos(6, 30), pos(7, 0, vinteM), pos(10, 0, vinteM), pos(11, 40),
    ]);
    expect(r.paradas).toHaveLength(1);
    expect(minDe(r.paradas[0].inicio)).toBe(1);
    expect(minDe(r.paradas[0].fim)).toBe(11);
    expect(r.paradas[0].min).toBe(10);
  });

  it("não funde paradas distantes", () => {
    const duzentosM = -7 + 0.0018; // ≈ 200 m
    const r = detectarParadas([
      pos(0, 40), pos(1, 0), pos(5, 0), pos(6, 30), pos(7, 0, duzentosM), pos(10, 0, duzentosM), pos(11, 40),
    ]);
    expect(r.paradas).toHaveLength(2);
  });

  it("intervalo longo sem posições (motor desligado) é uma parada só", () => {
    const r = detectarParadas([pos(0, 0), pos(120, 0), pos(121, 40)]);
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].min).toBe(121);
  });

  it("janela que termina parada fecha na última posição", () => {
    const r = detectarParadas([pos(0, 40), pos(1, 0), pos(5, 0)]);
    expect(r.paradas).toHaveLength(1);
    expect(minDe(r.paradas[0].fim)).toBe(5);
    expect(r.paradas[0].min).toBe(4);
  });

  it("ignora posições inválidas e ordena por horário", () => {
    const r = detectarParadas([pos(11, 40), pos(5, 0), pos(3, 90, -7, -43, false), pos(1, 0), pos(0, 40)]);
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].min).toBe(10);
  });

  it("sem nenhum movimento: primeiro/último movimento null", () => {
    const r = detectarParadas([pos(0, 0), pos(600, 0)]);
    expect(r.primeiroMovimento).toBeNull();
    expect(r.ultimoMovimento).toBeNull();
    expect(r.paradas).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run server/services/entregas/detectarParadas.test.ts`
Expected: FAIL com `Failed to resolve import "./detectarParadas"`.

- [ ] **Step 3: Implementar**

Crie `server/services/entregas/detectarParadas.ts`:

```ts
/*
 * MetricFlow — detecção de paradas a partir das posições brutas do GPS.
 * Parada = sequência contínua de posições abaixo de PARADA.velMaxKmh; termina
 * na primeira posição em movimento seguinte (cobre rastreador que reporta pouco
 * com motor desligado). Funde manobras curtas e descarta paradas de trânsito.
 */

export interface Posicao { lat: number; lon: number; em: Date; kmh: number; valida: boolean }
export interface Parada { lat: number; lon: number; inicio: Date; fim: Date; min: number }
export interface ResultadoParadas {
  paradas: Parada[];
  primeiroMovimento: Date | null;
  ultimoMovimento: Date | null;
}

export const PARADA = { velMaxKmh: 5, minDuracaoMin: 1, fundirDistM: 50, fundirGapMin: 2 } as const;

/** Distância haversine em metros. */
export function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const minutos = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60000;

export function detectarParadas(posicoes: Posicao[]): ResultadoParadas {
  const ps = posicoes.filter(p => p.valida).sort((a, b) => a.em.getTime() - b.em.getTime());
  const movendo = ps.filter(p => p.kmh >= PARADA.velMaxKmh);

  const brutas: Parada[] = [];
  let grupo: Posicao[] = [];
  const fechar = (fim: Date) => {
    if (!grupo.length) return;
    const inicio = grupo[0].em;
    brutas.push({
      lat: grupo.reduce((s, p) => s + p.lat, 0) / grupo.length,
      lon: grupo.reduce((s, p) => s + p.lon, 0) / grupo.length,
      inicio, fim, min: minutos(inicio, fim),
    });
    grupo = [];
  };
  for (const p of ps) {
    if (p.kmh < PARADA.velMaxKmh) grupo.push(p);
    else fechar(p.em);
  }
  if (grupo.length) fechar(grupo[grupo.length - 1].em);

  const fundidas: Parada[] = [];
  for (const p of brutas) {
    const ant = fundidas[fundidas.length - 1];
    if (ant && minutos(ant.fim, p.inicio) < PARADA.fundirGapMin
        && distM(ant.lat, ant.lon, p.lat, p.lon) < PARADA.fundirDistM) {
      ant.lat = (ant.lat + p.lat) / 2;
      ant.lon = (ant.lon + p.lon) / 2;
      ant.fim = p.fim;
      ant.min = minutos(ant.inicio, ant.fim);
    } else {
      fundidas.push({ ...p });
    }
  }

  return {
    paradas: fundidas.filter(p => p.min >= PARADA.minDuracaoMin),
    primeiroMovimento: movendo[0]?.em ?? null,
    ultimoMovimento: movendo[movendo.length - 1]?.em ?? null,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run server/services/entregas/detectarParadas.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add server/services/entregas/detectarParadas.ts server/services/entregas/detectarParadas.test.ts
git commit -m "feat(entregas): detecção de paradas a partir das posições do GPS" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `cruzar` (linhas por dia, status e KPIs)

**Files:**
- Create: `server/services/entregas/cruzar.ts`
- Test: `server/services/entregas/cruzar.test.ts`

**Interfaces:**
- Consumes: `Entrega` (Task 2); `Parada`, `distM` (Task 3).
- Produces:

```ts
export const LIMITES: { raioM: 300; relampagoMin: 3; paradaSemClienteMin: 10; saidaAte: "08:00"; apos14h: "14:00"; apos14hMinPct: 25; relampagoMaxPct: 10 };
export type Status = "no_raio" | "relampago" | "sem_parada" | "sem_coordenada";
export interface LinhaDia { data: string; placa: string; motorista: string; routeId: string; janela: { inicio: Date; fim: Date }; fechaRota: boolean }
export interface GpsLinha { erro: string | null; paradas: Parada[]; primeiroMovimento: Date | null; ultimoMovimento: Date | null; kmGps: number | null }
export interface EntregaCruzada { entrega: Entrega; status: Status; permanenciaMin: number; distMaisProximaM: number | null }
export interface ResultadoLinha {
  linha: LinhaDia; semGps: string | null;
  saida: Date | null; retorno: Date | null;
  entregasDia: number; totalRota: number; apos14h: number;
  baixasComCoord: number; noRaio: number; relampago: number; semParada: number;
  paradasSemCliente: { qtd: number; min: number };
  kmGps: number | null; pendentes: number | null; kmInformado: number | null;
  excecoes: EntregaCruzada[];
}
export function diaBRT(d: Date): string;     // "aaaa-mm-dd"
export function horaBRT(d: Date): string;    // "hh:mm"
export function agruparPorRota(entregas: Entrega[]): Map<string, Entrega[]>;
export function montarLinhas(entregas: Entrega[], agora: Date): LinhaDia[];
export function cruzar(linha: LinhaDia, entregasRota: Entrega[], gps: GpsLinha): ResultadoLinha;
```

- [ ] **Step 1: Escrever os testes que falham**

Crie `server/services/entregas/cruzar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cruzar, montarLinhas, type GpsLinha, type LinhaDia } from "./cruzar";
import type { Entrega } from "./parseCheckNow";
import type { Parada } from "./detectarParadas";

const brt = (s: string) => new Date(`${s}:00-03:00`); // "2026-10-05T10:00"

const entrega = (o: Partial<Entrega> = {}): Entrega => ({
  routeId: "R1", placa: "SOO-8D21", motorista: "ANTONIO",
  codCliente: "1", cliente: "C1", lat: -7, lon: -43,
  situacao: "ENTREGUE", baixaEm: brt("2026-10-05T10:00"),
  rotaInicio: brt("2026-10-05T07:00"), rotaFim: null,
  odoIniInformado: null, odoFimInformado: null, ...o,
});

const parada = (lat: number, lon: number, inicio: string, min: number): Parada =>
  ({ lat, lon, inicio: brt(inicio), fim: new Date(brt(inicio).getTime() + min * 60000), min });

const gps = (paradas: Parada[], o: Partial<GpsLinha> = {}): GpsLinha => ({
  erro: null, paradas, kmGps: 120,
  primeiroMovimento: brt("2026-10-05T07:30"), ultimoMovimento: brt("2026-10-05T18:00"), ...o,
});

const linha = (o: Partial<LinhaDia> = {}): LinhaDia => ({
  data: "2026-10-05", placa: "SOO-8D21", motorista: "ANTONIO", routeId: "R1",
  janela: { inicio: brt("2026-10-05T07:00"), fim: brt("2026-10-05T23:59") }, fechaRota: false, ...o,
});

const CINQUENTA_M = -7 + 0.00045; // ≈ 50 m ao norte do cliente (-7, -43)
const UM_KM = -7 + 0.009;         // ≈ 1000 m
const LONGE = -6.9;               // ≈ 11 km

describe("montarLinhas", () => {
  it("uma linha por dia da rota e janelas separadas na troca de motorista", () => {
    const r1 = { routeId: "R1", motorista: "ANTONIO", rotaInicio: brt("2026-10-02T07:21"), rotaFim: brt("2026-10-05T06:51") };
    const r2 = { routeId: "R2", motorista: "FRANCISCO", rotaInicio: brt("2026-10-05T06:52"), rotaFim: null };
    const linhas = montarLinhas([
      entrega({ ...r1, codCliente: "1", baixaEm: brt("2026-10-02T10:00") }),
      entrega({ ...r1, codCliente: "2", baixaEm: brt("2026-10-03T10:00") }),
      entrega({ ...r2, codCliente: "3", baixaEm: brt("2026-10-05T10:00") }),
    ], brt("2026-10-05T18:00"));

    const r1Linhas = linhas.filter(l => l.routeId === "R1");
    expect(r1Linhas.map(l => l.data)).toEqual(["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(r1Linhas[0].janela.inicio.toISOString()).toBe("2026-10-02T10:21:00.000Z");
    const r1Dia5 = r1Linhas[3];
    expect(r1Dia5.janela.inicio.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(r1Dia5.janela.fim.toISOString()).toBe("2026-10-05T09:51:00.000Z");
    expect(r1Dia5.fechaRota).toBe(true);

    const [r2Dia5] = linhas.filter(l => l.routeId === "R2");
    expect(r2Dia5.janela.inicio.toISOString()).toBe("2026-10-05T09:52:00.000Z");
    expect(r2Dia5.janela.fim.toISOString()).toBe("2026-10-05T21:00:00.000Z"); // agora
    expect(r2Dia5.fechaRota).toBe(false);
  });

  it("rota não iniciada não gera linha", () => {
    expect(montarLinhas([entrega({ rotaInicio: null, baixaEm: null, situacao: "AGUARDANDO" })], new Date())).toEqual([]);
  });
});

describe("cruzar", () => {
  it("no_raio: parada de 5 min a 50 m", () => {
    const r = cruzar(linha(), [entrega()], gps([parada(CINQUENTA_M, -43, "2026-10-05T09:55", 5)]));
    expect(r).toMatchObject({ noRaio: 1, relampago: 0, semParada: 0, baixasComCoord: 1, excecoes: [] });
  });

  it("relampago: parada de 2 min no raio vira exceção", () => {
    const r = cruzar(linha(), [entrega()], gps([parada(CINQUENTA_M, -43, "2026-10-05T09:55", 2)]));
    expect(r.relampago).toBe(1);
    expect(r.excecoes[0]).toMatchObject({ status: "relampago", permanenciaMin: 2 });
  });

  it("soma as paradas no raio para a permanência", () => {
    const r = cruzar(linha(), [entrega()], gps([
      parada(CINQUENTA_M, -43, "2026-10-05T09:50", 2),
      parada(-7, -43, "2026-10-05T10:05", 2),
    ]));
    expect(r.noRaio).toBe(1);
  });

  it("sem_parada: guarda a distância da parada mais próxima", () => {
    const r = cruzar(linha(), [entrega()], gps([parada(UM_KM, -43, "2026-10-05T10:00", 10)]));
    expect(r.semParada).toBe(1);
    expect(r.excecoes[0].status).toBe("sem_parada");
    expect(r.excecoes[0].distMaisProximaM).toBeGreaterThan(990);
    expect(r.excecoes[0].distMaisProximaM).toBeLessThan(1010);
  });

  it("sem_coordenada: exceção fora dos percentuais", () => {
    const r = cruzar(linha(), [entrega({ lat: null, lon: null })], gps([]));
    expect(r.baixasComCoord).toBe(0);
    expect(r.excecoes[0]).toMatchObject({ status: "sem_coordenada", distMaisProximaM: null });
  });

  it("clientes vizinhos podem ser atendidos pela mesma parada", () => {
    const r = cruzar(linha(), [entrega(), entrega({ codCliente: "2", lat: -7.0009 })],
      gps([parada(-7.00045, -43, "2026-10-05T09:55", 5)]));
    expect(r.noRaio).toBe(2);
  });

  it("ignora baixas de outro dia e conta entregas do dia sobre o total da rota", () => {
    const r = cruzar(linha(), [entrega(), entrega({ codCliente: "2", baixaEm: brt("2026-10-04T10:00") }),
      entrega({ codCliente: "3", situacao: "AGUARDANDO", baixaEm: null })], gps([]));
    expect(r.entregasDia).toBe(1);
    expect(r.totalRota).toBe(3);
  });

  // Review Focus 5
  it("após 14h conta só ENTREGUE e inclui 14:00 exato", () => {
    const r = cruzar(linha(), [
      entrega({ codCliente: "1", baixaEm: brt("2026-10-05T10:00") }),
      entrega({ codCliente: "2", baixaEm: brt("2026-10-05T14:00") }),
      entrega({ codCliente: "3", baixaEm: brt("2026-10-05T15:30") }),
      entrega({ codCliente: "4", baixaEm: brt("2026-10-05T16:00"), situacao: "PROBLEMA" }),
    ], gps([]));
    expect(r.entregasDia).toBe(3);
    expect(r.apos14h).toBe(2);
  });

  it("linha sem GPS: só KPIs do CheckNow, sem exceções", () => {
    const r = cruzar(linha(), [entrega()], gps([], { erro: "sem rastreador" }));
    expect(r).toMatchObject({ semGps: "sem rastreador", entregasDia: 1, noRaio: 0, saida: null, kmGps: null, excecoes: [] });
  });

  it("paradas sem cliente: só ≥ 10 min, entre saída e retorno, longe de todo cliente", () => {
    const r = cruzar(linha(), [entrega()], gps([
      parada(LONGE, -43, "2026-10-05T00:00", 450),     // pernoite (antes da saída)
      parada(LONGE, -43, "2026-10-05T12:00", 60),      // almoço → conta
      parada(LONGE, -43, "2026-10-05T15:00", 5),       // curta
      parada(CINQUENTA_M, -43, "2026-10-05T13:30", 30), // no cliente
      parada(LONGE, -43, "2026-10-05T18:00", 300),     // depois do retorno
    ]));
    expect(r.paradasSemCliente).toEqual({ qtd: 1, min: 60 });
  });

  // Review Focus 4
  it("caminhão parado o dia todo: saída/retorno null e nenhuma parada sem cliente", () => {
    const r = cruzar(linha(), [entrega()],
      gps([parada(-7, -43, "2026-10-05T00:00", 1439)], { primeiroMovimento: null, ultimoMovimento: null }));
    expect(r.saida).toBeNull();
    expect(r.retorno).toBeNull();
    expect(r.paradasSemCliente.qtd).toBe(0);
    expect(r.noRaio).toBe(1);
  });

  it("pendentes e km informado só no dia em que a rota fecha", () => {
    const es = [entrega({ odoIniInformado: 1000, odoFimInformado: 1334 }),
      entrega({ codCliente: "2", situacao: "AGUARDANDO", baixaEm: null })];
    expect(cruzar(linha({ fechaRota: true }), es, gps([]))).toMatchObject({ pendentes: 1, kmInformado: 334 });
    expect(cruzar(linha(), es, gps([]))).toMatchObject({ pendentes: null, kmInformado: null });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run server/services/entregas/cruzar.test.ts`
Expected: FAIL com `Failed to resolve import "./cruzar"`.

- [ ] **Step 3: Implementar**

Crie `server/services/entregas/cruzar.ts`:

```ts
/*
 * MetricFlow — cruzamento CheckNow × GPS.
 * Linha do relatório = placa · motorista · dia; a janela de GPS é o dia
 * recortado pelo início/fim realizados da rota (separa troca de motorista).
 */
import type { Entrega } from "./parseCheckNow";
import { distM, type Parada } from "./detectarParadas";

// Único lugar dos limites (v1: constantes; v2: configService).
export const LIMITES = {
  raioM: 300,
  relampagoMin: 3,
  paradaSemClienteMin: 10,
  saidaAte: "08:00",
  apos14h: "14:00",
  apos14hMinPct: 25,
  relampagoMaxPct: 10,
} as const;

export type Status = "no_raio" | "relampago" | "sem_parada" | "sem_coordenada";

export interface LinhaDia {
  data: string; // "aaaa-mm-dd" (BRT)
  placa: string;
  motorista: string;
  routeId: string;
  janela: { inicio: Date; fim: Date };
  fechaRota: boolean;
}

export interface GpsLinha {
  erro: string | null; // "sem rastreador" | "sem sinal GPS" | "falha no Infleet: ..."
  paradas: Parada[];
  primeiroMovimento: Date | null;
  ultimoMovimento: Date | null;
  kmGps: number | null;
}

export interface EntregaCruzada {
  entrega: Entrega;
  status: Status;
  permanenciaMin: number;
  distMaisProximaM: number | null;
}

export interface ResultadoLinha {
  linha: LinhaDia;
  semGps: string | null;
  saida: Date | null;
  retorno: Date | null;
  entregasDia: number;
  totalRota: number;
  apos14h: number;
  baixasComCoord: number;
  noRaio: number;
  relampago: number;
  semParada: number;
  paradasSemCliente: { qtd: number; min: number };
  kmGps: number | null;
  pendentes: number | null;
  kmInformado: number | null;
  excecoes: EntregaCruzada[];
}

const H3 = 3 * 3600000;
const DIA = 24 * 3600000;
export const diaBRT = (d: Date) => new Date(d.getTime() - H3).toISOString().slice(0, 10);
export const horaBRT = (d: Date) => new Date(d.getTime() - H3).toISOString().slice(11, 16);
const inicioDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);
const fimDia = (dia: string) => new Date(`${dia}T23:59:59-03:00`);

type ComCoord = Entrega & { lat: number; lon: number };
const temCoord = (e: Entrega): e is ComCoord => e.lat !== null && e.lon !== null;

export function agruparPorRota(entregas: Entrega[]): Map<string, Entrega[]> {
  const m = new Map<string, Entrega[]>();
  for (const e of entregas) m.set(e.routeId, [...(m.get(e.routeId) ?? []), e]);
  return m;
}

export function montarLinhas(entregas: Entrega[], agora: Date): LinhaDia[] {
  const linhas: LinhaDia[] = [];
  for (const [routeId, es] of agruparPorRota(entregas)) {
    const baixas = es.map(e => e.baixaEm?.getTime()).filter((t): t is number => t !== undefined);
    const inicio = es[0].rotaInicio ?? (baixas.length ? new Date(Math.min(...baixas)) : null);
    if (!inicio) continue; // rota não iniciada
    const fimRota = es[0].rotaFim;
    const ultimo = fimRota ?? (baixas.length ? new Date(Math.max(...baixas)) : inicio);
    const fimJanela = fimRota ?? agora;

    for (let dia = diaBRT(inicio); dia <= diaBRT(ultimo); dia = diaBRT(new Date(inicioDia(dia).getTime() + DIA))) {
      linhas.push({
        data: dia,
        placa: es[0].placa,
        motorista: es[0].motorista,
        routeId,
        janela: {
          inicio: new Date(Math.max(inicioDia(dia).getTime(), inicio.getTime())),
          fim: new Date(Math.min(fimDia(dia).getTime(), fimJanela.getTime())),
        },
        fechaRota: fimRota !== null && dia === diaBRT(fimRota),
      });
    }
  }
  return linhas;
}

function kmInformado(e: Entrega): number | null {
  return e.odoIniInformado !== null && e.odoFimInformado !== null ? e.odoFimInformado - e.odoIniInformado : null;
}

export function cruzar(linha: LinhaDia, entregasRota: Entrega[], gps: GpsLinha): ResultadoLinha {
  const baixasDia = entregasRota.filter(e =>
    e.situacao !== "AGUARDANDO" && e.baixaEm !== null && diaBRT(e.baixaEm) === linha.data);
  const entregues = baixasDia.filter(e => e.situacao === "ENTREGUE");

  const r: ResultadoLinha = {
    linha,
    semGps: gps.erro,
    saida: null,
    retorno: null,
    entregasDia: entregues.length,
    totalRota: entregasRota.length,
    apos14h: entregues.filter(e => horaBRT(e.baixaEm!) >= LIMITES.apos14h).length,
    baixasComCoord: 0,
    noRaio: 0,
    relampago: 0,
    semParada: 0,
    paradasSemCliente: { qtd: 0, min: 0 },
    kmGps: null,
    pendentes: linha.fechaRota ? entregasRota.filter(e => e.situacao === "AGUARDANDO").length : null,
    kmInformado: linha.fechaRota ? kmInformado(entregasRota[0]) : null,
    excecoes: [],
  };
  if (gps.erro) return r;

  r.saida = gps.primeiroMovimento;
  r.retorno = gps.ultimoMovimento;
  r.kmGps = gps.kmGps;

  for (const e of baixasDia) {
    if (!temCoord(e)) {
      r.excecoes.push({ entrega: e, status: "sem_coordenada", permanenciaMin: 0, distMaisProximaM: null });
      continue;
    }
    r.baixasComCoord++;
    const dists = gps.paradas.map(p => distM(p.lat, p.lon, e.lat, e.lon));
    const perm = gps.paradas.reduce((s, p, i) => (dists[i] <= LIMITES.raioM ? s + p.min : s), 0);
    const status: Status = perm >= LIMITES.relampagoMin ? "no_raio" : perm > 0 ? "relampago" : "sem_parada";
    if (status === "no_raio") { r.noRaio++; continue; }
    if (status === "relampago") r.relampago++;
    else r.semParada++;
    r.excecoes.push({ entrega: e, status, permanenciaMin: perm, distMaisProximaM: dists.length ? Math.min(...dists) : null });
  }

  const clientes = entregasRota.filter(temCoord);
  const { saida, retorno } = r;
  if (saida && retorno) {
    for (const p of gps.paradas) {
      if (p.min < LIMITES.paradaSemClienteMin || p.inicio <= saida || p.inicio >= retorno) continue;
      if (clientes.some(c => distM(p.lat, p.lon, c.lat, c.lon) <= LIMITES.raioM)) continue;
      r.paradasSemCliente.qtd++;
      r.paradasSemCliente.min += p.min;
    }
  }
  return r;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run server/services/entregas/cruzar.test.ts`
Expected: PASS (14 testes).

- [ ] **Step 5: Commit**

```bash
git add server/services/entregas/cruzar.ts server/services/entregas/cruzar.test.ts
git commit -m "feat(entregas): cruzamento das baixas com as paradas do GPS" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Adaptador do Infleet (`infleetEntregas`)

**Files:**
- Create: `server/services/entregas/infleetEntregas.ts`
- Test: `server/services/entregas/infleetEntregas.test.ts`

**Interfaces:**
- Consumes: `infleetQuery` (Task 1); `detectarParadas`, `Posicao` (Task 3); `GpsLinha` (Task 4); o valor de `SPEED_PARA_KMH` registrado na spec §2 (Task 1).
- Produces:

```ts
export const SPEED_PARA_KMH: number;
export function normalizarPlaca(p: string): string;
export function mapaVeiculos(): Promise<Map<string, string>>;           // placa normalizada → vehicleId
export function blocos(inicio: Date, fim: Date): { startAt: string; endAt: string }[];
export function gpsErro(erro: string): GpsLinha;
export function buscarGpsLinha(vehicleId: string, janela: { inicio: Date; fim: Date }): Promise<GpsLinha>; // nunca lança
```

- [ ] **Step 1: Escrever os testes que falham**

Crie `server/services/entregas/infleetEntregas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("../../routers/infleetRouter", () => ({ infleetQuery: vi.fn() }));
import { infleetQuery } from "../../routers/infleetRouter";
import { blocos, buscarGpsLinha, mapaVeiculos, normalizarPlaca, SPEED_PARA_KMH } from "./infleetEntregas";

const q = infleetQuery as Mock;
const T0 = new Date("2026-10-05T07:00:00-03:00");
const em = (min: number) => new Date(T0.getTime() + min * 60000).toISOString();
const janela = { inicio: T0, fim: new Date(T0.getTime() + 2 * 3600000) };
const p = (min: number, speed: number) => ({ latitude: -7, longitude: -43, fixTime: em(min), speed, valid: true });

beforeEach(() => q.mockReset());

describe("normalizarPlaca", () => {
  // Review Focus 3
  it("ignora caixa, hífen e espaços", () => {
    expect(normalizarPlaca("SOL-6B13")).toBe("SOL6B13");
    expect(normalizarPlaca(" sol 6b13 ")).toBe("SOL6B13");
  });
});

describe("mapaVeiculos", () => {
  it("indexa por placa normalizada", async () => {
    q.mockResolvedValue({ listVehicles: [{ id: "v1", plate: "SOL6B13" }] });
    expect((await mapaVeiculos()).get(normalizarPlaca("SOL-6B13"))).toBe("v1");
  });
});

describe("blocos", () => {
  it("divide a janela em blocos de 6 h", () => {
    const b = blocos(new Date("2026-10-05T07:00:00-03:00"), new Date("2026-10-05T23:59:59-03:00"));
    expect(b).toHaveLength(3);
    expect(b[0]).toEqual({ startAt: "2026-10-05T10:00:00.000Z", endAt: "2026-10-05T16:00:00.000Z" });
    expect(b[2].endAt).toBe("2026-10-06T02:59:59.000Z");
  });
});

describe("buscarGpsLinha", () => {
  it("converte posições, detecta paradas e lê o km", async () => {
    q.mockImplementation(async (query: string) =>
      query.includes("routeVehicleDetails")
        ? { routeVehicleDetails: { totalDistanceTraveled: 123456 } }
        : { listVehiclePositions: [p(0, 40 / SPEED_PARA_KMH), p(1, 0), p(10, 0), p(11, 40 / SPEED_PARA_KMH)] });
    const r = await buscarGpsLinha("v1", janela);
    expect(r.erro).toBeNull();
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].min).toBe(10);
    expect(r.kmGps).toBe(123.5);
  });

  it("sem posições → 'sem sinal GPS'", async () => {
    q.mockResolvedValue({ listVehiclePositions: [] });
    expect((await buscarGpsLinha("v1", janela)).erro).toBe("sem sinal GPS");
  });

  it("erro do Infleet não lança: vira GpsLinha com erro", async () => {
    q.mockRejectedValue(new Error("Infleet API HTTP 502"));
    expect((await buscarGpsLinha("v1", janela)).erro).toBe("falha no Infleet: Infleet API HTTP 502");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run server/services/entregas/infleetEntregas.test.ts`
Expected: FAIL com `Failed to resolve import "./infleetEntregas"`.

- [ ] **Step 3: Implementar**

Crie `server/services/entregas/infleetEntregas.ts`. Em `SPEED_PARA_KMH`, use o valor registrado na spec §2 na Task 1 (`1` ou `1.852`):

```ts
/*
 * MetricFlow — busca do GPS no Infleet para uma linha do relatório de entregas.
 * Posições sempre em blocos de 6 h (limite de listVehiclePositions não documentado).
 * buscarGpsLinha nunca lança: falhas viram GpsLinha.erro e a linha sai "sem GPS".
 */
import { infleetQuery } from "../../routers/infleetRouter";
import { detectarParadas, type Posicao } from "./detectarParadas";
import type { GpsLinha } from "./cruzar";

/** Fator do `speed` do Infleet para km/h — medido na sonda (spec §2). */
export const SPEED_PARA_KMH = 1;
const BLOCO_MS = 6 * 3600000;

export const normalizarPlaca = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function mapaVeiculos(): Promise<Map<string, string>> {
  const { listVehicles } = await infleetQuery<{ listVehicles: { id: string; plate: string }[] }>(
    `query { listVehicles { id plate } }`, {});
  return new Map(listVehicles.map(v => [normalizarPlaca(v.plate), v.id]));
}

export function blocos(inicio: Date, fim: Date): { startAt: string; endAt: string }[] {
  const out: { startAt: string; endAt: string }[] = [];
  for (let t = inicio.getTime(); t < fim.getTime(); t += BLOCO_MS) {
    out.push({ startAt: new Date(t).toISOString(), endAt: new Date(Math.min(t + BLOCO_MS, fim.getTime())).toISOString() });
  }
  return out;
}

export const gpsErro = (erro: string): GpsLinha =>
  ({ erro, paradas: [], primeiroMovimento: null, ultimoMovimento: null, kmGps: null });

const Q_POSICOES = `query($filter: ListVehiclePositionsFilterInput!) {
  listVehiclePositions(filter: $filter) { latitude longitude fixTime speed valid }
}`;
const Q_KM = `query($filter: ListVehiclePositionsFilterInput!) {
  routeVehicleDetails(filter: $filter) { totalDistanceTraveled }
}`;

type PosicaoInfleet = { latitude: number; longitude: number; fixTime: string; speed: number; valid: boolean };

export async function buscarGpsLinha(vehicleId: string, janela: { inicio: Date; fim: Date }): Promise<GpsLinha> {
  try {
    const posicoes: Posicao[] = [];
    for (const fixTime of blocos(janela.inicio, janela.fim)) {
      const r = await infleetQuery<{ listVehiclePositions: PosicaoInfleet[] }>(Q_POSICOES, { filter: { vehicleId, fixTime } });
      for (const p of r.listVehiclePositions) {
        posicoes.push({ lat: p.latitude, lon: p.longitude, em: new Date(p.fixTime), kmh: p.speed * SPEED_PARA_KMH, valida: p.valid });
      }
    }
    if (!posicoes.length) return gpsErro("sem sinal GPS");

    const km = await infleetQuery<{ routeVehicleDetails: { totalDistanceTraveled: number } | null }>(Q_KM, {
      filter: { vehicleId, fixTime: { startAt: janela.inicio.toISOString(), endAt: janela.fim.toISOString() } },
    });
    const raw = km.routeVehicleDetails?.totalDistanceTraveled ?? null;
    // Mesma conversão de unidade do resumoDiario (infleetRouter.ts).
    const kmGps = raw === null ? null : Math.round((raw > 1000 ? raw / 1000 : raw) * 10) / 10;

    return { erro: null, ...detectarParadas(posicoes), kmGps };
  } catch (e) {
    return gpsErro(`falha no Infleet: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run server/services/entregas/infleetEntregas.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add server/services/entregas/infleetEntregas.ts server/services/entregas/infleetEntregas.test.ts
git commit -m "feat(entregas): adaptador do Infleet (posições, km, placa)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: PDF do relatório de entregas

**Files:**
- Modify: `server/services/pdfService.tsx` (linhas 97, 99, 154, 359, 377, 385, 390, 435: só acrescentar `export`)
- Create: `server/services/pdfEntregas.tsx`
- Test: `server/services/pdfEntregas.test.ts`

**Interfaces:**
- Consumes: `LIMITES`, `horaBRT`, `ResultadoLinha`, `Status` (Task 4); de `pdfService.tsx`: `s`, `FooterBar`, `VERDE_TITULO`, `VERMELHO`, `fmtDate`, `fmtPct`, `stripHtml`, `renderAnalise`.
- Produces:

```ts
export interface PDFEntregasData { data: string; linhas: ResultadoLinha[]; analise: string; avisos: string[] }
export function gerarPDFEntregas(d: PDFEntregasData): Promise<Buffer>;
```

- [ ] **Step 1: Escrever os testes que falham**

Crie `server/services/pdfEntregas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gerarPDFEntregas } from "./pdfEntregas";
import type { ResultadoLinha } from "./entregas/cruzar";
import type { Entrega } from "./entregas/parseCheckNow";

const brt = (s: string) => new Date(`${s}:00-03:00`);
const entrega: Entrega = {
  routeId: "R1", placa: "SOL-6B13", motorista: "ANTONIO", codCliente: "160089", cliente: "CLIENTE A",
  lat: -7, lon: -43, situacao: "ENTREGUE", baixaEm: brt("2026-10-05T09:28"),
  rotaInicio: brt("2026-10-05T07:00"), rotaFim: null, odoIniInformado: null, odoFimInformado: null,
};
const base: ResultadoLinha = {
  linha: { data: "2026-10-05", placa: "SOL-6B13", motorista: "ANTONIO", routeId: "R1",
    janela: { inicio: brt("2026-10-05T07:00"), fim: brt("2026-10-05T23:59") }, fechaRota: false },
  semGps: null, saida: brt("2026-10-05T08:44"), retorno: brt("2026-10-05T17:10"),
  entregasDia: 33, totalRota: 60, apos14h: 10, baixasComCoord: 35, noRaio: 30, relampago: 2, semParada: 3,
  paradasSemCliente: { qtd: 2, min: 75 }, kmGps: 210.4, pendentes: null, kmInformado: null,
  excecoes: [{ entrega, status: "sem_parada", permanenciaMin: 0, distMaisProximaM: 774.4 }],
};
const semGps: ResultadoLinha = {
  ...base, linha: { ...base.linha, placa: "SOO-8D81", motorista: "ISRAEL" }, semGps: "sem rastreador",
  saida: null, retorno: null, baixasComCoord: 0, noRaio: 0, relampago: 0, semParada: 0,
  paradasSemCliente: { qtd: 0, min: 0 }, kmGps: null, pendentes: 4, kmInformado: 334, excecoes: [],
};
const ehPdf = (b: Buffer) => b.subarray(0, 4).toString() === "%PDF";

describe("gerarPDFEntregas", () => {
  it("gera PDF com linha com GPS, linha sem GPS, exceção, análise e avisos", async () => {
    const b = await gerarPDFEntregas({ data: "2026-10-05", linhas: [base, semGps], analise: "<p>Ok</p>", avisos: ["SOO-8D81 · ISRAEL: sem rastreador"] });
    expect(ehPdf(b)).toBe(true);
  });

  // Review Focus 5
  it("gera PDF sem nenhuma linha (denominadores zero)", async () => {
    const b = await gerarPDFEntregas({ data: "2026-10-05", linhas: [], analise: "", avisos: [] });
    expect(ehPdf(b)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run server/services/pdfEntregas.test.ts`
Expected: FAIL com `Failed to resolve import "./pdfEntregas"`.

- [ ] **Step 3: Exportar estilos e helpers do `pdfService.tsx`**

Em `server/services/pdfService.tsx`, só acrescente `export ` no início destas linhas, sem mudar mais nada:

| Linha | Antes | Depois |
|---|---|---|
| 97 | `const VERDE_TITULO = "#205527";` | `export const VERDE_TITULO = "#205527";` |
| 99 | `const VERMELHO = "#CC2200";` | `export const VERMELHO = "#CC2200";` |
| 154 | `const s = StyleSheet.create({` | `export const s = StyleSheet.create({` |
| 359 | `function stripHtml(html: string): string {` | `export function stripHtml(html: string): string {` |
| 377 | `function renderAnalise(text: string): React.ReactNode {` | `export function renderAnalise(text: string): React.ReactNode {` |
| 385 | `function fmtDate(iso: string): string {` | `export function fmtDate(iso: string): string {` |
| 390 | `function fmtPct(v: number, decimals = 0): string {` | `export function fmtPct(v: number, decimals = 0): string {` |
| 435 | `const FooterBar = ({ data, revenda }: { data: string; revenda: string }) => (` | `export const FooterBar = ({ data, revenda }: { data: string; revenda: string }) => (` |

- [ ] **Step 4: Implementar o PDF**

Crie `server/services/pdfEntregas.tsx`:

```tsx
/**
 * MetricFlow — Relatório Gerencial de Entregas (PDF, A4 paisagem)
 *   - Página 1: uma linha por placa · motorista · dia + linha Geral + análise + avisos
 *   - Página 2: exceções (baixas que o GPS não confirma)
 * Mesmo visual do relatório de vendas: estilos importados de pdfService.
 */
import React from "react";
import { Document, Page, Text, View, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { s, FooterBar, VERDE_TITULO, VERMELHO, fmtDate, fmtPct, stripHtml, renderAnalise } from "./pdfService";
import { LIMITES, horaBRT, type ResultadoLinha, type Status } from "./entregas/cruzar";

export interface PDFEntregasData {
  data: string; // "aaaa-mm-dd"
  linhas: ResultadoLinha[];
  analise: string; // texto ou HTML
  avisos: string[];
}

// Larguras — A4 paisagem (842pt − 2×28 de padding ≈ 786pt)
const C = { placa: 130, saida: 45, retorno: 45, entregas: 55, tarde: 75, raio: 75, semParada: 55, relamp: 75, semCliente: 80, km: 45, pend: 80 } as const;
const CE = { placa: 150, cliente: 220, cod: 60, baixa: 50, status: 100, dist: 80, perm: 70 } as const;

const LEGENDA = [
  { desc: `Entregas confirmadas por parada do GPS a até ${LIMITES.raioM}m do cliente` },
  { label: "Saída", desc: `Primeiro movimento do dia (vermelho se > ${LIMITES.saidaAte})` },
  { label: "Retorno", desc: "Último movimento do dia" },
  { label: "Entregas", desc: "Entregues no dia / total de clientes da rota" },
  { label: "Após às 14h", desc: `% das entregas do dia com baixa após as 14h (vermelho se < ${LIMITES.apos14hMinPct}%)` },
  { label: "No raio", desc: `Baixas com parada ≥ ${LIMITES.relampagoMin} min no raio / baixas do dia (vermelho se < 100%)` },
  { label: "Sem parada", desc: "Baixas sem nenhuma parada do GPS no raio (vermelho se > 0)" },
  { label: "Relâmpago", desc: `% de paradas no raio com menos de ${LIMITES.relampagoMin} min (vermelho se > ${LIMITES.relampagoMaxPct}%)` },
  { label: "Paradas s/ cliente", desc: `Paradas ≥ ${LIMITES.paradaSemClienteMin} min longe de todo cliente, entre a saída e o retorno` },
  { label: "Pendentes · Km inf.", desc: "Clientes não atendidos e km do odômetro informado — só no dia em que a rota fecha" },
];

const STATUS_LABEL: Record<Status, string> = {
  no_raio: "No raio", relampago: "Relâmpago", sem_parada: "Baixa sem parada", sem_coordenada: "Sem coordenada",
};

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const hora = (d: Date | null) => (d ? horaBRT(d) : "—");
function minParaHM(min: number): string {
  const t = Math.round(min);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const PaginaLinhas = ({ d }: { d: PDFEntregasData }) => {
  const ls = d.linhas;
  const gpsOk = ls.filter(r => !r.semGps);
  const soma = (rs: ResultadoLinha[], f: (r: ResultadoLinha) => number) => rs.reduce((a, r) => a + f(r), 0);
  const g = {
    entregas: soma(ls, r => r.entregasDia),
    apos: soma(ls, r => r.apos14h),
    raio: soma(gpsOk, r => r.noRaio),
    baixas: soma(gpsOk, r => r.baixasComCoord),
    semParada: soma(gpsOk, r => r.semParada),
    relamp: soma(gpsOk, r => r.relampago),
    semCliQtd: soma(gpsOk, r => r.paradasSemCliente.qtd),
    semCliMin: soma(gpsOk, r => r.paradasSemCliente.min),
    km: soma(gpsOk, r => r.kmGps ?? 0),
    pend: soma(ls, r => r.pendentes ?? 0),
  };
  const analise = stripHtml(d.analise);

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.pageHeader}>
        <Text style={s.pageHeaderTitle}>Relatório Gerencial de Entregas</Text>
        <Text style={s.pageHeaderMeta}>Data: {fmtDate(d.data)} · Raio: {LIMITES.raioM}m · Fonte: CheckNow × GPS Infleet</Text>
      </View>

      <View style={s.content}>
        <Text style={s.sectionTitle}>Legenda</Text>
        {LEGENDA.map((item, i) => (
          <View key={i} style={s.legendRow}>
            <Text style={s.legendLabel}>{item.label}</Text>
            <Text style={s.legendDesc}>{item.desc}</Text>
          </View>
        ))}

        <Text style={s.sectionTitle}>Detalhamento por Placa / Motorista</Text>
        {ls.length > 0 ? (
          <View>
            <View style={s.tblHeaderRow}>
              <Text style={[s.th, { width: C.placa, textAlign: "left" }]}>Placa · Motorista</Text>
              <Text style={[s.th, { width: C.saida }]}>Saída</Text>
              <Text style={[s.th, { width: C.retorno }]}>Retorno</Text>
              <Text style={[s.th, { width: C.entregas }]}>Entregas</Text>
              <Text style={[s.th, { width: C.tarde }]}>Após às 14h</Text>
              <Text style={[s.th, { width: C.raio }]}>No raio</Text>
              <Text style={[s.th, { width: C.semParada }]}>Sem parada</Text>
              <Text style={[s.th, { width: C.relamp }]}>Relâmpago</Text>
              <Text style={[s.th, { width: C.semCliente }]}>Paradas s/ cliente</Text>
              <Text style={[s.th, { width: C.km }]}>Km GPS</Text>
              <Text style={[s.th, { width: C.pend }]}>Pendentes · Km inf.</Text>
            </View>

            {ls.map((r, i) => {
              const gps = !r.semGps;
              const pTarde = pct(r.apos14h, r.entregasDia);
              const pRaio = pct(r.noRaio, r.baixasComCoord);
              const relBase = r.noRaio + r.relampago;
              const pRel = pct(r.relampago, relBase);
              const saidaAlerta = !!r.saida && horaBRT(r.saida) > LIMITES.saidaAte;
              return (
                <View key={i} style={i % 2 === 1 ? s.tblRowAlt : s.tblRow}>
                  <Text style={[s.td, { width: C.placa, textAlign: "left" }]}>{r.linha.placa} · {r.linha.motorista}</Text>
                  <Text style={[saidaAlerta ? s.tdAlert : s.td, { width: C.saida }]}>{gps ? hora(r.saida) : "—"}</Text>
                  <Text style={[s.td, { width: C.retorno }]}>{gps ? hora(r.retorno) : "—"}</Text>
                  <Text style={[s.td, { width: C.entregas }]}>{r.entregasDia}/{r.totalRota}</Text>
                  <Text style={[r.entregasDia > 0 && pTarde < LIMITES.apos14hMinPct ? s.tdAlert : s.td, { width: C.tarde }]}>
                    {fmtPct(pTarde)} ({r.apos14h}/{r.entregasDia})
                  </Text>
                  <Text style={[gps && r.baixasComCoord > 0 && pRaio < 100 ? s.tdAlert : s.td, { width: C.raio }]}>
                    {gps ? `${fmtPct(pRaio)} (${r.noRaio}/${r.baixasComCoord})` : "—"}
                  </Text>
                  <Text style={[gps && r.semParada > 0 ? s.tdAlert : s.td, { width: C.semParada }]}>{gps ? String(r.semParada) : "—"}</Text>
                  <Text style={[gps && pRel > LIMITES.relampagoMaxPct ? s.tdAlert : s.td, { width: C.relamp }]}>
                    {gps ? `${fmtPct(pRel)} (${r.relampago}/${relBase})` : "—"}
                  </Text>
                  <Text style={[s.td, { width: C.semCliente }]}>
                    {gps ? `${r.paradasSemCliente.qtd} · ${minParaHM(r.paradasSemCliente.min)}` : "—"}
                  </Text>
                  <Text style={[s.td, { width: C.km }]}>{gps && r.kmGps !== null ? r.kmGps.toFixed(0) : "—"}</Text>
                  <Text style={[r.pendentes ? s.tdAlert : s.td, { width: C.pend }]}>
                    {r.pendentes === null ? "—" : `${r.pendentes} · ${r.kmInformado ?? "—"} km`}
                  </Text>
                </View>
              );
            })}

            <View style={s.tblResumoRow}>
              <Text style={[s.tdResumo, { width: C.placa, textAlign: "left" }]}>Geral</Text>
              <Text style={[s.tdResumo, { width: C.saida }]}>—</Text>
              <Text style={[s.tdResumo, { width: C.retorno }]}>—</Text>
              <Text style={[s.tdResumo, { width: C.entregas }]}>{g.entregas}</Text>
              <Text style={[s.tdResumo, { width: C.tarde }]}>{fmtPct(pct(g.apos, g.entregas))} ({g.apos}/{g.entregas})</Text>
              <Text style={[s.tdResumo, { width: C.raio }]}>{fmtPct(pct(g.raio, g.baixas))} ({g.raio}/{g.baixas})</Text>
              <Text style={[s.tdResumo, { width: C.semParada }]}>{g.semParada}</Text>
              <Text style={[s.tdResumo, { width: C.relamp }]}>{fmtPct(pct(g.relamp, g.raio + g.relamp))} ({g.relamp}/{g.raio + g.relamp})</Text>
              <Text style={[s.tdResumo, { width: C.semCliente }]}>{g.semCliQtd} · {minParaHM(g.semCliMin)}</Text>
              <Text style={[s.tdResumo, { width: C.km }]}>{g.km.toFixed(0)}</Text>
              <Text style={[s.tdResumo, { width: C.pend }]}>{g.pend}</Text>
            </View>
          </View>
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>Sem rotas para esta data.</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Análise — Entregas</Text>
        <View style={s.analysisBox}>
          {analise ? renderAnalise(analise) : <Text style={s.analysisEmpty}></Text>}
        </View>

        {d.avisos.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Avisos</Text>
            {d.avisos.map((a, i) => (
              <Text key={i} style={[s.legendDesc, { color: VERMELHO }]}>{a}</Text>
            ))}
          </View>
        )}
      </View>

      <FooterBar data={d.data} revenda="Entregas" />
    </Page>
  );
};

const PaginaExcecoes = ({ d }: { d: PDFEntregasData }) => {
  const itens = d.linhas.flatMap(r => r.excecoes.map(x => ({ r, x })));
  const semParada = itens.filter(i => i.x.status === "sem_parada").length;

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={{ backgroundColor: VERDE_TITULO, paddingHorizontal: 28, paddingVertical: 13 }}>
        <Text style={s.pageHeaderTitle}>Exceções — Baixas não confirmadas pelo GPS</Text>
        <Text style={s.pageHeaderMeta}>Data: {fmtDate(d.data)} · Raio: {LIMITES.raioM}m</Text>
      </View>

      <View style={s.content}>
        <View style={s.summaryRow}>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Total de exceções</Text>
            <Text style={s.summaryValue}>{itens.length}</Text>
          </View>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Baixas sem parada</Text>
            <Text style={s.summaryValue}>{semParada}</Text>
          </View>
        </View>

        {itens.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>Todas as baixas foram confirmadas pelo GPS nesta data.</Text>
          </View>
        ) : (
          <View>
            <View style={s.tblHeaderRow}>
              <Text style={[s.th, { width: CE.placa, textAlign: "left" }]}>Placa · Motorista</Text>
              <Text style={[s.th, { width: CE.cliente, textAlign: "left" }]}>Cliente</Text>
              <Text style={[s.th, { width: CE.cod }]}>Código</Text>
              <Text style={[s.th, { width: CE.baixa }]}>Baixa</Text>
              <Text style={[s.th, { width: CE.status }]}>Status</Text>
              <Text style={[s.th, { width: CE.dist }]}>Parada mais próxima</Text>
              <Text style={[s.th, { width: CE.perm }]}>Permanência</Text>
            </View>
            {itens.map(({ r, x }, i) => (
              <View key={i} style={i % 2 === 1 ? s.tblRowAlt : s.tblRow}>
                <Text style={[s.td, { width: CE.placa, textAlign: "left" }]}>{r.linha.placa} · {r.linha.motorista}</Text>
                <Text style={[s.td, { width: CE.cliente, textAlign: "left" }]}>{x.entrega.cliente}</Text>
                <Text style={[s.td, { width: CE.cod }]}>{x.entrega.codCliente}</Text>
                <Text style={[s.td, { width: CE.baixa }]}>{hora(x.entrega.baixaEm)}</Text>
                <Text style={[s.tdAlert, { width: CE.status }]}>{STATUS_LABEL[x.status]}</Text>
                <Text style={[s.td, { width: CE.dist }]}>
                  {x.distMaisProximaM === null ? "—" : `${Math.round(x.distMaisProximaM)}m`}
                </Text>
                <Text style={[s.td, { width: CE.perm }]}>{minParaHM(x.permanenciaMin)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <FooterBar data={d.data} revenda="Entregas" />
    </Page>
  );
};

const RelatorioEntregas = ({ d }: { d: PDFEntregasData }) => (
  <Document title={`Entregas — ${fmtDate(d.data)}`} author="MetricFlow" creator="MetricFlow">
    <PaginaLinhas d={d} />
    <PaginaExcecoes d={d} />
  </Document>
);

export async function gerarPDFEntregas(d: PDFEntregasData): Promise<Buffer> {
  const element = React.createElement(RelatorioEntregas, { d }) as React.ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm vitest run server/services/pdfEntregas.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Inspecionar o PDF a olho**

Crie um arquivo temporário `server/services/tmp-pdf.test.ts`:

```ts
import { it } from "vitest";
import fs from "fs";
import { gerarPDFEntregas } from "./pdfEntregas";
it("grava amostra", async () => {
  fs.writeFileSync(process.env.TEMP + "/entregas-amostra.pdf", await gerarPDFEntregas({ data: "2026-10-05", linhas: [], analise: "Teste", avisos: ["SOO-8D81 · ISRAEL: sem rastreador"] }));
});
```

Rode `pnpm vitest run server/services/tmp-pdf.test.ts` e abra `%TEMP%/entregas-amostra.pdf`. Confira:
- 2 páginas em paisagem;
- cabeçalho verde;
- legenda;
- "Sem rotas para esta data.";
- aviso em vermelho;
- rodapé "MetricFlow · Entregas · 05/10/2026".

Depois **apague** `server/services/tmp-pdf.test.ts`.

- [ ] **Step 7: Rodar os testes de vendas para garantir que o `pdfService` não mudou de comportamento**

Run: `pnpm vitest run server/services/metricsCalculator.test.ts`
Expected: o mesmo resultado da base (as falhas antigas continuam idênticas; nenhuma nova).

- [ ] **Step 8: Commit**

```bash
git add server/services/pdfService.tsx server/services/pdfEntregas.tsx server/services/pdfEntregas.test.ts
git commit -m "feat(entregas): PDF do relatório gerencial de entregas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rota `POST /api/relatorio-entregas/gerar`

**Files:**
- Create: `server/routes/relatorioEntregas.ts`
- Modify: `server/_core/index.ts` (import na linha 12, `app.use` após a linha 50)

**Interfaces:**
- Consumes: `parseCheckNow`, `PlanilhaInvalidaError` (Task 2); `montarLinhas`, `agruparPorRota`, `cruzar`, `ResultadoLinha` (Task 4); `mapaVeiculos`, `buscarGpsLinha`, `gpsErro`, `normalizarPlaca` (Task 5); `gerarPDFEntregas` (Task 6).
- Produces: `POST /api/relatorio-entregas/gerar`
  - body `{ xlsxBase64: string; analise?: string }`;
  - 200 → `application/pdf` (`entregas_<data>.pdf`) quando há 1 dia, ou `application/zip` (`entregas.zip`) quando há mais;
  - 400 → `{ error, faltando? }`;
  - 500 → `{ error }`.

- [ ] **Step 1: Criar a rota**

Crie `server/routes/relatorioEntregas.ts`:

```ts
/**
 * MetricFlow — Relatório Gerencial de Entregas (CheckNow × Infleet)
 *
 *   POST /api/relatorio-entregas/gerar
 *     Body: { xlsxBase64: string, analise?: string }
 *     → PDF (1 dia) ou ZIP (vários dias). Sem banco: tudo calculado no request.
 */
import { Router, type Request, type Response } from "express";
import JSZip from "jszip";
import { parseCheckNow, PlanilhaInvalidaError, type Entrega } from "../services/entregas/parseCheckNow";
import { montarLinhas, agruparPorRota, cruzar, type ResultadoLinha } from "../services/entregas/cruzar";
import { mapaVeiculos, buscarGpsLinha, gpsErro, normalizarPlaca } from "../services/entregas/infleetEntregas";
import { gerarPDFEntregas } from "../services/pdfEntregas";

export const relatorioEntregasRouter = Router();

/** Executa fn sobre itens com no máximo n chamadas simultâneas, preservando a ordem. */
async function emParalelo<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (proximo < itens.length) {
      const k = proximo++;
      out[k] = await fn(itens[k]);
    }
  }));
  return out;
}

relatorioEntregasRouter.post("/gerar", async (req: Request, res: Response) => {
  const { xlsxBase64, analise } = (req.body ?? {}) as { xlsxBase64?: unknown; analise?: unknown };
  if (typeof xlsxBase64 !== "string" || !xlsxBase64) {
    res.status(400).json({ error: "Campo xlsxBase64 obrigatório." });
    return;
  }

  let entregas: Entrega[];
  try {
    entregas = parseCheckNow(Buffer.from(xlsxBase64, "base64"));
  } catch (e) {
    if (e instanceof PlanilhaInvalidaError) {
      res.status(400).json({ error: e.message, faltando: e.faltando });
      return;
    }
    res.status(400).json({ error: "Não foi possível ler a planilha.", detalhes: String(e) });
    return;
  }

  const linhas = montarLinhas(entregas, new Date());
  if (!linhas.length) {
    res.status(400).json({ error: "Nenhuma rota iniciada na planilha." });
    return;
  }

  try {
    const veiculos = await mapaVeiculos();
    const porRota = agruparPorRota(entregas);
    const resultados = await emParalelo(linhas, 3, async l => {
      const vId = veiculos.get(normalizarPlaca(l.placa));
      const gps = vId ? await buscarGpsLinha(vId, l.janela) : gpsErro("sem rastreador");
      return cruzar(l, porRota.get(l.routeId)!, gps);
    });

    const porDia = new Map<string, ResultadoLinha[]>();
    for (const r of resultados) porDia.set(r.linha.data, [...(porDia.get(r.linha.data) ?? []), r]);

    const textoAnalise = typeof analise === "string" ? analise : "";
    const pdfs: { nome: string; buf: Buffer }[] = [];
    for (const [data, ls] of [...porDia].sort(([a], [b]) => a.localeCompare(b))) {
      ls.sort((a, b) => a.linha.placa.localeCompare(b.linha.placa) || a.linha.motorista.localeCompare(b.linha.motorista));
      const avisos = ls.filter(r => r.semGps).map(r => `${r.linha.placa} · ${r.linha.motorista}: ${r.semGps}`);
      pdfs.push({ nome: `entregas_${data}.pdf`, buf: await gerarPDFEntregas({ data, linhas: ls, analise: textoAnalise, avisos }) });
    }

    if (pdfs.length === 1) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${pdfs[0].nome}"`);
      res.send(pdfs[0].buf);
      return;
    }
    const zip = new JSZip();
    for (const p of pdfs) zip.file(p.nome, p.buf);
    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="entregas.zip"`);
    res.send(zipBuf);
  } catch (e) {
    console.error("[relatorio-entregas]", e);
    res.status(500).json({ error: (e as Error).message });
  }
});
```

- [ ] **Step 2: Registrar no servidor**

Em `server/_core/index.ts`, depois da linha 12 (`import { crmUploadRouter } from "../routes/crmUpload";`), acrescente:

```ts
import { relatorioEntregasRouter } from "../routes/relatorioEntregas";
```

e depois de `app.use("/api/crm", crmUploadRouter);`, acrescente:

```ts
  app.use("/api/relatorio-entregas", relatorioEntregasRouter);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: só os 2 erros antigos (`client/src/App.tsx(69,9)` e `server/services/thumbnailService.ts(34,18)`).

- [ ] **Step 4: Subir o servidor e testar com a planilha real**

Em um terminal (em background): `DOTENV_CONFIG_PATH=../../../.env pnpm dev`. Anote a porta do log de inicialização (`<PORTA>`).

Monte o body com a planilha real (fora do repo):

```bash
node -e "const fs=require('fs');fs.writeFileSync(process.env.TEMP+'/entregas-body.json',JSON.stringify({xlsxBase64:fs.readFileSync('C:/Users/duttr/Documents/Projetos/rota/dados/CHECKNOW-Geracao_Dado_BI.xlsx').toString('base64'),analise:'teste'}))"
```

```bash
curl -s -o "$TEMP/entregas.zip" -w "%{http_code} %{content_type}\n" -H "Content-Type: application/json" --data @"$TEMP/entregas-body.json" http://localhost:<PORTA>/api/relatorio-entregas/gerar
```

Expected: `200 application/zip`. A planilha tem baixas de 01, 02, 03 e 05/10, e a rota de SOO-8D21 também passa por 04/10, então devem vir 5 PDFs.

Erro de planilha:

```bash
curl -s -w " %{http_code}\n" -H "Content-Type: application/json" --data "{\"xlsxBase64\":\"aXN0byBuYW8gZSBwbGFuaWxoYQ==\"}" http://localhost:<PORTA>/api/relatorio-entregas/gerar
```

Expected: `{"error":"Planilha do CheckNow sem as colunas: RouteId, ...","faltando":[...]} 400`.

- [ ] **Step 5: Abrir um PDF real**

Descompacte `$TEMP/entregas.zip` e abra `entregas_2026-10-05.pdf`. Confira:
- 4 linhas (SOL-6B13 · ANTONIO WELTON, SOO-8D21 · ANTONIO WELTON, SOO-8D21 · FRANCISCO DAS CHAGAS, SOO-8D81 · ISRAEL);
- colunas preenchidas ou "—" com aviso;
- página de exceções.

Se todas as linhas vierem "sem rastreador", compare o formato de `plate` registrado na spec §2 com a placa da planilha.

- [ ] **Step 6: Commit**

```bash
git add server/routes/relatorioEntregas.ts server/_core/index.ts
git commit -m "feat(entregas): rota POST /api/relatorio-entregas/gerar" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tela "Relatório de Entregas"

**Files:**
- Create: `client/src/pages/relatorio-entregas/index.tsx`
- Modify: `client/src/components/Sidebar.tsx` (import de ícone; item em `navItems` após `relatorio_semanal`)
- Modify: `client/src/App.tsx` (import após a linha 16; `<Route>` após `/relatorio-semanal`)

**Interfaces:**
- Consumes: `POST /api/relatorio-entregas/gerar` (Task 7); `blobToBase64` de `client/src/pages/analise/lib/pdf.ts`; `Sidebar`, `useSidebarCollapse`, `Button`, `Textarea`, `toast`.

- [ ] **Step 1: Criar a página**

Crie `client/src/pages/relatorio-entregas/index.tsx`:

```tsx
/*
 * MetricFlow — Relatório Gerencial de Entregas
 * Upload da planilha do CheckNow → PDF com o cruzamento das baixas com o GPS (Infleet).
 */
import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { blobToBase64 } from "@/pages/analise/lib/pdf";
import { useState } from "react";
import { toast } from "sonner";

export default function RelatorioEntregas() {
  const { isCollapsed } = useSidebarCollapse();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState("");
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    if (!arquivo) return;
    setGerando(true);
    try {
      const resp = await fetch("/api/relatorio-entregas/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xlsxBase64: await blobToBase64(arquivo), analise }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao gerar o relatório");
      }
      const blob = await resp.blob();
      const nome = resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "entregas.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Relatório gerado: ${nome}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage="relatorio_entregas" onNavigate={() => {}} />

      <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
        <header
          className="sticky top-0 z-20 bg-white/90 dark:bg-background/90 backdrop-blur-sm px-8 py-4 border-b border-border"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <h1 className="text-xl text-foreground" style={{ fontWeight: 900 }}>Relatório de Entregas</h1>
          <p className="text-xs text-muted-foreground">
            Cruza as baixas do CheckNow com as paradas do GPS (Infleet), por placa · motorista · dia.
          </p>
        </header>

        <section className="px-8 py-6 max-w-2xl space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-foreground">Planilha do CheckNow (Geracao_Dado_BI.xlsx)</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              className="block text-sm text-foreground"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-foreground">Análise do gestor (opcional)</span>
            <Textarea value={analise} onChange={e => setAnalise(e.target.value)} rows={6} />
          </label>

          <Button onClick={gerar} disabled={!arquivo || gerando}>
            {gerando ? "Gerando…" : "Gerar PDF"}
          </Button>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Menu lateral**

Em `client/src/components/Sidebar.tsx`, no import de `lucide-react` (linhas 7–29), acrescente `Truck,` em ordem alfabética, depois de `Trophy,`. Em `navItems`, logo depois da linha:

```ts
  { id: "relatorio_semanal",label: "Rel. Semanal",  icon: BarChartHorizontal,route: "/relatorio-semanal" },
```

acrescente:

```ts
  { id: "relatorio_entregas",label: "Rel. Entregas", icon: Truck,            route: "/relatorio-entregas" },
```

- [ ] **Step 3: Rota**

Em `client/src/App.tsx`, depois da linha 16 (`import RelatorioSemanal from "./pages/RelatorioSemanal";`), acrescente:

```tsx
import RelatorioEntregas from "./pages/relatorio-entregas";
```

e depois de `<Route path="/relatorio-semanal" component={RelatorioSemanal} />`, acrescente:

```tsx
      <Route path="/relatorio-entregas" component={RelatorioEntregas} />
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: só os 2 erros antigos.

- [ ] **Step 5: Testar no navegador**

Com o servidor da Task 7 rodando (`DOTENV_CONFIG_PATH=../../../.env pnpm dev`), abra `http://localhost:<PORTA>/relatorio-entregas` no Browser pane. Confira:
- o item "Rel. Entregas" aparece ativo no menu;
- o botão fica desabilitado sem arquivo;
- subir um `.xlsx` qualquer (que não seja do CheckNow) mostra um toast de erro com as colunas faltantes;
- subir `C:/Users/duttr/Documents/Projetos/rota/dados/CHECKNOW-Geracao_Dado_BI.xlsx` baixa `entregas.zip`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/relatorio-entregas/index.tsx client/src/components/Sidebar.tsx client/src/App.tsx
git commit -m "feat(entregas): tela de upload do relatório de entregas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Validação com dados reais

**Files:**
- Create: `script/validarEntregas.ts`

**Interfaces:**
- Consumes: `parseCheckNow` (Task 2); `montarLinhas`, `agruparPorRota`, `cruzar`, `diaBRT`, `horaBRT` (Task 4); `mapaVeiculos`, `buscarGpsLinha`, `gpsErro`, `normalizarPlaca` (Task 5).

- [ ] **Step 1: Criar o script**

Crie `script/validarEntregas.ts`:

```ts
/*
 * Validação do relatório de entregas com dados reais (spec §9).
 * Cruza o status do GPS com a distância da baixa informada pelo próprio CheckNow.
 * Uso (a partir da worktree):
 *   pnpm tsx --env-file=../../../.env script/validarEntregas.ts <planilha.xlsx>
 */
import fs from "fs";
import * as XLSX from "xlsx";
import { parseCheckNow } from "../server/services/entregas/parseCheckNow";
import { montarLinhas, agruparPorRota, cruzar, diaBRT, horaBRT } from "../server/services/entregas/cruzar";
import { mapaVeiculos, buscarGpsLinha, gpsErro, normalizarPlaca } from "../server/services/entregas/infleetEntregas";

const buf = fs.readFileSync(process.argv[2]);
const entregas = parseCheckNow(buf);

const wb = XLSX.read(buf, { type: "buffer" });
const distBaixa = new Map<string, number>();
for (const r of XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null })) {
  const chave = `${String(r["RouteId"]).trim()}|${String(r["Código do Cliente"]).trim()}`;
  if (!distBaixa.has(chave)) distBaixa.set(chave, Number(r["Distância do Ponto (MT)"] ?? 0));
}
const faixa = (m: number) => (m <= 300 ? "baixa ≤300m" : m <= 500 ? "baixa 300–500m" : "baixa >500m");

const veiculos = await mapaVeiculos();
const porRota = agruparPorRota(entregas);
const tabela: Record<string, Record<string, number>> = {};

for (const l of montarLinhas(entregas, new Date())) {
  const vId = veiculos.get(normalizarPlaca(l.placa));
  const es = porRota.get(l.routeId)!;
  const r = cruzar(l, es, vId ? await buscarGpsLinha(vId, l.janela) : gpsErro("sem rastreador"));
  console.log(
    l.data, l.placa.padEnd(9), l.motorista.padEnd(22),
    r.semGps ? `SEM GPS: ${r.semGps}` :
      `saída ${r.saida ? horaBRT(r.saida) : "—"} | no raio ${r.noRaio}/${r.baixasComCoord} | sem parada ${r.semParada} | relâmpago ${r.relampago} | s/ cliente ${r.paradasSemCliente.qtd} | km ${r.kmGps}`,
  );
  if (r.semGps) continue;
  for (const e of es.filter(x => x.situacao !== "AGUARDANDO" && x.baixaEm && diaBRT(x.baixaEm) === l.data)) {
    const status = r.excecoes.find(x => x.entrega === e)?.status ?? "no_raio";
    const f = faixa(distBaixa.get(`${e.routeId}|${e.codCliente}`) ?? 0);
    tabela[f] ??= {};
    tabela[f][status] = (tabela[f][status] ?? 0) + 1;
  }
}

console.log("\nDistância da baixa (CheckNow) × status pelo GPS:");
console.table(tabela);
```

- [ ] **Step 2: Rodar**

Run: `pnpm tsx --env-file=../../../.env script/validarEntregas.ts C:/Users/duttr/Documents/Projetos/rota/dados/CHECKNOW-Geracao_Dado_BI.xlsx`

Expected: uma linha por placa · motorista · dia e uma tabela cruzada (faixa da baixa × `no_raio` / `relampago` / `sem_parada` / `sem_coordenada`).

- [ ] **Step 3: Sanidade e calibração (com o usuário)**

Confira e **reporte ao usuário**, sem alterar limites por conta própria:
- **Saída:** horários de saída plausíveis (madrugada ou manhã), e nenhuma linha com saída depois do retorno.
- **Coerência entre faixas:** a faixa "baixa ≤300m" deve ser majoritariamente `no_raio`. Se não for, a detecção de parada está errada (revisar `SPEED_PARA_KMH` e `PARADA`).
- **Relâmpago:** se `relampago` passar de cerca de 30% em alguma faixa, investigar a frequência das posições, porque o rastreador pode reportar pouco.
- **Linhas sem GPS:** listar as placas e o motivo.

Mostre a saída do script ao usuário e pergunte se os limites (`LIMITES` em `cruzar.ts`, `PARADA` em `detectarParadas.ts`) devem mudar.

- [ ] **Step 4: Commit**

```bash
git add script/validarEntregas.ts
git commit -m "chore(entregas): script de validação com dados reais" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Rodar a suíte inteira uma vez**

Run: `pnpm test`
Expected: os testes novos passam (8 + 9 + 14 + 6 + 2 = 39), e as 42 falhas antigas continuam as mesmas, sem nenhuma nova.
