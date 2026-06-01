import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useWaTemplate } from "@/hooks/useWaTemplate";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Download,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TabConfiguracoes } from "../agenda-gv/components/TabConfiguracoes";
import { TabNovoCiclo } from "../agenda-gv/components/TabNovoCiclo";
import { AtividadeRevendaSection } from "./components/AtividadeRevendaSection";
import { FiltroListas } from "./components/FiltroListas";
import { RevendaSection } from "./components/RevendaSection";
import { TemplateConfigModal } from "./components/TemplateConfigModal";
import { exportarPDF } from "./lib/pdf";

export default function TrelloAtraso() {
  const { isCollapsed } = useSidebarCollapse();
  const [activePage] = useState("trello_atraso");
  const [exportando, setExportando] = useState(false);
  const [listasFiltro, setListasFiltro] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"atrasos" | "atividades" | "agenda">("atrasos");
  const [agendaSubTab, setAgendaSubTab] = useState<"ciclo" | "config">("ciclo");
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const { template, saveLocal, saveToServer, isSaving, serverSynced } = useWaTemplate();

  const { data, isLoading, isError, error, refetch, isFetching } =
    trpc.trello.getCardsAtraso.useQuery(
      { listasPermitidas: listasFiltro.length > 0 ? listasFiltro : undefined },
      { staleTime: 5 * 60 * 1000 }
    );

  const { data: dataCompleta } = trpc.trello.getCardsAtraso.useQuery(
    undefined,
    { staleTime: 10 * 60 * 1000 }
  );
  const todasListas = useMemo(() => {
    if (!dataCompleta) return [];
    const set = new Set<string>();
    dataCompleta.forEach((r) => r.todasListas?.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [dataCompleta]);

  const {
    data: atividadesData,
    isLoading: atividadesLoading,
    isError: atividadesError,
    error: atividadesErrorMsg,
    refetch: atividadesRefetch,
    isFetching: atividadesFetching,
  } = trpc.trello.getAtividadesDia.useQuery(
    { listasPermitidas: listasFiltro.length > 0 ? listasFiltro : undefined },
    { staleTime: 5 * 60 * 1000 }
  );

  const totalAtraso = data?.reduce((s, r) => s + r.totalAtraso, 0) ?? 0;
  const revendasComAtraso = data?.filter((r) => r.totalAtraso > 0).length ?? 0;

  const totalHoje = atividadesData?.reduce((s, r) => s + r.hoje.length, 0) ?? 0;
  const totalAmanha = atividadesData?.reduce((s, r) => s + r.amanha.length, 0) ?? 0;
  const revendasComAtividade = atividadesData?.filter((r) => r.hoje.length + r.amanha.length > 0).length ?? 0;

  const dataAtual = new Date().toLocaleDateString("pt-BR");
  const isCurrentFetching = activeTab === "atrasos" ? isFetching : atividadesFetching;

  function handleRefetch() {
    if (activeTab === "atrasos") refetch();
    else atividadesRefetch();
  }

  async function handleExportarPDF() {
    if (!data) return;
    setExportando(true);
    try {
      await exportarPDF(data, dataAtual);
      toast.success("PDF exportado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao exportar PDF: " + e.message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[var(--background)]">
      <Sidebar
        activePage={activePage}
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
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Trello</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Acompanhamento de tarefas por revenda
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab !== "agenda" && todasListas.length > 0 && (
              <FiltroListas
                todasListas={todasListas}
                selecionadas={listasFiltro}
                onChange={setListasFiltro}
              />
            )}
            {activeTab !== "agenda" && (
              <button
                onClick={handleRefetch}
                disabled={isCurrentFetching}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isCurrentFetching ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            )}
            {activeTab === "atrasos" && (
              <button
                onClick={handleExportarPDF}
                disabled={!data || exportando}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exportar PDF
              </button>
            )}
            {activeTab === "atividades" && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                Modelo de mensagem
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit shadow-sm">
          <button
            onClick={() => setActiveTab("atrasos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "atrasos"
                ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Cards em Atraso
            {totalAtraso > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {totalAtraso}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("atividades")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "atividades"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Atividades do Dia
            {(totalHoje + totalAmanha) > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {totalHoje + totalAmanha}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("agenda")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "agenda"
                ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Agenda GV
          </button>
        </div>

        {/* Aba: Cards em Atraso */}
        {activeTab === "atrasos" && (
          <>
            {data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total em Atraso</p>
                  <p className={`text-2xl font-bold ${totalAtraso > 0 ? "text-red-500" : "text-green-500"}`}>{totalAtraso}</p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Revendas Afetadas</p>
                  <p className={`text-2xl font-bold ${revendasComAtraso > 0 ? "text-orange-500" : "text-green-500"}`}>
                    {revendasComAtraso} / {data.length}
                  </p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Maior Atraso</p>
                  <p className="text-2xl font-bold text-red-600">
                    {Math.max(0, ...data.flatMap((r) => r.cards.map((c) => c.diasAtraso)))}d
                  </p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Atualizado em</p>
                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{dataAtual}</p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Buscando cards no Trello...</p>
              </div>
            )}

            {isError && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-300">Erro ao carregar dados do Trello</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {(error as any)?.message ?? "Verifique as variáveis TRELLO_API_KEY, TRELLO_TOKEN e TRELLO_BOARDS no arquivo .env"}
                  </p>
                </div>
              </div>
            )}

            {data && (
              <div className="space-y-4">
                {data.map((revenda) => (
                  <RevendaSection key={revenda.revenda} revenda={revenda} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Aba: Atividades do Dia */}
        {activeTab === "atividades" && (
          <>
            {atividadesData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Atividades Hoje</p>
                  <p className={`text-2xl font-bold ${totalHoje > 0 ? "text-blue-500" : "text-slate-400"}`}>{totalHoje}</p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Atividades Amanhã</p>
                  <p className={`text-2xl font-bold ${totalAmanha > 0 ? "text-purple-500" : "text-slate-400"}`}>{totalAmanha}</p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Revendas Ativas</p>
                  <p className={`text-2xl font-bold ${revendasComAtividade > 0 ? "text-indigo-500" : "text-slate-400"}`}>
                    {revendasComAtividade} / {atividadesData.length}
                  </p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Atualizado em</p>
                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{dataAtual}</p>
                </div>
              </div>
            )}

            {atividadesLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Buscando atividades no Trello...</p>
              </div>
            )}

            {atividadesError && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-300">Erro ao carregar atividades do Trello</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {(atividadesErrorMsg as any)?.message ?? "Verifique as configurações do Trello no arquivo .env"}
                  </p>
                </div>
              </div>
            )}

            {atividadesData && (
              <div className="space-y-4">
                {atividadesData.map((revenda) => (
                  <AtividadeRevendaSection key={revenda.revenda} revenda={revenda} template={template} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Aba: Agenda GV */}
        {activeTab === "agenda" && (
          <>
            {/* Sub-tabs */}
            <div className="flex gap-1 mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit shadow-sm">
              <button
                onClick={() => setAgendaSubTab("ciclo")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  agendaSubTab === "ciclo"
                    ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Novo Ciclo
              </button>
              <button
                onClick={() => setAgendaSubTab("config")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  agendaSubTab === "config"
                    ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Configurações
              </button>
            </div>

            {agendaSubTab === "ciclo" && <TabNovoCiclo />}
            {agendaSubTab === "config" && <TabConfiguracoes />}
          </>
        )}
      </main>

      {showTemplateModal && (
        <TemplateConfigModal
          template={template}
          onSaveLocal={saveLocal}
          onSaveServer={saveToServer}
          isSaving={isSaving}
          serverSynced={serverSynced}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </div>
  );
}
