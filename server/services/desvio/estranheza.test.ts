import { describe, it, expect } from "vitest";
import { estranheza } from "./estranheza";
import type { Caso } from "./analisar";

const caso = (i: number, o: Partial<Caso["pedido"]> = {}, avistaPct = 0): Caso => ({
  pedido: { pedido: `P${i}`, romaneio: "R", cliente: `C${i % 40}`, vendedor: "", canal: "", origem: "G", placa: "", motoristaCod: "1",
    dataPedido: "2026-10-01", tipoCobranca: "4", condicaoPagamento: "", banco: "", vencimento1: null, situacao: "acertado",
    dataAcerto: "2026-10-03", flagRomaneio: "", valor: 280 + (i % 7) * 10, valorRetorno: 0, itens: 3 + (i % 3), produtos: 2 + (i % 2), ...o },
  dia: "2026-10-01", saida: "2026-10-01", diasAberto: null, motorista: "M", nota: 0, faixa: "baixa", sinais: [], evidencia: null, semGps: true,
  perfil: { pedidos: 20, avistaPct, valorMediana: 300, intervaloDias: 7, ultimaCompra: "2026-09-24" },
});
const normais = Array.from({ length: 300 }, (_, i) => caso(i));
const plantado = caso(999, { valor: 15000, tipoCobranca: "1" });

describe("estranheza", () => {
  it("o pedido plantado fica no topo e a explicação aponta valor e à vista", () => {
    const e = estranheza([...normais, plantado]).get("P999")!;
    expect(e.nota).toBeGreaterThanOrEqual(99);
    expect(e.motivos.join(" ")).toMatch(/típico do cliente/);
    expect(e.motivos.join(" ")).toMatch(/à vista/);
  });
  it("determinístico", () => {
    expect(estranheza([...normais, plantado]).get("P10")).toEqual(estranheza([...normais, plantado]).get("P10"));
  });
  it("com menos de 50 pedidos não calcula", () => {
    expect(estranheza(normais.slice(0, 49)).size).toBe(0);
  });
});
