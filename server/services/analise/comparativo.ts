import type { ProcessedVisita } from "../xlsxService";
import type { ConfigMetricasRecorrencia } from "@shared/const";
import type { AnaliseVendedor, FlagId } from "./types";
import { FLAGS_RECORRENCIA } from "./types";
import { calcularAnalisePeriodo } from "./calcVendedorDia";
import { avaliarFlag, computarRecorrenciaPeriodo } from "./recorrencia";

export type Granularidade = "diario" | "semanal" | "mensal";

export interface PeriodoComparativo {
    label: string;
    inicio: string; // YYYY-MM-DD
    fim: string;    // YYYY-MM-DD
}

export interface ComparativoScoreResult {
    periodos: PeriodoComparativo[];
    /** Média da métrica entre vendedores ativos do setor, alinhada a `periodos`. */
    porRevenda: Record<string, (number | null)[]>;
    /** Detalhe por vendedor (chave = código do vendedor como string) — usado no drill-down da UI. */
    porRevendaVendedor: Record<string, Record<string, (number | null)[]>>;
}

export interface LinhaFlagDiaria {
    revenda: string;
    vendedor: string;
    data: string;
    deslocamento: boolean;
    problema: boolean;
    naoIniciouRota: boolean;
}

const MESES_PT = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function toDate(iso: string): Date {
    return new Date(iso + "T00:00:00");
}

function toISO(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function fmtDM(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
}

/** Segunda-feira da semana que contém `d` (semana comercial seg-sex). */
function segundaFeiraDaSemana(d: Date): Date {
    const diaSemana = d.getDay(); // 0=domingo, 1=segunda, ..., 6=sábado
    const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
    const segunda = new Date(d);
    segunda.setDate(segunda.getDate() + offset);
    return segunda;
}

/** Gera N períodos consecutivos terminando em `dataFim`, do mais antigo para o mais recente. */
export function gerarPeriodos(granularidade: Granularidade, dataFim: string, quantidade: number): PeriodoComparativo[] {
    const periodos: PeriodoComparativo[] = [];

    if (granularidade === "diario") {
        const fim = toDate(dataFim);
        for (let i = quantidade - 1; i >= 0; i--) {
            const d = new Date(fim);
            d.setDate(d.getDate() - i);
            const iso = toISO(d);
            periodos.push({ label: fmtDM(iso), inicio: iso, fim: iso });
        }
        return periodos;
    }

    if (granularidade === "semanal") {
        // Semana comercial completa: segunda a sexta, alinhada ao calendário (não um bloco corrido de 7 dias).
        const segundaRef = segundaFeiraDaSemana(toDate(dataFim));
        for (let i = quantidade - 1; i >= 0; i--) {
            const segunda = new Date(segundaRef);
            segunda.setDate(segunda.getDate() - i * 7);
            const sexta = new Date(segunda);
            sexta.setDate(sexta.getDate() + 4);
            const isoInicio = toISO(segunda);
            const isoFim = toISO(sexta);
            periodos.push({ label: `${fmtDM(isoInicio)}–${fmtDM(isoFim)}`, inicio: isoInicio, fim: isoFim });
        }
        return periodos;
    }

    // mensal
    const fimRef = toDate(dataFim);
    for (let i = quantidade - 1; i >= 0; i--) {
        const mesRef = new Date(fimRef.getFullYear(), fimRef.getMonth() - i, 1);
        const inicioMes = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
        const ultimoDiaMes = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0);
        const isMesAtual = i === 0;
        const fimMes = isMesAtual && ultimoDiaMes > fimRef ? fimRef : ultimoDiaMes;
        periodos.push({
            label: `${MESES_PT[mesRef.getMonth()]}/${mesRef.getFullYear()}`,
            inicio: toISO(inicioMes),
            fim: toISO(fimMes),
        });
    }
    return periodos;
}

/** Score do dia: nº de flags disparadas naquele dia específico (sem exigir recorrência). */
export function scoreDiaLinha(r: AnaliseVendedor, cfg: ConfigMetricasRecorrencia): number {
    return FLAGS_RECORRENCIA.reduce(
        (s, f) => (f.id === "ociosidadeAlta" ? s : s + (avaliarFlag(f.id as FlagId, r, cfg) ? 1 : 0)),
        0,
    );
}

