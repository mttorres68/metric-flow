/**
 * MetricFlow — Relatório Gerencial de Entregas (CheckNow × Infleet)
 *
 *   POST /api/relatorio-entregas/gerar
 *     Body: { xlsxBase64: string, analise?: string }
 *     → PDF (1 dia) ou ZIP (vários dias). Sem banco: tudo calculado no request.
 */
import { Router, type Request, type Response } from "express";
import JSZip from "jszip";
import { parseCheckNow, PlanilhaInvalidaError, type Entrega } from "../services/entregas/parseCheckNow";
import { montarLinhas, agruparPorRota, cruzar, type ResultadoLinha } from "../services/entregas/cruzar";
import { mapaVeiculos, buscarGpsLinha, gpsErro, normalizarPlaca } from "../services/entregas/infleetEntregas";
import { gerarPDFEntregas } from "../services/pdfEntregas";

export const relatorioEntregasRouter = Router();

/** Executa fn sobre itens com no máximo n chamadas simultâneas, preservando a ordem. */
async function emParalelo<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (proximo < itens.length) {
      const k = proximo++;
      out[k] = await fn(itens[k]);
    }
  }));
  return out;
}

relatorioEntregasRouter.post("/gerar", async (req: Request, res: Response) => {
  const { xlsxBase64, analise } = (req.body ?? {}) as { xlsxBase64?: unknown; analise?: unknown };
  if (typeof xlsxBase64 !== "string" || !xlsxBase64) {
    res.status(400).json({ error: "Campo xlsxBase64 obrigatório." });
    return;
  }

  let entregas: Entrega[];
  try {
    entregas = parseCheckNow(Buffer.from(xlsxBase64, "base64"));
  } catch (e) {
    if (e instanceof PlanilhaInvalidaError) {
      res.status(400).json({ error: e.message, faltando: e.faltando });
      return;
    }
    res.status(400).json({ error: "Não foi possível ler a planilha.", detalhes: String(e) });
    return;
  }

  const linhas = montarLinhas(entregas, new Date());
  if (!linhas.length) {
    res.status(400).json({ error: "Nenhuma rota iniciada na planilha." });
    return;
  }

  try {
    const veiculos = await mapaVeiculos();
    const porRota = agruparPorRota(entregas);
    const resultados = await emParalelo(linhas, 3, async l => {
      const vId = veiculos.get(normalizarPlaca(l.placa));
      const gps = vId ? await buscarGpsLinha(vId, l.janela) : gpsErro("sem rastreador");
      return cruzar(l, porRota.get(l.routeId)!, gps);
    });

    const porDia = new Map<string, ResultadoLinha[]>();
    for (const r of resultados) porDia.set(r.linha.data, [...(porDia.get(r.linha.data) ?? []), r]);

    const textoAnalise = typeof analise === "string" ? analise : "";
    const pdfs: { nome: string; buf: Buffer }[] = [];
    for (const [data, ls] of [...porDia].sort(([a], [b]) => a.localeCompare(b))) {
      ls.sort((a, b) => a.linha.placa.localeCompare(b.linha.placa) || a.linha.motorista.localeCompare(b.linha.motorista));
      const avisos = ls.filter(r => r.semGps).map(r => `${r.linha.placa} · ${r.linha.motorista}: ${r.semGps}`);
      pdfs.push({ nome: `entregas_${data}.pdf`, buf: await gerarPDFEntregas({ data, linhas: ls, analise: textoAnalise, avisos }) });
    }

    if (pdfs.length === 1) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${pdfs[0].nome}"`);
      res.send(pdfs[0].buf);
      return;
    }
    const zip = new JSZip();
    for (const p of pdfs) zip.file(p.nome, p.buf);
    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="entregas.zip"`);
    res.send(zipBuf);
  } catch (e) {
    console.error("[relatorio-entregas]", e);
    res.status(500).json({ error: (e as Error).message });
  }
});
