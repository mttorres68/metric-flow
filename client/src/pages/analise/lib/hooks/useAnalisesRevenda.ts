import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ANALISES_REVENDA_KEY } from "../constants";

function carregarAnalisesRevenda(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(ANALISES_REVENDA_KEY) || "{}"); }
    catch { return {}; }
}

export function useAnalisesRevenda(dataInicio: string, dataFim: string) {
    const [analises, setAnalises] = useState<Record<string, string>>(carregarAnalisesRevenda);

    const pkAnalise = (revenda: string) => `${revenda}__${dataInicio}__${dataFim}`;

    const getAnalise = useCallback((revenda: string): string =>
        analises[pkAnalise(revenda)] || "",
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [analises, dataInicio, dataFim]);

    const { data: dbAnalises } = trpc.analiseGestor.listarPorData.useQuery(
        { data: dataInicio },
        { staleTime: 60_000, enabled: !!dataInicio }
    );

    useEffect(() => {
        if (!dbAnalises?.length) return;
        setAnalises(prev => {
            const merged = { ...prev };
            dbAnalises.forEach((r: { revenda: string; tipo: string; conteudo: string }) => {
                if (r.tipo === "vendedores") merged[pkAnalise(r.revenda)] = r.conteudo;
            });
            localStorage.setItem(ANALISES_REVENDA_KEY, JSON.stringify(merged));
            return merged;
        });

        const gasStored: Record<string, string> = (() => {
            try { return JSON.parse(localStorage.getItem("metricflow:analises-ga") || "{}"); }
            catch { return {}; }
        })();
        let gasAtualizado = false;
        dbAnalises.forEach((r: { revenda: string; tipo: string; conteudo: string }) => {
            if (r.tipo === "gas") {
                gasStored[`${r.revenda}__${dataInicio}`] = r.conteudo;
                gasAtualizado = true;
            }
        });
        if (gasAtualizado) localStorage.setItem("metricflow:analises-ga", JSON.stringify(gasStored));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbAnalises]);

    const salvarMutation = trpc.analiseGestor.salvar.useMutation();

    const setAnalise = useCallback((revenda: string, html: string) => {
        setAnalises(prev => {
            const next = { ...prev, [pkAnalise(revenda)]: html };
            localStorage.setItem(ANALISES_REVENDA_KEY, JSON.stringify(next));
            return next;
        });
        salvarMutation.mutate({ revenda, data: dataInicio, tipo: "vendedores", conteudo: html });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataInicio, dataFim]);

    const analisesDoPeríodo = useCallback((): Record<string, string> => {
        const resultado: Record<string, string> = {};
        Object.entries(analises).forEach(([key, html]) => {
            if (key.endsWith(`__${dataInicio}__${dataFim}`) && html.trim()) {
                const revenda = key.replace(`__${dataInicio}__${dataFim}`, "");
                resultado[revenda] = html;
            }
        });
        return resultado;
    }, [analises, dataInicio, dataFim]);

    return { getAnalise, setAnalise, analisesDoPeríodo };
}
