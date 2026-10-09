import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";
import { paraLinha, deLinha, abrirSegredos, lerToken, deveColetarAuto } from "./repo";
import { cifrar } from "./cofre";
import type { Entrega } from "../entregas/parseCheckNow";

const e: Entrega = {
  routeId: "77", placa: "SOL-6B13", motorista: "ANTONIO", codCliente: "10", cliente: "MERCADO X",
  lat: -7, lon: -43, latApp: -7.001, lonApp: -43.002, situacao: "ENTREGUE", baixaEm: new Date("2026-10-05T13:00:00Z"), saidaApp: null,
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

describe("repo — segredos", () => {
  it("chave trocada: erro claro para recadastrar; token ilegível cai no padrão do servidor", () => {
    process.env.CHECKNOW_CHAVE = randomBytes(32).toString("base64");
    const conta = { checknowSenha: cifrar("s"), infleetToken: cifrar("t") };
    expect(abrirSegredos(conta)).toEqual({ senha: "s", infleetToken: "t" });
    expect(lerToken(conta.infleetToken)).toBe("t");
    process.env.CHECKNOW_CHAVE = randomBytes(32).toString("base64");
    expect(() => abrirSegredos(conta)).toThrow("credenciais cifradas com outra CHECKNOW_CHAVE — recadastre a conta");
    expect(lerToken(conta.infleetToken)).toBeUndefined();
    expect(lerToken(null)).toBeUndefined();
  });
});

describe("repo — coleta automática", () => {
  it("login recusado para a coleta automática até a conta ser editada", () => {
    expect(deveColetarAuto({ ultimaColetaOk: false, ultimaColetaErro: "login recusado" })).toBe(false);
    expect(deveColetarAuto({ ultimaColetaOk: false, ultimaColetaErro: "resposta não é Excel" })).toBe(true);
    expect(deveColetarAuto({ ultimaColetaOk: null, ultimaColetaErro: null })).toBe(true);
  });
});
