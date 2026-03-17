/*
 * MetricFlow — Vendedores Router
 * Endpoints tRPC para análise de vendedores
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getVisitasData } from "../services/dataCache";

export const vendedoresRouter = router({

  // Lista de todos os vendedores com resumo de performance
  listar: publicProcedure
    .input(
      z.object({
        gerente:    z.number().optional(),
        revenda:    z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim:    z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      if (input.gerente !== undefined) visitas = visitas.filter((v) => v.gerente === input.gerente);
      if (input.revenda)               visitas = visitas.filter((v) => v.revenda === input.revenda);
      if (input.dataInicio)            visitas = visitas.filter((v) => v.data >= input.dataInicio!);
      if (input.dataFim)               visitas = visitas.filter((v) => v.data <= input.dataFim!);

      const vendedoresMap: Record<
        number,
        {
          vendedor: number;
          totalVisitas: number;
          visitasConvertidas: number;
          receita: number;
          somaTempo: number;
          visitasComTempo: number;
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
            somaTempo: 0,
            visitasComTempo: 0,
            clientesUnicos: new Set(),
          };
        }

        const vd = vendedoresMap[v.vendedor];
        vd.totalVisitas++;
        vd.clientesUnicos.add(v.codCliente);

        if (v.status === "convertido") {
          vd.visitasConvertidas++;
          vd.receita += v.valorNumerico;
        }

        if (v.tempoVisita && v.tempoVisita !== "ND") {
          const [h, m] = v.tempoVisita.split(":").map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            vd.somaTempo += h * 60 + m;
            vd.visitasComTempo++;
          }
        }
      }

      return Object.values(vendedoresMap)
        .map((v) => ({
          vendedor:        v.vendedor,
          nomeVendedor:    `V0${v.vendedor}`,
          totalVisitas:    v.totalVisitas,
          visitasConvertidas: v.visitasConvertidas,
          receita:         v.receita,
          taxaConversao:   v.totalVisitas > 0 ? (v.visitasConvertidas / v.totalVisitas) * 100 : 0,
          tempoMedioVisita: v.visitasComTempo > 0 ? v.somaTempo / v.visitasComTempo : 0,
          clientesUnicos:  v.clientesUnicos.size,
        }))
        .sort((a, b) => b.receita - a.receita);
    }),

  // Detalhes de um vendedor específico
  detalhes: publicProcedure
    .input(
      z.object({
        vendedor:   z.number(),
        gerente:    z.number().optional(),
        revenda:    z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim:    z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      visitas = visitas.filter((v) => v.vendedor === input.vendedor);
      if (input.gerente !== undefined) visitas = visitas.filter((v) => v.gerente === input.gerente);
      if (input.revenda)               visitas = visitas.filter((v) => v.revenda === input.revenda);
      if (input.dataInicio)            visitas = visitas.filter((v) => v.data >= input.dataInicio!);
      if (input.dataFim)               visitas = visitas.filter((v) => v.data <= input.dataFim!);

      const totalVisitas        = visitas.length;
      const visitasConvertidas  = visitas.filter((v) => v.status === "convertido").length;
      const semVisita           = visitas.filter((v) => v.status === "sem_visita").length;
      const receita             = visitas
        .filter((v) => v.status === "convertido")
        .reduce((sum, v) => sum + v.valorNumerico, 0);
      const clientesUnicos      = new Set(visitas.map((v) => v.codCliente)).size;

      // Tempo médio: visitas com tempoVisita válido
      const visitasComTempo = visitas.filter(v => v.tempoVisita && v.tempoVisita !== "ND");
      let tempoMedioVisita = 0;
      if (visitasComTempo.length > 0) {
        const somaMin = visitasComTempo.reduce((sum, v) => {
          const partes = String(v.tempoVisita).split(":");
          if (partes.length >= 2) return sum + parseInt(partes[0]) * 60 + parseInt(partes[1]);
          return sum;
        }, 0);
        tempoMedioVisita = somaMin / visitasComTempo.length;
      }

      const motivosNaoVenda: Record<string, number> = {};
      visitas
        .filter((v) => v.status === "nao_convertido")
        .forEach((v) => { motivosNaoVenda[v.motivo] = (motivosNaoVenda[v.motivo] || 0) + 1; });

      return {
        vendedor:        input.vendedor,
        nomeVendedor:    `V0${input.vendedor}`,
        totalVisitas,
        visitasConvertidas,
        semVisita,
        receita,
        taxaConversao:   totalVisitas > 0 ? (visitasConvertidas / totalVisitas) * 100 : 0,
        clientesUnicos,
        tempoMedioVisita,
        motivosNaoVenda,
      };
    }),

  // Lista de clientes de um vendedor
  clientes: publicProcedure
    .input(
      z.object({
        vendedor:   z.number(),
        gerente:    z.number().optional(),
        revenda:    z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim:    z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let visitas = await getVisitasData();

      visitas = visitas.filter((v) => v.vendedor === input.vendedor);
      if (input.gerente !== undefined) visitas = visitas.filter((v) => v.gerente === input.gerente);
      if (input.revenda)               visitas = visitas.filter((v) => v.revenda === input.revenda);
      if (input.dataInicio)            visitas = visitas.filter((v) => v.data >= input.dataInicio!);
      if (input.dataFim)               visitas = visitas.filter((v) => v.data <= input.dataFim!);

      const clientesMap: Record<
        number,
        { codCliente: number; cliente: string; visitas: number; convertido: boolean; receita: number; ultimaVisita: string }
      > = {};

      for (const v of visitas) {
        if (!clientesMap[v.codCliente]) {
          clientesMap[v.codCliente] = {
            codCliente:   v.codCliente,
            cliente:      v.cliente,
            visitas:      0,
            convertido:   false,
            receita:      0,
            ultimaVisita: v.data,
          };
        }

        const c = clientesMap[v.codCliente];
        c.visitas++;
        if (v.data > c.ultimaVisita) c.ultimaVisita = v.data;
        if (v.status === "convertido") {
          c.convertido = true;
          c.receita += v.valorNumerico;
        }
      }

      return Object.values(clientesMap).sort((a, b) => b.receita - a.receita);
    }),
});