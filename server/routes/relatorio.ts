/**
 * MetricFlow — Rota de Geração de Relatórios PDF
 *
 * Endpoints:
 *   GET  /api/relatorio/gerar?data=YYYY-MM-DD[&revenda=NOME]
 *     → Compatibilidade retroativa; análises lidas do MySQL se disponível.
 *
 *   POST /api/relatorio/gerar
 *     → Body: { data, revenda?, analises: { [revenda]: { vendedores: string, gas: string } } }
 *     → Análises passadas inline no body (sem dependência de MySQL).
 *
 *   GET /api/relatorio/datas-disponiveis
 *   GET /api/relatorio/revendas?data=YYYY-MM-DD
 */

import { Router, Request, Response } from "express";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { and, eq } from "drizzle-orm";
import { getVisitasData, getRotaCoachingData } from "../services/dataCache";
import { calcularMetricas } from "../services/metricsCalculator";
import {
  gerarPDFRevenda,
  type CoachingKPIs,
  type CoachingRecord,
  type VendedorRow,
} from "../services/pdfService";
import { getDb } from "../db";
import { analises } from "../../drizzle/schema";

export const relatorioRouter = Router();

// Mapeamento canônico: nome do database.xlsx → nome no coaching JSON
const REVENDA_COACHING_MAP: Record<string, string> = {
  "duttra floriano": "duttra fl",
  "duttra ma":       "duttra ma",
  "duttra srn":      "duttra sr",
  "forte aracati":   "forte ar",
  "forte quixada":   "forte qx",
};

// ---------------------------------------------------------------------------
// Tipo para análises inline (passadas no body do POST)
// ---------------------------------------------------------------------------
type AnalisesInline = Record<string, { vendedores?: string; gas?: string }>;

