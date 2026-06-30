import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { AppCampeaoView } from "./views/AppCampeaoView";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AppCampeao() {
    const { isCollapsed } = useSidebarCollapse();
    const [activePage] = useState("app_campeao");

    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching",
            app_campeao: "/rota-coaching/app-campeao",
            agenda_ga_coaching: "/rota-coaching/agenda-ga",
            analises: "/analises", trello_atraso: "/trello-atraso",
            whatsapp: "/whatsapp", assessment: "/assessment",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        toast.info(`Módulo "${page}" em breve`);
    };

    return (
        <div className="h-screen overflow-hidden bg-background flex">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                {/* Header */}
                <header
                    className="shrink-0 bg-white/90 dark:bg-[var(--card)]/95 backdrop-blur-sm px-6 py-3 border-b border-slate-100 dark:border-[var(--border)] flex items-center justify-between"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500">
                            <Trophy className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base text-slate-800 dark:text-slate-100 leading-tight" style={{ fontWeight: 900 }}>App Campeão</h1>
                            <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                                Rota Campeã · R1 Duttra + R2 Forte
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/25 border border-amber-100 dark:border-amber-800/40" style={{ fontWeight: 700 }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Google Sheets
                    </div>
                </header>

                {/* View ocupa o espaço restante */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <AppCampeaoView />
                </div>
            </main>
        </div>
    );
}
