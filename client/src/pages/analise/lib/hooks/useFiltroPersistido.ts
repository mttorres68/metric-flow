import { useState } from "react";
import { FILTER_KEY } from "../constants";

function loadFilters() {
    try {
        const stored = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}");
        if (!("dataInicio" in stored) && !("dataFim" in stored)) {
            stored.dataInicio = new Date().toISOString().slice(0, 10);
            stored.dataFim = new Date().toISOString().slice(0, 10);
        }
        return stored;
    } catch {
        const today = new Date().toISOString().slice(0, 10);
        return { dataInicio: today, dataFim: today };
    }
}

export function useFiltroPersistido() {
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);

    const setFiltro = (k: string, v: any) =>
        setFiltros(prev => {
            const next = { ...prev, [k]: v };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });

    const setFiltrosMulti = (parcial: Record<string, any>) =>
        setFiltros(prev => {
            const next = { ...prev, ...parcial };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });

    const resetFiltros = () => {
        const today = new Date().toISOString().slice(0, 10);
        const defaultFilters = { dataInicio: today, dataFim: today };
        setFiltros(defaultFilters);
        localStorage.setItem(FILTER_KEY, JSON.stringify(defaultFilters));
    };

    const currentToday = new Date().toISOString().slice(0, 10);
    const temFiltro = Object.keys(filtros).some(k => {
        if (k === "dataInicio" || k === "dataFim") return filtros[k] !== currentToday && filtros[k] !== "";
        return Boolean(filtros[k]);
    });

    return { filtros, setFiltro, setFiltrosMulti, resetFiltros, temFiltro };
}
