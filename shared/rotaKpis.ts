/**
 * MetricFlow — Cálculo unificado de KPIs de Rota Coaching.
 *
 * Fonte única de verdade para dashboard (RotaCoaching.tsx), PDF cliente
 * (pdfExport.ts) e PDF servidor (routes/relatorio.ts). Antes, cada consumidor
 * tinha sua própria regra (com/sem dedup por GA, denominadores diferentes),
 * gerando números divergentes para o mesmo dia.
 *
 * Regras canônicas:
 *  - Dedup por GA dentro de (data, revenda): quando um GA acompanhou múltiplos
 *    vendedores no dia, vale a linha com mais visitas do vendedor (pdvsVis) —
 *    gaVis é o total do GA no dia repetido em cada par GA×vendedor, então
 *    somar sem dedup conta dobrado.
 *  - Contagens ok/parcial/nok: apenas linhas agendadas, após dedup.
 *  - Taxa = (ok + 0.5·parcial) / (ok + parcial + nok), em %, 1 casa decimal.
 */

export interface RotaKpiRow {
    data?: string;
    /** Nome da revenda — aceita tanto o campo curto (rev) quanto o longo. */
    rev?: string;
    revenda?: string;
    gaId?: string;
    ga?: string;
    status?: string; // "ok" | "partial"/"parcial" | "nok" | "na"
    agendado?: boolean;
    pdvsProg?: number;
    pdvsVis?: number;
    gaVis?: number;
    /** Vendedor declarado na agenda — linha "oficial" do GA no dia. */
    vendedor_agenda?: string;
}

const norm = (s: unknown): string => String(s ?? "").trim().toLowerCase();

export const revendaDe = (r: RotaKpiRow): string => String(r.rev ?? r.revenda ?? "");
export const gaDe = (r: RotaKpiRow): string => String(r.gaId ?? r.ga ?? "");

export const isOk = (r: RotaKpiRow): boolean => norm(r.status) === "ok";
export const isParcial = (r: RotaKpiRow): boolean => ["partial", "parcial"].includes(norm(r.status));
export const isNok = (r: RotaKpiRow): boolean => norm(r.status) === "nok";

/**
 * Deduplica por GA dentro de (data, revenda).
 * Preferência: 1) linha do vendedor declarado na agenda (vendedor_agenda
 * preenchido); 2) maior pdvsVis (regra histórica do PDF do servidor).
 */
export function dedupRotaPorGA<T extends RotaKpiRow>(rows: T[]): T[] {
    const best = new Map<string, T>();
    const temAgenda = (r: RotaKpiRow) => String(r.vendedor_agenda ?? "").trim() !== "";
    for (const r of rows) {
        const key = `${r.data ?? ""}__${norm(revendaDe(r))}__${gaDe(r)}`;
        const atual = best.get(key);
        if (!atual) { best.set(key, r); continue; }
        const ganha =
            (temAgenda(r) && !temAgenda(atual)) ||
            (temAgenda(r) === temAgenda(atual) &&
                Number(r.pdvsVis ?? 0) > Number(atual.pdvsVis ?? 0));
        if (ganha) best.set(key, r);
    }
    return [...best.values()];
}

export interface RotaKpis {
    /** Revendas distintas no conjunto (inclui não agendados). */
    revendas: number;
    ok: number;
    parcial: number;
    nok: number;
    /** ok + parcial + nok (denominador da taxa). */
    total: number;
    /** % com 1 casa decimal, ou null quando não há registros avaliáveis. */
    taxa: number | null;
    /** Linhas agendadas após dedup — base para tabelas e gráficos. */
    registros: RotaKpiRow[];
}

export function calcularKpisRota<T extends RotaKpiRow>(rows: T[]): RotaKpis & { registros: T[] } {
    const registros = dedupRotaPorGA(rows.filter(r => r.agendado));
    const ok = registros.filter(isOk).length;
    const parcial = registros.filter(isParcial).length;
    const nok = registros.filter(isNok).length;
    const total = ok + parcial + nok;
    return {
        revendas: new Set(rows.map(revendaDe).filter(Boolean)).size,
        ok, parcial, nok, total,
        taxa: total > 0 ? Math.round(((ok + parcial * 0.5) / total) * 1000) / 10 : null,
        registros,
    };
}

/** Formata a taxa para exibição ("82.5%" ou "—") */
export function formatarTaxa(taxa: number | null): string {
    return taxa != null ? `${taxa}%` : "—";
}