// ---------------------------------------------------------------------------
// Função principal de geração — compartilhada entre GET e POST
// ---------------------------------------------------------------------------
async function gerarPDFsParaData(
  data: string,
  revendas: string[],
  visitasData: any[],
  coachingAll: any[],
  analisesInline: AnalisesInline
): Promise<{ zip: JSZip; erros: string[] }> {
  const zip = new JSZip();
  const erros: string[] = [];

  function parseHMS(t: string): number {
    if (!t || t === "ND") return -1;
    const p = t.split(":").map(Number);
    return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
  }
  function isValidTime(t: string): boolean {
    return !!t && t !== "ND" && /^\d{1,2}:\d{2}/.test(t);
  }

  for (const revenda of revendas) {
    try {
      const visitasRevenda = visitasData.filter((v) => v.revenda === revenda);
      const metrics = calcularMetricas(visitasRevenda);

      // Matching canônico coaching
      const nomeCoaching = REVENDA_COACHING_MAP[revenda.toLowerCase()];
      const registrosData = (coachingAll as any[]).filter((r) => {
        if (!r?.revenda || !r?.data) return false;
        const nomeR = String(r.revenda).toLowerCase();
        const matchRevenda = nomeCoaching
          ? nomeR === nomeCoaching
          : nomeR === revenda.toLowerCase();
        return matchRevenda && r.data === data;
      });

      // Deduplica por GA: quando um GA acompanhou múltiplos vendedores no dia,
      // mantém apenas a entrada com mais visitas do vendedor (pdvsVis).
      const byGa: Record<string, any> = {};
      for (const r of registrosData) {
        const key = String(r.gaId ?? r.ga ?? "");
        if (!byGa[key] || (Number(r.pdvsVis ?? 0) > Number(byGa[key].pdvsVis ?? 0))) {
          byGa[key] = r;
        }
      }
      const agendados = Object.values(byGa);

      const okCount      = agendados.filter((r) => ["ok"].includes(String(r.status ?? "").toLowerCase())).length;
      const parcialCount = agendados.filter((r) => ["partial", "parcial"].includes(String(r.status ?? "").toLowerCase())).length;
      const nokCount     = agendados.filter((r) => ["nok"].includes(String(r.status ?? "").toLowerCase())).length;
      const total = okCount + parcialCount + nokCount;
      const taxa  = total > 0 ? Math.round(((okCount + parcialCount * 0.5) / total) * 1000) / 10 : 0;

      const coachingKPIs: CoachingKPIs = {
        ok: okCount, parcial: parcialCount, nok: nokCount, total, taxa,
        registros: agendados.map((r): CoachingRecord => {
          const vendIdValido = r.vendId && r.vendId !== "-" ? String(r.vendId) : "";
          const codVendedor = String(r.vendedor_agenda || r.vendedor_no_app || vendIdValido || "").trim() || undefined;
          const atividade = String(r.atividade || "").trim() || undefined;
          return {
            gaId: String(r.gaId ?? r.ga ?? "—"),
            ga: String(r.ga ?? "—"),
            atividade,
            codVendedor,
            status: String(r.status ?? "na"),
            pdvsProg: Number(r.pdvsProg ?? 0),
            pdvsVis: Number(r.pdvsVis ?? 0),
            gaVis: Number(r.gaVis ?? 0),
            conformidade_pct: Number(r.conformidade_pct ?? r.pctGA ?? 0),
          };
        }),
      };

      // Análises: prioridade ao inline (POST body / localStorage)
      // Fallback: MySQL se disponível
      // Nota: análises de GAs são salvas pelo RotaCoaching com o nome curto do coaching
      // (ex: "duttra fl"), então a busca no banco usa nomeCoaching como chave primária.
      let analiseVendedores = analisesInline[revenda]?.vendedores ?? "";
      let analiseGAs        = analisesInline[revenda]?.gas        ?? "";

      if (!analiseVendedores || !analiseGAs) {
        try {
          const db = await getDb();
          if (db) {
            // GAs são salvas com o nome do coaching JSON (ex: "duttra fl"), não o nome das visitas
            const revendaGA = nomeCoaching ?? revenda;
            const [avRows, agRows] = await Promise.all([
              !analiseVendedores
                ? db.select({ conteudo: analises.conteudo }).from(analises)
                    .where(and(eq(analises.revenda, revenda), eq(analises.data, data), eq(analises.tipo, "vendedores")))
                    .limit(1)
                : Promise.resolve([]),
              !analiseGAs
                ? db.select({ conteudo: analises.conteudo }).from(analises)
                    .where(and(eq(analises.revenda, revendaGA), eq(analises.data, data), eq(analises.tipo, "gas")))
                    .limit(1)
                : Promise.resolve([]),
            ]);
            analiseVendedores = analiseVendedores || avRows[0]?.conteudo || "";
            analiseGAs        = analiseGAs        || agRows[0]?.conteudo || "";
          }
        } catch (dbErr) {
          console.warn(`[relatorio] não foi possível carregar análises do banco para ${revenda}:`, dbErr);
        }
      }

      // Horários com segundos por vendedor
      const horariosPorVendedor = new Map<number, { ini: string; fim: string }>();
      for (const v of visitasRevenda) {
        const validIni = isValidTime(v.horaInicio);
        const validFim = isValidTime(v.horaFim);
        if (!validIni && !validFim) continue;
        const cur = horariosPorVendedor.get(v.vendedor);
        if (!cur) {
          horariosPorVendedor.set(v.vendedor, {
            ini: validIni ? v.horaInicio : "ND",
            fim: validFim ? v.horaFim    : "ND",
          });
        } else {
          if (validIni && (cur.ini === "ND" || parseHMS(v.horaInicio) < parseHMS(cur.ini))) cur.ini = v.horaInicio;
          if (validFim && (cur.fim === "ND" || parseHMS(v.horaFim)    > parseHMS(cur.fim))) cur.fim = v.horaFim;
        }
      }

      const vendedoresRows: VendedorRow[] = (metrics.graficos.vendedores as any[]).map((v) => {
        const cod = Number(String(v.vendedor).replace(/\D/g, ""));
        const hor = horariosPorVendedor.get(cod);
        const hrInicio = (hor && isValidTime(hor.ini)) ? hor.ini : (v.hrInicio ?? "ND");
        const hrFim    = (hor && isValidTime(hor.fim)) ? hor.fim : (v.hrFim    ?? "ND");
        return {
          vendedor: v.vendedor, hrInicio, hrFim,
          visitasAlmoco:     v.visitasAlmoco     ?? 0,
          percTarde:         v.percTarde         ?? 0,
          visitasTarde:      v.visitasTarde      ?? 0,
          visitasBrutasRaio: v.visitasBrutasRaio ?? 0,
          percCobertura:     v.percCobertura     ?? 0,
          visitasUnicasRaio: v.visitasUnicasRaio ?? 0,
          totalCarteira:     v.totalCarteira     ?? 0,
          percCurtas:        v.percCurtas        ?? 0,
          curtasCount:       v.curtasCount       ?? 0,
        };
      });

      const pdfBuffer = await gerarPDFRevenda({
        revenda, data, vendedoresRows, coachingKPIs, analiseVendedores, analiseGAs,
      });

      const nomeArquivo = `${revenda.replace(/[^a-z0-9\s]/gi, "").trim().replace(/\s+/g, "_")}_${data}.pdf`;
      zip.file(nomeArquivo, pdfBuffer);
      console.log(`[relatorio] PDF gerado: ${nomeArquivo}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[relatorio] erro ao gerar PDF para ${revenda}:`, msg);
      erros.push(`${revenda}: ${msg}`);
    }
  }

  return { zip, erros };
}

