import { describe, it, expect } from "vitest";
import { escolherRota, planoEmMinutos, previstoDaLinha } from "./previsto";
import type { RotaGravada } from "./repo";

const brt = (s: string) => new Date(`${s}:00-03:00`);
const p = (sequencia: number, codCliente: string, chegada: string, saida: string) =>
  ({ sequencia, pedido: String(sequencia), codCliente, cliente: "C", cidade: "X", chegada, saida, km: null });
const rota = (o: Partial<RotaGravada> = {}): RotaGravada => ({
  dataSimulacao: "2026-10-21", simulacao: "1288", rota: "RT001001", placa: "SOL6B13", motorista: "M",
  paradas: [p(1, "00074565", "07:22", "07:34"), p(2, "00072912", "09:30", "09:40"), p(3, "00000300", "23:07", "23:13"), p(4, "00000400", "00:28", "00:35")],
  ...o,
});
/** Linha do "Por dia" com as baixas: [código do cliente, chegada pelo GPS ou null, hora da baixa no app]. */
const linha = (data: string, baixas: [string, string | null, string][], ultimaSaida: string | null) => ({
  linha: { data, placa: "SOL-6B13", routeId: "R1" },
  baixas: baixas.map(([codCliente, gps, app]) => ({
    entrega: { codCliente, baixaEm: brt(app) },
    paradasNoRaio: gps ? [{ inicio: brt(gps), fim: brt(gps), distM: 10, lat: 0, lon: 0 }] : [],
  })),
  gpsClientes: { primeiraChegada: null, ultimaSaida: ultimaSaida ? brt(ultimaSaida) : null },
  app: { primeira: null, ultima: null, emClienteMin: 0 },
}) as never;

describe("plano em minutos corridos (o Pathfind não prevê pernoite)", () => {
  it("chegada menor que a anterior = dia seguinte; hora igual não vira; saída que passa da meia-noite", () => {
    const m = planoEmMinutos([p(1, "1", "21:34", "21:39"), p(2, "2", "23:07", "23:13"), p(3, "3", "23:07", "23:20"), p(4, "4", "00:28", "00:35"), p(5, "5", "23:53", "00:01")]);
    expect(m.map(x => x.chegadaMin)).toEqual([1294, 1387, 1387, 1468, 2873]);
    expect(m[4].saidaMin).toBe(2881);
  });
});

describe("escolherRota", () => {
  it("placa com/sem traço; simulação da véspera ou do dia; havendo várias, a mais recente", () => {
    const rotas = [rota({ simulacao: "1287" }), rota({ simulacao: "1288" }), rota({ simulacao: "1290", dataSimulacao: "2026-10-23" })];
    expect(escolherRota(rotas, "SOL-6B13", "2026-10-22")?.simulacao).toBe("1288");
    expect(escolherRota(rotas, "SOL-6B13", "2026-10-24")?.simulacao).toBe("1290");
    expect(escolherRota(rotas, "UHQ-5H38", "2026-10-22")).toBeNull();
  });
  it("caminhão que sai todo dia: a simulação da véspera (clientes em comum), não a de hoje feita para amanhã", () => {
    const ontem = rota({ simulacao: "1288", dataSimulacao: "2026-10-21", paradas: [p(1, "00074565", "07:22", "07:34"), p(2, "00072912", "09:30", "09:40")] });
    const hoje = rota({ simulacao: "1289", dataSimulacao: "2026-10-22", paradas: [p(1, "555", "07:10", "07:20"), p(2, "666", "08:00", "08:10")] });
    expect(escolherRota([ontem, hoje], "SOL-6B13", "2026-10-22", ["74565", "72912", "777"])?.simulacao).toBe("1288");
    expect(escolherRota([ontem, hoje], "SOL-6B13", "2026-10-22", ["999"])).toBeNull(); // nenhum cliente em comum
  });
  it("saída na segunda com simulação do sábado ainda casa", () => {
    expect(escolherRota([rota({ dataSimulacao: "2026-10-24" })], "SOL-6B13", "2026-10-26", ["74565"])?.simulacao).toBe("1288");
  });
  it("rota de ontem e de hoje da mesma placa: cada dia de início pega a sua", () => {
    const rotas = [rota({ simulacao: "1288", dataSimulacao: "2026-10-21" }), rota({ simulacao: "1300", dataSimulacao: "2026-10-26" })];
    expect(escolherRota(rotas, "SOL-6B13", "2026-10-22")?.simulacao).toBe("1288");
    expect(escolherRota(rotas, "SOL-6B13", "2026-10-27")?.simulacao).toBe("1300");
  });
});

