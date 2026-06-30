import { useState } from "react";
import { FILTER_KEY, todayIso, loadFilters } from "../types";

export function useFiltrosRota() {
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);

    const setFiltro = (k: string, v: any) => {
        setFiltros(prev => {
            const next = { ...prev, [k]: v ?? undefined };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });
    };

    const resetFiltros = () => {
        setFiltros({});
        localStorage.removeItem(FILTER_KEY);
    };

    const dateStart = filtros.dateStart ?? todayIso();
    const dateEnd = filtros.dateEnd ?? todayIso();
    const revenda = filtros.revenda ?? "";
    const ga = filtros.ga ?? "";
    const status = filtros.status ?? "";
    const sedeGeofenceId =
        filtros.geocercaId && filtros.geocercaId !== "undefined"
            ? filtros.geocercaId
            : undefined;
    const hasFiltrosAtivos = !!(revenda || ga || status || filtros.geocercaId);

    return {
        filtros,
        setFiltro,
        resetFiltros,
        dateStart,
        dateEnd,
        revenda,
        ga,
        status,
        sedeGeofenceId,
        hasFiltrosAtivos,
    };
}
