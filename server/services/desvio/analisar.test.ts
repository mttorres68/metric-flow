import { describe, it, expect } from "vitest";
import { analisarPedidos, porMotorista, romaneiosAbertos, type EntradaDesvio, type Evidencia } from "./analisar";
import type { PedidoErp } from "../erp/parsePedidosErp";

const ped = (o: Partial<PedidoErp>): PedidoErp => ({
  pedido: "P1", romaneio: "R1", cliente: "C1", vendedor: "V", canal: "01", origem: "G", placa: "SOL6B13", motoristaCod: "77",
  dataPedido: "2026-10-01", tipoCobranca: "4", condicaoPagamento: "34", banco: "928", vencimento1: null,
  situacao: "acertado", dataAcerto: "2026-10-02", flagRomaneio: "N", valor: 300, valorRetorno: 0, itens: 3, produtos: 2, ...o,
});
const ev = (o: Partial<Evidencia>): Evidencia => ({
  dia: "2026-10-07", placa: "SOL-6B13", motorista: "ISRAEL", documentos: ["X"], status: "sem_parada", distParadaM: 1200,
  paradaLat: -6.8, paradaLon: -43, paradaInicio: new Date("2026-10-07T10:00:00-03:00"), paradaFim: new Date("2026-10-07T10:40:00-03:00"),
  distAppM: null, clienteLat: -6.81, clienteLon: -43, ...o,
});
// 10 pedidos no boleto, um por semana, do cliente C1
const historico = Array.from({ length: 10 }, (_, i) => ped({
  pedido: `H${i}`, romaneio: `RH${i}`, dataPedido: new Date(Date.parse("2026-07-01") + i * 7 * 86_400_000).toISOString().slice(0, 10),
}));
// motorista 77 com 4 romaneios abertos que já saíram
const abertos = ["A1", "A2", "A3", "A4"].map((r, i) => ped({ pedido: r, romaneio: r, cliente: `K${i}`, situacao: "aberto", dataAcerto: null, dataPedido: "2026-10-05" }));
const base = (o: Partial<EntradaDesvio> = {}): EntradaDesvio => ({ pedidos: [], evidencias: [], semSinal: [], rotas: new Map(), hoje: "2026-10-12", raioM: 200, ...o });
const um = (casos: ReturnType<typeof analisarPedidos>, pedido: string) => casos.find(c => c.pedido.pedido === pedido)!;

describe("analisarPedidos", () => {
  it("caso real sintético: à vista atípico + motorista com > 3 abertos + aberto há dias + parou perto → nota alta", () => {
    const x = ped({ pedido: "X", romaneio: "RX", tipoCobranca: "1", situacao: "aberto", dataAcerto: null, dataPedido: "2026-10-06", valor: 1000 });
    const c = um(analisarPedidos(base({ pedidos: [...historico, ...abertos, x], evidencias: [ev({})],
      rotas: new Map([["X", { inicio: new Date("2026-10-07T06:00:00-03:00"), motorista: "ISRAEL", placa: "SOL-6B13" }]]) })), "X");
    expect(c.sinais.map(s => s.chave)).toEqual(["avistaAtipico", "valorAlto", "motoristaAbertos", "romaneioAberto", "parouPerto"]);
    expect(c).toMatchObject({ nota: 100, faixa: "alta", saida: "2026-10-07", diasAberto: 5, motorista: "ISRAEL", semGps: false });
    expect(c.sinais[0].texto).toMatch(/0% dos 10 pedidos/);
  });
  it("perfil só com pedidos anteriores: o primeiro pedido à vista do cliente é 'sem histórico'", () => {
    const casos = analisarPedidos(base({ pedidos: [ped({ pedido: "Z", dataPedido: "2026-06-01", tipoCobranca: "1" }), ...historico] }));
    expect(um(casos, "Z").sinais.map(s => s.chave)).toEqual(["avistaSemHistorico"]);
    expect(um(casos, "Z").perfil.pedidos).toBe(0);
    expect(um(casos, "H9").perfil).toMatchObject({ pedidos: 10, avistaPct: 10, valorMediana: 300, intervaloDias: 7 });
  });
  it("cliente do boleto com romaneio aberto há 2 dias e sem GPS → nota 0, semGps", () => {
    const c = um(analisarPedidos(base({ pedidos: [...historico, ped({ pedido: "Y", romaneio: "RY", situacao: "aberto", dataAcerto: null, dataPedido: "2026-10-10" })] })), "Y");
    expect(c).toMatchObject({ nota: 0, faixa: "baixa", semGps: true, diasAberto: 2 });
  });
  it("sem parada a até 3 km e registro no app longe", () => {
    const c = um(analisarPedidos(base({ pedidos: [ped({ pedido: "X" })], evidencias: [ev({ distParadaM: 8000, distAppM: 900 })] })), "X");
    expect(c.sinais.map(s => s.chave)).toEqual(["semParada", "appLonge"]);
  });
  it("noite sem sinal GPS do caminhão no dia da rota → sem parada", () => {
    const c = um(analisarPedidos(base({ pedidos: [ped({ pedido: "X" })], semSinal: [{ placa: "SOL-6B13", dia: "2026-10-07" }],
      rotas: new Map([["X", { inicio: new Date("2026-10-07T06:00:00-03:00"), motorista: "ISRAEL", placa: "SOL-6B13" }]]) })), "X");
    expect(c.sinais).toMatchObject([{ chave: "semParada", texto: expect.stringMatching(/sem sinal/) }]);
    expect(c.semGps).toBe(false);
  });
  it("romaneio que saiu hoje não conta para 'mais de 3 abertos'", () => {
    const hoje = ped({ pedido: "T", romaneio: "RT", situacao: "aberto", dataAcerto: null, dataPedido: "2026-10-12" });
    const casos = analisarPedidos(base({ pedidos: [...abertos.slice(0, 3), hoje] }));
    expect(casos.flatMap(c => c.sinais).some(s => s.chave === "motoristaAbertos")).toBe(false);
  });
  it("cancelados ficam de fora", () => {
    expect(analisarPedidos(base({ pedidos: [ped({ situacao: "cancelado" })] }))).toEqual([]);
  });
});

describe("romaneios abertos e motoristas", () => {
  it("agrupa os abertos por romaneio e soma por motorista", () => {
    const x = ped({ pedido: "X", romaneio: "A1", tipoCobranca: "1", situacao: "aberto", dataAcerto: null, dataPedido: "2026-10-05", valor: 500 });
    const casos = analisarPedidos(base({ pedidos: [...abertos, x] }));
    const rs = romaneiosAbertos(casos);
    expect(rs).toHaveLength(4);
    expect(rs.find(r => r.romaneio === "A1")).toMatchObject({ pedidos: 2, valor: 800, valorAvista: 500, dias: 7, motoristaCod: "77" });
    expect(porMotorista(casos, rs)).toMatchObject([{ motoristaCod: "77", romaneiosAbertos: 4 }]);
  });
});