describe("previstoDaLinha", () => {
  it("1º dia: hora do plano; cliente casa sem zeros à esquerda; atraso da linha e do cliente", () => {
    const l = linha("2026-10-22", [["74565", "2026-10-22T07:51", "2026-10-22T08:00"], ["72912", null, "2026-10-22T10:19"]], "2026-10-22T10:30");
    const r = previstoDaLinha(l, "2026-10-22", [rota()])!;
    expect(r.reancorado).toBe(false);
    expect(r.clientes["74565"]).toEqual({ chegadaPrevista: brt("2026-10-22T07:22"), atrasoMin: 29 });
    expect(r.clientes["72912"].atrasoMin).toBe(49); // sem parada no raio: a hora do app
    expect(r.fimPrevisto).toEqual(brt("2026-10-22T09:40")); // saída do mais adiante no plano entre os atendidos
    expect(r.fimRealizado).toEqual(brt("2026-10-22T10:30"));
    expect(r.atrasoMin).toBe(50);
  });

  it("dias seguintes: o relógio recomeça na 1ª chegada real do dia, no ritmo do plano", () => {
    const l = linha("2026-10-23", [["300", "2026-10-23T07:00", "2026-10-23T07:05"], ["400", "2026-10-23T08:40", "2026-10-23T08:45"]], "2026-10-23T08:50");
    const r = previstoDaLinha(l, "2026-10-22", [rota()])!;
    expect(r.reancorado).toBe(true);
    expect(r.clientes["300"]).toEqual({ chegadaPrevista: brt("2026-10-23T07:00"), atrasoMin: 0 });
    expect(r.clientes["400"]).toEqual({ chegadaPrevista: brt("2026-10-23T08:21"), atrasoMin: 19 }); // plano: 81 min depois
    expect(r.fimPrevisto).toEqual(brt("2026-10-23T08:28"));
  });

  it("cliente fora do Pathfind fica sem previsto; a linha mantém o seu", () => {
    const l = linha("2026-10-22", [["74565", "2026-10-22T07:30", "2026-10-22T07:31"], ["999", "2026-10-22T08:00", "2026-10-22T08:01"]], "2026-10-22T08:10");
    const r = previstoDaLinha(l, "2026-10-22", [rota()])!;
    expect(Object.keys(r.clientes)).toEqual(["74565"]);
    expect(r.fimPrevisto).toEqual(brt("2026-10-22T07:34"));
  });

  it("linha sem GPS: o previsto usa a hora da baixa no app", () => {
    const l = linha("2026-10-22", [], null) as unknown as { app: { ultima: Date | null } };
    l.app.ultima = brt("2026-10-22T10:00");
    const r = previstoDaLinha(l as never, "2026-10-22", [rota()], { baixasApp: [{ codCliente: "00072912", baixaEm: brt("2026-10-22T09:50") }] })!;
    expect(r.clientes["72912"]).toEqual({ chegadaPrevista: brt("2026-10-22T09:30"), atrasoMin: 20 });
    expect(r.fimPrevisto).toEqual(brt("2026-10-22T09:40"));
    expect(r.atrasoMin).toBe(20);
  });
  it("sem rota no Pathfind → null", () => {
    expect(previstoDaLinha(linha("2026-10-22", [["74565", null, "2026-10-22T08:00"]], null), "2026-10-22", [])).toBeNull();
  });
});
