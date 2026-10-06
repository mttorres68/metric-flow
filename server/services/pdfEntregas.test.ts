import { describe, it, expect } from "vitest";
import { gerarPDFEntregas } from "./pdfEntregas";
import type { ResultadoLinha } from "./entregas/cruzar";
import type { Entrega } from "./entregas/parseCheckNow";

const brt = (s: string) => new Date(`${s}:00-03:00`);
const entrega: Entrega = {
  routeId: "R1", placa: "SOL-6B13", motorista: "ANTONIO", codCliente: "160089", cliente: "CLIENTE A",
  lat: -7, lon: -43, situacao: "ENTREGUE", baixaEm: brt("2026-10-05T09:28"),
  rotaInicio: brt("2026-10-05T07:00"), rotaFim: null, odoIniInformado: null, odoFimInformado: null,
};
const base: ResultadoLinha = {
  linha: { data: "2026-10-05", placa: "SOL-6B13", motorista: "ANTONIO", routeId: "R1",
    janela: { inicio: brt("2026-10-05T07:00"), fim: brt("2026-10-05T23:59") }, fechaRota: false },
  semGps: null, saidaOrigem: "gps", retornoOrigem: "cerca", saida: brt("2026-10-05T08:44"), retorno: brt("2026-10-05T17:10"),
  entregasDia: 33, totalRota: 60, apos14h: 10, baixasComCoord: 35, noRaio: 30, relampago: 2, semParada: 3,
  paradasSemCliente: { qtd: 2, min: 75 }, kmGps: 210.4, pendentes: null, kmInformado: null,
  baixas: [{ entrega, status: "sem_parada", permanenciaMin: 0, distMaisProximaM: 774.4, paradasNoRaio: [], maisProxima: null, momentoBaixa: null },
    { entrega, status: "no_raio", permanenciaMin: 12, distMaisProximaM: 30, paradasNoRaio: [], maisProxima: null, momentoBaixa: { tipo: "na_parada", min: 0 } }],
};
const semGps: ResultadoLinha = {
  ...base, linha: { ...base.linha, placa: "SOO-8D81", motorista: "ISRAEL" }, semGps: "sem rastreador",
  saida: null, retorno: null, baixasComCoord: 0, noRaio: 0, relampago: 0, semParada: 0,
  paradasSemCliente: { qtd: 0, min: 0 }, kmGps: null, pendentes: 4, kmInformado: 334, baixas: [],
};
const ehPdf = (b: Buffer) => b.subarray(0, 4).toString() === "%PDF";

describe("gerarPDFEntregas", () => {
  it("gera PDF com linha com GPS, linha sem GPS, exceção, análise e avisos", async () => {
    const b = await gerarPDFEntregas({ data: "2026-10-05", linhas: [base, semGps], analise: "<p>Ok</p>", avisos: ["SOO-8D81 · ISRAEL: sem rastreador"], raioM: 500 });
    expect(ehPdf(b)).toBe(true);
  });

  // Review Focus 5
  it("gera PDF sem nenhuma linha (denominadores zero)", async () => {
    const b = await gerarPDFEntregas({ data: "2026-10-05", linhas: [], analise: "", avisos: [], raioM: 300 });
    expect(ehPdf(b)).toBe(true);
  });
});
