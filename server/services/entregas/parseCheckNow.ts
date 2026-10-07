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
  saidaApp: Date | null; // Data/Hora de Saída do cliente no app (opcional)
  rotaInicio: Date | null;
  rotaFim: Date | null;
  odoIniInformado: number | null;
  odoFimInformado: number | null;
  // Colunas opcionais (análise por rota). Valor, peso e notas somam as notas distintas do cliente.
  ordemPlanejada: number | null;
  valor: number;
  pesoKg: number;
  notas: number;
  motivoProblema: string | null;
  capacidadeKg: number | null;
  cidade: string;
}

/** "R$ 3.153,98" → 3153.98 (aceita número). */
function reais(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const n = Number(v.replace(/R\$/g, "").replace(/\./g, "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
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
  const notasVistas = new Set<string>(); // RouteId|Cliente|Documento — a planilha repete linhas inteiras
  for (const r of rows) {
    const routeId = String(r["RouteId"] ?? "").trim();
    const codCliente = String(r["Código do Cliente"] ?? "").trim();
    if (!routeId || !codCliente) continue;
    const chave = `${routeId}|${codCliente}`;
    const doc = String(r["Documento"] ?? "").trim();
    const notaNova = !notasVistas.has(`${chave}|${doc}`);
    notasVistas.add(`${chave}|${doc}`);

    const existente = entregas.get(chave);
    if (existente) {
      if (notaNova && doc) {
        existente.notas++;
        existente.valor += reais(r["Valor (R$)"]);
        existente.pesoKg += num(r["Peso (Kg)"]) ?? 0;
      }
      continue;
    }

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
      saidaApp: dataHoraBRT(r["Data de Saída"], r["Hora de Saída"]),
      rotaInicio: dataHoraBRT(r["Data Rota Inicio Realizada"], r["Hora Rota Inicio Realizada"]),
      rotaFim: dataHoraBRT(r["Data Rota Fim Realizada"], r["Hora Rota Fim Realizada"]),
      odoIniInformado: num(r["Odometro Inicial Real. Informado"]),
      odoFimInformado: num(r["Odometro Final Real. Informado"]),
      ordemPlanejada: num(r["Ordem Planejada"]),
      valor: reais(r["Valor (R$)"]),
      pesoKg: num(r["Peso (Kg)"]) ?? 0,
      notas: 1,
      motivoProblema: String(r["Motivo Problema"] ?? "").trim() || null,
      capacidadeKg: num(r["Capacidade Veículo"]),
      cidade: String(r["Cidade"] ?? "").trim(),
    });
  }
  return [...entregas.values()];
}
