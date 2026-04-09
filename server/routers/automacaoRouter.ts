/*
 * MetricFlow — Automação Router
 * Proxy para a API Flask de automação (run_all.py) em localhost:5000
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

function getApiUrl() {
  return process.env.AUTOMATION_API_URL || "http://localhost:5000";
}

/** Converte "yyyy-mm-dd" → "dd/mm/yyyy" (formato da API Flask) */
function isoToBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const automacaoRouter = router({

  /** Verifica se a API de automação está online */
  health: publicProcedure.query(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { online: false, data_config: null };
      const data = await res.json() as { status: string; data_config: string };
      return { online: data.status === "ok", data_config: data.data_config };
    } catch {
      return { online: false, data_config: null };
    }
  }),

  /** Executa o pipeline para uma data ou intervalo */
  run: publicProcedure
    .input(z.object({
      dataInicio:    z.string(),           // yyyy-mm-dd
      dataFim:       z.string().optional(), // yyyy-mm-dd (se omitido = dataInicio)
      forceDownload: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const url = getApiUrl();
      const inicio = isoToBr(input.dataInicio);
      const fim    = isoToBr(input.dataFim ?? input.dataInicio);

      const body =
        inicio === fim
          ? { data: inicio, force_download: input.forceDownload }
          : { intervalo: { inicio, fim }, force_download: input.forceDownload };

      const res = await fetch(`${url}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5 * 60 * 1000), // 5 min timeout
      });

      const resultado = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        const msg = (resultado.erro ?? resultado.error ?? "Erro desconhecido") as string;
        throw new Error(msg);
      }

      return resultado;
    }),
});
