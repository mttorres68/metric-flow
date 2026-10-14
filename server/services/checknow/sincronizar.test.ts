import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("./repo", async importOriginal => ({
  ColetaError: (await importOriginal<typeof import("./repo")>()).ColetaError,
  comTrava: vi.fn((_id: number, fn: () => unknown) => fn()),
  contaComSegredos: vi.fn(),
  abrirColeta: vi.fn(async () => 99),
  fecharColeta: vi.fn(),
  gravarEntregas: vi.fn(),
}));
vi.mock("./coletor", async o => ({ ...(await o<typeof import("./coletor")>()), baixarCheckNow: vi.fn() }));
vi.mock("../entregas/parseCheckNow", async importOriginal => ({
  ...(await importOriginal<typeof import("../entregas/parseCheckNow")>()),
  parseCheckNow: vi.fn(),
}));
import * as repo from "./repo";
import { baixarCheckNow } from "./coletor";
import { parseCheckNow } from "../entregas/parseCheckNow";
import { coletarRevenda, comTentativas, importarPlanilha } from "./sincronizar";
import { LIMITE_EXCEDIDO } from "./coletor";

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
  it("não repete limite de relatórios excedido (cada tentativa gastaria mais cota)", async () => {
    const fn = vi.fn().mockRejectedValue(new repo.ColetaError(LIMITE_EXCEDIDO));
    await expect(comTentativas(fn, [0, 0, 0])).rejects.toThrow(LIMITE_EXCEDIDO);
    expect(fn).toHaveBeenCalledTimes(1);
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
  it("a trava vale só durante cada tentativa: nas esperas o upload e o botão ficam livres", async () => {
    (baixarCheckNow as Mock).mockRejectedValueOnce(new repo.ColetaError("CheckNow não respondeu (HTTP 502)")).mockResolvedValue([Buffer.from("x")]);
    (parseCheckNow as Mock).mockReturnValue([{ routeId: "1" }]);
    (repo.gravarEntregas as Mock).mockResolvedValue({ rotas: 1, linhas: 1 });
    await coletarRevenda(5, "2026-10-06", "2026-10-07", "auto", [0]);
    expect(repo.comTrava).toHaveBeenCalledTimes(2);
    expect((repo.fecharColeta as Mock).mock.calls.map(c => c[2].status)).toEqual(["erro", "ok"]);
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
