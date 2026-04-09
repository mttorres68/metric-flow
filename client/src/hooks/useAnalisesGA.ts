import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useState } from "react";
import { ANALISES_GA_KEY } from "@/components/rota-coaching/types";

function carregarAnalisesGA(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(ANALISES_GA_KEY) || "{}"); }
    catch { return {}; }
}

export function useAnalisesGA(date: string) {
    const [analises, setAnalises] = useState<Record<string, string>>(carregarAnalisesGA);

    const pkAnalise = (revenda: string) => `${revenda}__${date}`;

    const getAnalise = useCallback((revenda: string): string =>
        analises[pkAnalise(revenda)] || "",
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [analises, date]);

    const { data: dbAnalises } = trpc.analiseGestor.listarPorData.useQuery(
        { data: date },
        { staleTime: 60_000, enabled: !!date }
    );

    useEffect(() => {
        if (!dbAnalises?.length) return;
        setAnalises(prev => {
            const merged = { ...prev };
            dbAnalises.forEach((r: { revenda: string; tipo: string; conteudo: string }) => {
                if (r.tipo === "gas") merged[pkAnalise(r.revenda)] = r.conteudo;
            });
            localStorage.setItem(ANALISES_GA_KEY, JSON.stringify(merged));
            return merged;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbAnalises]);

    const salvarMutation = trpc.analiseGestor.salvar.useMutation();

    const setAnalise = useCallback((revenda: string, html: string) => {
        setAnalises(prev => {
            const next = { ...prev, [pkAnalise(revenda)]: html };
            localStorage.setItem(ANALISES_GA_KEY, JSON.stringify(next));
            return next;
        });
        salvarMutation.mutate({ revenda, data: date, tipo: "gas", conteudo: html });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date]);

    const analisesDodia = useCallback((): Record<string, string> => {
        const res: Record<string, string> = {};
        Object.entries(analises).forEach(([key, html]) => {
            if (key.endsWith(`__${date}`) && html.trim()) {
                const rev = key.replace(`__${date}`, "");
                res[rev] = html;
            }
        });
        return res;
    }, [analises, date]);

    return { getAnalise, setAnalise, analisesDodia };
}
