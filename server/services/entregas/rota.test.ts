import { describe, it, expect } from "vitest";
import { analisarRotas } from "./rota";
import { cruzar, montarLinhas, type EventoGps, type GpsLinha, type TipoEvento } from "./cruzar";
import type { Entrega } from "./parseCheckNow";
import type { Parada } from "./detectarParadas";

const brt = (s: string) => new Date(`${s}:00-03:00`);
const lat = (k: number) => -7 + 0.01 * k; // clientes a ~1,1 km um do outro

const cliente = (k: number, o: Partial<Entrega>): Entrega => ({
  routeId: "R1", placa: "SOL-6E53", motorista: "FRANCISCO", codCliente: `c${k}`, cliente: `CLIENTE ${k}`,
  lat: lat(k), lon: -43, situacao: "ENTREGUE", baixaEm: null, saidaApp: null,
  rotaInicio: brt("2026-10-01T07:00"), rotaFim: brt("2026-10-02T18:00"),
  odoIniInformado: 1000, odoFimInformado: 1334,
  ordemPlanejada: k, valor: 0, pesoKg: 0, notas: 1, motivoProblema: null, capacidadeKg: 8000, cidade: `CIDADE ${k}`, ...o,
});

const entregas: Entrega[] = [
  cliente(1, { valor: 100, pesoKg: 3000, baixaEm: brt("2026-10-01T09:00") }),
  cliente(2, { valor: 200, pesoKg: 3000, baixaEm: brt("2026-10-01T10:40") }),
  cliente(3, { valor: 300, pesoKg: 2000, baixaEm: brt("2026-10-01T09:50") }),
  cliente(4, { situacao: "PROBLEMA", motivoProblema: "FECHADO/AUSENTE", valor: 50, pesoKg: 500, baixaEm: brt("2026-10-02T09:00") }),
  cliente(5, { situacao: "PROBLEMA", motivoProblema: "SEM DINHEIRO", valor: 70, pesoKg: 500, baixaEm: brt("2026-10-02T10:00") }),
  cliente(6, { situacao: "AGUARDANDO", valor: 400, pesoKg: 1000 }),
];

const parada = (k: number, inicio: string, min: number): Parada =>
  ({ lat: lat(k), lon: -43, inicio: brt(inicio), fim: new Date(brt(inicio).getTime() + min * 60000), min });

const RODOVIA = "Rodovia Izabel Rodrigues Vieira, Água Branca, Piauí, Brasil";
const ev = (tipo: TipoEvento, quando: string, o: Partial<EventoGps> = {}): EventoGps =>
  ({ tipo, em: brt(quando), endereco: RODOVIA, lat: lat(3), lon: -43, cercaId: null, cerca: null, duracaoMin: null, ...o });

const gpsPorDia: Record<string, GpsLinha> = {
  // dia 1: visita 1 → 3 → 2 (pulou a ordem do 2); estaciona às 18:00 perto do cliente 3, na rodovia
  "2026-10-01": {
    erro: null, saidaOrigem: "gps", retornoOrigem: "gps", kmGps: 100, trajeto: { t: [], km: [] },
    saida: brt("2026-10-01T07:30"), retorno: brt("2026-10-01T18:00"),
    paradas: [parada(1, "2026-10-01T08:50", 10), parada(3, "2026-10-01T09:40", 10), parada(2, "2026-10-01T10:30", 10), parada(3, "2026-10-01T18:00", 600)],
    eventos: [
      ev("deviceIdle", "2026-10-01T10:40", { duracaoMin: 20 }),
      ev("deviceStopped", "2026-10-01T18:00"),
      ev("ignitionOff", "2026-10-01T23:20"), // chave ligada 5h20 depois de parar
    ],
  },
  // dia 2: chave ligada às 02:41 (fora de hora); não passa no cliente 4; para no cliente 5
  "2026-10-02": {
    erro: null, saidaOrigem: "gps", retornoOrigem: "gps", kmGps: 50, trajeto: { t: [], km: [] },
    saida: brt("2026-10-02T07:00"), retorno: brt("2026-10-02T17:00"),
    paradas: [parada(5, "2026-10-02T09:55", 10)],
    eventos: [
      ev("ignitionOn", "2026-10-02T02:41"),
      ev("ignitionOn", "2026-10-02T06:50"),
      ev("deviceMoving", "2026-10-02T07:00"),
      ev("deviceIdle", "2026-10-02T12:00", { duracaoMin: 10 }),
    ],
  },
};

const analisar = (gps: Record<string, GpsLinha>) =>
  analisarRotas(entregas, montarLinhas(entregas, brt("2026-10-03T12:00")).map(l => cruzar(l, entregas, gps[l.data])))[0];
const r = analisar(gpsPorDia);

