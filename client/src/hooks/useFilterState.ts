/*
 * MetricFlow — useFilterState
 * Hook para gerenciar e persistir os filtros do dashboard no localStorage.
 * Mesmo padrão do useConfigMetricas: estado tipado, reset, isDirty.
 */

import { useState } from "react";

const FILTER_STORAGE_KEY = "metricflow:filters";

export interface FilterState {
    vendedor: string | undefined;
    status: string | undefined;
    gerente: number | undefined;
    revenda: string | undefined;
    dataInicio: string | undefined;
    dataFim: string | undefined;
}

const FILTER_VAZIO: FilterState = {
    vendedor: undefined,
    status: undefined,
    gerente: undefined,
    revenda: undefined,
    dataInicio: undefined,
    dataFim: undefined,
};

function loadFromStorage(): FilterState {
    try {
        const saved = localStorage.getItem(FILTER_STORAGE_KEY);
        if (!saved) return FILTER_VAZIO;
        // JSON.parse converte null → null, mas queremos undefined
        const parsed = JSON.parse(saved);
        return {
            vendedor: parsed.vendedor ?? undefined,
            status: parsed.status ?? undefined,
            gerente: parsed.gerente != null ? Number(parsed.gerente) : undefined,
            revenda: parsed.revenda ?? undefined,
            dataInicio: parsed.dataInicio ?? undefined,
            dataFim: parsed.dataFim ?? undefined,
        };
    } catch {
        return FILTER_VAZIO;
    }
}

function saveToStorage(filters: FilterState) {
    // Salva apenas campos com valor (undefined vira null no JSON mas limpa bem)
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
}

export function useFilterState() {
    const [filters, setFilters] = useState<FilterState>(loadFromStorage);

    const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        setFilters((prev) => {
            const next = { ...prev, [key]: value };
            saveToStorage(next);
            return next;
        });
    };

    const reset = () => {
        localStorage.removeItem(FILTER_STORAGE_KEY);
        setFilters(FILTER_VAZIO);
    };

    const isDirty = Object.values(filters).some((v) => v !== undefined);

    return {
        filters,
        set,
        reset,
        isDirty,
        // Setters individuais — mesma assinatura que os useState anteriores no Home
        setVendedor: (v: string | undefined) => set("vendedor", v),
        setStatus: (v: string | undefined) => set("status", v),
        setGerente: (v: number | undefined) => set("gerente", v),
        setRevenda: (v: string | undefined) => set("revenda", v),
        setDataInicio: (v: string | undefined) => set("dataInicio", v),
        setDataFim: (v: string | undefined) => set("dataFim", v),
    };
}