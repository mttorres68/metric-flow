import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";
import { paraLinha, deLinha, abrirSegredos, lerToken, deveColetarAuto, deveColetarPathfind, camposPathfind, enderecoPathfindValido } from "./repo";
import { cifrar } from "./cofre";
import type { Entrega } from "../entregas/parseCheckNow";

const e: Entrega = {
  routeId: "77", placa: "SOL-6B13", motorista: "ANTONIO", codCliente: "10", cliente: "MERCADO X",
  lat: -7, lon: -43, latApp: -7.001, lonApp: -43.002, documentos: ["202610070129"], situacao: "ENTREGUE", baixaEm: new Date("2026-10-05T13:00:00Z"), saidaApp: null,
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

describe("repo — conta do Pathfind (a senha não segue para outro endereço)", () => {
  const atual = { pathfindBase: "https://routing.pathfindsistema.com.br/pathfind_inter_floriano" };
  it("trocar o endereço sem senha nova apaga a senha guardada", () => {
    expect(camposPathfind(atual, { revendaId: 5, checknowUsuario: "u", pathfindBase: "https://routing.pathfindsistema.com.br/outra_empresa" }))
      .toMatchObject({ pathfindBase: "https://routing.pathfindsistema.com.br/outra_empresa", pathfindSenha: null });
  });
  it("mesmo endereço (com barra no fim) mantém a senha; senha nova é cifrada", () => {
    expect(camposPathfind(atual, { revendaId: 5, checknowUsuario: "u", pathfindBase: `${atual.pathfindBase}/` })).not.toHaveProperty("pathfindSenha");
    expect(typeof camposPathfind(atual, { revendaId: 5, checknowUsuario: "u", pathfindBase: "https://routing.pathfindsistema.com.br/x", pathfindSenha: "nova" }).pathfindSenha).toBe("string");
  });
  it("só aceita o endereço do Pathfind (https, routing.pathfindsistema.com.br)", () => {
    expect(enderecoPathfindValido("https://routing.pathfindsistema.com.br/pathfind_inter_floriano")).toBe(true);
    expect(enderecoPathfindValido("https://atacante.example/pathfind")).toBe(false);
    expect(enderecoPathfindValido("http://routing.pathfindsistema.com.br/x")).toBe(false);
  });
});

describe("repo — coleta do Pathfind", () => {
  const base = "https://routing.pathfindsistema.com.br/pathfind_inter_floriano";
  it("só com endereço e sem login recusado pendente", () => {
    expect(deveColetarPathfind({ pathfindBase: null, pathfindUltimaColetaOk: null, pathfindUltimaColetaErro: null })).toBe(false);
    expect(deveColetarPathfind({ pathfindBase: base, pathfindUltimaColetaOk: false, pathfindUltimaColetaErro: "login recusado" })).toBe(false);
    expect(deveColetarPathfind({ pathfindBase: base, pathfindUltimaColetaOk: false, pathfindUltimaColetaErro: "sem simulação" })).toBe(true);
    expect(deveColetarPathfind({ pathfindBase: base, pathfindUltimaColetaOk: null, pathfindUltimaColetaErro: null })).toBe(true);
  });
});
