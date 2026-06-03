/*
 * MetricFlow — Rota Coaching & Monitoramento de Frota
 *
 * Aba 1 — Rota Coaching : conformidade GA/GV/TRD × agenda × PathTracker
 * Aba 2 — Frota Infleet : KM, tempo ligado/parado, geocercas por veículo/dia
 */

import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useAnalisesGA } from "@/hooks/useAnalisesGA";
import { trpc } from "@/lib/trpc";
import { exportarPDF } from "@/lib/pdfExport";
import { AnalisesGestor } from "@/components/rota-coaching/AnalisesGestor";
import { ConformidadeTabela } from "@/components/rota-coaching/ConformidadeTabela";
import { FrotaInfleet } from "@/components/rota-coaching/FrotaInfleet";
import { RotaFiltros } from "@/components/rota-coaching/RotaFiltros";
import { RotaGraficos } from "@/components/rota-coaching/RotaGraficos";
import { RotaRow, loadFilters, FILTER_KEY, periodoIntervalo, todayIso } from "@/components/rota-coaching/types";
import { Car, Printer, RefreshCw, Route } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";

export default function RotaCoaching() {
    const { isCollapsed } = useSidebarCollapse();
    const [activePage, setActivePage] = useState("rota_coaching");
    const [aba, setAba] = useState<"coaching" | "frota">("coaching");
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);
    const [allData, setAllData] = useState<RotaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [vehiclesSel, setVehiclesSel] = useState<string[]>([]);
    const [mapRowKey, setMapRowKey] = useState<number | null>(null);

    const utils = trpc.useUtils();

    // ── Filtros ─────────────────────────────────────────────────────────────────
    const setFiltro = (k: string, v: any) => {
        setFiltros(prev => {
            const next = { ...prev, [k]: v ?? undefined };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });
    };
    const resetFiltros = () => { setFiltros({}); localStorage.removeItem(FILTER_KEY); };

    const dateStart = filtros.dateStart ?? todayIso();
    const dateEnd = filtros.dateEnd ?? todayIso();
    const revenda = filtros.revenda ?? "";
    const ga = filtros.ga ?? "";
    const status = filtros.status ?? "";
    const sedeGeofenceId = filtros.geocercaId && filtros.geocercaId !== "undefined" ? filtros.geocercaId : undefined;

    // ── Carrega dados ────────────────────────────────────────────────────────────
    const carregarDados = () => {
        setLoading(true); setErro(null);
        utils.rotaCoaching.getAll.fetch()
            .then((d: RotaRow[]) => { setAllData(d.filter(r => r.gaId && r.gaId !== "-")); setLoading(false); })
            .catch(e => { setErro(e.message); setLoading(false); });
    };

    const refreshCacheMutation = trpc.dashboard.refreshData.useMutation({
        onSettled: () => carregarDados(),
    });

    useEffect(() => { carregarDados(); }, []);

    // ── Dados derivados ──────────────────────────────────────────────────────────
    const baseFiltrado = useMemo(() => {
        let d = allData.filter(r => r.data >= dateStart && r.data <= dateEnd);
        if (revenda) d = d.filter(r => r.rev === revenda);
        if (ga) d = d.filter(r => r.gaId === ga);
        return d;
    }, [allData, dateStart, dateEnd, revenda, ga]);

    const tabelaFiltrada = useMemo(() => {
        let d = baseFiltrado;
        if (status) d = d.filter(r => r.status === status);
        return d;
    }, [baseFiltrado, status]);

    const revendasUnicas = useMemo(() =>
        [...new Set(allData.filter(r => r.data >= dateStart && r.data <= dateEnd && r.rev).map(r => r.rev))].sort(),
        [allData, dateStart, dateEnd]);

    const gasUnicos = useMemo(() =>
        [...new Set(allData.filter(r => r.data >= dateStart && r.data <= dateEnd && r.gaId !== "-").map(r => r.gaId))].sort(),
        [allData, dateStart, dateEnd]);

    const kpis = useMemo(() => {
        const ok = baseFiltrado.filter(r => r.status === "ok").length;
        const par = baseFiltrado.filter(r => r.status === "partial").length;
        const ag = baseFiltrado.filter(r => r.agendado).length;
        return {
            revendas: [...new Set(baseFiltrado.filter(r => r.rev).map(r => r.rev))].length,
            ok, par,
            nok: baseFiltrado.filter(r => r.status === "nok").length,
            taxa: ag ? Math.round(((ok + par * 0.5) / ag) * 100) + "%" : "—",
        };
    }, [baseFiltrado]);

    const dadosGA = useMemo(() => {
        const m: Record<string, { ga: string; visitas: number; prog: number }> = {};
        for (const r of baseFiltrado.filter(r => r.agendado)) {
            if (!m[r.gaId]) m[r.gaId] = { ga: r.gaId, visitas: 0, prog: 0 };
            m[r.gaId].visitas += r.gaVis || 0;
            m[r.gaId].prog += r.pdvsProg || 0;
        }
        return Object.values(m).sort((a, b) => b.visitas - a.visitas);
    }, [baseFiltrado]);

    const dadosRevenda = useMemo(() => {
        const m: Record<string, { rev: string; Completo: number; Parcial: number; "Não Realizado": number }> = {};
        for (const r of baseFiltrado.filter(r => r.agendado)) {
            if (!r.rev) continue;
            if (!m[r.rev]) m[r.rev] = { rev: r.rev, Completo: 0, Parcial: 0, "Não Realizado": 0 };
            if (r.status === "ok") m[r.rev].Completo++;
            else if (r.status === "partial") m[r.rev].Parcial++;
            else if (r.status === "nok") m[r.rev]["Não Realizado"]++;
        }
        return Object.values(m).sort((a, b) => a.rev.localeCompare(b.rev));
    }, [baseFiltrado]);

    // ── Análises GA ──────────────────────────────────────────────────────────────
    const { getAnalise, setAnalise, analisesDodia } = useAnalisesGA(dateStart);

    // ── Toggle linha expandida ───────────────────────────────────────────────────
    const toggleRow = useCallback((i: number) => {
        setExpandedRows(prev => {
            const s = new Set(prev);
            s.has(i) ? s.delete(i) : s.add(i);
            return s;
        });
    }, []);

    // ── Infleet queries ──────────────────────────────────────────────────────────
    const { data: veiculosInfleet = [] } = trpc.infleet.veiculos.useQuery(undefined, {
        enabled: aba === "frota",
        retry: false,
    });

    const { data: cercasInfleet = [] } = trpc.infleet.listarCercas.useQuery(undefined, {
        enabled: aba === "frota",
        retry: false,
    });

    const { data: resumoInfleet = [], isLoading: loadingInfleet } = trpc.infleet.resumoDiario.useQuery(
        {
            vehicleIds: vehiclesSel,
            periodo: periodoIntervalo(dateStart, dateEnd),
            sedeGeofenceId
        },
        { enabled: aba === "frota" && vehiclesSel.length > 0, retry: false }
    );

    const { data: viagensInfleet = [], isLoading: loadingViagens } = trpc.infleet.viagens.useQuery(
        {
            vehicleIds: vehiclesSel,
            periodo: periodoIntervalo(dateStart, dateEnd),
        },
        { enabled: aba === "frota" && vehiclesSel.length > 0, retry: false }
    );

    // ── Navegação ────────────────────────────────────────────────────────────────
    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching",
            analises: "/analises", trello_atraso: "/trello-atraso", whatsapp: "/whatsapp", assessment: "/assessment",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "rota_coaching") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    // ── KPI cards ────────────────────────────────────────────────────────────────
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

            <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-60'}`}>
                {/* Header */}
                <header className="sticky top-0 z-20 bg-white/90 dark:bg-[var(--card)]/95 backdrop-blur-sm px-8 py-4 border-b border-slate-100 dark:border-[var(--border)] flex items-center justify-between"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div>
                        <h1 className="text-xl text-slate-800 dark:text-slate-100" style={{ fontWeight: 900 }}>Monitor de Campo</h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>
                            Rota Coaching · Conformidade GA/GV/TRD
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => refreshCacheMutation.mutate()}
                            disabled={refreshCacheMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all disabled:opacity-50"
                            style={{ fontWeight: 600 }}>
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
                                <Printer className="w-3.5 h-3.5" />
                                Exportar PDF
                            </button>
                        )}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-100 dark:border-emerald-800/40" style={{ fontWeight: 700 }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ao vivo
                        </div>
                    </div>
                </header>

                <div className="px-8 py-6 space-y-6">
                    {/* Abas */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 w-fit">
                        {([
                            ["coaching", <Route className="w-4 h-4" />, "Rota Coaching"],
                            ["frota", <Car className="w-4 h-4" />, "Frota Infleet"],
                        ] as const).map(([id, icon, label]) => (
                            <button key={id} onClick={() => setAba(id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all ${aba === id
                                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    }`}
                                style={{ fontWeight: aba === id ? 700 : 500 }}>
                                {icon} {label}
                            </button>
                        ))}
                    </div>

                    {/* Filtros */}
                    <RotaFiltros
                        aba={aba}
                        dateStart={dateStart} dateEnd={dateEnd}
                        revenda={revenda} ga={ga} status={status} geocercaId={sedeGeofenceId}
                        revendasUnicas={revendasUnicas} gasUnicos={gasUnicos} cercasInfleet={cercasInfleet}
                        setFiltro={setFiltro} resetFiltros={resetFiltros}
                        hasFiltrosAtivos={!!(revenda || ga || status || filtros.geocercaId)}
                    />

                    {/* ── Aba: Rota Coaching ────────────────────────────────────────────────── */}
                    {aba === "coaching" && (
                        <>
                            {loading && (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                                </div>
                            )}

                            {erro && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-6 text-center">
                                    <p className="text-red-600 dark:text-red-400 text-sm" style={{ fontWeight: 600 }}>⚠️ {erro}</p>
                                    <p className="text-red-400 dark:text-red-500 text-xs mt-1">Mova o arquivo rota_coaching_all.json para a pasta public do projeto.</p>
                                </div>
                            )}

                            {!loading && !erro && (
                                <>
                                    {/* KPI Cards */}
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                        {kpiCards.map(k => (
                                            <div key={k.label} className={`bg-gradient-to-br ${k.bg} rounded-2xl p-5 border ${k.border}`}
                                                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>{k.label}</p>
                                                <p className={`text-3xl mt-2 ${k.color}`} style={{ fontWeight: 900 }}>{k.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <ConformidadeTabela
                                        tabelaFiltrada={tabelaFiltrada}
                                        expandedRows={expandedRows}
                                        toggleRow={toggleRow}
                                        mapRowKey={mapRowKey}
                                        setMapRowKey={setMapRowKey}
                                    />

                                    <AnalisesGestor
                                        revendasUnicas={revendasUnicas}
                                        dateStart={dateStart}
                                        getAnalise={getAnalise}
                                        setAnalise={setAnalise}
                                    />

                                    {baseFiltrado.some(r => r.agendado) && (
                                        <RotaGraficos dadosGA={dadosGA} dadosRevenda={dadosRevenda} />
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ── Aba: Frota Infleet ───────────────────────────────────────────────── */}
                    {aba === "frota" && (
                        <FrotaInfleet
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