describe("analisarRotas", () => {
  it("resumo: período, valores por situação e ocupação do caminhão", () => {
    expect(r).toMatchObject({
      routeId: "R1", placa: "SOL-6E53", motorista: "FRANCISCO", dias: ["2026-10-01", "2026-10-02"], clientes: 6, notas: 6,
      entregue: { qtd: 3, valor: 600 }, devolvido: { qtd: 2, valor: 120 }, pendente: { qtd: 1, valor: 400 },
      pesoKg: 10000, capacidadeKg: 8000, ocupacaoPct: 125,
    });
    expect(r.inicio.toISOString()).toBe(brt("2026-10-01T07:00").toISOString());
    expect(r.fim?.toISOString()).toBe(brt("2026-10-02T18:00").toISOString());
  });

  describe("pernoite", () => {
    it("onde, quando e quanto descansou (uma por noite, menos depois do último dia)", () => {
      expect(r.pernoites).toHaveLength(1);
      const p = r.pernoites[0];
      expect(p).toMatchObject({ data: "2026-10-01", endereco: RODOVIA, cidade: "CIDADE 3", local: "rodovia", cerca: null, descansoMin: 780, descansoCurto: false });
      expect([p.parou?.toISOString(), p.saiu?.toISOString()]).toEqual([brt("2026-10-01T18:00").toISOString(), brt("2026-10-02T07:00").toISOString()]);
    });

    it("chave ligada depois de parar e atividade fora de hora", () => {
      const p = r.pernoites[0];
      expect(p.chaveLigadaMin).toBe(320); // 18:00 → 23:20
      expect(p.foraDeHora.map(e => [e.tipo, e.em.toISOString()])).toEqual([["ignitionOn", brt("2026-10-02T02:41").toISOString()]]);
    });

    it("distância até o 1º cliente atendido no dia seguinte", () => {
      expect(r.pernoites[0].primeiroCliente).toMatchObject({ codCliente: "c5", cliente: "CLIENTE 5" });
      expect(r.pernoites[0].primeiroCliente!.distKm).toBeCloseTo(2.2, 1);
    });

    it("descanso abaixo de 11 h fica marcado", () => {
      const curto = analisar({ ...gpsPorDia, "2026-10-02": { ...gpsPorDia["2026-10-02"], saida: brt("2026-10-02T04:30") } });
      expect(curto.pernoites[0]).toMatchObject({ descansoMin: 630, descansoCurto: true });
    });

    it("dias seguidos só: sem entrega no meio (fim de semana parado), não há pernoite ligando os dias", () => {
      const pulado = entregas.map(e => ({
        ...e, rotaFim: brt("2026-10-05T18:00"),
        baixaEm: e.baixaEm && e.baixaEm >= brt("2026-10-02T00:00") ? new Date(e.baixaEm.getTime() + 3 * 86_400_000) : e.baixaEm,
      }));
      const rotas = analisarRotas(pulado, montarLinhas(pulado, brt("2026-10-06T12:00"))
        .map(l => cruzar(l, pulado, gpsPorDia[l.data] ?? gpsPorDia["2026-10-02"])));
      expect(rotas[0].dias).toEqual(["2026-10-01", "2026-10-05"]);
      expect(rotas[0].pernoites).toEqual([]);
    });

    it("dormiu dentro de uma cerca (ex.: Sede)", () => {
      const sede = analisar({
        ...gpsPorDia,
        "2026-10-01": { ...gpsPorDia["2026-10-01"], eventos: [ev("geofenceEnter", "2026-10-01T18:00", { cercaId: "s", cerca: "Sede", endereco: "Rua João Dantas, Floriano" })] },
      });
      expect(sede.pernoites[0]).toMatchObject({ local: "cerca", cerca: "Sede", endereco: "Rua João Dantas, Floriano" });
    });
  });

  it("sequência: ordem real pelo GPS × planejada, marcando os pulos", () => {
    expect(r.sequencia.itens.map(i => [i.ordemReal, i.ordemPlanejada, i.foraSequencia])).toEqual([
      [1, 1, false], [2, 3, false], [3, 2, true], [4, 5, false],
    ]);
    expect(r.sequencia.naSequenciaPct).toBe(75);
    expect(r.sequencia.semParada).toBe(1); // cliente 4
  });

  it("tempo por dia e indicadores de produtividade", () => {
    expect(r.tempoPorDia).toEqual([
      { data: "2026-10-01", jornadaMin: 630, rodandoMin: 600, emClienteMin: 30, paradoSemClienteMin: 0, chaveLigadaMin: 20, marchasLentas: 1 },
      { data: "2026-10-02", jornadaMin: 600, rodandoMin: 590, emClienteMin: 10, paradoSemClienteMin: 0, chaveLigadaMin: 10, marchasLentas: 1 },
    ]);
    expect(r.entregasPorHora).toBeCloseTo(3 / (1230 / 60), 3);
    expect(r.tempoMedioEntregaMin).toBeCloseTo(40 / 3, 3);
  });

  it("distância: km GPS × km informado, por entrega e R$ por km", () => {
    expect(r.distancia).toEqual({ kmGps: 150, kmInformado: 334, diferencaKm: -184, diferencaPct: expect.closeTo(-55.09, 1), kmPorEntrega: 50, reaisPorKm: 4 });
  });

  it("devoluções com prova: o caminhão esteve no cliente?", () => {
    expect(r.devolucoes.itens.map(d => [d.codCliente, d.motivo, d.gps, d.permanenciaMin])).toEqual([
      ["c4", "FECHADO/AUSENTE", "nao_parou", 0],
      ["c5", "SEM DINHEIRO", "esteve", 10],
    ]);
    expect(r.devolucoes.porMotivo).toEqual([
      { motivo: "FECHADO/AUSENTE", qtd: 1, valor: 50 },
      { motivo: "SEM DINHEIRO", qtd: 1, valor: 70 },
    ]);
  });

  it("rota sem GPS: blocos de GPS vazios, resumo continua", () => {
    const semGps = montarLinhas(entregas, brt("2026-10-03T12:00")).map(l =>
      cruzar(l, entregas, { ...gpsPorDia[l.data], erro: "sem rastreador" }));
    const [s] = analisarRotas(entregas, semGps);
    expect(s.entregue.qtd).toBe(3);
    expect(s.sequencia.itens).toEqual([]);
    expect(s.sequencia.naSequenciaPct).toBeNull();
    expect(s.distancia.kmGps).toBeNull();
    expect(s.devolucoes.itens.map(d => d.gps)).toEqual(["sem_gps", "sem_gps"]);
  });
});
