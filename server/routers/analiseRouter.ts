/*
 * MetricFlow — Análise Router
 * Calcula métricas detalhadas por vendedor/dia para a página Análise.
 *
 * Colunas calculadas:
 *   — Existentes (já em VendedoresLista): Início, Fim, Almoço, Após 14h, Visitas, Relâmpagos
 *   — Novas: PDVs Visitados, PDVs Sem Visita, Pedido SFA, Pedido Heishop,
 *            Heishop Verificado, IV, IAV, Atend>35min, Tempos, Maior Percurso,
 *            Tempo Não-Atendimento, Ranking Crítico
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getVisitasData } from "../services/dataCache";
import type { ProcessedVisita } from "../services/xlsxService";

// ─── Helpers de tempo ────────────────────────────────────────────────────────

function hmsToMin(s: string | null | undefined): number | null {
    if (!s || s === "ND") return null;
    const parts = s.split(":");
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const sec = parts[2] ? parseInt(parts[2], 10) : 0;
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m + sec / 60;
}

function minToHms(min: number): string {
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.floor(Math.abs(min) % 60);
    const s = Math.round((Math.abs(min) % 1) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function minToHM(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Tipo de saída ────────────────────────────────────────────────────────────

export interface AnaliseVendedor {
    revenda: string;
    vendedor: number;
    data: string;
    // Existentes
    inicio: string | null;   // HH:MM
    fim: string | null;
    almoco: number;          // visitas 12:15-13:45
    apos14h: number;
    apos14h_pct: number;
    apos14h_total: number;
    visitas: number;          // únicos dentro do raio
    visitas_total: number;          // carteira total
    visitas_total_dentro_raio: number;          // total de visitas mesmo que repetidas, mas dentro do raio estabelecido.
    visitas_pct: number;
    relampago: number;
    relampago_pct: number;
    // Novas
    pdvs_total: number;          // total de PDVs na carteira
    pdvs_visitados: number;          // PDVs com visita (duração registrada)
    pdvs_sem_visita: number;          // PDVs na carteira sem visita
    pedido_sfa: number;          // Pedidos via SFA (Tipo Cobr. ≠ Heishop/vazio)
    pedido_heishop: number;          // "PEDIDO FEITO VIA HEISHOP" no Valor Ped.
    heishop_verif: number;          // Heishop com Tipo Cobr. preenchida (verificado)
    iv: number;          // Índice de Visita = visitados/carteira
    iav: number;          // Índice de Atendimento = heishop_verif/heishop
    atend_maior35: number;          // Visitas > 35 min dentro do raio
    soma_maior35: number;          // Soma em minutos dos atend > 35 min
    soma_maior35_fmt: string;
    tempo_menor: number | null;   // Menor tempo de visita dentro do PDV (min)
    tempo_maior: number | null;
    tempo_medio: number | null;
    tempo_total: number | null;
    tempo_menor_fmt: string;
    tempo_maior_fmt: string;
    tempo_medio_fmt: string;
    tempo_total_fmt: string;
    maior_percurso: number | null;   // Maior gap entre visitas (min)
    percurso_ini: string | null;   // HH:MM — início do maior gap
    percurso_fim: string | null;   // HH:MM — fim do maior gap
    pdvs_apos_gap: number;          // PDVs atendidos após o maior percurso
    total_percurso: number | null;   // Soma de todos os gaps entre visitas (min)
    total_percurso_fmt: string;
    tempo_nao_atend: number | null;   // Tempo não-atendimento (min)
    tempo_nao_atend_fmt: string;
    ranking_critico: number;          // 1 = pior (mais relâmpagos)
}

// ─── Cálculo por vendedor/dia ─────────────────────────────────────────────────

function calcularVendedorDia(
    visitas: ProcessedVisita[],
    vendedor: number,
    data: string,
    rankTotal: number,   // total de vendedores para calcular ranking invertido
    rankPos: number,     // posição na lista ordenada (0=pior)
): AnaliseVendedor {

    const RAIO = 300;   // metros — espelha REPORT_CONFIG.VENDEDORES_DIST_PDV
    const CURTA = 3;     // minutos
    const TRAVA_H = 17 * 60; // 17:00 em minutos

    const all = visitas.filter(v => v.vendedor === vendedor && v.data === data);
    const revenda = all[0]?.revenda ?? "";

    // PDVs na carteira = todos únicos (incluindo sem visita)
    const carteira = new Set(all.map(v => v.codCliente)).size;
    const comVisita = all.filter(v => v.horaInicio && v.horaInicio !== "ND");
    const semVisita = all.filter(v => !v.horaInicio || v.horaInicio === "ND");

    // Dentro do raio (300m) ou "AC" (Cliente em situação de Atualização de Coordenadas) - assim considera dentro do raio e em atualização de coordenadas
    function parseDistPV(s: string): number | string {
        if (!s || s === "ND") return 9999;
        if (s === "AC") return "AC";
        const clean = s.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
        return parseFloat(clean) || 9999;
    }

    const dentroRaio = comVisita.filter(v => parseDistPV(v.distPV) <= RAIO || parseDistPV(v.distPV) === "AC");
    const unicos = [...new Map(dentroRaio.map(v => [v.codCliente, v])).values()];

    // Tempos das visitas dentro do PDV
    const tempos = unicos
        .map(v => hmsToMin(v.tempoVisita))
        .filter((t): t is number => t !== null && t > 0);

    const tempo_menor = tempos.length ? Math.min(...tempos) : null;
    const tempo_maior = tempos.length ? Math.max(...tempos) : null;
    const tempo_total = tempos.length ? tempos.reduce((a, b) => a + b, 0) : null;
    const tempo_medio = tempos.length ? tempo_total! / tempos.length : null;

    // Relâmpago = visita dentro do raio com duração < 3 min
    const relampago = unicos.filter(v => {
        const t = hmsToMin(v.tempoVisita);
        return t !== null && t < CURTA;
    }).length;

    // Atend > 35 min
    const maiores35 = unicos.filter(v => { const t = hmsToMin(v.tempoVisita); return t !== null && t > 35; });
    const soma35 = maiores35.reduce((acc, v) => acc + (hmsToMin(v.tempoVisita) ?? 0), 0);

    // Horários de início/fim
    const horasIni = dentroRaio
        .map(v => hmsToMin(v.horaInicio))
        .filter((t): t is number => t !== null);
    const horasFim = dentroRaio
        .map(v => hmsToMin(v.horaFim))
        .filter((t): t is number => t !== null);

    const inicio_min = horasIni.length ? Math.min(...horasIni) : null;
    const fim_min = horasFim.length ? Math.max(...horasFim) : null;

    // Almoço (12:15–13:45) e Após 14h
    const almoco = dentroRaio.filter(v => {
        const t = hmsToMin(v.horaInicio); return t !== null && t >= 12 * 60 + 15 && t <= 13 * 60 + 45;
    }).length;
    const apos14 = dentroRaio.filter(v => {
        const t = hmsToMin(v.horaInicio); return t !== null && t >= 14 * 60;
    }).length;

    // SFA vs Heishop
    // "PEDIDO FEITO VIA HEISHOP" ou "PEDIDO HEISHOP" no valor
    const isHeishop = (v: ProcessedVisita) =>
        v.valorPedido.toUpperCase().includes("HEISHOP");
    const heishopVisitas = dentroRaio.filter(isHeishop);
    const sfaVisitas = dentroRaio.filter(v =>
        v.valorNumerico > 0 || (v.valorPedido !== "0,00" && !isHeishop(v) && v.horaInicio !== "ND")
    );
    // Heishop verificado = heishop com tipoCobr preenchida (≠ "" e ≠ "-")
    const heishop_verif = heishopVisitas.filter(v =>
        v.tipoCobr && String(v.tipoCobr).trim() !== "" && String(v.tipoCobr).trim() !== "-"
    ).length;

    // IV e IAV
    const iv = carteira > 0 ? (unicos.length / carteira) * 100 : 0;
    const iav = heishopVisitas.length > 0
        ? (heishop_verif / heishopVisitas.length) * 100 : 0;

    // ── Maior Percurso ────────────────────────────────────────────────────────
    // Ordena visitas por hora de início, calcula gaps entre Hora_Fin e próximo Ini
    // Descarta gaps > 60 min (intervalo real já considerado no Tempo Ñ Atend)
    const visitasOrd = [...dentroRaio]
        .map(v => ({ ini: hmsToMin(v.horaInicio), fim: hmsToMin(v.horaFim), v }))
        .filter(x => x.ini !== null && x.fim !== null)
        .sort((a, b) => a.ini! - b.ini!);

    let maior_percurso: number | null = null;
    let percurso_ini_min: number | null = null;
    let percurso_fim_min: number | null = null;
    let total_percurso = 0;

    for (let i = 0; i < visitasOrd.length - 1; i++) {
        const gap = visitasOrd[i + 1].ini! - visitasOrd[i].fim!;
        if (gap > 0) {
            total_percurso += gap;
            if (maior_percurso === null || gap > maior_percurso) {
                maior_percurso = gap;
                percurso_ini_min = visitasOrd[i].fim!;
                percurso_fim_min = visitasOrd[i + 1].ini!;
            }
        }
    }

    // PDVs após o maior gap
    const pdvs_apos_gap = percurso_fim_min !== null
        ? visitasOrd.filter(x => x.ini! >= percurso_fim_min!).length
        : 0;

    // ── Tempo Não-Atendimento ────────────────────────────────────────────────
    // Do primeiro ao último atendimento dentro do raio, descontando tempo em visita
    // Trava após 17:00 (TRAVA_H)
    let tempo_nao_atend: number | null = null;
    if (inicio_min !== null && fim_min !== null && tempo_total !== null) {
        const fim_efetivo = Math.min(fim_min, TRAVA_H);
        const jornada = Math.max(0, fim_efetivo - inicio_min);
        tempo_nao_atend = Math.max(0, jornada - tempo_total);
    }

    return {
        revenda,
        vendedor,
        data,
        inicio: inicio_min !== null ? minToHms(inicio_min) : null,
        fim: fim_min !== null ? minToHms(fim_min) : null,
        almoco,
        apos14h: apos14,
        apos14h_pct: dentroRaio.length > 0 ? (apos14 / dentroRaio.length) * 100 : 0,
        apos14h_total: dentroRaio.length,
        visitas: unicos.length,
        visitas_total: carteira,
        visitas_total_dentro_raio: dentroRaio.length, // SÃO TODAS AS VISITAS MESMO QUE REPETIDAS, MAS DENTRO DO RAIO ESTABELECIDO.
        visitas_pct: carteira > 0 ? (unicos.length / carteira) * 100 : 0,
        relampago,
        relampago_pct: dentroRaio.length > 0 ? (relampago / dentroRaio.length) * 100 : 0,
        pdvs_total: carteira,
        pdvs_visitados: unicos.length,
        pdvs_sem_visita: semVisita.length,
        pedido_sfa: sfaVisitas.length,
        pedido_heishop: heishopVisitas.length,
        heishop_verif,
        iv: parseFloat(iv.toFixed(1)),
        iav: parseFloat(iav.toFixed(1)),
        atend_maior35: maiores35.length,
        soma_maior35: parseFloat(soma35.toFixed(1)),
        soma_maior35_fmt: minToHms(soma35),
        tempo_menor,
        tempo_maior,
        tempo_medio: tempo_medio !== null ? parseFloat(tempo_medio.toFixed(1)) : null,
        tempo_total: tempo_total !== null ? parseFloat(tempo_total.toFixed(1)) : null,
        tempo_menor_fmt: tempo_menor !== null ? minToHms(tempo_menor) : "—",
        tempo_maior_fmt: tempo_maior !== null ? minToHms(tempo_maior) : "—",
        tempo_medio_fmt: tempo_medio !== null ? minToHms(tempo_medio) : "—",
        tempo_total_fmt: tempo_total !== null ? minToHms(tempo_total) : "—",
        maior_percurso,
        percurso_ini: percurso_ini_min !== null ? minToHM(percurso_ini_min) : null,
        percurso_fim: percurso_fim_min !== null ? minToHM(percurso_fim_min) : null,
        pdvs_apos_gap,
        total_percurso: visitasOrd.length > 1 ? parseFloat(total_percurso.toFixed(1)) : null,
        total_percurso_fmt: visitasOrd.length > 1 && total_percurso > 0 ? minToHms(total_percurso) : "—",
        tempo_nao_atend: tempo_nao_atend !== null ? parseFloat(tempo_nao_atend.toFixed(1)) : null,
        tempo_nao_atend_fmt: tempo_nao_atend !== null ? minToHms(tempo_nao_atend) : "—",
        ranking_critico: rankPos + 1,  // 1 = pior
    };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const analiseRouter = router({

    getDados: publicProcedure
        .input(z.object({
            dataInicio: z.string().optional(),
            dataFim: z.string().optional(),
            revenda: z.string().optional(),
            vendedor: z.number().optional(),
        }))
        .query(async ({ input }) => {

            let visitas = await getVisitasData();

            // Filtros
            if (input.revenda) visitas = visitas.filter(v => v.revenda === input.revenda);
            if (input.vendedor) visitas = visitas.filter(v => v.vendedor === input.vendedor);
            if (input.dataInicio) visitas = visitas.filter(v => v.data >= input.dataInicio!);
            if (input.dataFim) visitas = visitas.filter(v => v.data <= input.dataFim!);

            // Agrupa por vendedor+data
            const chaves = new Set(visitas.map(v => `${v.revenda}__${v.vendedor}__${v.data}`));
            const visitasPorChave: Record<string, ProcessedVisita[]> = {};
            for (const v of visitas) {
                const c = `${v.revenda}__${v.vendedor}__${v.data}`;
                if (!visitasPorChave[c]) {
                    visitasPorChave[c] = [];
                }
                visitasPorChave[c].push(v);
            }

            // Calcula para cada par e coleta ranking (por relâmpago %)
            const resultados: AnaliseVendedor[] = [];

            // Primeiro passo: calcula sem ranking para ordenar
            const preLista = Array.from(chaves).map(chave => {
                const [revenda, vStr, data] = chave.split("__");
                const vendedor = parseInt(vStr, 10);
                // Passa apenas as visitas relevantes para este vendedor/dia
                return calcularVendedorDia(visitasPorChave[chave], vendedor, data, 0, 0);
            });

            // Ranking: ordena por relâmpago % DESC — posição 0 = pior
            const sorted = [...preLista].sort((a, b) => b.relampago_pct - a.relampago_pct);
            const rankMap = new Map(sorted.map((r, i) => [`${r.vendedor}__${r.data}`, i]));

            // Recalcula com ranking correto
            for (const pre of preLista) {
                const rankPos = rankMap.get(`${pre.vendedor}__${pre.data}`) ?? 0;
                const final = { ...pre, ranking_critico: rankPos + 1 };
                resultados.push(final);
            }

            // Ordena por revenda → vendedor → data
            resultados.sort((a, b) =>
                a.revenda.localeCompare(b.revenda) ||
                a.vendedor - b.vendedor ||
                a.data.localeCompare(b.data)
            );

            // Datas disponíveis para o filtro
            const datasDisponiveis = [...new Set(visitas.map(v => v.data))].sort().reverse();
            const revendasDisp = [...new Set(visitas.map(v => v.revenda))].sort();

            return { dados: resultados, datas: datasDisponiveis, revendas: revendasDisp };
        }),

    getVisitasDoDia: publicProcedure
        .input(z.object({
            vendedor: z.number(),
            revenda: z.string(),
            data: z.string(),
        }))
        .query(async ({ input }) => {
            const visitas = await getVisitasData();

            // Filtra visitas por vendedor, revenda e data
            const visitasDia = visitas.filter(v => v.vendedor === input.vendedor && v.revenda === input.revenda && v.data === input.data);

            // Ordena cronologicamente por horaInicio.
            visitasDia.sort((a, b) => {
                const aTime = a.horaInicio === "ND" || !a.horaInicio ? "99:99" : a.horaInicio;
                const bTime = b.horaInicio === "ND" || !b.horaInicio ? "99:99" : b.horaInicio;
                return aTime.localeCompare(bTime);
            });

            return visitasDia;
        }),
});