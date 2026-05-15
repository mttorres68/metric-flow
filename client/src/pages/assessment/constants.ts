export const PASTEL_LIGHT = [
    "#A8C5E8", "#A8F4C5", "#C5A8F4", "#F4C5A8",
    "#F4A8C5", "#A8D4F4", "#F4E8A8", "#F4A8A8",
    "#C5F4E8", "#E8C5F4",
];

export const PASTEL_DARK = [
    "#6C8EF5", "#34C78A", "#A78BFA", "#F5956C",
    "#F472B6", "#38BDF8", "#FBBF24", "#F87171",
    "#22D3EE", "#C084FC",
];

export const PIRAMIDE_COR: Record<string, string> = {
    "COMPLIANCE": "#F4A8A8",
    "COND. BÁSICA": "#F4C5A8",
    "EXECUÇÃO": "#A8C5E8",
    "EFICIÊNCIA": "#A8F4C5",
    "ESTRATÉGIA": "#C5A8F4",
};

export const FAMILIA_COR: Record<string, string> = {
    "RH / Pessoas": "#F4A8C5",
    "BI / Painel / Sistema": "#A8C5E8",
    "Rota / Visita de Mercado": "#A8F4C5",
    "Documentos / Política / Carta": "#C5A8F4",
    "Estoque / Armazém / Logística": "#F4C5A8",
    "Reunião / Governança / Ata": "#F4E8A8",
    "Cobertura de Marca / Comercial": "#A8D4F4",
    "Trade / Ativos / MPDV": "#F4A8A8",
    "Frota / Veículos": "#C5F4E8",
    "Fotos / Identidade Visual": "#E8C5F4",
    "SHE / Segurança": "#F5956C",
    "Lista de Presença / Treinamento": "#34C78A",
};

export const REVENDA_COR: Record<string, string> = {
    "Duttra MA": "#6C8EF5",
    "Duttra FL": "#34C78A",
    "Duttra SRN": "#A78BFA",
    "Forte QX": "#F5956C",
    "Forte AR": "#F472B6",
};

export const MESES = [
    { num: 1, label: "Jan" }, { num: 2, label: "Fev" }, { num: 3, label: "Mar" },
    { num: 4, label: "Abr" }, { num: 5, label: "Mai" }, { num: 6, label: "Jun" },
    { num: 7, label: "Jul" }, { num: 8, label: "Ago" }, { num: 9, label: "Set" },
    { num: 10, label: "Out" }, { num: 11, label: "Nov" }, { num: 12, label: "Dez" },
] as const;

export const MEDAL = ["🥇", "🥈", "🥉"];

export const POSITION_COLORS = [
    { bg: "from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10", border: "border-amber-200 dark:border-amber-500/30", badge: "bg-amber-400 text-white" },
    { bg: "from-slate-50 to-zinc-50 dark:from-slate-500/10 dark:to-zinc-500/10",     border: "border-slate-200 dark:border-slate-500/30",  badge: "bg-slate-400 text-white" },
    { bg: "from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10", border: "border-orange-200 dark:border-orange-500/30", badge: "bg-orange-400 text-white" },
];

export const DEFAULT_COLOR = { bg: "bg-white dark:bg-[var(--card)]", border: "", badge: "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400" };

export function classNames(...cls: (string | false | null | undefined)[]) {
    return cls.filter(Boolean).join(" ");
}

export function corFamilia(fam: string | null | undefined): string {
    if (!fam) return "#94A3B8";
    return FAMILIA_COR[fam] || "#94A3B8";
}

export function corRevenda(rev: string): string {
    return REVENDA_COR[rev] || "#94A3B8";
}

export function pctColor(pct: number): string {
    if (pct >= 80) return "#22C55E";
    if (pct >= 60) return "#84CC16";
    if (pct >= 40) return "#EAB308";
    if (pct >= 20) return "#F97316";
    return "#EF4444";
}
