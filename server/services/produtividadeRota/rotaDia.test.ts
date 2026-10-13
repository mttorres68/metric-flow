import { describe, it, expect } from "vitest";
import { agregarRotas, entregasPorDia, rotaDiaDe, type RotaDia } from "./rotaDia";
import type { LinhaProcessada } from "../entregas/cruzarDia";
import type { Entrega } from "../entregas/parseCheckNow";

const brt = (s: string) => new Date(`${s}:00-03:00`);
const dia = (o: Partial<RotaDia>): RotaDia => ({
  routeId: "R1", dia: "2026-10-05", placa: "SOL-6B13", motorista: "ANA", saida: brt("2026-10-05T06:00"), retorno: brt("2026-10-05T16:00"),
  jornadaMin: 600, rodandoMin: 240, emClienteMin: 300, paradoSemClienteMin: 60, idaMin: 60, voltaMin: 50,
  entregas: 20, aEntregar: 40, totalRota: 40, hl: 30, hlPorHora: 3, devPct: 2, kmGps: 150, semGps: null, parcial: false, incompleto: false,
  rotaInicio: brt("2026-10-05T05:50"), rotaFim: brt("2026-10-06T15:00"), ...o,
});

describe("rotaDiaDe", () => {
  it("leva os números da linha do dia e a jornada da saída ao retorno (sem retorno: saída do último cliente)", () => {
    const l = {
      linha: { routeId: "R1", data: "2026-10-05", placa: "SOL-6B13", motorista: "ANA" },
      saida: brt("2026-10-05T06:00"), retorno: null, gpsClientes: { primeiraChegada: null, ultimaSaida: brt("2026-10-05T15:30") },
      tempo: null, ida: { min: 55, km: 30 }, volta: null, entregasDia: 18, aEntregar: 40, totalRota: 40, kmGps: 120, semGps: null,
      produtividade: { hl: 27.5, hlPorHora: 2.895, devPct: 1.5, parcial: true, incompleto: false },
    } as unknown as LinhaProcessada;
    const e = { rotaInicio: brt("2026-10-05T05:50"), rotaFim: null } as Entrega;
    expect(rotaDiaDe(l, [e])).toMatchObject({
      routeId: "R1", dia: "2026-10-05", jornadaMin: 570, rodandoMin: null, idaMin: 55, voltaMin: null, entregas: 18, hl: 27.5,
      hlPorHora: 2.895, parcial: true, rotaInicio: brt("2026-10-05T05:50"), rotaFim: null,
    });
  });
});

describe("agregarRotas", () => {
  it("hL/h ponderado pelas horas dos dias com hL/h; dia sem GPS fora do tempo, mas dentro de hL e entregas", () => {
    const r = agregarRotas([
      dia({}),                                                                              // 30 hL em 10 h
      dia({ dia: "2026-10-06", jornadaMin: 120, hl: 2, hlPorHora: 1, entregas: 5 }),           // 2 hL em 2 h
      dia({ dia: "2026-10-07", jornadaMin: null, rodandoMin: null, emClienteMin: null, paradoSemClienteMin: null,
        hlPorHora: null, hl: 10, entregas: 10, semGps: "sem sinal GPS", kmGps: null }),
    ]).rotas[0];
    expect(r.hlPorHora).toBeCloseTo(32 / 12, 3);            // não (3 + 1) / 2
    expect(r).toMatchObject({ dias: 3, hl: 42, entregues: 35, clientes: 40, entreguePct: 87.5, jornadaMin: 720, diasSemGps: 1, emAndamento: false });
    expect(r.entregasPorHora).toBeCloseTo(25 / 12, 3);
    expect(r.hlPorKm).toBeCloseTo(32 / 300, 3);
  });
  it("dia com GPS e sem volume do ERP não entra no hL/h", () => {
    const r = agregarRotas([dia({}), dia({ dia: "2026-10-06", hlPorHora: null, hl: 0, incompleto: true })]).rotas[0];
    expect(r.hlPorHora).toBe(3);
    expect(r.incompleto).toBe(true);
  });
  it("ranking: menos produtiva primeiro; sem jornada no fim; em andamento à parte; resumo ponderado", () => {
    const rk = agregarRotas([
      dia({ routeId: "A", hl: 60, hlPorHora: 6 }),
      dia({ routeId: "B", hl: 20, hlPorHora: 2 }),
      dia({ routeId: "C", jornadaMin: null, hlPorHora: null, semGps: "sem rastreador" }),
      dia({ routeId: "D", rotaFim: null }),
    ]);
    expect(rk.rotas.map(r => r.routeId)).toEqual(["B", "A", "C"]);
    expect(rk.rotas[2].semJornada).toBe(true);
    expect(rk.emAndamento.map(r => r.routeId)).toEqual(["D"]);
    expect(rk.resumo).toMatchObject({ rotas: 3, tempoMedioMin: 600 });
    expect(rk.resumo.hlPorHora).toBeCloseTo(80 / 20, 3);
  });
  it("vazio → sem rotas e resumo nulo", () => {
    expect(agregarRotas([])).toEqual({ rotas: [], emAndamento: [], resumo: { rotas: 0, hlPorHora: null, entregasPorHora: null, tempoMedioMin: null } });
  });
});

describe("entregasPorDia", () => {
  it("um item por dia do período, com o total e por rota", () => {
    const r = entregasPorDia([dia({}), dia({ routeId: "B", entregas: 7 }), dia({ dia: "2026-10-07", entregas: 4 })], "2026-10-05", "2026-10-07", ["B"]);
    expect(r).toEqual([
      { dia: "2026-10-05", total: 27, porRota: { B: 7 } },
      { dia: "2026-10-06", total: 0, porRota: { B: 0 } },
      { dia: "2026-10-07", total: 4, porRota: { B: 0 } },
    ]);
  });
});
