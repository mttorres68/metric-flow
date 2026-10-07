import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("./repo", async importOriginal => ({
  ColetaError: (await importOriginal<typeof import("./repo")>()).ColetaError,
  comTrava: vi.fn((_id: number, fn: () => unknown) => fn()),
  contaComSegredos: vi.fn(),
  abrirColeta: vi.fn(async () => 99),
  fecharColeta: vi.fn(),
  gravarEntregas: vi.fn(),
}));
vi.mock("./coletor", () => ({ baixarCheckNow: vi.fn() }));
vi.mock("../entregas/parseCheckNow", async importOriginal => ({
  ...(await importOriginal<typeof import("../entregas/parseCheckNow")>()),
  parseCheckNow: vi.fn(),
}));
import * as repo from "./repo";
import { baixarCheckNow } from "./coletor";
import { parseCheckNow } from "../entregas/parseCheckNow";
import { coletarRevenda, comTentativas, importarPlanilha } from "./sincronizar";

const conta = { revendaId: 5, ativo: true, usuario: "u", senha: "s", infleetToken: null };
beforeEach(() => {
  vi.clearAllMocks();
  (repo.contaComSegredos as Mock).mockResolvedValue(conta);
  (baixarCheckNow as Mock).mockResolvedValue([Buffer.from("x")]);
});

describe("comTentativas", () => {
  it("repete até dar certo", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("502")).mockResolvedValue("ok");
    expect(await comTentativas(fn, [0, 0])).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("não repete login recusado", async () => {
    const fn = vi.fn().mockRejectedValue(new repo.ColetaError("login recusado"));
    await expect(comTentativas(fn, [0, 0, 0])).rejects.toThrow("login recusado");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("coletarRevenda", () => {
  it("grava e fecha a coleta como ok", async () => {
    (parseCheckNow as Mock).mockReturnValue([{ routeId: "1" }]);
    (repo.gravarEntregas as Mock).mockResolvedValue({ rotas: 1, linhas: 1 });
    expect(await coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).toEqual({ status: "ok", rotas: 1, linhas: 1 });
    expect(repo.fecharColeta).toHaveBeenCalledWith(99, 5, { status: "ok", rotas: 1, linhas: 1 });
  });
  it("arquivo vazio: sem_dados e nada gravado", async () => {
    (parseCheckNow as Mock).mockReturnValue([]);
    expect((await coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).status).toBe("sem_dados");
    expect(repo.gravarEntregas).not.toHaveBeenCalled();
  });
  it("falha: registra o erro, não grava e repassa a mensagem", async () => {
    (baixarCheckNow as Mock).mockRejectedValue(new repo.ColetaError("resposta não é Excel"));
    await expect(coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).rejects.toThrow("resposta não é Excel");
    expect(repo.fecharColeta).toHaveBeenCalledWith(99, 5, { status: "erro", erro: "resposta não é Excel" });
    expect(repo.gravarEntregas).not.toHaveBeenCalled();
  });
  it("revenda sem conta", async () => {
    (repo.contaComSegredos as Mock).mockResolvedValue(null);
    await expect(coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).rejects.toThrow("revenda sem conta do CheckNow");
  });
  it("trava ocupada não abre coleta", async () => {
    (repo.comTrava as Mock).mockRejectedValueOnce(new repo.ColetaError("coleta já em andamento"));
    await expect(coletarRevenda(5, "2026-10-06", "2026-10-07", "botao", [])).rejects.toThrow("coleta já em andamento");
    expect(repo.abrirColeta).not.toHaveBeenCalled();
  });
});

describe("importarPlanilha", () => {
  it("registra como upload no período das rotas", async () => {
    (parseCheckNow as Mock).mockReturnValue([{ routeId: "1", rotaInicio: new Date("2026-10-05T10:00:00-03:00") }]);
    (repo.gravarEntregas as Mock).mockResolvedValue({ rotas: 1, linhas: 1 });
    await importarPlanilha(5, Buffer.from("x"));
    expect(repo.abrirColeta).toHaveBeenCalledWith(5, "upload", "2026-10-05", "2026-10-05");
  });
});
