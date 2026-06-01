import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { CalendarDays, Settings2 } from "lucide-react";
import { useState } from "react";
import { TabConfiguracoes } from "./components/TabConfiguracoes";
import { TabNovoCiclo } from "./components/TabNovoCiclo";

type Tab = "ciclo" | "config";

export default function AgendaGV() {
  const { isCollapsed } = useSidebarCollapse();
  const [activeTab, setActiveTab] = useState<Tab>("ciclo");

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[var(--background)]">
      <Sidebar
        activePage="agenda_gv"
        onNavigate={(page) => {
          const routes: Record<string, string> = {
            dashboard: "/",
            vendedores: "/vendedores",
            compliance: "/compliance",
            clientes: "/clientes",
            relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal",
            rota_coaching: "/rota-coaching",
            analises: "/analises",
            trello_atraso: "/trello-atraso",
            agenda_gv: "/agenda-gv",
            whatsapp: "/whatsapp",
            assessment: "/assessment",
          };
          if (routes[page]) window.location.href = routes[page];
        }}
      />

      <main
        className={`flex-1 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"} p-6`}
        style={{ minWidth: 0 }}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Agenda GV</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Criação automática de ciclos mensais no Trello
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit shadow-sm">
          <button
            onClick={() => setActiveTab("ciclo")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "ciclo"
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Novo Ciclo
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "config"
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Configurações
          </button>
        </div>

        {activeTab === "ciclo" && <TabNovoCiclo />}
        {activeTab === "config" && <TabConfiguracoes />}
      </main>
    </div>
  );
}
