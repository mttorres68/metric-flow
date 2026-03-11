/*
 * MetricFlow — Vendedores Router
 * Endpoints tRPC para análise de vendedores
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { loadGoogleSheetsData, processarVisitas } from "../services/googleSheetsService";

// Cache compartilhado com dashboard
let cachedVisitas: ReturnType<typeof processarVisitas> | null = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

async function getVisitasData() {
  const now = Date.now();

  if (cachedVisitas && now - lastCacheTime < CACHE_DURATION_MS) {
    return cachedVisitas;
  }

  try {
    const rawData = await loadGoogleSheetsData();
    cachedVisitas = processarVisitas(rawData);
    lastCacheTime = now;
    return cachedVisitas;
  } catch (error) {
    console.error("[Vendedores] Erro ao carregar dados:", error);
    if (cachedVisitas) {
      return cachedVisitas;
    }
    throw new Error("Falha ao carregar dados de vendedores");
  }
}

export const vendedoresRouter = router({
  // Lista de todos os vendedores com resumo de performance
  listar: publicProcedure
    .input(
      z.object({
        gerente: z.number().optional(),
        revenda: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      // Aplicar filtros
      if (input.gerente !== undefined) {
        visitas = visitas.filter((v) => v.gerente === input.gerente);
      }
      if (input.revenda) {
        visitas = visitas.filter((v) => v.revenda === input.revenda);
      }
      if (input.dataInicio) {
        visitas = visitas.filter((v) => v.data >= input.dataInicio!);
      }
      if (input.dataFim) {
        visitas = visitas.filter((v) => v.data <= input.dataFim!);
      }

      const vendedoresMap: Record<
        number,
        {
          vendedor: number;
          totalVisitas: number;
          visitasConvertidas: number;
          receita: number;
          taxaConversao: number;
          tempoMedioVisita: number;
          clientesUnicos: Set<number>;
        }
      > = {};

      for (const v of visitas) {
        if (!vendedoresMap[v.vendedor]) {
          vendedoresMap[v.vendedor] = {
            vendedor: v.vendedor,
            totalVisitas: 0,
            visitasConvertidas: 0,
            receita: 0,
            taxaConversao: 0,
            tempoMedioVisita: 0,
            clientesUnicos: new Set(),
          };
        }

        const vend = vendedoresMap[v.vendedor];
        vend.totalVisitas++;
        vend.clientesUnicos.add(v.codCliente);

        if (v.status === "convertido") {
          vend.visitasConvertidas++;
          vend.receita += v.valorNumerico;
        }

        // Calcular tempo médio
        if (v.tempoVisita && v.tempoVisita !== "ND") {
          const [horas, minutos] = v.tempoVisita.split(":").map(Number);
          if (!isNaN(horas) && !isNaN(minutos)) {
            vend.tempoMedioVisita += horas * 60 + minutos;
          }
        }
      }

      // Converter para array e calcular percentuais
      const vendedores = Object.values(vendedoresMap)
        .map((v) => ({
          vendedor: v.vendedor,
          nomeVendedor: `V0${v.vendedor}`,
          totalVisitas: v.totalVisitas,
          visitasConvertidas: v.visitasConvertidas,
          receita: v.receita,
          taxaConversao: v.totalVisitas > 0 ? (v.visitasConvertidas / v.totalVisitas) * 100 : 0,
          tempoMedioVisita:
            v.visitasConvertidas > 0 ? v.tempoMedioVisita / v.visitasConvertidas : 0,
          clientesUnicos: v.clientesUnicos.size,
        }))
        .sort((a, b) => b.receita - a.receita);

      return vendedores;
    }),

  // Detalhes de um vendedor específico
  detalhes: publicProcedure
    .input(
      z.object({
        vendedor: z.number(),
        gerente: z.number().optional(),
        revenda: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      // Filtrar por vendedor
      visitas = visitas.filter((v) => v.vendedor === input.vendedor);

      // Aplicar filtros adicionais
      if (input.gerente !== undefined) {
        visitas = visitas.filter((v) => v.gerente === input.gerente);
      }
      if (input.revenda) {
        visitas = visitas.filter((v) => v.revenda === input.revenda);
      }
      if (input.dataInicio) {
        visitas = visitas.filter((v) => v.data >= input.dataInicio!);
      }
      if (input.dataFim) {
        visitas = visitas.filter((v) => v.data <= input.dataFim!);
      }

      const totalVisitas = visitas.length;
      const visitasConvertidas = visitas.filter((v) => v.status === "convertido").length;
      const receita = visitas
        .filter((v) => v.status === "convertido")
        .reduce((sum, v) => sum + v.valorNumerico, 0);

      const motivosNaoVenda: Record<string, number> = {};
      visitas
        .filter((v) => v.status === "nao_convertido")
        .forEach((v) => {
          motivosNaoVenda[v.motivo] = (motivosNaoVenda[v.motivo] || 0) + 1;
        });

      const clientesUnicos = new Set(visitas.map((v) => v.codCliente)).size;

      return {
        vendedor: input.vendedor,
        nomeVendedor: `V0${input.vendedor}`,
        totalVisitas,
        visitasConvertidas,
        receita,
        taxaConversao: totalVisitas > 0 ? (visitasConvertidas / totalVisitas) * 100 : 0,
        clientesUnicos,
        motivosNaoVenda,
      };
    }),

  // Lista de clientes de um vendedor
  clientes: publicProcedure
    .input(
      z.object({
        vendedor: z.number(),
        gerente: z.number().optional(),
        revenda: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      // Filtrar por vendedor
      visitas = visitas.filter((v) => v.vendedor === input.vendedor);

      // Aplicar filtros adicionais
      if (input.gerente !== undefined) {
        visitas = visitas.filter((v) => v.gerente === input.gerente);
      }
      if (input.revenda) {
        visitas = visitas.filter((v) => v.revenda === input.revenda);
      }
      if (input.dataInicio) {
        visitas = visitas.filter((v) => v.data >= input.dataInicio!);
      }
      if (input.dataFim) {
        visitas = visitas.filter((v) => v.data <= input.dataFim!);
      }

      const clientesMap: Record<
        number,
        {
          codCliente: number;
          cliente: string;
          visitas: number;
          convertido: boolean;
          receita: number;
          ultimaVisita: string;
        }
      > = {};

      for (const v of visitas) {
        if (!clientesMap[v.codCliente]) {
          clientesMap[v.codCliente] = {
            codCliente: v.codCliente,
            cliente: v.cliente,
            visitas: 0,
            convertido: false,
            receita: 0,
            ultimaVisita: v.data,
          };
        }

        const cliente = clientesMap[v.codCliente];
        cliente.visitas++;
        cliente.ultimaVisita = v.data > cliente.ultimaVisita ? v.data : cliente.ultimaVisita;

        if (v.status === "convertido") {
          cliente.convertido = true;
          cliente.receita += v.valorNumerico;
        }
      }

      return Object.values(clientesMap).sort((a, b) => b.receita - a.receita);
    }),
});
