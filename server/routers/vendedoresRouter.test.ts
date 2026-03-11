import { describe, it, expect } from "vitest";
import { vendedoresRouter } from "./vendedoresRouter";
import type { TrpcContext } from "../_core/context";

// Mock context
const mockContext: TrpcContext = {
  user: null,
  req: {} as any,
  res: {} as any,
};

describe("Vendedores Router", () => {
  describe("listar", () => {
    it("deve retornar lista de vendedores", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar({});

      expect(Array.isArray(vendedores)).toBe(true);
      expect(vendedores.length).toBeGreaterThan(0);
    });

    it("cada vendedor deve ter propriedades obrigatórias", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar({});

      const primeiro = vendedores[0];
      expect(primeiro).toHaveProperty("vendedor");
      expect(primeiro).toHaveProperty("nomeVendedor");
      expect(primeiro).toHaveProperty("totalVisitas");
      expect(primeiro).toHaveProperty("visitasConvertidas");
      expect(primeiro).toHaveProperty("receita");
      expect(primeiro).toHaveProperty("taxaConversao");
      expect(primeiro).toHaveProperty("tempoMedioVisita");
      expect(primeiro).toHaveProperty("clientesUnicos");
    });

    it("vendedores devem estar ordenados por receita decrescente", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar({});

      for (let i = 0; i < vendedores.length - 1; i++) {
        expect(vendedores[i].receita).toBeGreaterThanOrEqual(vendedores[i + 1].receita);
      }
    });

    it("taxa de conversão deve estar entre 0 e 100", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar({});

      for (const v of vendedores) {
        expect(v.taxaConversao).toBeGreaterThanOrEqual(0);
        expect(v.taxaConversao).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("detalhes", () => {
    it("deve retornar detalhes de um vendedor específico", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar();

      if (vendedores.length > 0) {
        const detalhes = await caller.detalhes({ vendedor: vendedores[0].vendedor });
        expect(detalhes).not.toBeNull();
        expect(detalhes?.vendedor).toBe(vendedores[0].vendedor);
      }
    });

    it("detalhes devem conter propriedades obrigatórias", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar();

      if (vendedores.length > 0) {
        const detalhes = await caller.detalhes({ vendedor: vendedores[0].vendedor });
        expect(detalhes).toHaveProperty("vendedor");
        expect(detalhes).toHaveProperty("nomeVendedor");
        expect(detalhes).toHaveProperty("totalVisitas");
        expect(detalhes).toHaveProperty("visitasConvertidas");
        expect(detalhes).toHaveProperty("receita");
        expect(detalhes).toHaveProperty("taxaConversao");
        expect(detalhes).toHaveProperty("tempoMedio");
        expect(detalhes).toHaveProperty("clientesConvertidos");
        expect(detalhes).toHaveProperty("clientesNaoConvertidos");
        expect(detalhes).toHaveProperty("clientesSemVisita");
        expect(detalhes).toHaveProperty("motivos");
        expect(detalhes).toHaveProperty("visitas");
      }
    });

    it("deve retornar null para vendedor inexistente", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const detalhes = await caller.detalhes({ vendedor: 99999 });
      expect(detalhes).toBeNull();
    });
  });

  describe("clientes", () => {
    it("deve retornar lista de clientes de um vendedor", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar();

      if (vendedores.length > 0) {
        const clientes = await caller.clientes({ vendedor: vendedores[0].vendedor });
        expect(Array.isArray(clientes)).toBe(true);
        expect(clientes.length).toBeGreaterThan(0);
      }
    });

    it("cada cliente deve ter propriedades obrigatórias", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar();

      if (vendedores.length > 0) {
        const clientes = await caller.clientes({ vendedor: vendedores[0].vendedor });
        if (clientes.length > 0) {
          const primeiro = clientes[0];
          expect(primeiro).toHaveProperty("codCliente");
          expect(primeiro).toHaveProperty("cliente");
          expect(primeiro).toHaveProperty("ultimaVisita");
          expect(primeiro).toHaveProperty("status");
          expect(primeiro).toHaveProperty("receita");
          expect(primeiro).toHaveProperty("visitasCount");
        }
      }
    });

    it("clientes devem estar ordenados por receita decrescente", async () => {
      const caller = vendedoresRouter.createCaller(mockContext);
      const vendedores = await caller.listar();

      if (vendedores.length > 0) {
        const clientes = await caller.clientes({ vendedor: vendedores[0].vendedor });
        for (let i = 0; i < clientes.length - 1; i++) {
          expect(clientes[i].receita).toBeGreaterThanOrEqual(clientes[i + 1].receita);
        }
      }
    });
  });
});
