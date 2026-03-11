import { describe, it, expect } from "vitest";
import { calcularKPIs, calcularGraficos, filtrarVisitas } from "./metricsCalculator";
import type { ProcessedVisita } from "./googleSheetsService";

const mockVisitas: ProcessedVisita[] = [
  {
    id: 1,
    vendedor: 1,
    cliente: "Cliente A",
    codCliente: 100,
    seqERP: 1,
    seqPT: 1,
    valorPedido: "100,00",
    valorNumerico: 100,
    tipoCobr: "14",
    horaInicio: "08:00:00",
    horaFim: "08:10:00",
    tempoVisita: "00:10:00",
    distR: "10",
    status: "convertido",
    motivo: "Pedido realizado",
  },
  {
    id: 2,
    vendedor: 1,
    cliente: "Cliente B",
    codCliente: 101,
    seqERP: 2,
    seqPT: 2,
    valorPedido: "0,00",
    valorNumerico: 0,
    tipoCobr: "-",
    horaInicio: "08:20:00",
    horaFim: "08:25:00",
    tempoVisita: "00:05:00",
    distR: "5",
    status: "nao_convertido",
    motivo: "Sem dinheiro",
  },
  {
    id: 3,
    vendedor: 2,
    cliente: "Cliente C",
    codCliente: 102,
    seqERP: 3,
    seqPT: 3,
    valorPedido: "50,00",
    valorNumerico: 50,
    tipoCobr: "14",
    horaInicio: "09:00:00",
    horaFim: "09:08:00",
    tempoVisita: "00:08:00",
    distR: "8",
    status: "convertido",
    motivo: "Pedido realizado",
  },
  {
    id: 4,
    vendedor: 2,
    cliente: "Cliente D",
    codCliente: 103,
    seqERP: 4,
    seqPT: 4,
    valorPedido: "ND",
    valorNumerico: 0,
    tipoCobr: "-",
    horaInicio: "ND",
    horaFim: "ND",
    tempoVisita: "ND",
    distR: "ND",
    status: "sem_visita",
    motivo: "Sem visita registrada",
  },
];

describe("Metrics Calculator", () => {
  describe("calcularKPIs", () => {
    it("deve calcular receita total corretamente", () => {
      const kpis = calcularKPIs(mockVisitas);
      expect(kpis.receita_total).toBe(150); // 100 + 50
    });

    it("deve contar clientes visitados únicos", () => {
      const kpis = calcularKPIs(mockVisitas);
      expect(kpis.clientes_visitados).toBe(4); // 4 clientes únicos
    });

    it("deve calcular taxa de conversão corretamente", () => {
      const kpis = calcularKPIs(mockVisitas);
      // 2 convertidos de 4 = 50%
      expect(kpis.taxa_conversao).toBeCloseTo(50, 1);
    });

    it("deve calcular tempo médio de visita", () => {
      const kpis = calcularKPIs(mockVisitas);
      // (10 + 5 + 8) / 3 = 7.67 minutos
      expect(kpis.tempo_medio_visita).toBeCloseTo(7.67, 1);
    });

    it("deve calcular distância total em km", () => {
      const kpis = calcularKPIs(mockVisitas);
      // (10 + 5 + 8) / 1000 = 0.023 km
      expect(kpis.distancia_total).toBeCloseTo(0.023, 3);
    });
  });

  describe("filtrarVisitas", () => {
    it("deve filtrar por vendedor", () => {
      const filtradas = filtrarVisitas(mockVisitas, "1");
      expect(filtradas.length).toBe(2);
      expect(filtradas.every((v) => v.vendedor === 1)).toBe(true);
    });

    it("deve filtrar por status", () => {
      const filtradas = filtrarVisitas(mockVisitas, undefined, "convertido");
      expect(filtradas.length).toBe(2);
      expect(filtradas.every((v) => v.status === "convertido")).toBe(true);
    });

    it("deve filtrar por vendedor e status", () => {
      const filtradas = filtrarVisitas(mockVisitas, "1", "convertido");
      expect(filtradas.length).toBe(1);
      expect(filtradas[0].vendedor).toBe(1);
      expect(filtradas[0].status).toBe("convertido");
    });

    it("deve retornar todas as visitas sem filtro", () => {
      const filtradas = filtrarVisitas(mockVisitas);
      expect(filtradas.length).toBe(4);
    });
  });

  describe("calcularGraficos", () => {
    it("deve gerar evolução horária corretamente", () => {
      const graficos = calcularGraficos(mockVisitas);
      expect(graficos.evolucao_horaria.length).toBeGreaterThan(0);
      expect(graficos.evolucao_horaria[0]).toHaveProperty("hora");
      expect(graficos.evolucao_horaria[0]).toHaveProperty("acumulado");
      expect(graficos.evolucao_horaria[0]).toHaveProperty("visitas");
    });

    it("deve gerar dados de vendedores", () => {
      const graficos = calcularGraficos(mockVisitas);
      expect(graficos.vendedores.length).toBe(2); // 2 vendedores
      expect(graficos.vendedores[0]).toHaveProperty("vendedor");
      expect(graficos.vendedores[0]).toHaveProperty("clientes");
      expect(graficos.vendedores[0]).toHaveProperty("receita");
    });

    it("deve gerar motivos de não venda", () => {
      const graficos = calcularGraficos(mockVisitas);
      expect(graficos.motivos_nao_venda.length).toBeGreaterThan(0);
      expect(graficos.motivos_nao_venda[0]).toHaveProperty("motivo");
      expect(graficos.motivos_nao_venda[0]).toHaveProperty("quantidade");
      expect(graficos.motivos_nao_venda[0]).toHaveProperty("cor");
    });

    it("deve ordenar vendedores por quantidade de clientes", () => {
      const graficos = calcularGraficos(mockVisitas);
      for (let i = 0; i < graficos.vendedores.length - 1; i++) {
        expect(graficos.vendedores[i].clientes).toBeGreaterThanOrEqual(
          graficos.vendedores[i + 1].clientes
        );
      }
    });
  });
});
