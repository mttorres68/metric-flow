import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
    AlertTriangle, BarChart3, Clock, RefreshCw, TrendingDown, TrendingUp, X, FileText,
    Printer, MessageCircle, Loader2, Play, WifiOff, ChevronDown, ChevronUp,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { EditorAnaliseHandle } from "@/components/EditorAnalise";
import { generateWordReport } from "@/lib/wordGenerator";
import { useTheme } from "@/contexts/ThemeContext";

import { ColumnsSelector } from "./components/ColumnsSelector";
import { FilterSelect, FilterDate } from "./components/FilterControls";
import { EnviarWAModal } from "./components/EnviarWAModal";
import { DiariaView } from "./views/DiariaView";

import { useColumnVisibility } from "./lib/hooks/useColumnVisibility";
import { useFiltroPersistido } from "./lib/hooks/useFiltroPersistido";
import { useAnalisesRevenda } from "./lib/hooks/useAnalisesRevenda";

import { SCROLL_TO_REVENDA_KEY, REVENDA_COACHING_MAP } from "./lib/constants";
import { pct } from "./lib/formatters";
import { buildMensagensHTML } from "./lib/mensagens";
import type { AcaoTipo, AcaoVendState } from "./lib/types";

export default function Analise() {
    const activePage = "analise_diaria";
    const { filtros, setFiltro, setFiltrosMulti, resetFiltros, temFiltro } = useFiltroPersistido();
    const { isCollapsed } = useSidebarCollapse();
    const { getAnalise, setAnalise, analisesDoPeríodo } = useAnalisesRevenda(
        filtros.dataInicio || "",
        filtros.dataFim || ""
    );
    const { col, toggle, toggleAll, allOn, hiddenCount } = useColumnVisibility();
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const [sortBy, setSortBy] = useState("vendedor");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [expandedHelp, setExpandedHelp] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
    const [downloadingUnified, setDownloadingUnified] = useState(false);
    const [waModalOpen, setWaModalOpen] = useState(false);
    const [headerExpanded, setHeaderExpanded] = useState(true);
    const [checkboxState, setCheckboxState] = useState<Record<string, Record<string, AcaoVendState>>>({});
    const editorRefs = useRef<Map<string, EditorAnaliseHandle>>(new Map());

    const toggleCheck = useCallback((rev: string, vendedor: string | number, tipo: AcaoTipo) => {
        const prevRevState = checkboxState[rev] ?? {};
        const prevVend = prevRevState[String(vendedor)] ?? { deslocamento: false, problema: false };
        const newRevState = {
            ...prevRevState,
            [String(vendedor)]: { ...prevVend, [tipo]: !prevVend[tipo] },
        };
        setCheckboxState(prev => ({ ...prev, [rev]: newRevState }));
        const mensagens = buildMensagensHTML(newRevState);
        editorRefs.current.get(rev)?.setGeneratedContent(mensagens);
    }, [checkboxState]);

    useEffect(() => {
        const revenda = sessionStorage.getItem(SCROLL_TO_REVENDA_KEY);
        if (!revenda) return;
        sessionStorage.removeItem(SCROLL_TO_REVENDA_KEY);
        const el = document.getElementById(`revenda-${revenda}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            const timer = setTimeout(() => {
                document.getElementById(`revenda-${revenda}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const { data: vendedoresList = [] } = trpc.clientes.vendedores.useQuery({ revenda: filtros.revenda });

    const healthQuery = trpc.automacao.health.useQuery(undefined, { refetchInterval: 30_000, retry: false });
    const runMutation = trpc.automacao.run.useMutation({
        onSuccess: () => { toast.success("Pipeline executado com sucesso! Atualizando dados…"); refetch(); },
        onError: (e) => toast.error(`Falha no pipeline: ${e.message}`),
    });
    const refreshCacheMutation = trpc.dashboard.refreshData.useMutation({
        onSuccess: () => refetch(),
        onError: () => refetch(),
    });

    const { data: result, isLoading, error, refetch } = trpc.analise.getDados.useQuery(
        {
            dataInicio: filtros.dataInicio || undefined,
            dataFim: filtros.dataFim || undefined,
            revenda: filtros.revenda || undefined,
            vendedor: filtros.vendedor ? parseInt(filtros.vendedor, 10) : undefined,
        },
        { staleTime: 5 * 60 * 1000 }
    );

    const dados = result?.dados ?? [];
    const revendas = result?.revendas ?? [];

    const sorted = useMemo(() => {
        const d = [...dados];
        d.sort((a, b) => {
            const av = (a as any)[sortBy];
            const bv = (b as any)[sortBy];
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
            return sortDir === "asc" ? cmp : -cmp;
        });
        return d;
    }, [dados, sortBy, sortDir]);

    const { revendasOrdenadas, groupedData } = useMemo(() => {
        const groups: Record<string, typeof sorted> = {};
        sorted.forEach(r => {
            if (!groups[r.revenda]) groups[r.revenda] = [];
            groups[r.revenda].push(r);
        });
        return { revendasOrdenadas: Object.keys(groups).sort(), groupedData: groups };
    }, [sorted]);

    const getAnaliseGAs = useCallback((revenda: string): string => {
        try {
            const stored: Record<string, string> = JSON.parse(localStorage.getItem("metricflow:analises-ga") || "{}");
            const storedLower = Object.fromEntries(Object.entries(stored).map(([k, v]) => [k.toLowerCase(), v]));
            const nomeCoaching = REVENDA_COACHING_MAP[revenda.toLowerCase()];
            for (const nome of nomeCoaching ? [nomeCoaching, revenda] : [revenda]) {
                const val = storedLower[`${nome.toLowerCase()}__${filtros.dataInicio}`];
                if (val) return val;
            }
            return "";
        } catch { return ""; }
    }, [filtros.dataInicio]);

    const downloadPDF = useCallback(async (revenda?: string) => {
        const chave = revenda ?? "__all__";
        setDownloadingPDF(chave);
        try {
            const data = filtros.dataInicio;
            if (!data) { toast.error("Selecione uma data primeiro."); return; }

            const analisesPayload: Record<string, { vendedores: string; gas: string }> = {};
            if (revenda) {
                analisesPayload[revenda] = { vendedores: getAnalise(revenda), gas: getAnaliseGAs(revenda) };
            } else {
                const todasAnalises = analisesDoPeríodo();
                revendasOrdenadas.forEach(rev => {
                    analisesPayload[rev] = { vendedores: todasAnalises[rev] ?? "", gas: getAnaliseGAs(rev) };
                });
            }

            const resp = await fetch("/api/relatorio/gerar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data, ...(revenda ? { revenda } : {}), analises: analisesPayload }),
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                toast.error(err.error ?? "Erro ao gerar PDF.");
                return;
            }

            const blob = await resp.blob();
            const filename = resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
                ?? (revenda ? `${revenda}_${data}.pdf` : `relatorios_${data}.zip`);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF baixado com sucesso!");
        } catch (e) {
            console.error(e);
            toast.error("Erro ao baixar PDF.");
        } finally {
            setDownloadingPDF(null);
        }
    }, [filtros.dataInicio, getAnalise, getAnaliseGAs, analisesDoPeríodo, revendasOrdenadas]);

    const downloadPDFUnificado = useCallback(async () => {
        setDownloadingUnified(true);
        try {
            const data = filtros.dataInicio;
            if (!data) { toast.error("Selecione uma data primeiro."); return; }

            const todasAnalises = analisesDoPeríodo();
            const analisesPayload: Record<string, { vendedores: string; gas: string }> = {};
            revendasOrdenadas.forEach(rev => {
                analisesPayload[rev] = { vendedores: todasAnalises[rev] ?? "", gas: getAnaliseGAs(rev) };
            });

            const resp = await fetch("/api/relatorio/gerar-unificado", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data, analises: analisesPayload }),
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                toast.error(err.error ?? "Erro ao gerar PDF unificado.");
                return;
            }

            const blob = await resp.blob();
            const filename = resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
                ?? `relatorios_unificado_${data}.pdf`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF unificado baixado com sucesso!");
        } catch (e) {
            console.error(e);
            toast.error("Erro ao baixar PDF unificado.");
        } finally {
            setDownloadingUnified(false);
        }
    }, [filtros.dataInicio, analisesDoPeríodo, getAnaliseGAs, revendasOrdenadas]);

    function toggleSort(column: string) {
        if (sortBy === column) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortBy(column); setSortDir("asc"); }
    }

    const totais = useMemo(() => ({
        vendedores: dados.length,
        pdvs: dados.reduce((s, r) => s + r.pdvs_visitados, 0),
        pdvs_total: dados.reduce((s, r) => s + r.pdvs_total, 0),
        heishop: dados.reduce((s, r) => s + r.pedido_heishop, 0),
        relampago_avg: dados.length ? dados.reduce((s, r) => s + r.relampago_pct, 0) / dados.length : 0,
        iv_avg: dados.length ? dados.reduce((s, r) => s + r.iv, 0) / dados.length : 0,
    }), [dados]);

    const handleNavigate = (page: string) => {
        toast.info(`Módulo "${page}" em breve`);
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                {/* ── Header ── */}
                <div className="bg-white dark:bg-[var(--card)] border-b border-slate-100 dark:border-[var(--border)] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <BarChart3 size={20} className="text-indigo-500 dark:text-indigo-400" />
                            Análise de Vendedores
                        </h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Métricas detalhadas por vendedor e dia</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedHelp(h => !h)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <AlertTriangle size={12} /> Glossário
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    await generateWordReport(groupedData, revendasOrdenadas, filtros.dataInicio || "", filtros.dataFim || "", analisesDoPeríodo());
                                    toast.success("Relatório baixado com sucesso!");
                                } catch (e) {
                                    toast.error("Erro ao gerar relatório Word.");
                                    console.error(e);
                                }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        >
                            <FileText size={12} /> Exportar Word
                        </button>
                        <button
                            onClick={() => downloadPDF()}
                            disabled={downloadingPDF !== null || downloadingUnified}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                            title="Baixar PDF de todas as revendas (ZIP)"
                        >
                            <Printer size={12} /> {downloadingPDF === "__all__" ? "Gerando..." : "Baixar todos (ZIP)"}
                        </button>
                        <button
                            onClick={downloadPDFUnificado}
                            disabled={downloadingPDF !== null || downloadingUnified}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
                            title="Baixar todas as revendas em um único arquivo PDF"
                        >
                            <Printer size={12} /> {downloadingUnified ? "Gerando..." : "Baixar unificado (PDF)"}
                        </button>
                        <button
                            onClick={() => setWaModalOpen(true)}
                            disabled={revendasOrdenadas.length === 0}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white border border-green-600 disabled:opacity-40"
                            style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
                            title="Enviar relatórios por WhatsApp para todas as revendas"
                        >
                            <MessageCircle size={12} /> Enviar WhatsApp
                        </button>
                        <button
                            onClick={() => runMutation.mutate({
                                dataInicio: filtros.dataInicio || new Date().toISOString().slice(0, 10),
                                dataFim: filtros.dataFim || filtros.dataInicio || new Date().toISOString().slice(0, 10),
                            })}
                            disabled={runMutation.isPending || !healthQuery.data?.online}
                            title={!healthQuery.data?.online ? "API de automação offline — execute: python api.py" : `Executar pipeline para ${filtros.dataInicio ?? "hoje"}`}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border disabled:opacity-40 transition-colors"
                            style={
                                healthQuery.data?.online
                                    ? isDark
                                        ? { background: "oklch(0.20 0.06 162 / 0.35)", color: "#4ade80", borderColor: "oklch(0.38 0.12 162)" }
                                        : { background: "#f0fdf4", color: "#16a34a", borderColor: "#86efac" }
                                    : isDark
                                        ? { background: "oklch(0.155 0.020 252)", color: "#64748b", borderColor: "oklch(0.265 0.018 252)" }
                                        : { background: "#f8fafc", color: "#94a3b8", borderColor: "#e2e8f0" }
                            }
                        >
                            {runMutation.isPending
                                ? <><Loader2 size={12} className="animate-spin" /> Executando…</>
                                : healthQuery.data?.online
                                    ? <><Play size={12} /> Executar pipeline</>
                                    : <><WifiOff size={12} /> Pipeline offline</>}
                        </button>
                        <button
                            onClick={() => refreshCacheMutation.mutate()}
                            disabled={refreshCacheMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={refreshCacheMutation.isPending ? "animate-spin" : ""} /> Atualizar
                        </button>
                        <button
                            onClick={() => setHeaderExpanded(e => !e)}
                            title={headerExpanded ? "Recolher filtros e KPIs" : "Expandir filtros e KPIs"}
                            className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            {headerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                {/* ── Seção colapsável: Glossário + Filtros + KPIs ── */}
                {headerExpanded && (
                    <>
                        {expandedHelp && (
                            <div className="bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30 px-6 py-3">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-600 dark:text-slate-300 max-w-5xl">
                                    {[
                                        ["Início", "Alerta se primeiro atendimento após 09:30"],
                                        ["Visitas / IV", "Visitados dentro do raio / carteira. Alerta se < 90%"],
                                        ["Relâmpago", "Visitas < 3 min dentro do raio. Alerta se > 10%"],
                                        ["Pedido SFA", "Pedidos realizados pelo vendedor via sistema SFA"],
                                        ["Pedido Heishop", "Pedidos realizados via plataforma Heishop"],
                                        ["Heishop Verificado", "Pedidos Heishop confirmados (com Tipo Cobr. preenchida)"],
                                        ["IAV", "Índice de Atendimento = Heishop verificado / Heishop total"],
                                        ["Ranking Crítico", "1 = pior desempenho (maior % relâmpago)"],
                                        ["Atend. > 35min", "Visitas com duração > 35min dentro do raio"],
                                        ["Maior Percurso", "Maior gap entre visitas consecutivas"],
                                        ["PDVs após gap", "Atendimentos realizados após o maior intervalo"],
                                        ["Tempo Ñ Atend.", "Jornada − tempo em visita. Trava às 17:00"],
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex gap-2">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200 min-w-[140px]">{k}:</span>
                                            <span>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4 mx-6 mt-4"
                            style={{ border: `1px solid ${isDark ? "oklch(0.265 0.018 252)" : "oklch(0.93 0.006 240)"}`, boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.25)" : "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <FilterSelect
                                label="Revenda"
                                value={filtros.revenda ?? ""}
                                onChange={v => setFiltrosMulti({ revenda: v || undefined, vendedor: undefined })}
                                placeholder="Todas"
                                options={revendas.map(r => ({ value: r, label: r }))}
                            />
                            <FilterSelect
                                label="Vendedor"
                                value={filtros.vendedor ?? ""}
                                onChange={v => setFiltro("vendedor", v || undefined)}
                                placeholder="Todos"
                                options={vendedoresList.map(v => ({ value: String(v.id), label: v.nome }))}
                            />
                            <FilterDate label="Data Início" value={filtros.dataInicio ?? ""} onChange={v => setFiltro("dataInicio", v || undefined)} />
                            <FilterDate label="Data Fim" value={filtros.dataFim ?? ""} onChange={v => setFiltro("dataFim", v || undefined)} />
                            {temFiltro && (
                                <button onClick={resetFiltros}
                                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all font-semibold">
                                    <X className="w-3.5 h-3.5" /> Limpar
                                </button>
                            )}
                            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto font-medium">{sorted.length} vendedor(es)</span>
                            <ColumnsSelector col={col} toggle={toggle} toggleAll={toggleAll} allOn={allOn} hiddenCount={hiddenCount} />
                        </div>

                        <div className="px-6 pt-4 pb-2 grid grid-cols-5 gap-3">
                            {[
                                { label: "Vendedores", value: totais.vendedores, color: "text-slate-700 dark:text-slate-200", icon: <BarChart3 size={16} className="text-indigo-400" /> },
                                { label: "PDVs Visitados", value: totais.pdvs, sub: totais.pdvs_total, color: "text-slate-700 dark:text-slate-200", icon: <TrendingUp size={16} className="text-green-400" /> },
                                { label: "Pedidos Heishop", value: totais.heishop, color: "text-amber-600", icon: <AlertTriangle size={16} className="text-amber-400" /> },
                                { label: "Relâmpago médio", value: pct(totais.relampago_avg), color: totais.relampago_avg > 20 ? "text-red-600" : "text-green-600", icon: <TrendingDown size={16} className="text-red-400" /> },
                                { label: "IV médio", value: pct(totais.iv_avg), color: "text-indigo-600", icon: <Clock size={16} className="text-indigo-400" /> },
                            ].map(k => (
                                <div key={k.label} className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] px-4 py-3 flex items-center gap-3"
                                    style={{ boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.06)" }}>
                                    {k.icon}
                                    <div>
                                        <div className={`text-lg font-bold ${k.color}`}>
                                            {k.value}
                                            {k.sub ? <span className="text-xs text-slate-400 dark:text-slate-500">/{k.sub} = {k.sub - (k.value as number)}</span> : ""}
                                        </div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500">{k.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ── Conteúdo principal ── */}
                <div className="flex-1 min-h-0 overflow-auto">
                    <DiariaView
                        isLoading={isLoading}
                        error={error}
                        revendasOrdenadas={revendasOrdenadas}
                        groupedData={groupedData}
                        col={col}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                        checkboxState={checkboxState}
                        onToggleCheck={toggleCheck}
                        getAnalise={getAnalise}
                        onSetAnalise={setAnalise}
                        downloadPDF={downloadPDF}
                        downloadingPDF={downloadingPDF}
                        editorRefs={editorRefs}
                        dataInicio={filtros.dataInicio || ""}
                        isDark={isDark}
                    />
                </div>
            </div>

            {waModalOpen && (
                <EnviarWAModal
                    revendasOrdenadas={revendasOrdenadas}
                    data={filtros.dataInicio || ""}
                    getAnalise={getAnalise}
                    getAnaliseGAs={getAnaliseGAs}
                    onClose={() => setWaModalOpen(false)}
                />
            )}
        </div>
    );
}
