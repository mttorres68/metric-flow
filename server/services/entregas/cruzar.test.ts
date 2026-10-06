import { describe, it, expect } from "vitest";
import { cruzar, excecoes, montarLinhas, type GpsLinha, type LinhaDia } from "./cruzar";
import type { Entrega } from "./parseCheckNow";
import type { Parada } from "./detectarParadas";

const brt = (s: string) => new Date(`${s}:00-03:00`); // "2026-10-05T10:00"

const entrega = (o: Partial<Entrega> = {}): Entrega => ({
  routeId: "R1", placa: "SOO-8D21", motorista: "ANTONIO",
  codCliente: "1", cliente: "C1", lat: -7, lon: -43,
  situacao: "ENTREGUE", baixaEm: brt("2026-10-05T10:00"),
  rotaInicio: brt("2026-10-05T07:00"), rotaFim: null,
  odoIniInformado: null, odoFimInformado: null, ...o,
});

const parada = (lat: number, lon: number, inicio: string, min: number): Parada =>
  ({ lat, lon, inicio: brt(inicio), fim: new Date(brt(inicio).getTime() + min * 60000), min });

const gps = (paradas: Parada[], o: Partial<GpsLinha> = {}): GpsLinha => ({
  erro: null, paradas, kmGps: 120, saidaOrigem: "gps", retornoOrigem: "gps",
  saida: brt("2026-10-05T07:30"), retorno: brt("2026-10-05T18:00"), ...o,
});

const linha = (o: Partial<LinhaDia> = {}): LinhaDia => ({
  data: "2026-10-05", placa: "SOO-8D21", motorista: "ANTONIO", routeId: "R1",
  janela: { inicio: brt("2026-10-05T07:00"), fim: brt("2026-10-05T23:59") }, fechaRota: false, ...o,
});

const CINQUENTA_M = -7 + 0.00045; // ≈ 50 m ao norte do cliente (-7, -43)
const UM_KM = -7 + 0.009;         // ≈ 1000 m
const LONGE = -6.9;               // ≈ 11 km