// ---------------------------------------------------------------------------
// Envia ZIP ou PDF único na response
// ---------------------------------------------------------------------------
async function enviarResposta(
  res: Response,
  zip: JSZip,
  erros: string[],
  data: string,
  revendaFiltro: string | undefined
) {
  const filesGerados = Object.keys(zip.files).length;

  if (filesGerados === 0) {
    res.status(500).json({ error: "Nenhum PDF pôde ser gerado.", detalhes: erros });
    return;
  }

  if (filesGerados === 1 && revendaFiltro) {
    const nomeArquivo = Object.keys(zip.files)[0];
    const fileData = await zip.files[nomeArquivo].async("nodebuffer");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    res.setHeader("Content-Length", fileData.length);
    if (erros.length > 0) res.setHeader("X-Erros-Parciais", JSON.stringify(erros));
    res.send(fileData);
    return;
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const zipFilename = `relatorios_${data}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);
  res.setHeader("Content-Length", zipBuffer.length);
  if (erros.length > 0) res.setHeader("X-Erros-Parciais", JSON.stringify(erros));
  console.log(`[relatorio] ZIP gerado: ${zipFilename} (${filesGerados} PDFs, ${zipBuffer.length} bytes)`);
  res.send(zipBuffer);
}

// ---------------------------------------------------------------------------
// GET /api/relatorio/datas-disponiveis
// ---------------------------------------------------------------------------
relatorioRouter.get("/datas-disponiveis", async (_req: Request, res: Response) => {
  try {
    const visitas = await getVisitasData();
    const datas = [...new Set(visitas.map((v) => v.data))].filter(Boolean).sort().reverse();
    res.json({ datas });
  } catch (err) {
    console.error("[relatorio] erro ao listar datas:", err);
    res.status(500).json({ error: "Erro ao carregar datas disponíveis." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/relatorio/revendas?data=YYYY-MM-DD
// ---------------------------------------------------------------------------
relatorioRouter.get("/revendas", async (req: Request, res: Response) => {
  const { data } = req.query;
  if (!data || typeof data !== "string") {
    res.status(400).json({ error: 'Parâmetro "data" obrigatório.' });
    return;
  }
  try {
    const visitas = await getVisitasData();
    const revendas = [...new Set(visitas.filter((v) => v.data === data).map((v) => v.revenda))]
      .filter(Boolean).sort();
    res.json({ revendas });
  } catch (err) {
    console.error("[relatorio] erro ao listar revendas:", err);
    res.status(500).json({ error: "Erro ao carregar revendas." });
  }
});

// ---------------------------------------------------------------------------
// Helpers de validação
// ---------------------------------------------------------------------------
function validarData(data: unknown): data is string {
  return typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data);
}

async function resolverRevendas(
  visitasData: any[],
  revendaFiltro: string | undefined,
  res: Response,
  data: string
): Promise<string[] | null> {
  let revendas = [...new Set(visitasData.map((v) => v.revenda))].filter(Boolean).sort();
  if (revendaFiltro) {
    revendas = revendas.filter((r) => r.toLowerCase() === revendaFiltro.toLowerCase());
    if (revendas.length === 0) {
      res.status(404).json({ error: `Revenda "${revendaFiltro}" não encontrada para ${data}.` });
      return null;
    }
  }
  return revendas;
}

// ---------------------------------------------------------------------------
// GET /api/relatorio/gerar?data=YYYY-MM-DD[&revenda=NOME]
// Retrocompat — análises lidas do MySQL se disponível.
// ---------------------------------------------------------------------------
relatorioRouter.get("/gerar", async (req: Request, res: Response) => {
  const { data, revenda: revendaFiltro } = req.query;

  if (!validarData(data)) {
    res.status(400).json({ error: 'Parâmetro "data" obrigatório (YYYY-MM-DD).' });
    return;
  }

  try {
    const [visitas, coachingAll] = await Promise.all([getVisitasData(), getRotaCoachingData()]);
    const visitasData = visitas.filter((v) => v.data === data);

    if (visitasData.length === 0) {
      res.status(404).json({ error: `Sem dados para a data ${data}.` });
      return;
    }

    const revendasFiltro = typeof revendaFiltro === "string" ? revendaFiltro : undefined;
    const revendas = await resolverRevendas(visitasData, revendasFiltro, res, data);
    if (!revendas) return;

    const { zip, erros } = await gerarPDFsParaData(data, revendas, visitasData, coachingAll, {});
    await enviarResposta(res, zip, erros, data, revendasFiltro);
  } catch (err) {
    console.error("[relatorio] erro geral:", err);
    res.status(500).json({ error: "Erro interno ao gerar relatórios.", detalhes: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/relatorio/gerar
// Body: { data: string, revenda?: string, analises: AnalisesInline }
// analises: { "Duttra Floriano": { vendedores: "<html>", gas: "<html>" }, ... }
// ---------------------------------------------------------------------------
relatorioRouter.post("/gerar", async (req: Request, res: Response) => {
  const { data, revenda: revendaFiltro, analises: analisesBody } = req.body ?? {};

  if (!validarData(data)) {
    res.status(400).json({ error: 'Campo "data" obrigatório (YYYY-MM-DD).' });
    return;
  }

  const analisesInline: AnalisesInline = analisesBody && typeof analisesBody === "object"
    ? analisesBody
    : {};

  try {
    const [visitas, coachingAll] = await Promise.all([getVisitasData(), getRotaCoachingData()]);
    const visitasData = visitas.filter((v) => v.data === data);

    if (visitasData.length === 0) {
      res.status(404).json({ error: `Sem dados para a data ${data}.` });
      return;
    }

    const revendasFiltro = typeof revendaFiltro === "string" ? revendaFiltro : undefined;
    const revendas = await resolverRevendas(visitasData, revendasFiltro, res, data);
    if (!revendas) return;

    const { zip, erros } = await gerarPDFsParaData(data, revendas, visitasData, coachingAll, analisesInline);
    await enviarResposta(res, zip, erros, data, revendasFiltro);
  } catch (err) {
    console.error("[relatorio] erro geral (POST):", err);
    res.status(500).json({ error: "Erro interno ao gerar relatórios.", detalhes: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/relatorio/gerar-unificado
// Mesmo body do /gerar, mas retorna um único PDF com todas as revendas mescladas.
// ---------------------------------------------------------------------------
relatorioRouter.post("/gerar-unificado", async (req: Request, res: Response) => {
  const { data, analises: analisesBody } = req.body ?? {};

  if (!validarData(data)) {
    res.status(400).json({ error: 'Campo "data" obrigatório (YYYY-MM-DD).' });
    return;
  }

  const analisesInline: AnalisesInline = analisesBody && typeof analisesBody === "object"
    ? analisesBody
    : {};

  try {
    const [visitas, coachingAll] = await Promise.all([getVisitasData(), getRotaCoachingData()]);
    const visitasData = visitas.filter((v) => v.data === data);

    if (visitasData.length === 0) {
      res.status(404).json({ error: `Sem dados para a data ${data}.` });
      return;
    }

    const revendas = await resolverRevendas(visitasData, undefined, res, data);
    if (!revendas) return;

    const { zip, erros } = await gerarPDFsParaData(data, revendas, visitasData, coachingAll, analisesInline);

    const filesGerados = Object.keys(zip.files);
    if (filesGerados.length === 0) {
      res.status(500).json({ error: "Nenhum PDF pôde ser gerado.", detalhes: erros });
      return;
    }

    // Mescla todos os PDFs em um único documento
    const merged = await PDFDocument.create();
    for (const nome of filesGerados) {
      const buf = await zip.files[nome].async("nodebuffer");
      const doc = await PDFDocument.load(buf);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }

    const mergedBuffer = Buffer.from(await merged.save());
    const filename = `relatorios_unificado_${data}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", mergedBuffer.length);
    if (erros.length > 0) res.setHeader("X-Erros-Parciais", JSON.stringify(erros));
    console.log(`[relatorio] PDF unificado gerado: ${filename} (${filesGerados.length} revendas, ${mergedBuffer.length} bytes)`);
    res.send(mergedBuffer);
  } catch (err) {
    console.error("[relatorio] erro ao gerar PDF unificado:", err);
    res.status(500).json({ error: "Erro interno ao gerar PDF unificado.", detalhes: String(err) });
  }
});
