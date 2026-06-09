export async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export async function fetchPDFBase64(
    data: string,
    rev: string,
    analises: Record<string, { vendedores: string; gas: string }>
): Promise<{ base64: string; filename: string }> {
    const resp = await fetch("/api/relatorio/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, revenda: rev, analises }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao gerar PDF");
    }
    const blob = await resp.blob();
    const filename =
        resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `${rev}_${data}.pdf`;
    const base64 = await blobToBase64(blob);
    return { base64, filename };
}

export async function fetchThumbnail(pdfBase64: string): Promise<string | null> {
    try {
        const resp = await fetch("/api/relatorio/thumbnail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdf: pdfBase64 }),
        });
        if (!resp.ok) return null;
        const { thumbnail } = await resp.json();
        return thumbnail ?? null;
    } catch {
        return null;
    }
}

export async function fetchUnifiedPDFBase64(
    data: string,
    analises: Record<string, { vendedores: string; gas: string }>
): Promise<{ base64: string; filename: string }> {
    const resp = await fetch("/api/relatorio/gerar-unificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, analises }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao gerar PDF unificado");
    }
    const blob = await resp.blob();
    const filename =
        resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `relatorios_unificado_${data}.pdf`;
    const base64 = await blobToBase64(blob);
    return { base64, filename };
}
