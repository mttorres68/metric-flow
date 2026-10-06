/**
 * MetricFlow — Relatório Gerencial de Entregas (CheckNow × Infleet)
 *
 *   POST /api/relatorio-entregas/gerar
 *     Body: { xlsxBase64: string, analise?: string, data?: "aaaa-mm-dd" }
 *     → PDF (1 dia, ou só `data` quando informada) ou ZIP (vários dias).
 *     Sem banco: tudo calculado no request. A tela usa o tRPC entregas.processar.
 */
import { Router, type Request, type Response } from "express";
import JSZip from "jszip";
import { PlanilhaInvalidaError } from "../services/entregas/parseCheckNow";
import { processarPlanilha } from "../services/entregas/processar";
import type { ResultadoLinha } from "../services/entregas/cruzar";
import { gerarPDFEntregas } from "../services/pdfEntregas";

export const relatorioEntregasRouter = Router();

relatorioEntregasRouter.post("/gerar", async (req: Request, res: Response) => {
  const { xlsxBase64, analise, data: soData } = (req.body ?? {}) as { xlsxBase64?: unknown; analise?: unknown; data?: unknown };
  if (typeof xlsxBase64 !== "string" || !xlsxBase64) {
    res.status(400).json({ error: "Campo xlsxBase64 obrigatório." });
    return;
  }

  try {
    let resultados = await processarPlanilha(Buffer.from(xlsxBase64, "base64"), new Date());
    if (typeof soData === "string" && soData) resultados = resultados.filter(r => r.linha.data === soData);
    if (!resultados.length) {
      res.status(400).json({ error: "Nenhuma rota iniciada na planilha para o período pedido." });
      return;
    }

    const porDia = new Map<string, ResultadoLinha[]>();
    for (const r of resultados) porDia.set(r.linha.data, [...(porDia.get(r.linha.data) ?? []), r]);

    const textoAnalise = typeof analise === "string" ? analise : "";
    const pdfs: { nome: string; buf: Buffer }[] = [];
    for (const [data, ls] of porDia) {
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
    if (e instanceof PlanilhaInvalidaError) {
      res.status(400).json({ error: e.message, faltando: e.faltando });
      return;
    }
    console.error("[relatorio-entregas]", e);
    res.status(500).json({ error: (e as Error).message });
  }
});
