import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getVisitasData } from "../services/dataCache";
import { getDb } from "../db";
import { analiseRecorrencia } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getConfigMetricas } from "../services/configService";
import {
    calcularAnalisePeriodo,
    computarRecorrenciaPeriodo,
    FLAGS_RECORRENCIA,
    hmsToMin,
    minToHM,
    parseDistPV,
} from "../services/analise";

// Re-exporta os tipos usados por outros módulos
export type { AnaliseVendedor } from "../services/analise";

// ─── Router ───────────────────────────────────────────────────────────────────

export const analiseRouter = router({

    getDados: publicProcedure
        .input(z.object({
            dataInicio: z.string().optional(),
            dataFim:    z.string().optional(),
            revenda:    z.string().optional(),
            vendedor:   z.number().optional(),
        }))
        .query(async ({ input }) => {
            let visitas = await getVisitasData();
            if (input.revenda)    visitas = visitas.filter(v => v.revenda  === input.revenda);
            if (input.vendedor)   visitas = visitas.filter(v => v.vendedor === input.vendedor);
            if (input.dataInicio) visitas = visitas.filter(v => v.data >= input.dataInicio!);
            if (input.dataFim)    visitas = visitas.filter(v => v.data <= input.dataFim!);

            const cfg = await getConfigMetricas();
            const resultados = calcularAnalisePeriodo(visitas, cfg.diaria);
            resultados.sort((a, b) =>
                a.revenda.localeCompare(b.revenda) || a.vendedor - b.vendedor || a.data.localeCompare(b.data)
            );

            const datasDisponiveis = [...new Set(visitas.map(v => v.data))].sort().reverse();
            const revendasDisp     = [...new Set(visitas.map(v => v.revenda))].sort();
            return { dados: resultados, datas: datasDisponiveis, revendas: revendasDisp };
        }),

    getRecorrenciaSemanal: publicProcedure
        .input(z.object({
            dataInicio: z.string(),
            dataFim:    z.string(),
            revenda:    z.string().optional(),
            vendedor:   z.number().optional(),
        }))
        .query(async ({ input }) => {
            let visitas = await getVisitasData();
            if (input.revenda)  visitas = visitas.filter(v => v.revenda  === input.revenda);
            if (input.vendedor) visitas = visitas.filter(v => v.vendedor === input.vendedor);
            visitas = visitas.filter(v => v.data >= input.dataInicio && v.data <= input.dataFim);

            const cfg = await getConfigMetricas();
            const porRevenda = computarRecorrenciaPeriodo(visitas, cfg.recorrencia);

            const datas    = [...new Set(visitas.map(v => v.data))].sort();
            const revendas = [...new Set(visitas.map(v => v.revenda))].sort();
            return { porRevenda, flags: FLAGS_RECORRENCIA, semana: { inicio: input.dataInicio, fim: input.dataFim }, datas, revendas };
        }),

    gerarInsightRecorrencia: publicProcedure
        .input(z.object({
            revenda:    z.string(),
            dataInicio: z.string(),
            dataFim:    z.string(),
        }))
        .mutation(async ({ input }) => {
            let visitas = await getVisitasData();
            visitas = visitas.filter(v =>
                v.revenda === input.revenda && v.data >= input.dataInicio && v.data <= input.dataFim
            );

            const cfg = await getConfigMetricas();
            const listaCompleta = computarRecorrenciaPeriodo(visitas, cfg.recorrencia)[input.revenda] ?? [];
            const lista = listaCompleta.filter(v => v.scoreCritico > 0);

            if (lista.length === 0) {
                return { html: "<p>Sem padrões recorrentes identificados para esta revenda no período selecionado.</p>" };
            }

            const linhasTexto = lista.map(v => {
                const recorrentes = FLAGS_RECORRENCIA
                    .filter(f => f.id !== "ociosidadeAlta" && v.metricas[f.id].recorrente)
                    .map(f => `${f.label} (${v.metricas[f.id].dias}/${v.diasAtivos} dias)`);
                return `- Vendedor ${v.vendedor} [${v.diasAtivos} dias ativos]: ${recorrentes.length ? recorrentes.join("; ") : "sem padrões recorrentes"}`;
            }).join("\n");

            if (!ENV.anthropicApiKey) {
                throw new Error("ANTHROPIC_API_KEY não configurada. Adicione ao .env:\nANTHROPIC_API_KEY=sk-ant-...");
            }

            const modelo  = process.env.LLM_MODEL_INSIGHT ?? "claude-sonnet-4-6";
            const sistema =
                "Você é um analista de força de vendas. Recebe o mapeamento semanal de recorrências " +
                "de vendedores de uma revenda e deve escrever uma análise objetiva em português do Brasil.\n\n" +
                "REGRAS DE FORMATAÇÃO — siga exatamente:\n" +
                "• Use APENAS estas tags HTML: <p>, <ul>, <li>, <strong>\n" +
                "• PROIBIDO: <table>, <style>, <script>, <h1>, <h2>, <div>, <span>, <br>, " +
                "atributos class=, style=, id= ou qualquer outro atributo HTML\n" +
                "• NÃO inclua boilerplate (<html>, <head>, <body>)\n" +
                "• Responda SOMENTE com o fragmento HTML da análise, sem texto fora das tags\n\n" +
                "ESTRUTURA (três partes obrigatórias):\n" +
                "1) <p><strong>Destaques gerais</strong></p> — resumo dos padrões da semana\n" +
                "2) <p><strong>Vendedores críticos</strong></p> + <ul><li>...</li></ul> por vendedor\n" +
                "3) <p><strong>Plano de ação</strong></p> — ações práticas e diretas\n\n" +
                "Seja conciso. NÃO invente dados além dos fornecidos.";

            const resp = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": ENV.anthropicApiKey,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: modelo,
                    max_tokens: 1024,
                    system: sistema,
                    messages: [{ role: "user", content: `Revenda: ${input.revenda}\nSemana: ${input.dataInicio} a ${input.dataFim}\n\nRecorrências por vendedor:\n${linhasTexto}` }],
                }),
            });

            if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}: ${await resp.text()}`);

            const body = await resp.json() as { content: Array<{ type: string; text: string }> };
            const raw  = body.content.filter(b => b.type === "text").map(b => b.text).join("");
            const html = raw.replace(/<(?!\/?(?:p|ul|li|strong|br)\b)[^>]+>/gi, "");
            return { html };
        }),

    salvarRecorrencia: publicProcedure
        .input(z.object({
            revenda:      z.string(),
            semanaInicio: z.string(),
            semanaFim:    z.string(),
            mapaJson:     z.string(),
            insightHtml:  z.string(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Banco de dados indisponível.");

            const existing = await db
                .select({ id: analiseRecorrencia.id })
                .from(analiseRecorrencia)
                .where(and(eq(analiseRecorrencia.revenda, input.revenda), eq(analiseRecorrencia.semanaInicio, input.semanaInicio)))
                .limit(1);

            if (existing.length > 0) {
                await db.update(analiseRecorrencia)
                    .set({ semanaFim: input.semanaFim, mapaJson: input.mapaJson, insightHtml: input.insightHtml, updatedAt: new Date() })
                    .where(eq(analiseRecorrencia.id, existing[0].id));
            } else {
                await db.insert(analiseRecorrencia).values(input);
            }

            return { ok: true } as const;
        }),

    listarRecorrenciaPorSemana: publicProcedure
        .input(z.object({ semanaInicio: z.string() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return [];
            return db.select().from(analiseRecorrencia).where(eq(analiseRecorrencia.semanaInicio, input.semanaInicio));
        }),

    getVisitasDoDia: publicProcedure
        .input(z.object({ vendedor: z.number(), revenda: z.string(), data: z.string() }))
        .query(async ({ input }) => {
            const visitas = await getVisitasData();
            return visitas
                .filter(v => v.vendedor === input.vendedor && v.revenda === input.revenda && v.data === input.data)
                .sort((a, b) => {
                    const at = a.horaInicio === "ND" || !a.horaInicio ? "99:99" : a.horaInicio;
                    const bt = b.horaInicio === "ND" || !b.horaInicio ? "99:99" : b.horaInicio;
                    return at.localeCompare(bt);
                });
        }),

    getClientesForeaRaio: publicProcedure
        .input(z.object({
            revenda:    z.string(),
            data:       z.string(),
            horaInicio: z.string().optional(),
            horaFim:    z.string().optional(),
        }))
        .query(async ({ input }) => {
            const visitas = await getVisitasData();
            const cfg = await getConfigMetricas();
            const RAIO = cfg.diaria.raioPDV;

            const todasVisitas = visitas.filter(v =>
                v.revenda === input.revenda && v.data === input.data && v.horaInicio && v.horaInicio !== "ND"
            );

            // Identifica clientes com qualquer visita dentro do raio
            const clienteTemDentro: Record<number, Record<string, boolean>> = {};
            for (const v of todasVisitas) {
                if (parseDistPV(v.distPV) <= RAIO) {
                    clienteTemDentro[v.vendedor] ??= {};
                    clienteTemDentro[v.vendedor][String(v.codCliente)] = true;
                }
            }

            let visitasFiltradas = todasVisitas;
            if (input.horaInicio || input.horaFim) {
                const hIni = input.horaInicio ? hmsToMin(input.horaInicio) : null;
                const hFim = input.horaFim    ? hmsToMin(input.horaFim)    : null;
                visitasFiltradas = visitasFiltradas.filter(v => {
                    const t = hmsToMin(v.horaInicio);
                    if (t === null) return false;
                    if (hIni !== null && t < hIni) return false;
                    if (hFim !== null && t > hFim) return false;
                    return true;
                });
            }

            const foraRaio = visitasFiltradas
                .filter(v => parseDistPV(v.distPV) > RAIO)
                .filter(v => !clienteTemDentro[v.vendedor]?.[String(v.codCliente)]);

            const porSetorCliente: Record<number, Record<string, typeof foraRaio>> = {};
            for (const v of foraRaio) {
                porSetorCliente[v.vendedor] ??= {};
                (porSetorCliente[v.vendedor][String(v.codCliente)] ??= []).push(v);
            }

            return Object.entries(porSetorCliente).map(([setorStr, clientesMap]) => {
                const setor = parseInt(setorStr, 10);
                const clientes = Object.values(clientesMap).map(visitasCliente => {
                    const ord = [...visitasCliente].sort((a, b) => {
                        const at = a.horaInicio === "ND" || !a.horaInicio ? "99:99" : a.horaInicio;
                        const bt = b.horaInicio === "ND" || !b.horaInicio ? "99:99" : b.horaInicio;
                        return at.localeCompare(bt);
                    });
                    const pv = ord[0];
                    const dist = parseDistPV(pv.distPV);
                    return {
                        setor,
                        cliente:      pv.cliente,
                        codCliente:   String(pv.codCliente),
                        horaInicio:   pv.horaInicio,
                        horaFim:      pv.horaFim,
                        tempo:        hmsToMin(pv.tempoVisita) !== null ? minToHM(hmsToMin(pv.tempoVisita)!) : "—",
                        distancia:    `${dist}m`,
                        valorPedido:  pv.valorPedido,
                        visitasCount: ord.length,
                    };
                });
                return { setor, clientes };
            });
        }),
});
