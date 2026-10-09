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
  it("etiquetas: app atrasado (pelo 1º registro do dia), registros longe e entregas sem pedido no ERP", () => {
    const longe = { lat: -7, lon: -43, latApp: -7.01, lonApp: -43, situacao: "ENTREGUE" };
    const { r, vols } = linha([
      baixa(1, 5, { entrega: { ...longe, baixaEm: new Date("2026-10-05T12:45:00Z") }, momentoBaixa: { tipo: "depois", min: 45 } }),
      baixa(1, 5, { entrega: { ...longe, baixaEm: new Date("2026-10-05T13:30:00Z") }, momentoBaixa: { tipo: "na_parada", min: 0 } }),
      baixa(0, 5, { vol: null }),
    ]);
    const textos = produtividadeLinha(r, vols, 200).etiquetas.map(e => e.texto);
    expect(textos).toEqual(expect.arrayContaining(["app 45 min depois", "2 registros longe do cliente", "1 entrega sem pedido no ERP"]));
  });
  it("pernoite perto de cliente não vira 'app atrasado' (vale a passagem do próprio cliente)", () => {
    const { r, vols } = linha([baixa(1, 5, { momentoBaixa: { tipo: "na_parada", min: 0 } })],
      { gpsClientes: { primeiraChegada: new Date("2026-10-05T03:07:00Z"), ultimaSaida: new Date("2026-10-05T13:30:00Z") } });
    expect(produtividadeLinha(r, vols, 200).etiquetas.map(e => e.texto).join()).not.toMatch(/app/);
  });
  it("sem volume casado com o ERP: hL/h e hL/km ficam vazios (não zero)", () => {
    const { r, vols } = linha([baixa(0, 5, { vol: null })]);
    expect(produtividadeLinha(r, vols, 200)).toMatchObject({ hlPorHora: null, hlPorKm: null });
    const semPedido = linha([baixa(0, 5, { vol: { ...baixa(0, 5).vol, casou: false } })]);
    expect(produtividadeLinha(semPedido.r, semPedido.vols, 200)).toMatchObject({ hlPorHora: null, hlPorKm: null, semVolume: 1 });
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
