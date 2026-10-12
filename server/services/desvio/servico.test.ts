import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("./repo", () => ({
  carregarPedidos: vi.fn(), carregarEvidencias: vi.fn(async () => []), noitesSemSinal: vi.fn(async () => []),
  rotasDosPedidos: vi.fn(async () => new Map()), versao: vi.fn(), revisoes: vi.fn(), revisar: vi.fn(),
}));
vi.mock("../configService", () => ({ getConfigEntregas: async () => ({ raioM: 200 }) }));
import * as repo from "./repo";
import { fila } from "./servico";
import type { PedidoErp } from "../erp/parsePedidosErp";

const ped = (o: Partial<PedidoErp>): PedidoErp => ({
  pedido: "P1", romaneio: "R1", cliente: "C1", vendedor: "V", canal: "01", origem: "G", placa: "SOL6B13", motoristaCod: "77",
  dataPedido: "2026-10-01", tipoCobranca: "4", condicaoPagamento: "34", banco: "928", vencimento1: null,
  situacao: "acertado", dataAcerto: "2026-10-02", flagRomaneio: "N", valor: 300, valorRetorno: 0, itens: 3, produtos: 2, ...o,
});
const historico = Array.from({ length: 10 }, (_, i) => ped({
  pedido: `H${i}`, romaneio: `RH${i}`, dataPedido: new Date(Date.parse("2026-07-01") + i * 7 * 86_400_000).toISOString().slice(0, 10),
}));
const x = ped({ pedido: "X", romaneio: "RX", tipoCobranca: "1", situacao: "aberto", dataAcerto: null, dataPedido: "2026-10-06" });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T12:00:00-03:00"));
  vi.mocked(repo.carregarPedidos).mockReset().mockResolvedValue([...historico, x]);
  vi.mocked(repo.revisoes).mockResolvedValue(new Map());
});
afterEach(() => vi.useRealTimers());

describe("fila", () => {
  it("traz o à vista atípico do período e não os pedidos do histórico", async () => {
    vi.mocked(repo.versao).mockResolvedValue("v1");
    const f = await fila(1, "2026-10-01", "2026-10-12");
    expect(f.map(c => c.pedido.pedido)).toEqual(["X"]);
    expect(f[0]).toMatchObject({ nota: 40, faixa: "media", revisao: null }); // à vista atípico 30 + aberto há 6 dias 10
  });
  it("revisado como ok some da fila; com incluirRevisados volta", async () => {
    vi.mocked(repo.versao).mockResolvedValue("v2");
    vi.mocked(repo.revisoes).mockResolvedValue(new Map([["X", { situacao: "ok" as const, observacao: "cliente confirmou", revisadoEm: new Date() }]]));
    expect(await fila(1, "2026-10-01", "2026-10-12")).toEqual([]);
    expect((await fila(1, "2026-10-01", "2026-10-12", true))[0].revisao?.situacao).toBe("ok");
  });
  it("cache: mesma versão não recarrega; versão nova recarrega", async () => {
    vi.mocked(repo.versao).mockResolvedValue("v3");
    await fila(1, "2026-10-01", "2026-10-12");
    await fila(1, "2026-10-01", "2026-10-12");
    expect(repo.carregarPedidos).toHaveBeenCalledTimes(1);
    vi.mocked(repo.versao).mockResolvedValue("v4");
    await fila(1, "2026-10-01", "2026-10-12");
    expect(repo.carregarPedidos).toHaveBeenCalledTimes(2);
  });
});
