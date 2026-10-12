import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
vi.mock("./repo", () => ({ salvarProdutos: vi.fn(async (ps: unknown[]) => ps.length), gravarPedidos: vi.fn(), codigosSemCadastro: vi.fn(), gravarCabecalhos: vi.fn() }));
vi.mock("../checknow/repo", async o => ({
  ColetaError: (await o<typeof import("../checknow/repo")>()).ColetaError,
  comTrava: vi.fn((_: number, fn: () => unknown) => fn()), abrirColeta: vi.fn(async () => 7), fecharColeta: vi.fn(),
}));
vi.mock("./parsePedidosErp", () => ({ parsePedidosErp: vi.fn(), parseCabecalhosPedidos: vi.fn(() => [{ pedido: "1" }, { pedido: "2" }]) }));
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
    expect(repo.gravarCabecalhos).toHaveBeenCalledWith(5, [{ pedido: "1" }, { pedido: "2" }]);
  });
  it("arquivo sem itens: sem_dados e nada gravado", async () => {
    (parsePedidosErp as Mock).mockReturnValue([]);
    await importarPedidos(5, Buffer.from(""));
    expect(repo.gravarPedidos).not.toHaveBeenCalled();
  });
});
