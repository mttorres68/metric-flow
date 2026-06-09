export function pct(v: number, decimals = 1) {
    return `${v.toFixed(decimals)}%`;
}

export function fmt(v: number | null | undefined, suffix = "") {
    if (v === null || v === undefined) return "—";
    return `${v}${suffix}`;
}

export function minToHM(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h === 0) return `${m}min`;
    return `${h}h${String(m).padStart(2, "0")}`;
}

export function sanitizeInsightHtml(html: string): string {
    return html.replace(/<(?!\/?(?:p|ul|li|strong|br)\b)[^>]+>/gi, "");
}
