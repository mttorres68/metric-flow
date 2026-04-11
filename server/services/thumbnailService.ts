/**
 * MetricFlow — Thumbnail Service
 *
 * Renderiza a primeira página de um buffer PDF como JPEG usando
 * pdfjs-dist (legado, Node.js) + @napi-rs/canvas.
 */

import { createCanvas, DOMMatrix, Path2D } from "@napi-rs/canvas";
import { createRequire } from "module";

// Injeta polyfills que o pdfjs-dist (legacy) precisa em Node.js.
// Deve ser feito ANTES do primeiro import do pdfjs.
if (!(globalThis as any).DOMMatrix) (globalThis as any).DOMMatrix = DOMMatrix;
if (!(globalThis as any).Path2D)    (globalThis as any).Path2D    = Path2D;

const _require = createRequire(import.meta.url);
const pdfjsLib = _require("pdfjs-dist/legacy/build/pdf.js");

// Desabilita o worker (não existe em Node.js)
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

// ---------------------------------------------------------------------------
// Canvas factory compatível com @napi-rs/canvas
// ---------------------------------------------------------------------------

interface CanvasAndContext {
    canvas: ReturnType<typeof createCanvas>;
    context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>;
}

const NodeCanvasFactory = {
    create(width: number, height: number): CanvasAndContext {
        const canvas = createCanvas(width, height);
        return { canvas, context: canvas.getContext("2d") };
    },
    reset(cc: CanvasAndContext, width: number, height: number) {
        cc.canvas.width  = width;
        cc.canvas.height = height;
    },
    destroy(_cc: CanvasAndContext) { /* noop */ },
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Gera um thumbnail JPEG da primeira página do PDF.
 * @param pdfBuffer  Buffer contendo o PDF
 * @param scale      Fator de escala (padrão 0.75 — resulta ~A4 thumbnail)
 * @returns          Buffer JPEG
 */
export async function gerarThumbnailPDF(pdfBuffer: Buffer, scale = 0.75): Promise<Buffer> {
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        useWorkerFetch:   false,
        isEvalSupported:  false,
        useSystemFonts:   true,
        canvasFactory:    NodeCanvasFactory,
    });

    const pdf  = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale });
    const w = Math.floor(viewport.width);
    const h = Math.floor(viewport.height);

    const canvas  = createCanvas(w, h);
    const context = canvas.getContext("2d");

    await page.render({
        canvasContext: context as any,
        viewport,
        canvasFactory: NodeCanvasFactory,
    }).promise;

    // JPEG 85 % — bom equilíbrio qualidade/tamanho para thumbnail WA
    return canvas.toBuffer("image/jpeg", 85);
}
