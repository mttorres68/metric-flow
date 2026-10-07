import { describe, it, expect } from "vitest";
import { paraLinha, deLinha } from "./repo";
import type { Entrega } from "../entregas/parseCheckNow";

const e: Entrega = {
  routeId: "77", placa: "SOL-6B13", motorista: "ANTONIO", codCliente: "10", cliente: "MERCADO X",
  lat: -7, lon: -43, situacao: "ENTREGUE", baixaEm: new Date("2026-10-05T13:00:00Z"), saidaApp: null,
  rotaInicio: new Date("2026-10-05T02:30:00Z"), rotaFim: null, odoIniInformado: 100, odoFimInformado: null,
  ordemPlanejada: 3, valor: 10.5, pesoKg: 2, notas: 1, motivoProblema: null, capacidadeKg: null, cidade: "FLORIANO",
};

describe("repo — conversão", () => {
  it("dia é a data BRT do início da rota (23:30 BRT continua no dia anterior)", () => {
    expect(paraLinha(5, e).dia).toBe("2026-10-04");
  });
  it("ida e volta preserva a entrega", () => {
    const { revendaId, dia, ...resto } = paraLinha(5, e);
    expect(revendaId).toBe(5);
    expect(deLinha({ ...resto, id: 1, revendaId, dia, coletadoEm: new Date() })).toEqual(e);
  });
});
