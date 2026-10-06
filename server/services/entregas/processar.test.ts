import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import * as XLSX from "xlsx";

vi.mock("../../routers/infleetRouter", () => ({ infleetQuery: vi.fn() }));
vi.mock("./infleetEntregas", async importOriginal => ({
  ...(await importOriginal<typeof import("./infleetEntregas")>()),
  mapaVeiculos: vi.fn(),
  buscarGpsLinha: vi.fn(),
}));
import { mapaVeiculos, buscarGpsLinha } from "./infleetEntregas";
import { processarPlanilha } from "./processar";

function planilha(linhas: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Geracao_Dado_BI");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

const linha = (o: Record<string, unknown>): Record<string, unknown> => ({
  "RouteId": 1, "Placa": "SOL-6B13", "Motorista": "ANTONIO", "Código do Cliente": 10,
  "Descrição do Ponto": "CLIENTE", "Latitude": -7, "Longitude": -43, "Situação": "ENTREGUE",
  "Data de Chegada": "05/10/2026", "Hora de Chegada": "10:00:00",
  "Data Rota Inicio Realizada": "05/10/2026", "Hora Rota Inicio Realizada": "07:00:00",
  "Data Rota Fim Realizada": "05/10/2026", "Hora Rota Fim Realizada": "18:00:00",
  "Odometro Inicial Real. Informado": "", "Odometro Final Real. Informado": "", ...o,
});

const inicio = new Date("2026-10-05T09:55:00-03:00");
const gpsNoCliente = {
  erro: null, kmGps: 50, ociosoMin: null, saidaOrigem: "gps" as const, retornoOrigem: "gps" as const, saida: new Date("2026-10-05T07:30:00-03:00"), retorno: new Date("2026-10-05T17:00:00-03:00"),
  paradas: [{ lat: -7, lon: -43, inicio, fim: new Date(inicio.getTime() + 10 * 60000), min: 10 }],
};

beforeEach(() => {
  (mapaVeiculos as Mock).mockReset();
  (buscarGpsLinha as Mock).mockReset();
});

describe("processarPlanilha", () => {
  it("cruza cada linha com o GPS, ordena por dia/placa/motorista e marca placa sem rastreador", async () => {
    (mapaVeiculos as Mock).mockResolvedValue(new Map([["SOL6B13", "v1"]]));
    (buscarGpsLinha as Mock).mockResolvedValue(gpsNoCliente);
    const rs = await processarPlanilha(planilha([
      linha({ "RouteId": 2, "Placa": "ABC-1234", "Motorista": "ZE", "Código do Cliente": 20 }),
      linha({}),
    ]), new Date("2026-10-06T12:00:00-03:00"));

    expect(rs.map(r => [r.linha.data, r.linha.placa, r.semGps])).toEqual([
      ["2026-10-05", "ABC-1234", "sem rastreador"],
      ["2026-10-05", "SOL-6B13", null],
    ]);
    expect(rs[1].noRaio).toBe(1);
    expect((buscarGpsLinha as Mock).mock.calls.map(c => c[0])).toEqual(["v1"]);
  });

  it("repassa a cerca escolhida para a busca do GPS", async () => {
    (mapaVeiculos as Mock).mockResolvedValue(new Map([["SOL6B13", "v1"]]));
    (buscarGpsLinha as Mock).mockResolvedValue(gpsNoCliente);
    await processarPlanilha(planilha([linha({})]), new Date("2026-10-06T12:00:00-03:00"), { cercaId: "sede" });
    expect((buscarGpsLinha as Mock).mock.calls[0][2]).toBe("sede");
  });

  it("usa o raio informado no cruzamento", async () => {
    (mapaVeiculos as Mock).mockResolvedValue(new Map([["SOL6B13", "v1"]]));
    const a400m = { ...gpsNoCliente, paradas: [{ ...gpsNoCliente.paradas[0], lat: -7 + 0.0036 }] };
    (buscarGpsLinha as Mock).mockResolvedValue(a400m);
    const agora = new Date("2026-10-06T12:00:00-03:00");
    expect((await processarPlanilha(planilha([linha({})]), agora))[0].noRaio).toBe(0);
    expect((await processarPlanilha(planilha([linha({})]), agora, { raioM: 500 }))[0].noRaio).toBe(1);
  });

  it("planilha sem rota iniciada devolve lista vazia sem chamar o Infleet", async () => {
    const rs = await processarPlanilha(planilha([linha({
      "Situação": "AGUARDANDO", "Data de Chegada": "", "Hora de Chegada": "",
      "Data Rota Inicio Realizada": "", "Hora Rota Inicio Realizada": "",
      "Data Rota Fim Realizada": "", "Hora Rota Fim Realizada": "",
    })]), new Date());
    expect(rs).toEqual([]);
    expect(mapaVeiculos).not.toHaveBeenCalled();
  });
});