function media(valores: number[]): number | null {
    if (!valores.length) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function criarAgregador(periodos: PeriodoComparativo[]) {
    const porRevenda: Record<string, (number | null)[]> = {};
    const porRevendaVendedor: Record<string, Record<string, (number | null)[]>> = {};

    function garantirLinha(revenda: string, vendedor?: string) {
        if (!porRevenda[revenda]) porRevenda[revenda] = periodos.map(() => null);
        if (vendedor !== undefined) {
            if (!porRevendaVendedor[revenda]) porRevendaVendedor[revenda] = {};
            if (!porRevendaVendedor[revenda][vendedor]) porRevendaVendedor[revenda][vendedor] = periodos.map(() => null);
        }
    }

    return { porRevenda, porRevendaVendedor, garantirLinha };
}

export function computarComparativo(
    visitas: ProcessedVisita[],
    granularidade: Granularidade,
    dataFim: string,
    quantidade: number,
    cfg: ConfigMetricasRecorrencia,
    campo: "scoreCritico" | "scoreDistorcao" = "scoreCritico",
): ComparativoScoreResult {
    const periodos = gerarPeriodos(granularidade, dataFim, quantidade);
    const { porRevenda, porRevendaVendedor, garantirLinha } = criarAgregador(periodos);

    if (granularidade === "diario") {
        const inicioJanela = periodos[0]?.inicio;
        const fimJanela = periodos[periodos.length - 1]?.fim;
        const visitasJanela = visitas.filter(v => v.data >= inicioJanela && v.data <= fimJanela);
        const linhas = calcularAnalisePeriodo(visitasJanela, cfg);
        const ativas = linhas.filter(l => l.visitas_total_dentro_raio > 0);

        const idxPorData = new Map(periodos.map((p, i) => [p.inicio, i]));

        // Agrupa por (revenda, data) para tirar a média entre vendedores do setor naquele dia
        const grupos = new Map<string, { revenda: string; idx: number; scores: number[] }>();
        for (const l of ativas) {
            const idx = idxPorData.get(l.data);
            if (idx === undefined) continue;
            const score = scoreDiaLinha(l, cfg);
            const vendedorKey = String(l.vendedor);

            garantirLinha(l.revenda, vendedorKey);
            porRevendaVendedor[l.revenda][vendedorKey][idx] = score;

            const chave = `${l.revenda}|${idx}`;
            if (!grupos.has(chave)) grupos.set(chave, { revenda: l.revenda, idx, scores: [] });
            grupos.get(chave)!.scores.push(score);
        }
        for (const { revenda, idx, scores } of grupos.values()) {
            garantirLinha(revenda);
            porRevenda[revenda][idx] = media(scores);
        }
        return { periodos, porRevenda, porRevendaVendedor };
    }

    // semanal / mensal — reaproveita computarRecorrenciaPeriodo por janela
    periodos.forEach((periodo, idx) => {
        const visitasPeriodo = visitas.filter(v => v.data >= periodo.inicio && v.data <= periodo.fim);
        const porRev = computarRecorrenciaPeriodo(visitasPeriodo, cfg);
        for (const [revenda, lista] of Object.entries(porRev)) {
            const ativos = lista.filter(v => v.diasAtivos > 0);
            garantirLinha(revenda);
            porRevenda[revenda][idx] = media(ativos.map(v => v[campo]));
            for (const v of ativos) {
                const vendedorKey = String(v.vendedor);
                garantirLinha(revenda, vendedorKey);
                porRevendaVendedor[revenda][vendedorKey][idx] = v[campo];
            }
        }
    });

    return { periodos, porRevenda, porRevendaVendedor };
}

/** Score da flag diária manual: nº de flags marcadas (Deslocamento/Problema/Não iniciou rota), 0 a 3. */
export function scoreFlagDiaria(l: LinhaFlagDiaria): number {
    return (l.deslocamento ? 1 : 0) + (l.problema ? 1 : 0) + (l.naoIniciouRota ? 1 : 0);
}

/**
 * Comparativo baseado nas flags manuais diárias (analiseFlagsDiarias) em vez do score de recorrência
 * calculado sobre as visitas. Cada vendedor entra no período apenas se tiver ao menos um registro salvo nele;
 * o valor do vendedor no período é a média dos scores diários salvos, e o valor do setor é a média entre vendedores.
 */
export function computarComparativoFlags(
    linhas: LinhaFlagDiaria[],
    granularidade: Granularidade,
    dataFim: string,
    quantidade: number,
): ComparativoScoreResult {
    const periodos = gerarPeriodos(granularidade, dataFim, quantidade);
    const { porRevenda, porRevendaVendedor, garantirLinha } = criarAgregador(periodos);

    // revenda -> vendedor -> idx -> valores do dia
    const bucket = new Map<string, Map<string, Map<number, number[]>>>();
    for (const l of linhas) {
        const idx = periodos.findIndex(p => l.data >= p.inicio && l.data <= p.fim);
        if (idx === -1) continue;
        if (!bucket.has(l.revenda)) bucket.set(l.revenda, new Map());
        const porVend = bucket.get(l.revenda)!;
        if (!porVend.has(l.vendedor)) porVend.set(l.vendedor, new Map());
        const porIdx = porVend.get(l.vendedor)!;
        if (!porIdx.has(idx)) porIdx.set(idx, []);
        porIdx.get(idx)!.push(scoreFlagDiaria(l));
    }

    for (const [revenda, porVend] of bucket) {
        garantirLinha(revenda);
        const mediasPorIdx: number[][] = periodos.map(() => []);
        for (const [vendedor, porIdx] of porVend) {
            garantirLinha(revenda, vendedor);
            periodos.forEach((_, idx) => {
                const valores = porIdx.get(idx);
                const m = valores?.length ? media(valores) : null;
                porRevendaVendedor[revenda][vendedor][idx] = m;
                if (m !== null) mediasPorIdx[idx].push(m);
            });
        }
        porRevenda[revenda] = mediasPorIdx.map(vals => media(vals));
    }

    return { periodos, porRevenda, porRevendaVendedor };
}
