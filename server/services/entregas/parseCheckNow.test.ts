import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseCheckNow, PlanilhaInvalidaError, dataHoraBRT } from "./parseCheckNow";

function planilha(linhas: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Geracao_Dado_BI");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

const base: Record<string, unknown> = {
  "RouteId": 1791041162179,
  "Placa": "SOL-6B13",
  "Motorista": "ANTONIO",
  "Código do Cliente": 160089,
  "Descrição do Ponto": "CLIENTE A",
  "Latitude": -7.093788,
  "Longitude": -43.510433,
  "Situação": "ENTREGUE",
  "Data de Chegada": "05/10/2026",
  "Hora de Chegada": "09:28:07",
  "Data Rota Inicio Realizada": "05/10/2026",
  "Hora Rota Inicio Realizada": "08:44:41",
  "Data Rota Fim Realizada": "",
  "Hora Rota Fim Realizada": "",
  "Odometro Inicial Real. Informado": 101625,
  "Odometro Final Real. Informado": "",
};

describe("parseCheckNow", () => {
  it("converte uma linha em Entrega com datas em BRT", () => {
    const [e] = parseCheckNow(planilha([base]));
    expect(e).toMatchObject({
      routeId: "1791041162179", placa: "SOL-6B13", motorista: "ANTONIO",
      codCliente: "160089", cliente: "CLIENTE A",
      lat: -7.093788, lon: -43.510433, situacao: "ENTREGUE",
      rotaFim: null, odoIniInformado: 101625, odoFimInformado: null,
    });
    expect(e.baixaEm?.toISOString()).toBe("2026-10-05T12:28:07.000Z");
    expect(e.rotaInicio?.toISOString()).toBe("2026-10-05T11:44:41.000Z");
  });

  it("deduplica por RouteId + Código do Cliente (várias notas e linhas repetidas)", () => {
    const outroCliente = { ...base, "Código do Cliente": 340007 };
    const entregas = parseCheckNow(planilha([base, base, { ...base, "Descrição do Ponto": "NF 2" }, outroCliente]));
    expect(entregas.map(e => e.codCliente)).toEqual(["160089", "340007"]);
  });

  it("coordenada zero vira null", () => {
    const [e] = parseCheckNow(planilha([{ ...base, "Latitude": -0, "Longitude": 0 }]));
    expect(e.lat).toBeNull();
    expect(e.lon).toBeNull();
  });

  it("AGUARDANDO sem baixa tem baixaEm null", () => {
    const [e] = parseCheckNow(planilha([{ ...base, "Situação": "AGUARDANDO", "Data de Chegada": "", "Hora de Chegada": "" }]));
    expect(e.situacao).toBe("AGUARDANDO");
    expect(e.baixaEm).toBeNull();
  });

  it("lista as colunas faltantes", () => {
    const semDuas = Object.fromEntries(Object.entries(base).filter(([k]) => k !== "Placa" && k !== "Latitude"));
    try {
      parseCheckNow(planilha([semDuas]));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PlanilhaInvalidaError);
      expect((e as PlanilhaInvalidaError).faltando).toEqual(["Placa", "Latitude"]);
    }
  });

  // Review Focus 2
  it("arquivo que não é a planilha do CheckNow vira PlanilhaInvalidaError", () => {
    expect(() => parseCheckNow(Buffer.from("isto não é uma planilha"))).toThrow(PlanilhaInvalidaError);
  });

  // Review Focus 1
  it("aceita data e hora como número serial do Excel", () => {
    const serial = Date.UTC(2026, 9, 5) / 86400000 + 25569; // 05/10/2026
    const [e] = parseCheckNow(planilha([{ ...base, "Data de Chegada": serial, "Hora de Chegada": 0.5 }]));
    expect(e.baixaEm?.toISOString()).toBe("2026-10-05T15:00:00.000Z"); // 12:00 BRT
  });
});

describe("parseCheckNow — dados da rota (colunas opcionais)", () => {
  const extra = {
    "Documento": 202610030111, "Valor (R$)": "R$ 3.153,98", "Peso (Kg)": 413.44, "Ordem Planejada": 34,
    "Motivo Problema": "", "Capacidade Veículo": 8000, "Cidade": "BERTOLINIA",
  };

  it("soma valor, peso e notas distintas do cliente, ignorando linhas repetidas", () => {
    const [e] = parseCheckNow(planilha([
      { ...base, ...extra },
      { ...base, ...extra },                                                   // linha repetida
      { ...base, ...extra, "Documento": 202610030124, "Valor (R$)": "R$ 1.000,02", "Peso (Kg)": 100 },
    ]));
    expect(e.notas).toBe(2);
    expect(e.valor).toBeCloseTo(4154, 2);
    expect(e.pesoKg).toBeCloseTo(513.44, 2);
    expect(e).toMatchObject({ ordemPlanejada: 34, capacidadeKg: 8000, cidade: "BERTOLINIA", motivoProblema: null });
  });

  it("lê o horário de saída do cliente no app (opcional)", () => {
    const [e] = parseCheckNow(planilha([{ ...base, ...extra, "Data de Saída": "05/10/2026", "Hora de Saída": "09:40:00" }]));
    expect(e.saidaApp?.toISOString()).toBe("2026-10-05T12:40:00.000Z");
    expect(parseCheckNow(planilha([base]))[0].saidaApp).toBeNull();
  });

  it("lê onde o motorista registrou a entrega no app (Latitude/Longitude Final; zero ou ausente = null)", () => {
    const [e] = parseCheckNow(planilha([{ ...base, "Latitude Final": -6.973179817199707, "Longitude Final": -42.66939163208008 }]));
    expect([e.latApp, e.lonApp]).toEqual([-6.973179817199707, -42.66939163208008]);
    expect(parseCheckNow(planilha([{ ...base, "Latitude Final": 0, "Longitude Final": 0 }]))[0].latApp).toBeNull();
    expect(parseCheckNow(planilha([base]))[0]).toMatchObject({ latApp: null, lonApp: null });
  });

  it("guarda os documentos distintos da entrega (= Pedido do ERP)", () => {
    const [e] = parseCheckNow(planilha([
      { ...base, "Documento": "202610070129" },
      { ...base, "Documento": "202610070129" }, // linha repetida
      { ...base, "Documento": "202610070130" },
    ]));
    expect(e.documentos).toEqual(["202610070129", "202610070130"]);
    expect(parseCheckNow(planilha([base]))[0].documentos).toEqual([]);
  });

  it("lê o motivo do problema", () => {
    const [e] = parseCheckNow(planilha([{ ...base, ...extra, "Situação": "PROBLEMA", "Motivo Problema": "FECHADO/AUSENTE" }]));
    expect(e.motivoProblema).toBe("FECHADO/AUSENTE");
  });

  it("sem as colunas opcionais, usa valores neutros", () => {
    const [e] = parseCheckNow(planilha([base]));
    expect(e).toMatchObject({ notas: 1, valor: 0, pesoKg: 0, ordemPlanejada: null, capacidadeKg: null, cidade: "", motivoProblema: null });
  });
});

describe("dataHoraBRT", () => {
  it("retorna null quando falta data ou hora", () => {
    expect(dataHoraBRT("05/10/2026", "")).toBeNull();
    expect(dataHoraBRT(null, "09:00:00")).toBeNull();
  });
});
