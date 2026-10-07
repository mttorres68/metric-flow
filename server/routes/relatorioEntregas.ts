/**
 * MetricFlow — Relatório Gerencial de Entregas (CheckNow × Infleet)
 *
 *   POST /api/relatorio-entregas/gerar
 *     Body: { revendaId: number, de: "aaaa-mm-dd", ate: "aaaa-mm-dd", analise?: string, data?: "aaaa-mm-dd", cercaId?: string }
 *     → PDF (1 dia, ou só `data` quando informada) ou ZIP (vários dias).
 *     Entregas lidas do banco (coleta do CheckNow); GPS pela conta Infleet da revenda. A tela usa o tRPC entregas.processar.
 */
import { Router, type Request, type Response } from "express";
import JSZip from "jszip";
import { processarEntregas } from "../services/entregas/processar";
import { entregasDoPeriodo, tokenInfleet } from "../services/checknow/repo";
import type { ResultadoLinha } from "../services/entregas/cruzar";
import { gerarPDFEntregas } from "../services/pdfEntregas";
import { getConfigEntregas } from "../services/configService";

export const relatorioEntregasRouter = Router();

relatorioEntregasRouter.post("/gerar", async (req: Request, res: Response) => {
  const { revendaId, de, ate, analise, data: soData, cercaId } = (req.body ?? {}) as Record<string, unknown>;
  const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (typeof revendaId !== "number" || !Number.isInteger(revendaId) || !ehDia(de) || !ehDia(ate)) {
    res.status(400).json({ error: "Informe revenda e período." });
    return;
  }

  try {
    const config = await getConfigEntregas();
    const [entregas, token] = await Promise.all([entregasDoPeriodo(revendaId, de, ate), tokenInfleet(revendaId)]);
    let { linhas: resultados } = await processarEntregas(entregas, new Date(), {
      cercaId: typeof cercaId === "string" && cercaId ? cercaId : undefined,
      token,
      config,
      periodo: { de, ate },
    });
    if (typeof soData === "string" && soData) resultados = resultados.filter(r => r.linha.data === soData);
    if (!resultados.length) {
      res.status(400).json({ error: "Nenhuma rota iniciada no período pedido." });
      return;
    }

    const porDia = new Map<string, ResultadoLinha[]>();
    for (const r of resultados) porDia.set(r.linha.data, [...(porDia.get(r.linha.data) ?? []), r]);

    const textoAnalise = typeof analise === "string" ? analise : "";
    const pdfs: { nome: string; buf: Buffer }[] = [];
    for (const [data, ls] of porDia) {
      const avisos = ls.filter(r => r.semGps).map(r => `${r.linha.placa} · ${r.linha.motorista}: ${r.semGps}`);
      pdfs.push({ nome: `entregas_${data}.pdf`, buf: await gerarPDFEntregas({ data, linhas: ls, analise: textoAnalise, avisos, raioM: config.raioM }) });
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
