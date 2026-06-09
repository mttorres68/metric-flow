import type { AcaoVendState } from "./types";

function listSetores(codigos: string[]): string {
    if (codigos.length === 1) return codigos[0];
    return codigos.slice(0, -1).join(", ") + " e " + codigos[codigos.length - 1];
}

export function buildMensagensHTML(vendState: Record<string, AcaoVendState>): string {
    const problemas = Object.entries(vendState)
        .filter(([, v]) => v.problema).map(([k]) => k)
        .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    const deslocamentos = Object.entries(vendState)
        .filter(([, v]) => v.deslocamento).map(([k]) => k)
        .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

    const msgs: string[] = [];

    if (problemas.length === 1)
        msgs.push(`<p>O setor ${problemas[0]} apresentou problema no PathTracker.</p>`);
    else if (problemas.length > 1)
        msgs.push(`<p>Os setores ${listSetores(problemas)} apresentaram problema no PathTracker.</p>`);

    if (deslocamentos.length === 1)
        msgs.push(`<p>O setor ${deslocamentos[0]} realizou deslocamento extenso até o primeiro PDV.</p>`);
    else if (deslocamentos.length > 1)
        msgs.push(`<p>Os setores ${listSetores(deslocamentos)} realizaram deslocamento extenso até o primeiro PDV.</p>`);

    return msgs.join("");
}
