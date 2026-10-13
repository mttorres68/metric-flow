import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("../checknow/repo", () => ({ entregasDoPeriodo: vi.fn(), tokenInfleet: vi.fn() }));
vi.mock("../entregas/infleetEntregas", () => ({
  mapaVeiculos: vi.fn(), buscarGpsLinha: vi.fn(), sedeDaConta: vi.fn(),
  normalizarPlaca: (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, ""),
}));
vi.mock("../configService", async () => ({ getConfigEntregas: async () => (await import("@shared/entregas")).CONFIG_ENTREGAS_PADRAO }));
vi.mock("./repo", () => ({ gravarNoites: vi.fn() }));
vi.mock("../desvio/repo", () => ({ gravarEvidencias: vi.fn() }));
vi.mock("../produtividadeRota/registrar", () => ({ registrarRotasDia: vi.fn(async () => 1) }));
import * as cn from "../checknow/repo";
import * as inf from "../entregas/infleetEntregas";
import { gravarNoites } from "./repo";
import { gravarEvidencias } from "../desvio/repo";
import { registrarRotasDia } from "../produtividadeRota/registrar";
import { processarNoites, reprocessar, statusReprocessamento } from "./processar";
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
    expect(gravarEvidencias).toHaveBeenCalledWith(1, [expect.objectContaining({ dia: D, routeId: "R1", codCliente: "1", documentos: [] })]);
    expect(registrarRotasDia).toHaveBeenCalledWith(1, D, "sede");
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
  it("cliente já entregue no dia não conta como cliente da manhã seguinte (rota de vários dias)", async () => {
    const e = entrega({ lat: -7.1 });
    vi.mocked(cn.entregasDoPeriodo).mockImplementation(async () => [e]); // rota aberta: volta também no dia seguinte
    vi.mocked(inf.buscarGpsLinha).mockResolvedValue({ ...gps, paradas: [
      { lat: -7.11, lon: -43.02, inicio: brt(`${D}T15:00`), fim: brt("2026-10-06T05:30"), min: 870 },
      { lat: -7.1, lon: -43.02, inicio: brt("2026-10-06T05:35"), fim: brt("2026-10-06T05:40"), min: 5 }, // perto do cliente de ontem
      { lat: -6.77, lon: -43.02, inicio: brt("2026-10-06T07:00"), fim: brt("2026-10-06T07:30"), min: 30 }, // Sede
    ] } as never);
    await processarNoites(1, D);
    expect(vi.mocked(gravarNoites).mock.calls[0][1]).toMatchObject([{ classificacao: "na_malicia" }]);
  });
  it("reprocessar conta os dias que falharam", async () => {
    comEntregas([entrega({})]);
    vi.mocked(inf.sedeDaConta).mockResolvedValue(null);
    reprocessar(7, D, "2026-10-06");
    await vi.waitFor(() => expect(statusReprocessamento(7)?.rodando).toBe(false));
    expect(statusReprocessamento(7)).toMatchObject({ feitos: 2, total: 2, erros: 2, ultimoErro: "cerca Sede não encontrada no Infleet" });
  });
  it("placa no Infleet sem nenhuma posição na janela → noite 'sem sinal GPS'; falha da API → pulada", async () => {
    comEntregas([entrega({}), entrega({ routeId: "R2", placa: "BBB-2222", motorista: "ISRAEL" })]);
    vi.mocked(inf.buscarGpsLinha).mockImplementation(async vId => (vId === "v1"
      ? { ...gps, erro: "sem sinal GPS", paradas: [] } : { ...gps, erro: "falha no Infleet", paradas: [] }) as never);
    expect(await processarNoites(1, D)).toBe(1);
    expect(vi.mocked(gravarNoites).mock.calls[0][1]).toMatchObject([
      { placa: "AAA-1111", motorista: "ANA", classificacao: "sem_sinal", lat: null, sinais: { perto: { ok: false, motivo: "sem sinal GPS" } } },
    ]);
  });
  it("erro na produtividade da rota: o pernoite fica gravado e o dia conta como erro", async () => {
    comEntregas([entrega({})]);
    vi.mocked(registrarRotasDia).mockRejectedValueOnce(new Error("falha no Infleet"));
    await expect(processarNoites(1, D)).rejects.toThrow("falha no Infleet");
    expect(gravarNoites).toHaveBeenCalled();
  });
});

