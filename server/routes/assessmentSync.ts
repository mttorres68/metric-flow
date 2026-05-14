import { Router } from "express";
import { listAssessmentItens, upsertResposta } from "../db/assessment";

export const assessmentSyncRouter = Router();

/**
 * POST /api/assessment/sync
 * Recebido do check.py — enriquece com dados do catálogo e faz upsert em lote.
 *
 * Body: { ano: number, mes: number, respostas: RespostaPayload[] }
 */
assessmentSyncRouter.post("/sync", async (req, res) => {
  const { ano, mes, respostas } = req.body as {
    ano: number;
    mes: number;
    respostas: {
      revenda: string;
      item: string;
      autoavaliacao?: string;
      evidencia?: string;
      statusFinal?: "Sim" | "Parcial" | "Não";
      padrinho?: string;
      macroArea?: string;
      microArea?: string;
      piramide?: string;
      descricao?: string;
      tipoResposta?: string;
      pontoPossivel?: number;
      pontosEvidencia?: number;
      pontosAutoavaliacao?: number;
    }[];
  };

  if (!ano || !mes || !Array.isArray(respostas)) {
    res.status(400).json({ erro: "Campos obrigatórios: ano, mes, respostas[]" });
    return;
  }

  // Carrega catálogo uma única vez e constrói mapa item → dados
  const catalogo = await listAssessmentItens();
  const cat = new Map(catalogo.map(i => [i.item, i]));

  let ok = 0;
  const erros: string[] = [];

  for (const r of respostas) {
    try {
      const info = cat.get(r.item);

      // Pontos: autoavaliação vale o total possível quando atendida;
      // evidência só pontua quando confirmada (check.py não tem essa info do HTML)
      const pontoPossivel        = r.pontoPossivel        ?? info?.pontoPossivel        ?? 0;
      const pontosAutoavaliacao  = r.statusFinal !== "Não" ? pontoPossivel : 0;
      const pontosEvidencia      = r.evidencia === "Sim"   ? pontoPossivel : 0;

      await upsertResposta({
        ano,
        mes,
        revenda:              r.revenda,
        item:                 r.item,
        autoavaliacao:        r.autoavaliacao,
        evidencia:            r.evidencia,
        statusFinal:          r.statusFinal,
        padrinho:             r.padrinho,
        // Catálogo preenche o que o HTML não traz
        macroArea:            r.macroArea    || info?.macroArea    || undefined,
        microArea:            r.microArea    || info?.microArea    || undefined,
        piramide:             r.piramide     || info?.piramide     || undefined,
        descricao:            r.descricao    || info?.descricao    || undefined,
        tipoResposta:         r.tipoResposta || info?.tipoResposta || undefined,
        pontoPossivel,
        pontosAutoavaliacao,
        pontosEvidencia,
      });

      ok++;
    } catch (err) {
      erros.push(`${r.revenda}/${r.item}: ${String(err)}`);
    }
  }

  res.json({ ok, erro: erros.length, erros });
});
