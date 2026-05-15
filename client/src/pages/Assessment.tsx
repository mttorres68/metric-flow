import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useTheme } from "@/contexts/ThemeContext";
import {
    Award,
    BarChart3,
    Filter,
    Medal,
    Network,
    PenLine,
    RefreshCw,
    Search,
    Trophy,
    Users,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { PASTEL_DARK, PASTEL_LIGHT, PIRAMIDE_COR, classNames } from "./assessment/constants";
import type { ClustersData, Indicador, ResultadosData } from "./assessment/types";
import { ClustersView } from "./assessment/views/ClustersView";
import { EquipeView } from "./assessment/views/EquipeView";
import { OverviewView } from "./assessment/views/OverviewView";
import { RankingView } from "./assessment/views/RankingView";
import { RespostasView } from "./assessment/views/RespostasView";
import { ResultadosView } from "./assessment/views/ResultadosView";

export default function Assessment() {
    const { isCollapsed } = useSidebarCollapse();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [activePage, setActivePage] = useState("assessment");

    const palette = isDark ? PASTEL_DARK : PASTEL_LIGHT;

    const [view, setView] = useState<"overview" | "clusters" | "resultados" | "respostas" | "equipe" | "ranking">("overview");

    // ─── Dados ───────────────────────────────────────────────────────────────
    const [indicadores, setIndicadores] = useState<Indicador[]>([]);
    const [clusters, setClusters] = useState<ClustersData | null>(null);
    const [resultados, setResultados] = useState<ResultadosData | null>(null);
    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState<string | null>(null);

    const syncMutation = trpc.assessment.triggerSync.useMutation({
        onSuccess: (r) => {
            if (r?.sucesso) toast.success("Sincronização concluída com sucesso!");
            else toast.error(`Erro na sincronização: ${String(r?.erro ?? "").slice(0, 100)}`);
        },
        onError: () => toast.error("Não foi possível conectar à automação"),
    });

    const dbRevendasQuery = trpc.assessment.listRevendas.useQuery();

    useEffect(() => {
        let alive = true;
        Promise.all([
            fetch("/assessment_indicadores.json").then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            }),
            fetch("/assessment_clusters.json").then(r => r.ok ? r.json() : null).catch(() => null),
            fetch("/assessment_resultados.json").then(r => r.ok ? r.json() : null).catch(() => null),
        ])
            .then(([ind, cl, res]: [Indicador[], ClustersData | null, ResultadosData | null]) => {
                if (!alive) return;
                setIndicadores(ind);
                setClusters(cl);
                setResultados(res);
                setLoading(false);
            })
            .catch(err => {
                if (!alive) return;
                console.error(err);
                setErrMsg("Falha ao carregar indicadores. Verifique se /assessment_indicadores.json está em client/public.");
                setLoading(false);
            });
        return () => { alive = false; };
    }, []);

    // ─── Filtros (Overview) ───────────────────────────────────────────────────
    const [fMacro, setFMacro] = useState<string>("");
    const [fMicro, setFMicro] = useState<string>("");
    const [fPiramide, setFPiramide] = useState<string>("");
    const [fTipo, setFTipo] = useState<string>("");
    const [fEvidencia, setFEvidencia] = useState<string>("");
    const [busca, setBusca] = useState("");
    const [expandido, setExpandido] = useState<string | null>(null);

    const opcMacro = useMemo(() => Array.from(new Set(indicadores.map(i => i.macroArea))).sort(), [indicadores]);
    const opcMicro = useMemo(() => {
        const base = fMacro ? indicadores.filter(i => i.macroArea === fMacro) : indicadores;
        return Array.from(new Set(base.map(i => i.microArea))).sort();
    }, [indicadores, fMacro]);
    const opcPiramide = useMemo(() => Array.from(new Set(indicadores.map(i => i.piramide))).sort(), [indicadores]);

    const indicadoresFiltrados = useMemo(() => {
        const q = busca.toLowerCase().trim();
        return indicadores.filter(i => {
            if (fMacro && i.macroArea !== fMacro) return false;
            if (fMicro && i.microArea !== fMicro) return false;
            if (fPiramide && i.piramide !== fPiramide) return false;
            if (fTipo && i.tipoResposta !== fTipo) return false;
            if (fEvidencia && i.evidenciaObrigatoria !== fEvidencia) return false;
            if (q) {
                const blob = `${i.idIndicador} ${i.descricaoItem} ${i.microArea} ${i.piramide}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }, [indicadores, fMacro, fMicro, fPiramide, fTipo, fEvidencia, busca]);

    const temFiltro = !!(fMacro || fMicro || fPiramide || fTipo || fEvidencia || busca);
    const limparFiltros = () => {
        setFMacro(""); setFMicro(""); setFPiramide("");
        setFTipo(""); setFEvidencia(""); setBusca("");
    };

    // ─── KPIs (Overview) ─────────────────────────────────────────────────────
    const totalIndicadores = indicadoresFiltrados.length;
    const totalPontos = useMemo(
        () => indicadoresFiltrados.reduce((s, i) => s + (Number(i.pontoPossivel) || 0), 0),
        [indicadoresFiltrados],
    );
    const totalEvidencia = useMemo(
        () => indicadoresFiltrados.filter(i => (i.evidenciaObrigatoria || "").toUpperCase() === "SIM").length,
        [indicadoresFiltrados],
    );
    const microAreasUnicas = useMemo(
        () => new Set(indicadoresFiltrados.map(i => i.microArea)).size,
        [indicadoresFiltrados],
    );

    // ─── Dados dos gráficos (Overview) ───────────────────────────────────────
    const dadosPiramide = useMemo(() => {
        const map = new Map<string, { count: number; pontos: number }>();
        indicadoresFiltrados.forEach(i => {
            const cur = map.get(i.piramide) || { count: 0, pontos: 0 };
            cur.count += 1;
            cur.pontos += Number(i.pontoPossivel) || 0;
            map.set(i.piramide, cur);
        });
        return Array.from(map.entries())
            .map(([k, v]) => ({ name: k, indicadores: v.count, pontos: v.pontos, fill: PIRAMIDE_COR[k] || "#94A3B8" }))
            .sort((a, b) => b.pontos - a.pontos);
    }, [indicadoresFiltrados]);

    const dadosMicroArea = useMemo(() => {
        const map = new Map<string, { count: number; pontos: number; macro: string }>();
        indicadoresFiltrados.forEach(i => {
            const cur = map.get(i.microArea) || { count: 0, pontos: 0, macro: i.macroArea };
            cur.count += 1;
            cur.pontos += Number(i.pontoPossivel) || 0;
            map.set(i.microArea, cur);
        });
        return Array.from(map.entries())
            .map(([k, v], idx) => ({ name: k, indicadores: v.count, pontos: v.pontos, macro: v.macro, fill: palette[idx % palette.length] }))
            .sort((a, b) => b.pontos - a.pontos);
    }, [indicadoresFiltrados, palette]);

    const dadosTipoResposta = useMemo(() => {
        const map = new Map<string, number>();
        indicadoresFiltrados.forEach(i => map.set(i.tipoResposta, (map.get(i.tipoResposta) || 0) + 1));
        return Array.from(map.entries()).map(([k, v], idx) => ({
            name: k, value: v,
            fill: idx === 0 ? (isDark ? "#6C8EF5" : "#A8C5E8") : (isDark ? "#A78BFA" : "#C5A8F4"),
        }));
    }, [indicadoresFiltrados, isDark]);

    // ─── Navegação ───────────────────────────────────────────────────────────
    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching", analises: "/analises",
            trello_atraso: "/trello-atraso", whatsapp: "/whatsapp", assessment: "/assessment",
        };
        if (rotas[page] && page !== "assessment") { window.location.href = rotas[page]; return; }
        if (page !== "assessment") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    // ─── Estilos compartilhados ───────────────────────────────────────────────
    const cardBorder = isDark
        ? "1px solid var(--sidebar-border)"
        : "1px solid oklch(0.93 0.006 240)";
    const cardShadow = "0 1px 4px rgba(0,0,0,0.04)";
    const tickColor = isDark ? "#64748B" : "#94A3B8";
    const gridColor = isDark ? "#1E2A3A" : "#F1F5F9";

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                {/* ─── Header ─────────────────────────────────────────────────── */}
                <header
                    className="sticky top-0 z-20 bg-white/90 dark:bg-[var(--card)]/90 backdrop-blur-sm px-8 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center justify-between"
                    style={{ boxShadow: cardShadow }}
                >
                    <div>
                        <h1 className="text-xl text-slate-800 dark:text-slate-100" style={{ fontWeight: 900 }}>
                            Assessment — Programa de Excelência
                        </h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>
                            Indicadores de avaliação · {indicadores[0]?.nomeOperacao || "DUTTRA"}
                            {indicadores.length > 0 && ` · ${indicadores[0].mes}/${indicadores[0].ano}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Tab switcher */}
                        <div className="flex items-center bg-slate-100 dark:bg-[var(--accent)] rounded-xl p-1">
                            {(
                                [
                                    { id: "overview",   label: "Visão Geral",          Icon: BarChart3 },
                                    { id: "clusters",   label: "Clusters & Evidências", Icon: Network   },
                                    { id: "resultados", label: "Resultados",            Icon: Trophy    },
                                    { id: "respostas",  label: "Respostas",             Icon: PenLine   },
                                    { id: "equipe",     label: "Equipe",                Icon: Users     },
                                    { id: "ranking",    label: "Ranking",               Icon: Medal     },
                                ] as const
                            ).map(({ id, label, Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setView(id)}
                                    className={classNames(
                                        "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all",
                                        view === id
                                            ? "bg-white dark:bg-[var(--card)] text-slate-800 dark:text-slate-100 shadow-sm"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                                    )}
                                    style={{ fontWeight: 700 }}
                                >
                                    <Icon className="w-3.5 h-3.5" /> {label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => syncMutation.mutate({})}
                            disabled={syncMutation.isPending}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition-all"
                            style={{ fontWeight: 700 }}
                        >
                            <RefreshCw className={classNames("w-3.5 h-3.5", syncMutation.isPending && "animate-spin")} />
                            {syncMutation.isPending ? "Sincronizando…" : "Sincronizar"}
                        </button>

                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/30" style={{ fontWeight: 700 }}>
                            <Award className="w-3.5 h-3.5" />
                            {indicadores.length} indicadores
                        </div>
                    </div>
                </header>

                {/* ─── Filtros sticky (apenas Visão Geral) ────────────────── */}
                {view === "overview" && (
                    <div className="sticky top-[73px] z-10 bg-white/95 dark:bg-[var(--card)]/95 backdrop-blur-sm px-8 py-3 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex flex-wrap items-center gap-4"
                        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>
                            <Filter className="w-3.5 h-3.5" /> Filtros
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Macro Área</label>
                            <select value={fMacro} onChange={e => { setFMacro(e.target.value); setFMicro(""); }}
                                className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                <option value="">Todas</option>
                                {opcMacro.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Micro Área</label>
                            <select value={fMicro} onChange={e => setFMicro(e.target.value)}
                                className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                <option value="">Todas</option>
                                {opcMicro.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Pirâmide</label>
                            <select value={fPiramide} onChange={e => setFPiramide(e.target.value)}
                                className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                <option value="">Todas</option>
                                {opcPiramide.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Tipo</label>
                            <select value={fTipo} onChange={e => setFTipo(e.target.value)}
                                className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                <option value="">Todos</option>
                                <option value="Binária">Binária</option>
                                <option value="Maturidade">Maturidade</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Evidência Obrig.</label>
                            <select value={fEvidencia} onChange={e => setFEvidencia(e.target.value)}
                                className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                <option value="">Todos</option>
                                <option value="SIM">SIM</option>
                                <option value="NÃO">NÃO</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 ml-auto bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-3 py-1.5">
                            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            <input type="text" placeholder="Buscar indicador..."
                                value={busca} onChange={e => setBusca(e.target.value)}
                                className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none w-48"
                                style={{ fontWeight: 500 }} />
                            {busca && <button onClick={() => setBusca("")}><X className="w-3 h-3 text-slate-400" /></button>}
                        </div>

                        {temFiltro && (
                            <button onClick={limparFiltros}
                                className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--accent)] transition-all"
                                style={{ fontWeight: 600 }}>
                                <X className="w-3.5 h-3.5" /> Limpar
                            </button>
                        )}
                    </div>
                )}

                <div className="px-8 py-6 space-y-6">
                    {errMsg && (
                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                            {errMsg}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center h-60 bg-white dark:bg-[var(--card)] rounded-2xl"
                            style={{ border: cardBorder, boxShadow: cardShadow }}>
                            <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                        </div>
                    ) : view === "clusters" ? (
                        <ClustersView data={clusters} isDark={isDark} cardBorder={cardBorder} cardShadow={cardShadow} />
                    ) : view === "respostas" ? (
                        <RespostasView data={resultados} indicadores={indicadores} dbRevendas={dbRevendasQuery.data ?? []} isDark={isDark} cardBorder={cardBorder} cardShadow={cardShadow} />
                    ) : view === "resultados" ? (
                        <ResultadosView isDark={isDark} cardBorder={cardBorder} cardShadow={cardShadow} palette={palette} />
                    ) : view === "equipe" ? (
                        <EquipeView indicadores={indicadores} isDark={isDark} cardBorder={cardBorder} cardShadow={cardShadow} />
                    ) : view === "ranking" ? (
                        <RankingView isDark={isDark} cardBorder={cardBorder} cardShadow={cardShadow} />
                    ) : (
                        <OverviewView
                            indicadores={indicadores}
                            indicadoresFiltrados={indicadoresFiltrados}
                            expandido={expandido}
                            setExpandido={setExpandido}
                            totalIndicadores={totalIndicadores}
                            totalPontos={totalPontos}
                            totalEvidencia={totalEvidencia}
                            microAreasUnicas={microAreasUnicas}
                            dadosPiramide={dadosPiramide}
                            dadosMicroArea={dadosMicroArea}
                            dadosTipoResposta={dadosTipoResposta}
                            isDark={isDark}
                            cardBorder={cardBorder}
                            cardShadow={cardShadow}
                            tickColor={tickColor}
                            gridColor={gridColor}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
