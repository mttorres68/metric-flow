// ─────────────────────────────────────────────────────────────────────────────
// Tipos, constantes e helpers do módulo Rota Coaching
// ─────────────────────────────────────────────────────────────────────────────

export interface RotaRow {
    data: string;
    rev: string;
    gaId: string;
    vendId: string;
    fonte: string;
    agendado: boolean;
    status: "ok" | "partial" | "nok" | "na";
    pdvsProg: number;
    pdvsVis: number;
    gaVis: number;
    pctGA: number;
    pctV: number;
    /** Cobertura: |GA ∩ visitados válidos| / pdvsVis (regra 12/06/2026) */
    pctCob?: number | null;
    /** Setor declarado na agenda do GA */
    setor_agendado?: string;
    /** Todos os setores que o GA registrou no app no dia */
    setores_app?: string[];
    vendedor_agenda?: string;
    atividade?: string;
    vendedor_no_app?: string;
    clientes_comuns?: string[];
    geo_detalhes?: Array<{
        cliente: string;
        razao_social?: string;
        cod_cliente_pt?: string;
        id_cliente_ga?: string | null;
        tem_ga?: boolean;
        hora_ini_vend?: string | null;
        hora_fim_vend?: string | null;
        hora_ga?: string | null;
        valor_ped?: string;
        q1_status_pdv?: string | null;
        distancia_m: number | null;
        dentro_raio: boolean | null;
        lat_ga: number | null;
        lon_ga: number | null;
        lat_vend?: number | null;
        lon_vend?: number | null;
        lat_pdv?: number | null;
        lon_pdv?: number | null;
        fonte_distancia?: 'app' | 'haversine' | 'sem_dado';
    }>;
    clientes_dentro_raio?: string[];
    clientes_fora_raio?: string[];
    clientes_sem_coords?: string[];
    pct_geo_confirmado?: number | null;
}

export interface MapPonto {
    lat: number;
    lon: number;
    tipo: 'pdv' | 'ga' | 'vend';
    label: string;
    cor?: string;
    info?: string;
}

export const STATUS_COLORS = {
    ok: { bg: "bg-green-50 border-green-200 text-green-700", dot: "bg-green-500", label: "Completo" },
    partial: { bg: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-400", label: "Parcial" },
    nok: { bg: "bg-red-50 border-red-200 text-red-600", dot: "bg-red-400", label: "Não Realizado" },
    na: { bg: "bg-slate-50 border-slate-200 text-slate-500", dot: "bg-slate-300", label: "Sem Agenda" },
};

export const CHART_COLORS = ["#22d3ee", "#facc15", "#f87171", "#34d399", "#818cf8", "#fb923c"];

export const FILTER_KEY = "metricflow:rota-coaching-filters";
export const ANALISES_GA_KEY = "metricflow:analises-ga";

export function fmtMin(min: number): string {
    if (min <= 0) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

export function todayIso(): string {
    // Fuso fixo de Fortaleza — toISOString() (UTC) virava "amanhã" após as 21h BRT
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Fortaleza",
        year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
}

export function periodoIntervalo(start: string, end: string) {
    return { inicio: `${start}T00:00:00-03:00`, fim: `${end}T23:59:59-03:00` };
}

export function loadFilters(): Record<string, any> {
    try { return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch { return {}; }
}
