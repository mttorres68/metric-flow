import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("../checknow/repo", () => ({ entregasDoPeriodo: vi.fn(), tokenInfleet: vi.fn() }));
vi.mock("../entregas/infleetEntregas", () => ({
  mapaVeiculos: vi.fn(), buscarGpsLinha: vi.fn(), sedeDaConta: vi.fn(),
  normalizarPlaca: (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, ""),
}));
vi.mock("../configService", async () => ({ getConfigEntregas: async () => (await import("@shared/entregas")).CONFIG_ENTREGAS_PADRAO }));
vi.mock("./repo", () => ({ gravarNoites: vi.fn() }));
import * as cn from "../checknow/repo";
import * as inf from "../entregas/infleetEntregas";
import { gravarNoites } from "./repo";
import { processarNoites } from "./processar";
import type { Entrega } from "../entregas/parseCheckNow";

const brt = (s: string) => new Date(`${s}:00-03:00`);
const D = "2026-10-05";
const q: [number, number][] = [[-43.025, -6.775], [-43.015, -6.775], [-43.015, -6.765], [-43.025, -6.765], [-43.025, -6.775]];
const sede = { cercaId: "sede", centro: { lat: -6.77, lon: -43.02 }, poligono: q };
const entrega = (o: Partial<Entrega>): Entrega => ({
  routeId: "R1", placa: "AAA-1111", motorista: "ANA", codCliente: "1", cliente: "C", lat: -7.1, lon: -43.02, documentos: [],
  latApp: null, lonApp: null, situacao: "ENTREGUE", baixaEm: brt(`${D}T10:00`), saidaApp: null, rotaInicio: brt(`${D}T06:00`), rotaFim: null,
  odoIniInformado: null, odoFimInformado: null, ordemPlanejada: null, valor: 0, pesoKg: 0, notas: 0, motivoProblema: null, capacidadeKg: null, cidade: "X", ...o,
});
const gps = {
  paradas: [{ lat: -7.11, lon: -43.02, inicio: brt(`${D}T15:00`), fim: brt("2026-10-06T05:30"), min: 870 }],
  eventos: [], saida: null, saidaOrigem: "gps", retorno: null, retornoOrigem: "gps", kmGps: null, trajeto: { t: [], km: [] },
};

beforeEach(() => {
  vi.mocked(cn.tokenInfleet).mockResolvedValue(undefined);
  vi.mocked(inf.sedeDaConta).mockResolvedValue(sede);
  vi.mocked(inf.mapaVeiculos).mockResolvedValue(new Map([["AAA1111", "v1"], ["BBB2222", "v2"]]));
  vi.mocked(inf.buscarGpsLinha).mockReset().mockResolvedValue(gps as never);
  vi.mocked(gravarNoites).mockReset();
});
const comEntregas = (es: Entrega[]) => vi.mocked(cn.entregasDoPeriodo).mockImplementation(async (_id, de) => (de === D ? es : []));

describe("processarNoites", () => {
  it("pede ao Infleet de 00:00 do dia até 12:00 do dia seguinte e grava as noites", async () => {
    comEntregas([entrega({})]);
    expect(await processarNoites(1, D)).toBe(1);
    expect(inf.buscarGpsLinha).toHaveBeenCalledWith("v1", { inicio: brt(`${D}T00:00`), fim: brt("2026-10-06T12:00") }, expect.anything());
    const [rev, noites] = vi.mocked(gravarNoites).mock.calls[0];
    expect(rev).toBe(1);
    expect(noites).toMatchObject([{ dia: D, placa: "AAA-1111", motorista: "ANA", classificacao: "evitavel" }]); // perto, dava para chegar, não voltou de manhã
  });
  it("placa sem rastreador é pulada", async () => {
    comEntregas([entrega({}), entrega({ routeId: "R2", placa: "ZZZ-9999" })]);
    expect(await processarNoites(1, D)).toBe(1);
    expect(inf.buscarGpsLinha).toHaveBeenCalledTimes(1);
  });
  it("sem Sede na conta → erro", async () => {
    comEntregas([entrega({})]);
    vi.mocked(inf.sedeDaConta).mockResolvedValue(null);
    await expect(processarNoites(1, D)).rejects.toThrow("cerca Sede não encontrada no Infleet");
  });
  it("duas rotas da mesma placa no dia → uma noite, motorista da rota que começou por último", async () => {
    comEntregas([
      entrega({ rotaInicio: brt(`${D}T06:00`), rotaFim: brt(`${D}T09:00`), baixaEm: brt(`${D}T08:00`) }),
      entrega({ routeId: "R2", motorista: "BETO", rotaInicio: brt(`${D}T09:00`), baixaEm: brt(`${D}T11:00`) }),
    ]);
    expect(await processarNoites(1, D)).toBe(1);
    expect(vi.mocked(gravarNoites).mock.calls[0][1]).toMatchObject([{ motorista: "BETO" }]);
  });
});
