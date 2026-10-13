import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("./repo", () => ({ gravarRotasDia: vi.fn(), fecharRotas: vi.fn() }));
vi.mock("../entregas/cruzarDia", () => ({ cruzarDia: vi.fn() }));
import * as repo from "./repo";
import { cruzarDia } from "../entregas/cruzarDia";
import { deveGravarTela, gravarLinhas, registrarRotasDia } from "./registrar";
import type { LinhaProcessada } from "../entregas/cruzarDia";

const linha = (routeId: string, semGps: string | null) => ({
  linha: { routeId, data: "2026-10-05", placa: "SOL-6B13", motorista: "ANA" }, saida: null, retorno: null,
  gpsClientes: { primeiraChegada: null, ultimaSaida: null }, tempo: null, ida: null, volta: null, entregasDia: 3, aEntregar: 5, totalRota: 5,
  kmGps: null, semGps, produtividade: { hl: 2, hlPorHora: null, devPct: null, parcial: true, incompleto: false },
}) as unknown as LinhaProcessada;
const entrega = (routeId: string) => ({ routeId, rotaInicio: new Date("2026-10-05T06:00:00-03:00"), rotaFim: null }) as never;

beforeEach(() => vi.clearAllMocks());

describe("gravarLinhas", () => {
  it("I-2: falha passageira do Infleet não sobrescreve o dia; sem rastreador / sem sinal gravam", async () => {
    await gravarLinhas(1, { linhas: [linha("A", "falha no Infleet: HTTP 502"), linha("B", "sem sinal GPS"), linha("C", null)], entregas: [entrega("A"), entrega("B"), entrega("C")] });
    expect(vi.mocked(repo.gravarRotasDia).mock.calls[0][1].map(r => r.routeId)).toEqual(["B", "C"]);
  });
});

describe("deveGravarTela", () => {
  const base = { de: "2026-10-05", ate: "2026-10-05", cercaId: "sede", sedeId: "sede", hoje: "2026-10-13" };
  it("I-1: só grava dia passado, um dia só, com a cerca Sede", () => {
    expect(deveGravarTela(base)).toBe(true);
    expect(deveGravarTela({ ...base, cercaId: undefined })).toBe(false);
    expect(deveGravarTela({ ...base, cercaId: "posto" })).toBe(false);
    expect(deveGravarTela({ ...base, sedeId: null })).toBe(false);
    expect(deveGravarTela({ ...base, de: "2026-10-13", ate: "2026-10-13" })).toBe(false);
    expect(deveGravarTela({ ...base, ate: "2026-10-06" })).toBe(false);
  });
});

describe("registrarRotasDia", () => {
  it("I-4: depois de gravar, fecha as rotas que o CheckNow já fechou", async () => {
    vi.mocked(cruzarDia).mockResolvedValue({ linhas: [linha("C", null)], rotas: [], entregas: [entrega("C")] });
    expect(await registrarRotasDia(1, "2026-10-05", "sede")).toBe(1);
    expect(cruzarDia).toHaveBeenCalledWith(1, "2026-10-05", "2026-10-05", "sede");
    expect(repo.fecharRotas).toHaveBeenCalledWith(1);
  });
});
