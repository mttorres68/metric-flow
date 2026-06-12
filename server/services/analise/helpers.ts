export function hmsToMin(s: string | null | undefined): number | null {
    if (!s || s === "ND") return null;
    const parts = s.split(":");
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const sec = parts[2] ? parseInt(parts[2], 10) : 0;
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m + sec / 60;
}

export function minToHms(min: number): string {
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.floor(Math.abs(min) % 60);
    const s = Math.round((Math.abs(min) % 1) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function minToHM(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseDistPV(s: string): number {
    if (!s || s === "ND") return 9999;
    if (s === "AC") return 299;  // Atualização de Coordenadas = dentro do raio por definição
    let clean: string;
    if (s.includes(",") && s.includes(".")) {
        // Formato BR: "3.852,92" → ponto=milhar, vírgula=decimal
        clean = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
        // Vírgula como decimal: "3852,92"
        clean = s.replace(",", ".");
    } else {
        // Ponto decimal padrão: "3852.92"
        clean = s;
    }
    clean = clean.replace(/[^0-9.\-]/g, "");
    const result = parseFloat(clean);
    return isNaN(result) ? 9999 : result;
}