describe("montarLinhas", () => {
  it("uma linha por dia da rota e janelas separadas na troca de motorista", () => {
    const r1 = { routeId: "R1", motorista: "ANTONIO", rotaInicio: brt("2026-10-02T07:21"), rotaFim: brt("2026-10-05T06:51") };
    const r2 = { routeId: "R2", motorista: "FRANCISCO", rotaInicio: brt("2026-10-05T06:52"), rotaFim: null };
    const linhas = montarLinhas([
      entrega({ ...r1, codCliente: "1", baixaEm: brt("2026-10-02T10:00") }),
      entrega({ ...r1, codCliente: "2", baixaEm: brt("2026-10-03T10:00") }),
      entrega({ ...r2, codCliente: "3", baixaEm: brt("2026-10-05T10:00") }),
    ], brt("2026-10-05T18:00"));

    const r1Linhas = linhas.filter(l => l.routeId === "R1");
    expect(r1Linhas.map(l => l.data)).toEqual(["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(r1Linhas[0].janela.inicio.toISOString()).toBe("2026-10-02T03:00:00.000Z"); // dia inteiro: 00:00, não o início no app
    expect(r1Linhas[0].janela.fim.toISOString()).toBe("2026-10-03T02:59:59.000Z");
    const r1Dia5 = r1Linhas[3];
    expect(r1Dia5.janela.inicio.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(r1Dia5.janela.fim.toISOString()).toBe("2026-10-05T09:51:00.000Z");
    expect(r1Dia5.fechaRota).toBe(true);

    const [r2Dia5] = linhas.filter(l => l.routeId === "R2");
    expect(r2Dia5.janela.inicio.toISOString()).toBe("2026-10-05T09:51:00.000Z");
    expect(r2Dia5.janela.fim.toISOString()).toBe("2026-10-05T21:00:00.000Z"); // agora
    expect(r2Dia5.fechaRota).toBe(false);
  });

  it("rota que fecha no meio do dia, sem outra rota no caminhão, usa o dia inteiro (pega o retorno à base)", () => {
    const [l] = montarLinhas([entrega({ rotaInicio: brt("2026-10-05T08:44"), rotaFim: brt("2026-10-05T13:00") })], brt("2026-10-06T12:00"));
    expect(l.janela.inicio.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(l.janela.fim.toISOString()).toBe("2026-10-06T02:59:59.000Z");
  });

  it("troca de motorista sem fim registrado na rota anterior: corta no início da rota seguinte", () => {
    const linhas = montarLinhas([
      entrega({ routeId: "R1", motorista: "A", rotaInicio: brt("2026-10-05T06:00"), rotaFim: null, baixaEm: brt("2026-10-05T09:00") }),
      entrega({ routeId: "R2", motorista: "B", rotaInicio: brt("2026-10-05T12:00"), rotaFim: null, baixaEm: brt("2026-10-05T14:00") }),
    ], brt("2026-10-05T18:00"));
    const [a, b] = ["R1", "R2"].map(id => linhas.find(l => l.routeId === id)!);
    expect(a.janela.fim.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(b.janela.inicio.toISOString()).toBe("2026-10-05T15:00:00.000Z");
  });

  it("rota não iniciada não gera linha", () => {
    expect(montarLinhas([entrega({ rotaInicio: null, baixaEm: null, situacao: "AGUARDANDO" })], new Date())).toEqual([]);
  });
});

describe("cruzar", () => {
  it("no_raio: parada de 5 min a 50 m", () => {
    const r = cruzar(linha(), [entrega()], gps([parada(CINQUENTA_M, -43, "2026-10-05T09:55", 5)]));
    expect(r).toMatchObject({ noRaio: 1, relampago: 0, semParada: 0, baixasComCoord: 1, baixas: [{ status: "no_raio", permanenciaMin: 5 }] });
  });

  it("relampago: parada de 2 min no raio vira exceção", () => {
    const r = cruzar(linha(), [entrega()], gps([parada(CINQUENTA_M, -43, "2026-10-05T09:55", 2)]));
    expect(r.relampago).toBe(1);
    expect(r.baixas[0]).toMatchObject({ status: "relampago", permanenciaMin: 2 });
  });

  it("soma as paradas no raio para a permanência", () => {
    const r = cruzar(linha(), [entrega()], gps([
      parada(CINQUENTA_M, -43, "2026-10-05T09:50", 2),
      parada(-7, -43, "2026-10-05T10:05", 2),
    ]));
    expect(r.noRaio).toBe(1);
  });

  it("sem_parada: guarda a distância da parada mais próxima", () => {
    const r = cruzar(linha(), [entrega()], gps([parada(UM_KM, -43, "2026-10-05T10:00", 10)]));
    expect(r.semParada).toBe(1);
    expect(r.baixas[0].status).toBe("sem_parada");
    expect(r.baixas[0].distMaisProximaM).toBeGreaterThan(990);
    expect(r.baixas[0].distMaisProximaM).toBeLessThan(1010);
  });

  it("sem_coordenada: exceção fora dos percentuais", () => {
    const r = cruzar(linha(), [entrega({ lat: null, lon: null })], gps([]));
    expect(r.baixasComCoord).toBe(0);
    expect(r.baixas[0]).toMatchObject({ status: "sem_coordenada", distMaisProximaM: null });
  });

  it("clientes vizinhos podem ser atendidos pela mesma parada", () => {
    const r = cruzar(linha(), [entrega(), entrega({ codCliente: "2", lat: -7.0009 })],
      gps([parada(-7.00045, -43, "2026-10-05T09:55", 5)]));
    expect(r.noRaio).toBe(2);
  });

  it("baixas traz todas as baixas do dia (inclusive no_raio), cada uma com seu status", () => {
    const r = cruzar(linha(), [entrega(), entrega({ codCliente: "2", lat: UM_KM })],
      gps([parada(CINQUENTA_M, -43, "2026-10-05T09:55", 5)]));
    expect(r.baixas.map(b => [b.entrega.codCliente, b.status])).toEqual([["1", "no_raio"], ["2", "sem_parada"]]);
  });

  it("excecoes() devolve só as baixas que não ficaram no raio", () => {
    const r = cruzar(linha(), [entrega(), entrega({ codCliente: "2", lat: UM_KM })],
      gps([parada(CINQUENTA_M, -43, "2026-10-05T09:55", 5)]));
    expect(excecoes(r).map(b => b.entrega.codCliente)).toEqual(["2"]);
  });

  it("ignora baixas de outro dia e conta entregas do dia sobre o total da rota", () => {
    const r = cruzar(linha(), [entrega(), entrega({ codCliente: "2", baixaEm: brt("2026-10-04T10:00") }),
      entrega({ codCliente: "3", situacao: "AGUARDANDO", baixaEm: null })], gps([]));
    expect(r.entregasDia).toBe(1);
    expect(r.totalRota).toBe(3);
  });

  // Review Focus 5
  it("após 14h conta só ENTREGUE e inclui 14:00 exato", () => {
    const r = cruzar(linha(), [
      entrega({ codCliente: "1", baixaEm: brt("2026-10-05T10:00") }),
      entrega({ codCliente: "2", baixaEm: brt("2026-10-05T14:00") }),
      entrega({ codCliente: "3", baixaEm: brt("2026-10-05T15:30") }),
      entrega({ codCliente: "4", baixaEm: brt("2026-10-05T16:00"), situacao: "PROBLEMA" }),
    ], gps([]));
    expect(r.entregasDia).toBe(3);
    expect(r.apos14h).toBe(2);
  });

  it("linha sem GPS: só KPIs do CheckNow, sem exceções", () => {
    const r = cruzar(linha(), [entrega()], gps([], { erro: "sem rastreador" }));
    expect(r).toMatchObject({ semGps: "sem rastreador", entregasDia: 1, noRaio: 0, saida: null, kmGps: null, baixas: [] });
  });

  it("paradas sem cliente: só ≥ 10 min, entre saída e retorno, longe de todo cliente", () => {
    const r = cruzar(linha(), [entrega()], gps([
      parada(LONGE, -43, "2026-10-05T00:00", 450),     // pernoite (antes da saída)
      parada(LONGE, -43, "2026-10-05T12:00", 60),      // almoço → conta
      parada(LONGE, -43, "2026-10-05T15:00", 5),       // curta
      parada(CINQUENTA_M, -43, "2026-10-05T13:30", 30), // no cliente
      parada(LONGE, -43, "2026-10-05T18:00", 300),     // depois do retorno
    ]));
    expect(r.paradasSemCliente).toEqual({ qtd: 1, min: 60 });
  });

  // Review Focus 4
  it("caminhão parado o dia todo: saída/retorno null e nenhuma parada sem cliente", () => {
    const r = cruzar(linha(), [entrega()],
      gps([parada(-7, -43, "2026-10-05T00:00", 1439)], { saida: null, retorno: null }));
    expect(r.saida).toBeNull();
    expect(r.retorno).toBeNull();
    expect(r.paradasSemCliente.qtd).toBe(0);
    expect(r.noRaio).toBe(1);
  });

  it("pendentes e km informado só no dia em que a rota fecha", () => {
    const es = [entrega({ odoIniInformado: 1000, odoFimInformado: 1334 }),
      entrega({ codCliente: "2", situacao: "AGUARDANDO", baixaEm: null })];
    expect(cruzar(linha({ fechaRota: true }), es, gps([]))).toMatchObject({ pendentes: 1, kmInformado: 334 });
    expect(cruzar(linha(), es, gps([]))).toMatchObject({ pendentes: null, kmInformado: null });
  });
});
