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
import { calcularAnalisePeriodo } from "../services/analise";
import { getConfigMetricas } from "../services/configService";
import {
  gerarPDFRevenda,
  gerarPDFRecorrencia,
  type CoachingKPIs,
  type CoachingRecord,
  type VendedorRow,
  type ClienteForaRaioSetor,
} from "../services/pdfService";
import { getDb } from "../db";
import { analises } from "../../drizzle/schema";
import { calcularKpisRota, dedupRotaPorGA } from "@shared/rotaKpis";

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
// Calcula clientes visitados fora do raio de 300m
// Espelha a lógica do analiseRouter.getClientesForeaRaio (sem filtro de hora)
// ---------------------------------------------------------------------------
function calcularClientesForaRaio(visitasRevenda: any[]): ClienteForaRaioSetor[] {
  const RAIO = 300;

  function parseDistPVLocal(s: string): number | string {
    if (!s || s === "ND") return 9999;
    if (s === "AC") return "AC";
    const clean = s.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
    return parseFloat(clean) || 9999;
  }

  function hmsToMin(s: string | null | undefined): number | null {
    if (!s || s === "ND") return null;
    const parts = s.split(":");
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const sec = parts[2] ? parseInt(parts[2], 10) : 0;
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m + sec / 60;
  }

  function minToHM(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const todasVisitas = visitasRevenda.filter((v) => v.horaInicio && v.horaInicio !== "ND");

  const clienteTemDentro: Record<number, Record<string, boolean>> = {};
  for (const v of todasVisitas) {
    const dist = parseDistPVLocal(v.distPV ?? "");
    const isDentro = dist === "AC" || (typeof dist === "number" && dist <= RAIO);
    if (isDentro) {
      clienteTemDentro[v.vendedor] ??= {};
      clienteTemDentro[v.vendedor][String(v.codCliente)] = true;
    }
  }

  const foraRaio = todasVisitas
    .filter((v) => {
      const dist = parseDistPVLocal(v.distPV ?? "");
      return typeof dist === "number" && dist > RAIO;
    })
    .filter((v) => !clienteTemDentro[v.vendedor]?.[String(v.codCliente)]);

  const porSetorCliente: Record<number, Record<string, any[]>> = {};
  for (const v of foraRaio) {
    const key = String(v.codCliente);
    porSetorCliente[v.vendedor] ??= {};
    porSetorCliente[v.vendedor][key] ??= [];
    porSetorCliente[v.vendedor][key].push(v);
  }

  return Object.entries(porSetorCliente)
    .map(([setorStr, clientesMap]) => {
      const setor = parseInt(setorStr, 10);
      const clientes = Object.values(clientesMap).map((visitasCliente) => {
        const ordenadas = [...visitasCliente].sort((a, b) => {
          const at = !a.horaInicio || a.horaInicio === "ND" ? "99:99" : a.horaInicio;
          const bt = !b.horaInicio || b.horaInicio === "ND" ? "99:99" : b.horaInicio;
          return at.localeCompare(bt);
        });
        const pv = ordenadas[0];
        const tempoMin = hmsToMin(pv.tempoVisita);
        const dist = parseDistPVLocal(pv.distPV ?? "");
        return {
          cliente: String(pv.cliente ?? ""),
          codCliente: String(pv.codCliente ?? ""),
          horaInicio: pv.horaInicio ?? "ND",
          horaFim: pv.horaFim ?? "ND",
          tempo: tempoMin !== null ? minToHM(tempoMin) : "—",
          distancia: typeof dist === "string" ? dist : `${dist}m`,
          valorPedido: String(pv.valorPedido ?? "—"),
          visitasCount: ordenadas.length,
        };
      });
      return { setor, clientes };
    })
    .sort((a, b) => a.setor - b.setor);
}

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

  const cfgMetricas = await getConfigMetricas();

  for (const revenda of revendas) {
    try {
      const visitasRevenda = visitasData.filter((v) => v.revenda === revenda);

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

      // KPIs unificados (shared/rotaKpis): dedup por GA/dia/revenda + taxa ponderada —
      // mesma regra usada pelo dashboard e pelo PDF cliente.
      const k = calcularKpisRota(registrosData);
      // Tabela do PDF mantém também linhas não agendadas (exibidas com colunas vazias).
      const linhasTabela = dedupRotaPorGA(registrosData);

      const coachingKPIs: CoachingKPIs = {
        ok: k.ok, parcial: k.parcial, nok: k.nok, total: k.total, taxa: k.taxa ?? 0,
        registros: linhasTabela.map((r): CoachingRecord => {
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

      const analisesPorVendedor = calcularAnalisePeriodo(visitasRevenda, cfgMetricas.diaria);
      const vendedoresRows: VendedorRow[] = analisesPorVendedor
        .sort((a, b) => a.vendedor - b.vendedor)
        .map((rel) => ({
          vendedor:          String(rel.vendedor),
          hrInicio:          rel.inicio ?? "ND",
          hrFim:             rel.fim    ?? "ND",
          visitasAlmoco:     rel.almoco,
          percTarde:         rel.apos14h_pct,
          visitasTarde:      rel.apos14h,
          visitasBrutasRaio: rel.visitas_total_dentro_raio,
          percCobertura:     rel.visitas_pct,
          visitasUnicasRaio: rel.visitas,
          totalCarteira:     rel.visitas_total,
          percCurtas:        rel.relampago_pct,
          curtasCount:       rel.relampago,
          relampDenom:       rel.visitas_total_dentro_raio,
        }));

      const clientesForaRaio = calcularClientesForaRaio(visitasRevenda);

      const pdfBuffer = await gerarPDFRevenda({
        revenda, data, vendedoresRows, coachingKPIs, analiseVendedores, analiseGAs, clientesForaRaio,
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
// POST /api/relatorio/thumbnail
// Body: { pdf: string }  (base64 do PDF)
// Retorna: { thumbnail: string }  (base64 JPEG da primeira página)
// ---------------------------------------------------------------------------
relatorioRouter.post("/thumbnail", async (req: Request, res: Response) => {
  const { pdf: pdfBase64 } = req.body ?? {};
  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    res.status(400).json({ error: "Campo 'pdf' (base64) obrigatório." });
    return;
  }
  try {
    const { gerarThumbnailPDF } = await import("../services/thumbnailService.js");
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const thumbnailBuffer = await gerarThumbnailPDF(pdfBuffer);
    res.json({ thumbnail: thumbnailBuffer.toString("base64") });
  } catch (err) {
    console.error("[relatorio] erro ao gerar thumbnail:", err);
    res.status(500).json({ error: "Erro ao gerar thumbnail do PDF.", detalhes: String(err) });
  }
});

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

// ---------------------------------------------------------------------------
// POST /api/relatorio/gerar-semanal
// Body: { revenda, semanaInicio, semanaFim, mapaJson, insightHtml? }
// Gera um PDF da aba de Recorrência Semanal para uma revenda.
// ---------------------------------------------------------------------------
relatorioRouter.post("/gerar-semanal", async (req: Request, res: Response) => {
  try {
    const { revenda, semanaInicio, semanaFim, mapaJson, insightHtml } = req.body as {
      revenda: string;
      semanaInicio: string;
      semanaFim: string;
      mapaJson: string;
      insightHtml?: string;
    };

    if (!revenda || !semanaInicio || !semanaFim || !mapaJson) {
      res.status(400).json({ error: "Campos obrigatórios: revenda, semanaInicio, semanaFim, mapaJson" });
      return;
    }

    const vendedores = JSON.parse(mapaJson);

    // Flags visíveis no relatório (ociosidadeAlta oculta temporariamente)
    const flags = [
      { id: "relampagoAlto",    label: "Relâmpago alto" },
      { id: "inicioTardio",     label: "Início tardio" },
      { id: "coberturaBaixa",   label: "Cobertura/IV baixa" },
      { id: "almocoExcesso",    label: "Almoço acima do limite" },
      { id: "tardeInsuficiente",label: "Pouca visita após 14h" },
      { id: "tempoAtendBaixo",  label: "Σ atend. < 2h" },
      { id: "fimCedo",          label: "Finaliza cedo" },
    ];

    const buffer = await gerarPDFRecorrencia({
      revenda,
      semanaInicio,
      semanaFim,
      flags,
      vendedores,
      insightHtml: insightHtml ?? "",
    });

    const slug = revenda.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${slug}_recorrencia_${semanaInicio}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    console.log(`[relatorio] PDF semanal gerado: ${filename} (${buffer.length} bytes)`);
    res.send(buffer);
  } catch (err) {
    console.error("[relatorio] erro ao gerar PDF semanal:", err);
    res.status(500).json({ error: "Erro ao gerar PDF semanal", detalhes: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/relatorio/gerar-semanal-unificado
// Body: { semanaInicio, semanaFim, revendas: Array<{ revenda, mapaJson, insightHtml? }> }
// Gera um único PDF com uma página por revenda, em ordem.
// ---------------------------------------------------------------------------
relatorioRouter.post("/gerar-semanal-unificado", async (req: Request, res: Response) => {
  try {
    const { semanaInicio, semanaFim, revendas: revendasPayload } = req.body as {
      semanaInicio: string;
      semanaFim: string;
      revendas: Array<{ revenda: string; mapaJson: string; insightHtml?: string }>;
    };

    if (!semanaInicio || !semanaFim || !Array.isArray(revendasPayload) || revendasPayload.length === 0) {
      res.status(400).json({ error: "Campos obrigatórios: semanaInicio, semanaFim, revendas[]" });
      return;
    }

    const flags = [
      { id: "relampagoAlto",    label: "Relâmpago alto" },
      { id: "inicioTardio",     label: "Início tardio" },
      { id: "coberturaBaixa",   label: "Cobertura/IV baixa" },
      { id: "almocoExcesso",    label: "Almoço acima do limite" },
      { id: "tardeInsuficiente",label: "Pouca visita após 14h" },
      { id: "tempoAtendBaixo",  label: "Σ atend. < 2h" },
      { id: "fimCedo",          label: "Finaliza cedo" },
    ];

    const merged = await PDFDocument.create();

    for (const { revenda, mapaJson, insightHtml } of revendasPayload) {
      try {
        const vendedores = JSON.parse(mapaJson ?? "[]");
        const buf = await gerarPDFRecorrencia({
          revenda, semanaInicio, semanaFim, flags, vendedores, insightHtml: insightHtml ?? "",
        });
        const doc = await PDFDocument.load(buf);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      } catch (e) {
        console.error(`[relatorio] erro ao gerar PDF semanal para ${revenda}:`, e);
      }
    }

    const mergedBuffer = Buffer.from(await merged.save());
    const filename = `recorrencia_semanal_${semanaInicio}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", mergedBuffer.length);
    console.log(`[relatorio] PDF semanal unificado: ${filename} (${revendasPayload.length} revendas, ${mergedBuffer.length} bytes)`);
    res.send(mergedBuffer);
  } catch (err) {
    console.error("[relatorio] erro ao gerar PDF semanal unificado:", err);
    res.status(500).json({ error: "Erro ao gerar PDF semanal unificado", detalhes: String(err) });
  }
});
