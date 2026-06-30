import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { calcularKpisRota, formatarTaxa } from "@shared/rotaKpis";
import type { RotaRow } from "../types";

export function useRotaDados(
    dateStart: string,
    dateEnd: string,
    revenda: string,
    ga: string,
    status: string,
) {
    const utils = trpc.useUtils();
    const [allData, setAllData] = useState<RotaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState<string | null>(null);

    const carregarDados = () => {
        setLoading(true);
        setErro(null);
        utils.rotaCoaching.getAll
            .fetch({ dateStart, dateEnd })
            .then((d: RotaRow[]) => {
                setAllData(d.filter(r => r.gaId && r.gaId !== "-"));
                setLoading(false);
            })
            .catch(e => {
                setErro(e.message);
                setLoading(false);
            });
    };

    useEffect(() => { carregarDados(); }, [dateStart, dateEnd]);

    const baseFiltrado = useMemo(() => {
        let d = allData.filter(r => r.data >= dateStart && r.data <= dateEnd);
        if (revenda) d = d.filter(r => r.rev === revenda);
        if (ga) d = d.filter(r => r.gaId === ga);
        return d;
    }, [allData, dateStart, dateEnd, revenda, ga]);

    const tabelaFiltrada = useMemo(() => {
        let d = baseFiltrado;
        if (status) d = d.filter(r => r.status === status);
        return d;
    }, [baseFiltrado, status]);

    const revendasUnicas = useMemo(
        () =>
            [
                ...new Set(
                    allData
                        .filter(r => r.data >= dateStart && r.data <= dateEnd && r.rev)
                        .map(r => r.rev),
                ),
            ].sort(),
        [allData, dateStart, dateEnd],
    );

    const gasUnicos = useMemo(
        () =>
            [
                ...new Set(
                    allData
                        .filter(r => r.data >= dateStart && r.data <= dateEnd && r.gaId !== "-")
                        .map(r => r.gaId),
                ),
            ].sort(),
        [allData, dateStart, dateEnd],
    );

    const kpisCalc = useMemo(() => calcularKpisRota(baseFiltrado), [baseFiltrado]);

    const kpis = useMemo(
        () => ({
            revendas: kpisCalc.revendas,
            ok: kpisCalc.ok,
            par: kpisCalc.parcial,
            nok: kpisCalc.nok,
            taxa: formatarTaxa(kpisCalc.taxa),
        }),
        [kpisCalc],
    );

    const dadosGA = useMemo(() => {
        const m: Record<string, { ga: string; visitas: number; prog: number }> = {};
        for (const r of kpisCalc.registros) {
            if (!m[r.gaId]) m[r.gaId] = { ga: r.gaId, visitas: 0, prog: 0 };
            m[r.gaId].visitas += r.gaVis || 0;
            m[r.gaId].prog += r.pdvsProg || 0;
        }
        return Object.values(m).sort((a, b) => b.visitas - a.visitas);
    }, [kpisCalc]);

    const dadosRevenda = useMemo(() => {
        const m: Record<
            string,
            { rev: string; Completo: number; Parcial: number; "Não Realizado": number }
        > = {};
        for (const r of kpisCalc.registros) {
            if (!r.rev) continue;
            if (!m[r.rev])
                m[r.rev] = { rev: r.rev, Completo: 0, Parcial: 0, "Não Realizado": 0 };
            if (r.status === "ok") m[r.rev].Completo++;
            else if (r.status === "partial") m[r.rev].Parcial++;
            else if (r.status === "nok") m[r.rev]["Não Realizado"]++;
        }
        return Object.values(m).sort((a, b) => a.rev.localeCompare(b.rev));
    }, [kpisCalc]);

    return {
        allData,
        loading,
        erro,
        carregarDados,
        baseFiltrado,
        tabelaFiltrada,
        revendasUnicas,
        gasUnicos,
        kpis,
        dadosGA,
        dadosRevenda,
    };
}
