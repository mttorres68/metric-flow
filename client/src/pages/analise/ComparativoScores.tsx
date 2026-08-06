import { BarChartHorizontal } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";

import { ComparativoScoresView } from "./views/ComparativoScoresView";

export default function ComparativoScores() {
    const { isCollapsed } = useSidebarCollapse();

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
            <Sidebar activePage="analise_comparativo" onNavigate={() => {}} />

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                {/* ── Header ── */}
                <div className="bg-white dark:bg-[var(--card)] border-b border-slate-100 dark:border-[var(--border)] px-6 py-4">
                    <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <BarChartHorizontal size={20} className="text-indigo-500 dark:text-indigo-400" />
                        Comparativo de Scores
                    </h1>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Evolução do score crítico por setor ao longo do tempo — entenda se a política está sendo cumprida
                    </p>
                </div>

                {/* ── Conteúdo ── */}
                <div className="flex-1 min-h-0 overflow-auto">
                    <ComparativoScoresView />
                </div>
            </div>
        </div>
    );
}
