import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { AgendaGaView } from "./views/AgendaGaView";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AgendaGA() {
    const { isCollapsed } = useSidebarCollapse();
    const [activePage] = useState("agenda_ga_coaching");

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
        <div className="min-h-screen bg-background flex">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                <header
                    className="sticky top-0 z-20 bg-white/90 dark:bg-[var(--card)]/95 backdrop-blur-sm px-8 py-4 border-b border-slate-100 dark:border-[var(--border)] flex items-center justify-between"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
                            <CalendarDays className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl text-slate-800 dark:text-slate-100" style={{ fontWeight: 900 }}>Agenda GA</h1>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>
                                Programação dos Gestores de Área
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/25 border border-violet-100 dark:border-violet-800/40" style={{ fontWeight: 700 }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                            Google Sheets
                        </div>
                    </div>
                </header>

                <div className="px-8 py-6">
                    <AgendaGaView />
                </div>
            </main>
        </div>
    );
}
