import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useAnalisesGA } from "@/hooks/useAnalisesGA";
import { trpc } from "@/lib/trpc";
import { exportarPDF } from "@/lib/pdfExport";
import { RotaFiltros } from "./components/RotaFiltros";
import { CoachingView } from "./views/CoachingView";
import { FrotaView } from "./views/FrotaView";
import { useFiltrosRota } from "./lib/hooks/useFiltrosRota";
import { useRotaDados } from "./lib/hooks/useRotaDados";
import { periodoIntervalo } from "./lib/types";
import { Car, Printer, RefreshCw, Route, Play } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export default function RotaCoaching() {
    const { isCollapsed } = useSidebarCollapse();
    const [activePage] = useState("rota_coaching");
    const [aba, setAba] = useState<"coaching" | "frota">("coaching");
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [vehiclesSel, setVehiclesSel] = useState<string[]>([]);
    const [mapRowKey, setMapRowKey] = useState<number | null>(null);

    const {
        filtros, setFiltro, resetFiltros,
        dateStart, dateEnd, revenda, ga, status, sedeGeofenceId, hasFiltrosAtivos,
    } = useFiltrosRota();

    const {
        loading, erro, carregarDados,
        baseFiltrado, tabelaFiltrada,
        revendasUnicas, gasUnicos,
        kpis, dadosGA, dadosRevenda,
    } = useRotaDados(dateStart, dateEnd, revenda, ga, status);

    const { getAnalise, setAnalise, analisesDodia } = useAnalisesGA(dateStart);

    const refreshCacheMutation = trpc.dashboard.refreshData.useMutation({
        onSettled: () => carregarDados(),
    });

    const processarRotaMutation = trpc.automacao.runRotaCoaching.useMutation({
        onSuccess: (res: any) => {
            toast.success(`Rota Coaching processada — ${res.rotas} rotas em ${res.tempo_segundos}s`);
            carregarDados();
        },
        onError: (err) => toast.error(`Erro ao processar: ${err.message}`),
    });

    const { data: cercasInfleet = [] } = trpc.infleet.listarCercas.useQuery(undefined, {
        enabled: aba === "frota",
        retry: false,
    });

    const { data: veiculosInfleet = [] } = trpc.infleet.veiculos.useQuery(undefined, {
        enabled: aba === "frota",
        retry: false,
    });

    const { data: resumoInfleet = [], isLoading: loadingInfleet } = trpc.infleet.resumoDiario.useQuery(
        { vehicleIds: vehiclesSel, periodo: periodoIntervalo(dateStart, dateEnd), sedeGeofenceId },
        { enabled: aba === "frota" && vehiclesSel.length > 0, retry: false },
    );

    const { data: viagensInfleet = [], isLoading: loadingViagens } = trpc.infleet.viagens.useQuery(
        { vehicleIds: vehiclesSel, periodo: periodoIntervalo(dateStart, dateEnd) },
        { enabled: aba === "frota" && vehiclesSel.length > 0, retry: false },
    );

    const toggleRow = useCallback((i: number) => {
        setExpandedRows(prev => {
            const s = new Set(prev);
            s.has(i) ? s.delete(i) : s.add(i);
            return s;
        });
    }, []);

    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching",
            analises: "/analises", trello_atraso: "/trello-atraso", whatsapp: "/whatsapp", assessment: "/assessment",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "rota_coaching") toast.info(`Módulo "${page}" em breve`);
    };

    const kpiCards = [
        { label: "Revendas", value: kpis.revendas, color: "text-indigo-600 dark:text-indigo-400", bg: "from-indigo-50 to-blue-50 dark:from-indigo-900/25 dark:to-blue-900/20", border: "border-indigo-100 dark:border-indigo-800/40" },
        { label: "Completo", value: kpis.ok, color: "text-green-600 dark:text-green-400", bg: "from-green-50 to-emerald-50 dark:from-green-900/25 dark:to-emerald-900/20", border: "border-green-100 dark:border-green-800/40" },
        { label: "Parcial", value: kpis.par, color: "text-amber-600 dark:text-amber-400", bg: "from-amber-50 to-yellow-50 dark:from-amber-900/25 dark:to-yellow-900/20", border: "border-amber-100 dark:border-amber-800/40" },
        { label: "Não Realizado", value: kpis.nok, color: "text-red-500 dark:text-red-400", bg: "from-red-50 to-rose-50 dark:from-red-900/25 dark:to-rose-900/20", border: "border-red-100 dark:border-red-800/40" },
        { label: "Taxa Geral", value: kpis.taxa, color: "text-indigo-600 dark:text-indigo-400", bg: "from-slate-50 to-indigo-50 dark:from-slate-800/50 dark:to-indigo-900/20", border: "border-slate-100 dark:border-slate-700/50" },
    ];

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                <header
                    className="sticky top-0 z-20 bg-white/90 dark:bg-[var(--card)]/95 backdrop-blur-sm px-8 py-4 border-b border-slate-100 dark:border-[var(--border)] flex items-center justify-between"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                >
                    <div>
                        <h1 className="text-xl text-slate-800 dark:text-slate-100" style={{ fontWeight: 900 }}>Monitor de Campo</h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>
                            Rota Coaching · Conformidade GA/GV/TRD
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {aba === "coaching" && (
                            <button
                                onClick={() => processarRotaMutation.mutate({ data: dateStart })}
                                disabled={processarRotaMutation.isPending}
                                title={`Processar Rota Coaching para ${dateStart}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                style={{ fontWeight: 700 }}
                            >
                                <Play className={`w-3.5 h-3.5 ${processarRotaMutation.isPending ? "animate-pulse" : ""}`} />
                                {processarRotaMutation.isPending ? "Processando…" : `Processar ${dateStart}`}
                            </button>
                        )}
                        <button
                            onClick={() => refreshCacheMutation.mutate()}
                            disabled={refreshCacheMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all disabled:opacity-50"
                            style={{ fontWeight: 600 }}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshCacheMutation.isPending ? "animate-spin" : ""}`} /> Atualizar
                        </button>
                        {aba === "coaching" && (
                            <button
                                onClick={() => {
                                    if (!baseFiltrado.length) {
                                        alert("Sem dados para exportar. Selecione uma data com dados.");
                                        return;
                                    }
                                    exportarPDF(baseFiltrado as any, dateStart, kpis as any, analisesDodia());
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                                style={{ fontWeight: 700 }}
                                title={`Exportar PDF — ${dateStart}`}
                            >
                                <Printer className="w-3.5 h-3.5" /> Exportar PDF
                            </button>
                        )}
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-100 dark:border-emerald-800/40"
                            style={{ fontWeight: 700 }}
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ao vivo
                        </div>
                    </div>
                </header>

                <div className="px-8 py-6 space-y-6">
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 w-fit">
                        {(
                            [
                                ["coaching", <Route className="w-4 h-4" />, "Rota Coaching"],
                                ["frota", <Car className="w-4 h-4" />, "Frota Infleet"],
                            ] as const
                        ).map(([id, icon, label]) => (
                            <button
                                key={id}
                                onClick={() => setAba(id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all ${
                                    aba === id
                                        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                }`}
                                style={{ fontWeight: aba === id ? 700 : 500 }}
                            >
                                {icon} {label}
                            </button>
                        ))}
                    </div>

                    <RotaFiltros
                        aba={aba}
                        dateStart={dateStart} dateEnd={dateEnd}
                        revenda={revenda} ga={ga} status={status} geocercaId={sedeGeofenceId}
                        revendasUnicas={revendasUnicas} gasUnicos={gasUnicos} cercasInfleet={cercasInfleet}
                        setFiltro={setFiltro} resetFiltros={resetFiltros}
                        hasFiltrosAtivos={hasFiltrosAtivos}
                    />

                    {aba === "coaching" && (
                        <CoachingView
                            loading={loading}
                            erro={erro}
                            kpiCards={kpiCards}
                            tabelaFiltrada={tabelaFiltrada}
                            expandedRows={expandedRows}
                            toggleRow={toggleRow}
                            mapRowKey={mapRowKey}
                            setMapRowKey={setMapRowKey}
                            revendasUnicas={revendasUnicas}
                            dateStart={dateStart}
                            getAnalise={getAnalise}
                            setAnalise={setAnalise}
                            baseFiltrado={baseFiltrado}
                            dadosGA={dadosGA}
                            dadosRevenda={dadosRevenda}
                        />
                    )}

                    {aba === "frota" && (
                        <FrotaView
                            veiculosInfleet={veiculosInfleet}
                            vehiclesSel={vehiclesSel}
                            setVehiclesSel={setVehiclesSel}
                            resumoInfleet={resumoInfleet}
                            loadingInfleet={loadingInfleet}
                            viagensInfleet={viagensInfleet}
                            loadingViagens={loadingViagens}
                            dateStart={dateStart}
                            dateEnd={dateEnd}
                            geocercaId={sedeGeofenceId}
                        />
                    )}

                    <div className="text-center py-4">
                        <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                            MetricFlow · Monitor de Campo · {new Date().toLocaleDateString("pt-BR")}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
