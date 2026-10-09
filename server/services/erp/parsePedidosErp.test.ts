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
  it("o número do item vem com o prefixo || também no valor (\"||002\")", () => {
    expect(parsePedidosErp(csv(linha({ Item: "||002" })))[0].item).toBe(2);
  });
  it("acentos em latin1 não quebram; linhas sem pedido são ignoradas", () => {
    expect(parsePedidosErp(csv(linha(), ";;;;")).length).toBe(1);
  });
  it("colunas faltando", () => {
    expect(() => parsePedidosErp(Buffer.from("Pedido;Cliente\r\n1;2", "latin1"))).toThrow(ArquivoErpInvalidoError);
  });
});
