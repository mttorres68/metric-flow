import { useState } from "react";
import { CalendarDays, Settings2, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useTheme } from "@/contexts/ThemeContext";
import { ConfigMetricasModal } from "@/components/ConfigMetricasModal";

import { RecorrenciaSemanal } from "./views/RecorrenciaSemanal";
import { FilterDate, FilterSelect } from "./components/FilterControls";
import { useFiltroPersistido } from "./lib/hooks/useFiltroPersistido";
import { useAnalisesRevenda } from "./lib/hooks/useAnalisesRevenda";

export default function AnaliseSemanal() {
    const { filtros, setFiltro, resetFiltros, temFiltro } = useFiltroPersistido();
    const { isCollapsed } = useSidebarCollapse();
    const { theme } = useTheme();
    const [configOpen, setConfigOpen] = useState(false);
    const isDark = theme === "dark";

    const { data: result } = trpc.analise.getDados.useQuery(
        {
            dataInicio: filtros.dataInicio || undefined,
            dataFim: filtros.dataFim || undefined,
            revenda: filtros.revenda || undefined,
        },
        { staleTime: 5 * 60 * 1000 }
    );
    const revendas = result?.revendas ?? [];

    const { setAnalise } = useAnalisesRevenda(
        filtros.dataInicio || "",
        filtros.dataFim || ""
    );

    return (
        <>
        <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
            <Sidebar activePage="analise_semanal" onNavigate={() => {}} />

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                {/* ── Header ── */}
                <div className="bg-white dark:bg-[var(--card)] border-b border-slate-100 dark:border-[var(--border)] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <CalendarDays size={20} className="text-indigo-500 dark:text-indigo-400" />
                            Recorrência Semanal
                        </h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Heatmap de comportamentos recorrentes por vendedor
                        </p>
                    </div>
                    <button
                        onClick={() => setConfigOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors font-semibold"
                        title="Configurar thresholds das métricas"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        Configurar métricas
                    </button>
                </div>

                {/* ── Filtros ── */}
                <div
                    className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4 mx-6 mt-4"
                    style={{
                        border: `1px solid ${isDark ? "oklch(0.265 0.018 252)" : "oklch(0.93 0.006 240)"}`,
                        boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.25)" : "0 1px 4px rgba(0,0,0,0.04)",
                    }}
                >
                    <FilterSelect
                        label="Revenda"
                        value={filtros.revenda ?? ""}
                        onChange={v => setFiltro("revenda", v || undefined)}
                        placeholder="Todas"
                        options={revendas.map(r => ({ value: r, label: r }))}
                    />
                    <FilterDate
                        label="Data Início"
                        value={filtros.dataInicio ?? ""}
                        onChange={v => setFiltro("dataInicio", v || undefined)}
                    />
                    <FilterDate
                        label="Data Fim"
                        value={filtros.dataFim ?? ""}
                        onChange={v => setFiltro("dataFim", v || undefined)}
                    />
                    {temFiltro && (
                        <button
                            onClick={resetFiltros}
                            className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all font-semibold"
                        >
                            <X className="w-3.5 h-3.5" /> Limpar
                        </button>
                    )}
                </div>

                {/* ── Conteúdo ── */}
                <div className="flex-1 min-h-0 overflow-auto">
                    <RecorrenciaSemanal
                        dataInicio={filtros.dataInicio || ""}
                        dataFim={filtros.dataFim || ""}
                        revendaFiltro={filtros.revenda}
                        setAnalise={setAnalise}
                    />
                </div>
            </div>
        </div>
        <ConfigMetricasModal open={configOpen} onClose={() => setConfigOpen(false)} />
        </>
    );
}
