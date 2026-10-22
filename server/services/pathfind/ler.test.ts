import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { lerParadas, lerRotas, lerSimulacoes, redirecionouParaLogin, viewStateParcial } from "./ler";

const fx = (f: string) => readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), "utf8");

describe("leitor do Pathfind (respostas reais reduzidas)", () => {
  it("simulações da data pelo código da linha; sem registro = lista vazia", () => {
    expect(lerSimulacoes(fx("simulacoes.xml"))).toEqual([{ codigo: "1288" }, { codigo: "1287" }]);
    expect(lerSimulacoes(fx("sem-simulacao.xml"))).toEqual([]);
  });

  it("rotas: rota, placa (só a placa), motorista, tempo e km; campos da linha para reenviar", () => {
    const rotas = lerRotas(fx("rotas.xml"));
    expect(rotas).toHaveLength(2);
    expect(rotas[0]).toMatchObject({ indice: 0, rota: "RT001001", placa: "SOL6B13", motorista: "MOTORISTA 1", tempoMin: 23 * 60 + 48, km: 642.84 });
    expect(rotas[1]).toMatchObject({ indice: 1, rota: "RT001002", placa: "UHS3A96", tempoMin: 8 * 60 + 28, km: 46.55 });
    expect(rotas[0].campos["tabelaRotas:0:selectVeiculoComMotoristaId_input"]).toBe("22");
    expect(rotas[0].campos["tabelaRotas:0:motorista_input"]).toBe("4");
  });

  it("paradas: uma por linha, conferida campo a campo; saída que passa da meia-noite fica como veio", () => {
    const p = lerParadas(fx("paradas.xml"));
    expect(p).toHaveLength(5);
    expect(p[0]).toEqual({ sequencia: 1, pedido: "0089", codCliente: "00074565", cliente: "CLIENTE 1", cidade: "FLORIANO", chegada: "07:22", saida: "07:34", km: 18.98 });
    expect(p[1]).toMatchObject({ sequencia: 2, codCliente: "00072912", cidade: "JERUMENHA", chegada: "08:32", saida: "08:38", km: 72.24 });
    expect(p[4]).toMatchObject({ chegada: "23:53", saida: "00:01" });
  });

  it("ViewState novo da resposta parcial e sessão expirada (redirect para o login)", () => {
    expect(viewStateParcial(fx("rotas.xml"))).toBe("VS-NOVO-123");
    expect(redirecionouParaLogin(fx("expirou.xml"))).toBe(true);
    expect(redirecionouParaLogin(fx("rotas.xml"))).toBe(false);
  });
});
