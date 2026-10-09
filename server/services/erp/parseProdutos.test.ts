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
