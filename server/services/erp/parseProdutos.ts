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
