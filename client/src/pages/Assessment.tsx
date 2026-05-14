/*
 * MetricFlow — Página Assessment
 * Visualização dos indicadores do Programa de Excelência (Assessment Heineken / Revendas)
 * Fonte de dados: client/public/assessment_indicadores.json (extraído da aba Worksheet)
 */

import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useTheme } from "@/contexts/ThemeContext";
import {
    Award,
    BarChart3,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Crown,
    FileCheck2,
    Filter,
    GitBranch,
    LayersIcon,
    Link2,
    Medal,
    Network,
    Percent,
    PenLine,
    Search,
    Sparkles,
    Target,
    TrendingDown,
    TrendingUp,
    Trophy,
    UserCheck,
    Users,
    Waves,
    X,
    RefreshCw,
    Phone,
    Briefcase,
    UserPlus,
    BarChart2,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────
interface Indicador {
    idIndicador: string;
    idOperacao: number | string;
    nomeOperacao: string;
    ano: number;
    mes: string;
    macroArea: string;
    microArea: string;
    piramide: string;
    descricaoItem: string;
    detalhamentoItem: string;
    informacaoItem: string;
    evidenciaObrigatoria: string;
    detalhesEvidencia: string;
    planoAcao: string;
    tipoResposta: string;
    pontoPossivel: number;
}

// Cluster analysis types
interface ClusterUI {
    id: number;
    tamanho: number;
    pontosTotais: number;
    microAreaDom: string | null;
    piramideDom: string | null;
    familiaDom: string | null;
    periodicidadeDom: string | null;
    indicadores: string[];
    descricoes: { id: string; descricao: string }[];
    breakdownFamilias: Record<string, number>;
    breakdownPiramide: Record<string, number>;
}
interface ParAlta {
    a: string;
    b: string;
    sim: number;
    mesmaMicroArea: boolean;
    mesmaPiramide: boolean;
    mesmaPeriodicidade: boolean;
    familiasComuns: string[];
}
interface OndaColeta {
    periodicidade: string;
    familia: string;
    qtd: number;
    indicadores: string[];
}
interface FamiliaEvidencia {
    nome: string;
    qtdIndicadores: number;
    pontosTotais: number;
    qtdMicroAreas: number;
    microAreas: string[];
    indicadores: string[];
}
interface GrafoNode {
    id: string;
    label: string;
    macroArea: string;
    microArea: string;
    piramide: string;
    descricao: string;
    pontos: number;
    cluster: number;
    familias: string[];
    periodicidade: string;
}
interface GrafoEdge { source: string; target: string; sim: number; }
interface ClustersData {
    meta: { totalIndicadores: number; totalClusters: number; distThreshold: number; edgeThreshold: number; pairThreshold: number };
    familias: FamiliaEvidencia[];
    clusters: ClusterUI[];
    ondasColeta: OndaColeta[];
    paresAltaSimilaridade: ParAlta[];
    grafo: { nodes: GrafoNode[]; edges: GrafoEdge[] };
}

// Resultados (assessment de abril)
interface RespostaResultado {
    data: string;
    operacao: number;
    revenda: string;
    shortId: string;
    item: string;
    autoavaliacao: "Sim" | "Não" | string;
    evidencia: "Sim" | "Não" | string;
    padrinho: string;
    hora: string | null;
    macroArea: string;
    microArea: string;
    piramide: string;
    descricao: string;
    tipoResposta: string;
    pontoPossivel: number;
    pontosEvidencia: number;
    pontosAutoavaliacao: number;
}
interface ResultadosData {
    meta: { totalRespostas: number; totalRevendas: number; totalIndicadores: number; mes: string; ano: number; fonte: string };
    revendas: string[];
    padrinhos: string[];
    respostas: RespostaResultado[];
}

// ─── Paletas (Pastel Command Center) ──────────────────────────────────────
const PASTEL_LIGHT = [
    "#A8C5E8", "#A8F4C5", "#C5A8F4", "#F4C5A8",
    "#F4A8C5", "#A8D4F4", "#F4E8A8", "#F4A8A8",
    "#C5F4E8", "#E8C5F4",
];
const PASTEL_DARK = [
    "#6C8EF5", "#34C78A", "#A78BFA", "#F5956C",
    "#F472B6", "#38BDF8", "#FBBF24", "#F87171",
    "#22D3EE", "#C084FC",
];

// Cor "diagnóstica" por pirâmide
const PIRAMIDE_COR: Record<string, string> = {
    "COMPLIANCE": "#F4A8A8",
    "COND. BÁSICA": "#F4C5A8",
    "EXECUÇÃO": "#A8C5E8",
    "EFICIÊNCIA": "#A8F4C5",
    "ESTRATÉGIA": "#C5A8F4",
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function classNames(...cls: (string | false | null | undefined)[]) {
    return cls.filter(Boolean).join(" ");
}

export default function Assessment() {
    const { isCollapsed } = useSidebarCollapse();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [activePage, setActivePage] = useState("assessment");

    const palette = isDark ? PASTEL_DARK : PASTEL_LIGHT;

    // ─── Visualização ────────────────────────────────────────────────────────
    const [view, setView] = useState<"overview" | "clusters" | "resultados" | "respostas" | "equipe">("overview");

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

    // ─── Filtros ─────────────────────────────────────────────────────────────
    const [fMacro, setFMacro] = useState<string>("");
    const [fMicro, setFMicro] = useState<string>("");
    const [fPiramide, setFPiramide] = useState<string>("");
    const [fTipo, setFTipo] = useState<string>("");
    const [fEvidencia, setFEvidencia] = useState<string>("");
    const [busca, setBusca] = useState("");
    const [expandido, setExpandido] = useState<string | null>(null);

    // Listas de opções para os selects
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

    // ─── KPIs ────────────────────────────────────────────────────────────────
    const totalIndicadores = indicadoresFiltrados.length;
    const totalPontos = useMemo(
        () => indicadoresFiltrados.reduce((s, i) => s + (Number(i.pontoPossivel) || 0), 0),
        [indicadoresFiltrados]
    );
    const totalEvidencia = useMemo(
        () => indicadoresFiltrados.filter(i => (i.evidenciaObrigatoria || "").toUpperCase() === "SIM").length,
        [indicadoresFiltrados]
    );
    const microAreasUnicas = useMemo(
        () => new Set(indicadoresFiltrados.map(i => i.microArea)).size,
        [indicadoresFiltrados]
    );

    // ─── Datasets dos gráficos ───────────────────────────────────────────────
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
            name: k, value: v, fill: idx === 0 ? (isDark ? "#6C8EF5" : "#A8C5E8") : (isDark ? "#A78BFA" : "#C5A8F4"),
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

    // ─── Render ──────────────────────────────────────────────────────────────
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
                            <button
                                onClick={() => setView("overview")}
                                className={classNames(
                                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all",
                                    view === "overview"
                                        ? "bg-white dark:bg-[var(--card)] text-slate-800 dark:text-slate-100 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                                )}
                                style={{ fontWeight: 700 }}
                            >
                                <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
                            </button>
                            <button
                                onClick={() => setView("clusters")}
                                className={classNames(
                                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all",
                                    view === "clusters"
                                        ? "bg-white dark:bg-[var(--card)] text-slate-800 dark:text-slate-100 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                                )}
                                style={{ fontWeight: 700 }}
                            >
                                <Network className="w-3.5 h-3.5" /> Clusters & Evidências
                            </button>
                            <button
                                onClick={() => setView("resultados")}
                                className={classNames(
                                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all",
                                    view === "resultados"
                                        ? "bg-white dark:bg-[var(--card)] text-slate-800 dark:text-slate-100 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                                )}
                                style={{ fontWeight: 700 }}
                            >
                                <Trophy className="w-3.5 h-3.5" /> Resultados
                            </button>
                            <button
                                onClick={() => setView("respostas")}
                                className={classNames(
                                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all",
                                    view === "respostas"
                                        ? "bg-white dark:bg-[var(--card)] text-slate-800 dark:text-slate-100 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                                )}
                                style={{ fontWeight: 700 }}
                            >
                                <PenLine className="w-3.5 h-3.5" /> Respostas
                            </button>
                            <button
                                onClick={() => setView("equipe")}
                                className={classNames(
                                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all",
                                    view === "equipe"
                                        ? "bg-white dark:bg-[var(--card)] text-slate-800 dark:text-slate-100 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                                )}
                                style={{ fontWeight: 700 }}
                            >
                                <Users className="w-3.5 h-3.5" /> Equipe
                            </button>
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
                    ) : (
                        <>
                            {/* ─── KPIs ──────────────────────────────────────────────── */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <KPI titulo="Indicadores" valor={totalIndicadores} icone={ClipboardList} cor="from-indigo-400 to-purple-400" subtitulo="No filtro atual" />
                                <KPI titulo="Pontos Possíveis" valor={totalPontos} icone={Target} cor="from-amber-400 to-orange-400" subtitulo={`Máx ${totalIndicadores ? (totalPontos / totalIndicadores).toFixed(1) : "0"} pts/ind.`} />
                                <KPI titulo="Evidência Obrigatória" valor={totalEvidencia} icone={FileCheck2} cor="from-emerald-400 to-teal-400" subtitulo={`${totalIndicadores ? Math.round(totalEvidencia / totalIndicadores * 100) : 0}% do total`} />
                                <KPI titulo="Micro Áreas" valor={microAreasUnicas} icone={LayersIcon} cor="from-rose-400 to-pink-400" subtitulo="Cobertas no recorte" />
                            </div>

                            {/* ─── Gráficos: Pirâmide, Micro Áreas & Tipo Resposta ─── */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                {/* Pirâmide */}
                                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                                    <div className="mb-4">
                                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                                            <TrendingUp className="w-4 h-4 text-indigo-500" /> Distribuição por Pirâmide
                                        </h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Indicadores e pontos possíveis por nível</p>
                                    </div>
                                    <ResponsiveContainer width="100%" height={Math.max(220, dadosPiramide.length * 50)}>
                                        <BarChart data={dadosPiramide} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                                            <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: tickColor }}
                                                width={100} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                cursor={{ fill: "rgba(99,102,241,0.06)" }}
                                                contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                                                formatter={(v: number, name: string) => [v, name === "indicadores" ? "Indicadores" : "Pontos"]}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="indicadores" name="Indicadores" radius={[0, 6, 6, 0]}>
                                                {dadosPiramide.map((entry, i) => (
                                                    <Cell key={i} fill={entry.fill} />
                                                ))}
                                                <LabelList dataKey="indicadores" position="insideRight" style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }} />
                                            </Bar>
                                            <Bar dataKey="pontos" name="Pontos" radius={[0, 6, 6, 0]} fill={isDark ? "#A78BFA" : "#C5A8F4"}>
                                                <LabelList dataKey="pontos" position="insideRight" style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Micro Áreas */}
                                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                                    <div className="mb-4">
                                        <h3 className="text-slate-800 dark:text-slate-100 text-base" style={{ fontWeight: 800 }}>
                                            Pontos por Micro Área
                                        </h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Onde estão concentrados os pontos no scorecard</p>
                                    </div>
                                    <ResponsiveContainer width="100%" height={Math.max(220, dadosMicroArea.length * 28)}>
                                        <BarChart data={dadosMicroArea} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                                            <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: tickColor }}
                                                width={120} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                cursor={{ fill: "rgba(99,102,241,0.06)" }}
                                                contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                                                formatter={(v: number, _: any, props: any) => [
                                                    `${v} pts (${props.payload.indicadores} ind.)`,
                                                    props.payload.macro,
                                                ]}
                                            />
                                            <Bar dataKey="pontos" radius={[0, 6, 6, 0]}>
                                                {dadosMicroArea.map((entry, i) => (
                                                    <Cell key={i} fill={entry.fill} />
                                                ))}
                                                <LabelList dataKey="pontos" position="insideRight" style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Tipo Resposta — Pie */}
                                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                                    <div className="mb-4">
                                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tipo de Resposta
                                        </h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Distribuição entre Binária e Maturidade</p>
                                    </div>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <PieChart>
                                            <Pie data={dadosTipoResposta} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                                innerRadius={50} outerRadius={85} paddingAngle={3}
                                                label={({ name, value }) => `${name}: ${value}`}
                                                labelLine={false}
                                            >
                                                {dadosTipoResposta.map((entry, i) => (
                                                    <Cell key={i} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                                        {dadosTipoResposta.map(d => (
                                            <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                                                {d.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ─── Tabela detalhada ─────────────────────────────────── */}
                            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                                style={{ border: cardBorder, boxShadow: cardShadow }}>
                                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <h3 className="text-slate-800 dark:text-slate-100 text-base" style={{ fontWeight: 800 }}>
                                            Indicadores detalhados
                                        </h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                            {indicadoresFiltrados.length} de {indicadores.length} · clique para expandir descrição completa
                                        </p>
                                    </div>
                                </div>

                                {indicadoresFiltrados.length === 0 ? (
                                    <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                                        Nenhum indicador encontrado com os filtros atuais.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                                <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>ID</th>
                                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Macro / Micro</th>
                                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Pirâmide</th>
                                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Descrição</th>
                                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Tipo</th>
                                                    <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Evid.</th>
                                                    <th className="px-4 py-3 text-right" style={{ fontWeight: 700 }}>Pts</th>
                                                    <th className="px-4 py-3" />
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                                {indicadoresFiltrados.map(i => {
                                                    const aberto = expandido === i.idIndicador;
                                                    const corPiramide = PIRAMIDE_COR[i.piramide] || "#94A3B8";
                                                    return (
                                                        <FragmentRow
                                                            key={i.idIndicador}
                                                            item={i}
                                                            aberto={aberto}
                                                            corPiramide={corPiramide}
                                                            onToggle={() => setExpandido(aberto ? null : i.idIndicador)}
                                                        />
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="text-center py-4">
                                <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                                    MetricFlow · Assessment · {new Date().toLocaleDateString("pt-BR")}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────

function KPI({ titulo, valor, icone: Icone, cor, subtitulo }: {
    titulo: string;
    valor: number | string;
    icone: any;
    cor: string;
    subtitulo?: string;
}) {
    return (
        <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 relative overflow-hidden"
            style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${cor} opacity-20`} />
            <div className="relative">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cor} flex items-center justify-center mb-3`}>
                    <Icone className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                    {titulo}
                </p>
                <p className="text-3xl text-slate-800 dark:text-slate-100 mt-1 tabular-nums" style={{ fontWeight: 900 }}>
                    {valor}
                </p>
                {subtitulo && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1" style={{ fontWeight: 500 }}>
                        {subtitulo}
                    </p>
                )}
            </div>
        </div>
    );
}

function FragmentRow({ item, aberto, corPiramide, onToggle }: {
    item: Indicador;
    aberto: boolean;
    corPiramide: string;
    onToggle: () => void;
}) {
    return (
        <>
            <tr className="hover:bg-slate-50/80 dark:hover:bg-[var(--accent)] cursor-pointer transition-colors" onClick={onToggle}>
                <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                        {item.idIndicador.split(" - ")[0]}
                    </span>
                </td>
                <td className="px-4 py-3">
                    <p className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 600 }}>{item.macroArea}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{item.microArea}</p>
                </td>
                <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs"
                        style={{ background: `${corPiramide}33`, color: corPiramide, fontWeight: 700 }}>
                        {item.piramide}
                    </span>
                </td>
                <td className="px-4 py-3 max-w-md">
                    <p className="text-slate-700 dark:text-slate-200 truncate" style={{ fontWeight: 500 }}>
                        {item.descricaoItem}
                    </p>
                </td>
                <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs ${item.tipoResposta === "Maturidade"
                        ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300"
                        : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300"
                        }`} style={{ fontWeight: 600 }}>
                        {item.tipoResposta}
                    </span>
                </td>
                <td className="px-4 py-3 text-center">
                    {(item.evidenciaObrigatoria || "").toUpperCase() === "SIM" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                </td>
                <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-slate-800 dark:text-slate-200" style={{ fontWeight: 700 }}>
                        {item.pontoPossivel}
                    </span>
                </td>
                <td className="px-4 py-3 text-right">
                    {aberto
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </td>
            </tr>
            {aberto && (
                <tr className="bg-slate-50/60 dark:bg-[var(--accent)]/40">
                    <td colSpan={8} className="px-6 py-4 space-y-3">
                        <DetailBlock titulo="Detalhamento do Item" texto={item.detalhamentoItem} />
                        <DetailBlock titulo="Informação do Item" texto={item.informacaoItem} />
                        <DetailBlock titulo="Detalhes da Evidência" texto={item.detalhesEvidencia} />
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2">
                            <span><span style={{ fontWeight: 700 }}>Operação:</span> {item.nomeOperacao} ({item.idOperacao})</span>
                            <span><span style={{ fontWeight: 700 }}>Período:</span> {item.mes}/{item.ano}</span>
                            <span><span style={{ fontWeight: 700 }}>Plano de Ação:</span> {item.planoAcao}</span>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

type LineType = "question" | "numbered" | "lettered" | "obs" | "url" | "blank" | "text";

function classifyLine(line: string): LineType {
    const t = line.trim();
    if (!t) return "blank";
    if (/^https?:\/\//i.test(t)) return "url";
    if (/^obs\.?:/i.test(t) || /^obs\./i.test(t)) return "obs";
    if (/^\d+\.\s/.test(t)) return "numbered";
    if (/^[a-zA-Z]\.\s/.test(t)) return "lettered";
    if (t.endsWith("?")) return "question";
    return "text";
}

function RichText({ texto }: { texto: string }) {
    const lines = texto.replace(/\r/g, "").split("\n");
    const nodes: ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const kind = classifyLine(line);

        if (kind === "blank") { i++; continue; }

        if (kind === "question") {
            nodes.push(
                <p key={i} className="text-xs text-indigo-600 dark:text-indigo-400 mb-2" style={{ fontWeight: 700, lineHeight: 1.6 }}>
                    {line.trim()}
                </p>
            );
        } else if (kind === "numbered") {
            const match = line.trim().match(/^(\d+)\.\s(.*)$/);
            if (match) {
                nodes.push(
                    <div key={i} className="flex gap-2 mt-2 mb-0.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]" style={{ fontWeight: 800 }}>
                            {match[1]}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-200 pt-0.5" style={{ fontWeight: 600, lineHeight: 1.6 }}>
                            {match[2]}
                        </span>
                    </div>
                );
            }
        } else if (kind === "lettered") {
            const match = line.trim().match(/^([a-zA-Z])\.\s(.*)$/);
            if (match) {
                nodes.push(
                    <div key={i} className="flex gap-2 ml-7 mt-0.5">
                        <span className="flex-shrink-0 text-[10px] text-slate-400 dark:text-slate-500 pt-0.5 w-4" style={{ fontWeight: 700 }}>
                            {match[1]}.
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300" style={{ fontWeight: 500, lineHeight: 1.6 }}>
                            {match[2]}
                        </span>
                    </div>
                );
            }
        } else if (kind === "obs") {
            nodes.push(
                <div key={i} className="flex gap-2 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg">
                    <span className="text-xs text-amber-600 dark:text-amber-400" style={{ fontWeight: 700, lineHeight: 1.6 }}>
                        {line.trim()}
                    </span>
                </div>
            );
        } else if (kind === "url") {
            nodes.push(
                <p key={i} className="text-xs text-slate-400 dark:text-slate-500 ml-7 truncate" style={{ fontWeight: 500, lineHeight: 1.6 }}>
                    {line.trim()}
                </p>
            );
        } else {
            nodes.push(
                <p key={i} className="text-xs text-slate-600 dark:text-slate-300 mt-1" style={{ fontWeight: 500, lineHeight: 1.6 }}>
                    {line.trim()}
                </p>
            );
        }
        i++;
    }

    return <div className="space-y-0.5">{nodes}</div>;
}

function DetailBlock({ titulo, texto }: { titulo: string; texto?: string | null }) {
    if (!texto) return null;
    return (
        <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2" style={{ fontWeight: 700 }}>
                {titulo}
            </p>
            <RichText texto={texto} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW DE CLUSTERS
// ═══════════════════════════════════════════════════════════════════════════

const FAMILIA_COR: Record<string, string> = {
    "RH / Pessoas": "#F4A8C5",
    "BI / Painel / Sistema": "#A8C5E8",
    "Rota / Visita de Mercado": "#A8F4C5",
    "Documentos / Política / Carta": "#C5A8F4",
    "Estoque / Armazém / Logística": "#F4C5A8",
    "Reunião / Governança / Ata": "#F4E8A8",
    "Cobertura de Marca / Comercial": "#A8D4F4",
    "Trade / Ativos / MPDV": "#F4A8A8",
    "Frota / Veículos": "#C5F4E8",
    "Fotos / Identidade Visual": "#E8C5F4",
    "SHE / Segurança": "#F5956C",
    "Lista de Presença / Treinamento": "#34C78A",
};

function corFamilia(fam: string | null | undefined): string {
    if (!fam) return "#94A3B8";
    return FAMILIA_COR[fam] || "#94A3B8";
}

function ClustersView({ data, isDark, cardBorder, cardShadow }: {
    data: ClustersData | null;
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
}) {
    const [clusterFocus, setClusterFocus] = useState<number | null>(null);

    if (!data) {
        return (
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-10 text-center"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Análise de clusters não disponível. Gere o arquivo <code>/assessment_clusters.json</code> rodando <code>analise_clusters.py</code>.
                </p>
            </div>
        );
    }

    const clustersSignificativos = data.clusters.filter(c => c.tamanho >= 2);
    const ondasSignificativas = data.ondasColeta.filter(o => o.qtd >= 5);

    return (
        <div className="space-y-6">
            {/* ─── KPIs Cluster ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPI
                    titulo="Clusters Significativos"
                    valor={clustersSignificativos.length}
                    icone={Network}
                    cor="from-indigo-400 to-purple-400"
                    subtitulo={`De ${data.meta.totalClusters} clusters totais`}
                />
                <KPI
                    titulo="Pares de Alta Similaridade"
                    valor={data.paresAltaSimilaridade.length}
                    icone={Link2}
                    cor="from-rose-400 to-pink-400"
                    subtitulo={`Cosseno ≥ ${data.meta.pairThreshold}`}
                />
                <KPI
                    titulo="Ondas de Coleta"
                    valor={ondasSignificativas.length}
                    icone={Waves}
                    cor="from-amber-400 to-orange-400"
                    subtitulo="Periodicidade × Família, ≥ 5 ind"
                />
                <KPI
                    titulo="Famílias de Evidência"
                    valor={data.familias.length}
                    icone={Sparkles}
                    cor="from-emerald-400 to-teal-400"
                    subtitulo="Tipos recorrentes detectados"
                />
            </div>

            {/* ─── Diagrama de rede ───────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <Network className="w-4 h-4 text-indigo-500" /> Diagrama de Cluster
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Cada nó é um indicador. Linhas conectam pares com similaridade ≥ {data.meta.edgeThreshold}.
                            Cor = Família de evidência dominante. Clique em um cluster ao lado para destacar.
                        </p>
                    </div>
                    {clusterFocus !== null && (
                        <button onClick={() => setClusterFocus(null)}
                            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 px-2 py-1 rounded-lg"
                            style={{ fontWeight: 600 }}>
                            <X className="w-3 h-3" /> Limpar foco
                        </button>
                    )}
                </div>
                <ClusterGraph data={data} clusterFocus={clusterFocus} setClusterFocus={setClusterFocus} isDark={isDark} />
            </div>

            {/* ─── Famílias de Evidência ──────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <Sparkles className="w-4 h-4 text-emerald-500" /> Famílias de Evidência
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Tipos de evidência recorrentes — uma única coleta pode satisfazer múltiplos indicadores.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.familias.map(f => (
                        <div key={f.nome} className="rounded-xl p-4 border border-slate-100 dark:border-[var(--sidebar-border)]"
                            style={{ background: `${corFamilia(f.nome)}15` }}>
                            <div className="flex items-start gap-2 mb-2">
                                <span className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: corFamilia(f.nome) }} />
                                <p className="text-sm text-slate-800 dark:text-slate-100 flex-1" style={{ fontWeight: 700 }}>
                                    {f.nome}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                                <span><span style={{ fontWeight: 800 }}>{f.qtdIndicadores}</span> ind</span>
                                <span><span style={{ fontWeight: 800 }}>{f.pontosTotais}</span> pts</span>
                                <span><span style={{ fontWeight: 800 }}>{f.qtdMicroAreas}</span> áreas</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Clusters significativos ────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <GitBranch className="w-4 h-4 text-purple-500" /> Clusters com Evidência Compartilhável
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Indicadores agrupados por similaridade de descrição/evidência. Atender o cluster geralmente cobre todos os membros.
                    </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {clustersSignificativos.map(c => (
                        <ClusterCard key={c.id} cluster={c} indicadoresGrafo={data.grafo.nodes} highlight={clusterFocus === c.id} onClick={() => setClusterFocus(clusterFocus === c.id ? null : c.id)} />
                    ))}
                </div>
            </div>

            {/* ─── Pares de alta similaridade ─────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <Link2 className="w-4 h-4 text-rose-500" /> Pares de Alta Similaridade
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Top {data.paresAltaSimilaridade.length} pares com sobreposição evidente. Quanto maior a similaridade,
                        mais provável que uma evidência cobre os dois indicadores.
                    </p>
                </div>
                <div className="overflow-x-auto max-h-[420px]">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-[var(--accent)] sticky top-0">
                            <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Par</th>
                                <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Similaridade</th>
                                <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Mesma µ-área</th>
                                <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Mesma Pirâmide</th>
                                <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Periodicidade</th>
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Famílias comuns</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                            {data.paresAltaSimilaridade.map((p, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[var(--accent)]">
                                    <td className="px-4 py-3 font-mono">
                                        <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                            {p.a.split(" - ")[0]}
                                        </span>
                                        <span className="text-slate-400 dark:text-slate-500 mx-1.5">⇄</span>
                                        <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                            {p.b.split(" - ")[0]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="inline-flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full"
                                                    style={{ width: `${p.sim * 100}%`, background: p.sim >= 0.7 ? "#F4A8A8" : p.sim >= 0.5 ? "#F4C5A8" : "#A8C5E8" }} />
                                            </div>
                                            <span className="tabular-nums text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                                {(p.sim * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">{p.mesmaMicroArea ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                                    <td className="px-4 py-3 text-center">{p.mesmaPiramide ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                                    <td className="px-4 py-3 text-center">{p.mesmaPeriodicidade ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {p.familiasComuns.slice(0, 3).map(f => (
                                                <span key={f} className="px-1.5 py-0.5 rounded-md text-xs"
                                                    style={{ background: `${corFamilia(f)}33`, color: corFamilia(f), fontWeight: 600 }}>
                                                    {f.split(" / ")[0]}
                                                </span>
                                            ))}
                                            {p.familiasComuns.length > 3 && (
                                                <span className="text-xs text-slate-400">+{p.familiasComuns.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Ondas de coleta ────────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <Waves className="w-4 h-4 text-amber-500" /> Ondas de Coleta de Evidência
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Combinações <em>periodicidade × família</em> que englobam múltiplos indicadores —
                        oportunidade de organizar a coleta em "lotes".
                    </p>
                </div>
                <div className="overflow-x-auto max-h-[420px]">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-[var(--accent)] sticky top-0">
                            <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Periodicidade</th>
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Família</th>
                                <th className="px-4 py-3 text-right" style={{ fontWeight: 700 }}>Indicadores</th>
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Membros (preview)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                            {data.ondasColeta.map((o, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[var(--accent)]">
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded-md text-xs"
                                            style={{
                                                background: o.periodicidade === "MENSAL" ? "#A8F4C533" :
                                                    o.periodicidade === "TRIMESTRAL" ? "#F4E8A833" :
                                                        o.periodicidade === "SEMESTRAL" ? "#F4C5A833" :
                                                            o.periodicidade === "ANUAL" ? "#F4A8A833" : "#94A3B833",
                                                color: o.periodicidade === "MENSAL" ? "#22C55E" :
                                                    o.periodicidade === "TRIMESTRAL" ? "#CA8A04" :
                                                        o.periodicidade === "SEMESTRAL" ? "#EA580C" :
                                                            o.periodicidade === "ANUAL" ? "#DC2626" : "#64748B",
                                                fontWeight: 700,
                                            }}>
                                            {o.periodicidade}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ background: corFamilia(o.familia) }} />
                                            <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 600 }}>
                                                {o.familia}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200" style={{ fontWeight: 800 }}>
                                        {o.qtd}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                                        {o.indicadores.slice(0, 8).map(id => id.split(" - ")[0]).join(", ")}
                                        {o.indicadores.length > 8 && " …"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-center py-2">
                <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                    Análise gerada via TF-IDF + clustering hierárquico (linkage avg, distância ≤ {data.meta.distThreshold})
                </p>
            </div>
        </div>
    );
}

// ─── Diagrama de Rede SVG (radial layout) ────────────────────────────────
function ClusterGraph({ data, clusterFocus, setClusterFocus, isDark }: {
    data: ClustersData;
    clusterFocus: number | null;
    setClusterFocus: (id: number | null) => void;
    isDark: boolean;
}) {
    const W = 1100, H = 620;
    const CX = W / 2, CY = H / 2;

    // Posicionar cada cluster em torno de uma elipse macro
    const clustersComMembros = data.clusters; // já vem ordenado por tamanho
    const numClusters = clustersComMembros.length;

    // Posição de cada cluster (centroide)
    const clusterPositions = useMemo(() => {
        const pos = new Map<number, { x: number; y: number; r: number }>();
        // Clusters significativos (>=2) ficam em ring interno; singletons em ring externo
        const grandes = clustersComMembros.filter(c => c.tamanho >= 2);
        const pequenos = clustersComMembros.filter(c => c.tamanho < 2);

        // Ring interno
        const RA = 200, RB = 130;
        grandes.forEach((c, idx) => {
            const ang = (2 * Math.PI * idx) / Math.max(1, grandes.length) - Math.PI / 2;
            pos.set(c.id, {
                x: CX + RA * Math.cos(ang),
                y: CY + RB * Math.sin(ang),
                r: 18 + Math.sqrt(c.tamanho) * 8,
            });
        });

        // Ring externo (singletons distribuídos)
        const RA2 = 480, RB2 = 270;
        pequenos.forEach((c, idx) => {
            const ang = (2 * Math.PI * idx) / Math.max(1, pequenos.length) + Math.PI / 6;
            pos.set(c.id, {
                x: CX + RA2 * Math.cos(ang),
                y: CY + RB2 * Math.sin(ang),
                r: 8,
            });
        });
        return pos;
    }, [clustersComMembros]);

    // Posição de cada nó dentro do cluster
    const nodePositions = useMemo(() => {
        const pos = new Map<string, { x: number; y: number; cluster: number; node: GrafoNode }>();
        clustersComMembros.forEach(c => {
            const cp = clusterPositions.get(c.id);
            if (!cp) return;
            const members = data.grafo.nodes.filter(n => n.cluster === c.id);
            if (members.length === 1) {
                pos.set(members[0].id, { x: cp.x, y: cp.y, cluster: c.id, node: members[0] });
            } else {
                const r = cp.r + 10;
                members.forEach((m, idx) => {
                    const ang = (2 * Math.PI * idx) / members.length - Math.PI / 2;
                    pos.set(m.id, {
                        x: cp.x + r * Math.cos(ang),
                        y: cp.y + r * Math.sin(ang),
                        cluster: c.id,
                        node: m,
                    });
                });
            }
        });
        return pos;
    }, [data.grafo.nodes, clustersComMembros, clusterPositions]);

    const focusActive = clusterFocus !== null;
    const isHighlighted = (clusterId: number) => !focusActive || clusterId === clusterFocus;

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 800, height: 620 }}>
                {/* Background subtle */}
                <defs>
                    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={isDark ? "#1e293b" : "#F8FAFC"} stopOpacity="0.5" />
                        <stop offset="100%" stopColor={isDark ? "#0f172a" : "#FFFFFF"} stopOpacity="0" />
                    </radialGradient>
                </defs>
                <rect x={0} y={0} width={W} height={H} fill="url(#bgGrad)" />

                {/* Edges */}
                {data.grafo.edges.map((e, idx) => {
                    const sp = nodePositions.get(e.source);
                    const tp = nodePositions.get(e.target);
                    if (!sp || !tp) return null;
                    const highlight = isHighlighted(sp.cluster) && isHighlighted(tp.cluster);
                    return (
                        <line
                            key={idx}
                            x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                            stroke={isDark ? "#475569" : "#CBD5E1"}
                            strokeOpacity={highlight ? Math.min(0.7, e.sim) : 0.08}
                            strokeWidth={Math.max(0.6, e.sim * 2.5)}
                        />
                    );
                })}

                {/* Cluster halos (only for significant clusters) */}
                {clustersComMembros.filter(c => c.tamanho >= 2).map(c => {
                    const cp = clusterPositions.get(c.id);
                    if (!cp) return null;
                    const isFocus = clusterFocus === c.id;
                    const dim = focusActive && !isFocus ? 0.15 : 0.4;
                    return (
                        <g key={`halo-${c.id}`} style={{ cursor: "pointer" }} onClick={() => setClusterFocus(isFocus ? null : c.id)}>
                            <circle
                                cx={cp.x} cy={cp.y}
                                r={cp.r + 22}
                                fill={corFamilia(c.familiaDom)}
                                fillOpacity={dim * 0.5}
                                stroke={corFamilia(c.familiaDom)}
                                strokeOpacity={dim}
                                strokeWidth={1.5}
                                strokeDasharray="3,4"
                            />
                            <text
                                x={cp.x} y={cp.y - cp.r - 28}
                                textAnchor="middle"
                                fontSize="11"
                                fill={isDark ? "#cbd5e1" : "#475569"}
                                style={{ fontWeight: 800, pointerEvents: "none" }}
                            >
                                C{c.id} · {c.microAreaDom}
                            </text>
                        </g>
                    );
                })}

                {/* Nodes */}
                {Array.from(nodePositions.values()).map(({ x, y, cluster, node }) => {
                    const familiaDom = node.familias[0] || "Documentos / Política / Carta";
                    const cor = corFamilia(familiaDom);
                    const highlight = isHighlighted(cluster);
                    const r = Math.max(4, Math.sqrt(node.pontos) * 1.6);
                    return (
                        <g key={node.id} style={{ cursor: "pointer" }}
                            onClick={() => setClusterFocus(clusterFocus === cluster ? null : cluster)}>
                            <title>
                                {`${node.id} · ${node.microArea} · ${node.piramide}\n` +
                                    `Pts: ${node.pontos} · ${node.periodicidade}\n` +
                                    `${node.descricao}`}
                            </title>
                            <circle
                                cx={x} cy={y} r={r}
                                fill={cor}
                                fillOpacity={highlight ? 0.95 : 0.18}
                                stroke={isDark ? "#0f172a" : "#FFFFFF"}
                                strokeWidth={highlight ? 1.2 : 0.6}
                            />
                            {highlight && r >= 6 && (
                                <text x={x} y={y + 3} textAnchor="middle"
                                    fontSize="8" fill={isDark ? "#0f172a" : "#1e293b"}
                                    style={{ fontWeight: 800, pointerEvents: "none" }}>
                                    {node.id.split(" - ")[0].replace(/\D/g, "").slice(-2)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
            {/* Legenda */}
            <div className="flex flex-wrap justify-center gap-3 mt-3 px-2">
                {Object.entries(FAMILIA_COR).map(([fam, cor]) => (
                    <span key={fam} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
                        {fam}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Card de cluster ──────────────────────────────────────────────────────
function ClusterCard({ cluster, indicadoresGrafo, highlight, onClick }: {
    cluster: ClusterUI;
    indicadoresGrafo: GrafoNode[];
    highlight?: boolean;
    onClick?: () => void;
}) {
    const cor = corFamilia(cluster.familiaDom);
    const membros = indicadoresGrafo.filter(n => n.cluster === cluster.id);

    return (
        <button
            onClick={onClick}
            className={classNames(
                "w-full text-left rounded-xl p-4 border transition-all",
                highlight
                    ? "border-indigo-300 dark:border-indigo-500/60 ring-2 ring-indigo-200 dark:ring-indigo-500/30"
                    : "border-slate-100 dark:border-[var(--sidebar-border)] hover:border-slate-200 dark:hover:border-slate-600",
            )}
            style={{ background: `${cor}10` }}
        >
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full mt-0.5" style={{ background: cor }} />
                    <div>
                        <p className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                            Cluster #{cluster.id} · {cluster.microAreaDom}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                            {cluster.familiaDom} · {cluster.piramideDom} · {cluster.periodicidadeDom}
                        </p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-2xl tabular-nums text-slate-800 dark:text-slate-100 leading-none" style={{ fontWeight: 900 }}>
                        {cluster.tamanho}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500" style={{ fontWeight: 600 }}>
                        {cluster.pontosTotais} pts
                    </p>
                </div>
            </div>
            <div className="space-y-1.5">
                {membros.slice(0, 6).map(m => (
                    <div key={m.id} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0 w-12" style={{ fontWeight: 700 }}>
                            {m.id.split(" - ")[0]}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 line-clamp-1" style={{ fontWeight: 500 }}>
                            {m.descricao}
                        </span>
                    </div>
                ))}
                {membros.length > 6 && (
                    <p className="text-xs text-slate-400 italic mt-1">+{membros.length - 6} indicadores</p>
                )}
            </div>
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW DE RESULTADOS (assessment de abril)
// ═══════════════════════════════════════════════════════════════════════════

const REVENDA_COR: Record<string, string> = {
    "Duttra MA": "#6C8EF5",
    "Duttra FL": "#34C78A",
    "Duttra SRN": "#A78BFA",
    "Forte QX": "#F5956C",
    "Forte AR": "#F472B6",
};

function corRevenda(rev: string): string {
    return REVENDA_COR[rev] || "#94A3B8";
}

function pctColor(pct: number): string {
    if (pct >= 80) return "#22C55E";   // verde
    if (pct >= 60) return "#84CC16";   // verde-lima
    if (pct >= 40) return "#EAB308";   // amarelo
    if (pct >= 20) return "#F97316";   // laranja
    return "#EF4444";                  // vermelho
}

const MESES_RES = [
    { num: 1, label: "Jan" }, { num: 2, label: "Fev" }, { num: 3, label: "Mar" },
    { num: 4, label: "Abr" }, { num: 5, label: "Mai" }, { num: 6, label: "Jun" },
    { num: 7, label: "Jul" }, { num: 8, label: "Ago" }, { num: 9, label: "Set" },
    { num: 10, label: "Out" }, { num: 11, label: "Nov" }, { num: 12, label: "Dez" },
] as const;

function ResultadosView({ isDark, cardBorder, cardShadow }: {
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
    palette: string[];
}) {
    const hoje = new Date();
    const [selectedAno, setSelectedAno] = useState(hoje.getFullYear());
    const [selectedMes, setSelectedMes] = useState(hoje.getMonth() + 1);

    // Filtros
    const [fRevendas, setFRevendas] = useState<string[]>([]);
    const [fPadrinhos, setFPadrinhos] = useState<string[]>([]);
    const [fMacro, setFMacro] = useState<string>("");
    const [fMicro, setFMicro] = useState<string>("");
    const [fPiramide, setFPiramide] = useState<string>("");
    const [fStatusEvid, setFStatusEvid] = useState<string>("");
    const [busca, setBusca] = useState("");

    const dbQuery = trpc.assessment.listAll.useQuery(
        { ano: selectedAno, mes: selectedMes },
        { retry: false },
    );

    const respostas = useMemo<RespostaResultado[]>(() =>
        (dbQuery.data ?? []).map(r => ({
            data:                r.data ?? `${r.ano}-${String(r.mes).padStart(2, "0")}-01`,
            operacao:            r.operacao ?? 0,
            revenda:             r.revenda,
            shortId:             r.item,
            item:                r.item,
            autoavaliacao:       (r.autoavaliacao ?? "Não") as "Sim" | "Não",
            evidencia:           (r.evidencia ?? "Não") as "Sim" | "Não",
            padrinho:            r.padrinho || "Sem padrinho",
            hora:                r.horaCheck ?? null,
            macroArea:           r.macroArea ?? "",
            microArea:           r.microArea ?? "",
            piramide:            r.piramide ?? "",
            descricao:           r.descricao ?? "",
            tipoResposta:        r.tipoResposta ?? "",
            pontoPossivel:       r.pontoPossivel ?? 0,
            pontosEvidencia:     r.pontosEvidencia ?? 0,
            pontosAutoavaliacao: r.pontosAutoavaliacao ?? 0,
        })),
    [dbQuery.data]);

    const todasRevendas  = useMemo(() => [...new Set(respostas.map(r => r.revenda))].sort(), [respostas]);
    const todosPadrinhos = useMemo(() =>
        [...new Set(respostas.map(r => r.padrinho).filter(p => p && p !== "Sem padrinho"))].sort(),
    [respostas]);

    // Opções de filtro
    const opcMacro = useMemo(() => Array.from(new Set(respostas.map(r => r.macroArea))).sort(), [respostas]);
    const opcMicro = useMemo(() => {
        const base = fMacro ? respostas.filter(r => r.macroArea === fMacro) : respostas;
        return Array.from(new Set(base.map(r => r.microArea))).sort();
    }, [respostas, fMacro]);
    const opcPiramide = useMemo(() => Array.from(new Set(respostas.map(r => r.piramide))).sort(), [respostas]);

    // Filtragem
    const filtradas = useMemo(() => {
        const q = busca.toLowerCase().trim();
        return respostas.filter(r => {
            if (fRevendas.length > 0 && !fRevendas.includes(r.revenda)) return false;
            if (fPadrinhos.length > 0 && !fPadrinhos.includes(r.padrinho)) return false;
            if (fMacro && r.macroArea !== fMacro) return false;
            if (fMicro && r.microArea !== fMicro) return false;
            if (fPiramide && r.piramide !== fPiramide) return false;
            if (fStatusEvid === "sim" && r.evidencia !== "Sim") return false;
            if (fStatusEvid === "nao" && r.evidencia !== "Não") return false;
            if (q) {
                const blob = `${r.shortId} ${r.descricao} ${r.revenda} ${r.microArea} ${r.padrinho}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }, [respostas, fRevendas, fPadrinhos, fMacro, fMicro, fPiramide, fStatusEvid, busca]);

    const temFiltro = !!(fRevendas.length || fPadrinhos.length || fMacro || fMicro || fPiramide || fStatusEvid || busca);
    const limparFiltros = () => {
        setFRevendas([]); setFPadrinhos([]); setFMacro(""); setFMicro("");
        setFPiramide(""); setFStatusEvid(""); setBusca("");
    };

    // KPIs
    const totalPossivel = filtradas.reduce((s, r) => s + r.pontoPossivel, 0);
    const totalEvid = filtradas.reduce((s, r) => s + r.pontosEvidencia, 0);
    const totalAuto = filtradas.reduce((s, r) => s + r.pontosAutoavaliacao, 0);
    const pctEvid = totalPossivel > 0 ? Math.round(totalEvid / totalPossivel * 100) : 0;
    const totalEvidSim = filtradas.filter(r => r.evidencia === "Sim").length;
    const totalAutoSim = filtradas.filter(r => r.autoavaliacao === "Sim").length;
    const totalIndicadores = filtradas.length;

    // Ranking de revendas
    const rankingRevendas = useMemo(() => {
        const map = new Map<string, { possivel: number; evid: number; auto: number; simEvid: number; simAuto: number; total: number }>();
        filtradas.forEach(r => {
            const cur = map.get(r.revenda) || { possivel: 0, evid: 0, auto: 0, simEvid: 0, simAuto: 0, total: 0 };
            cur.possivel += r.pontoPossivel;
            cur.evid += r.pontosEvidencia;
            cur.auto += r.pontosAutoavaliacao;
            cur.total += 1;
            if (r.evidencia === "Sim") cur.simEvid += 1;
            if (r.autoavaliacao === "Sim") cur.simAuto += 1;
            map.set(r.revenda, cur);
        });
        return Array.from(map.entries())
            .map(([rev, s]) => ({
                revenda: rev,
                possivel: s.possivel,
                evid: s.evid,
                auto: s.auto,
                pctEvid: s.possivel > 0 ? Math.round(s.evid / s.possivel * 100) : 0,
                pctAuto: s.possivel > 0 ? Math.round(s.auto / s.possivel * 100) : 0,
                simEvid: s.simEvid,
                simAuto: s.simAuto,
                total: s.total,
            }))
            .sort((a, b) => b.evid - a.evid);
    }, [filtradas]);

    const melhorRevenda = rankingRevendas[0];
    const piorRevenda = rankingRevendas[rankingRevendas.length - 1];

    // Pontos por Micro-Área (agrupado por revenda)
    const microPorRevenda = useMemo(() => {
        const map = new Map<string, Record<string, number>>();
        const microSet = new Set<string>();
        const possiveis = new Map<string, number>();

        filtradas.forEach(r => {
            microSet.add(r.microArea);
            possiveis.set(r.microArea, (possiveis.get(r.microArea) || 0) + r.pontoPossivel);
            if (!map.has(r.microArea)) map.set(r.microArea, {});
            const inner = map.get(r.microArea)!;
            inner[r.revenda] = (inner[r.revenda] || 0) + r.pontosEvidencia;
        });

        const revendasList = Array.from(new Set(filtradas.map(r => r.revenda)));
        const arr = Array.from(microSet).sort().map(micro => {
            const row: Record<string, number | string> = { name: micro, possivel: possiveis.get(micro) || 0 };
            revendasList.forEach(rev => {
                row[rev] = map.get(micro)?.[rev] || 0;
            });
            return row;
        });
        return { rows: arr, revendas: revendasList };
    }, [filtradas]);

    // Qtd de evidências respondidas vs total por micro-área
    const evidQtdPorMicro = useMemo(() => {
        const map = new Map<string, { respondida: number; total: number }>();
        filtradas.forEach(r => {
            const cur = map.get(r.microArea) || { respondida: 0, total: 0 };
            cur.total += 1;
            if (r.evidencia === "Sim") cur.respondida += 1;
            map.set(r.microArea, cur);
        });
        return Array.from(map.entries())
            .map(([micro, v]) => ({
                name: micro,
                respondida: v.respondida,
                total: v.total,
                pendente: v.total - v.respondida,
                pct: v.total > 0 ? Math.round(v.respondida / v.total * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total);
    }, [filtradas]);

    // Pontos por Pirâmide
    const piramideData = useMemo(() => {
        const map = new Map<string, { evid: number; possivel: number }>();
        filtradas.forEach(r => {
            const cur = map.get(r.piramide) || { evid: 0, possivel: 0 };
            cur.evid += r.pontosEvidencia;
            cur.possivel += r.pontoPossivel;
            map.set(r.piramide, cur);
        });
        return Array.from(map.entries())
            .map(([k, v]) => ({
                name: k,
                evid: v.evid,
                possivel: v.possivel,
                pct: v.possivel > 0 ? Math.round(v.evid / v.possivel * 100) : 0,
                fill: PIRAMIDE_COR[k] || "#94A3B8",
            }))
            .sort((a, b) => b.possivel - a.possivel);
    }, [filtradas]);

    // Performance por padrinho
    const padrinhoStats = useMemo(() => {
        const map = new Map<string, { simEvid: number; total: number; pontos: number }>();
        filtradas.filter(r => r.padrinho && r.padrinho !== "Sem padrinho").forEach(r => {
            const cur = map.get(r.padrinho) || { simEvid: 0, total: 0, pontos: 0 };
            cur.total += 1;
            if (r.evidencia === "Sim") {
                cur.simEvid += 1;
                cur.pontos += r.pontosEvidencia;
            }
            map.set(r.padrinho, cur);
        });
        return Array.from(map.entries())
            .map(([nome, s]) => ({ nome, ...s, pctSim: s.total > 0 ? Math.round(s.simEvid / s.total * 100) : 0 }))
            .sort((a, b) => b.pontos - a.pontos);
    }, [filtradas]);

    // Heatmap: Revenda × Micro-Área (% de aderência)
    const heatmap = useMemo(() => {
        const microSet = new Set<string>();
        const map = new Map<string, Map<string, { evid: number; possivel: number }>>();
        filtradas.forEach(r => {
            microSet.add(r.microArea);
            if (!map.has(r.revenda)) map.set(r.revenda, new Map());
            const inner = map.get(r.revenda)!;
            const cur = inner.get(r.microArea) || { evid: 0, possivel: 0 };
            cur.evid += r.pontosEvidencia;
            cur.possivel += r.pontoPossivel;
            inner.set(r.microArea, cur);
        });
        const revendasList = Array.from(map.keys()).sort();
        const microList = Array.from(microSet).sort();
        return {
            revendas: revendasList,
            micros: microList,
            cells: revendasList.map(rev => microList.map(micro => {
                const cell = map.get(rev)?.get(micro);
                if (!cell || cell.possivel === 0) return { pct: 0, evid: 0, possivel: 0, hasData: false };
                return { pct: Math.round(cell.evid / cell.possivel * 100), evid: cell.evid, possivel: cell.possivel, hasData: true };
            })),
        };
    }, [filtradas]);

    const tickColor = isDark ? "#64748B" : "#94A3B8";
    const gridColor = isDark ? "#1E2A3A" : "#F1F5F9";

    const toggleRevenda = (rev: string) => {
        setFRevendas(prev => prev.includes(rev) ? prev.filter(r => r !== rev) : [...prev, rev]);
    };
    const togglePadrinho = (p: string) => {
        setFPadrinhos(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    if (dbQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-60 bg-white dark:bg-[var(--card)] rounded-2xl"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
            </div>
        );
    }

    const anos = [hoje.getFullYear(), hoje.getFullYear() - 1];

    return (
        <div className="space-y-6">
            {/* Seletor de período */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-4 flex flex-wrap items-center gap-3"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Período</span>
                <div className="flex gap-1">
                    {MESES_RES.map(m => (
                        <button key={m.num}
                            onClick={() => setSelectedMes(m.num)}
                            className={classNames(
                                "text-xs px-2.5 py-1 rounded-lg border transition-all",
                                selectedMes === m.num
                                    ? "bg-indigo-500 text-white border-indigo-500"
                                    : "bg-white dark:bg-[var(--card)] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                            )}
                            style={{ fontWeight: 700 }}>{m.label}</button>
                    ))}
                </div>
                <select value={selectedAno} onChange={e => setSelectedAno(Number(e.target.value))}
                    className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none dark:text-slate-200"
                    style={{ fontWeight: 700 }}>
                    {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {dbQuery.isFetching && (
                    <span className="text-xs text-indigo-400 animate-pulse ml-1">Carregando…</span>
                )}
                <span className="ml-auto text-xs text-slate-400" style={{ fontWeight: 500 }}>
                    {respostas.length} respostas
                </span>
            </div>

            {respostas.length === 0 && !dbQuery.isFetching && (
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-10 text-center"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Nenhum dado para {MESES_RES[selectedMes - 1].label}/{selectedAno}.
                        Execute <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">check.py --sync</code> para importar.
                    </p>
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 space-y-3"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>
                    <Filter className="w-3.5 h-3.5" /> Filtros · {filtradas.length} de {respostas.length} respostas
                    {temFiltro && (
                        <button onClick={limparFiltros}
                            className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--accent)]"
                            style={{ fontWeight: 600 }}>
                            <X className="w-3.5 h-3.5" /> Limpar
                        </button>
                    )}
                </div>

                <div className="flex items-start gap-3">
                    <label className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 shrink-0 w-20" style={{ fontWeight: 600 }}>Revendas</label>
                    <div className="flex flex-wrap gap-1.5">
                        {todasRevendas.map(rev => {
                            const active = fRevendas.includes(rev);
                            const cor = corRevenda(rev);
                            return (
                                <button key={rev}
                                    onClick={() => toggleRevenda(rev)}
                                    className={classNames(
                                        "text-xs px-2.5 py-1 rounded-lg transition-all border",
                                        active
                                            ? "text-white"
                                            : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                                    )}
                                    style={{
                                        fontWeight: 700,
                                        background: active ? cor : undefined,
                                        borderColor: active ? cor : isDark ? "var(--border)" : "#E2E8F0",
                                    }}>
                                    <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                                        style={{ background: active ? "white" : cor }} />
                                    {rev}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <label className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 shrink-0 w-20" style={{ fontWeight: 600 }}>Padrinhos</label>
                    <div className="flex flex-wrap gap-1.5">
                        {todosPadrinhos.map(p => {
                            const active = fPadrinhos.includes(p);
                            return (
                                <button key={p}
                                    onClick={() => togglePadrinho(p)}
                                    className={classNames(
                                        "text-xs px-2.5 py-1 rounded-lg transition-all border",
                                        active
                                            ? "bg-indigo-500 text-white border-indigo-500"
                                            : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                                    )}
                                    style={{ fontWeight: 600 }}>
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Macro</label>
                        <select value={fMacro} onChange={e => { setFMacro(e.target.value); setFMicro(""); }}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                            <option value="">Todas</option>
                            {opcMacro.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Micro</label>
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
                        <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Evidência</label>
                        <select value={fStatusEvid} onChange={e => setFStatusEvid(e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                            <option value="">Todas</option>
                            <option value="sim">Atendeu (Sim)</option>
                            <option value="nao">Não atendeu</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 ml-auto bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-3 py-1.5">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <input type="text" placeholder="Buscar..."
                            value={busca} onChange={e => setBusca(e.target.value)}
                            className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none w-40"
                            style={{ fontWeight: 500 }} />
                        {busca && <button onClick={() => setBusca("")}><X className="w-3 h-3 text-slate-400" /></button>}
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KPI titulo={`% Aderência`} valor={`${pctEvid}%`} icone={Percent} cor="from-indigo-400 to-purple-400"
                    subtitulo={`${totalEvid}/${totalPossivel} pts`} />
                <KPI titulo="Evidências OK" valor={totalEvidSim} icone={CheckCircle2} cor="from-emerald-400 to-teal-400"
                    subtitulo={`${totalIndicadores ? Math.round(totalEvidSim / totalIndicadores * 100) : 0}% dos itens`} />
                <KPI titulo="Autoavaliações" valor={totalAutoSim} icone={UserCheck} cor="from-blue-400 to-cyan-400"
                    subtitulo={`${totalPossivel ? Math.round(totalAuto / totalPossivel * 100) : 0}% pts auto`} />
                <KPI titulo="Melhor Revenda"
                    valor={melhorRevenda ? `${melhorRevenda.pctEvid}%` : "—"}
                    icone={Crown} cor="from-amber-400 to-orange-400"
                    subtitulo={melhorRevenda ? melhorRevenda.revenda : ""} />
                <KPI titulo="Crítica"
                    valor={piorRevenda ? `${piorRevenda.pctEvid}%` : "—"}
                    icone={TrendingDown} cor="from-rose-400 to-pink-400"
                    subtitulo={piorRevenda ? piorRevenda.revenda : ""} />
            </div>

            {/* Ranking */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <Trophy className="w-4 h-4 text-amber-500" /> Ranking de Revendas
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Aderência por evidência (% dos pontos possíveis atingidos)
                    </p>
                </div>
                <div className="space-y-3">
                    {rankingRevendas.map((r, idx) => {
                        const cor = corRevenda(r.revenda);
                        return (
                            <div key={r.revenda} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={classNames(
                                            "inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs",
                                            idx === 0 ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                                                idx === 1 ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" :
                                                    idx === 2 ? "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300" :
                                                        "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                                        )} style={{ fontWeight: 900 }}>
                                            {idx + 1}
                                        </span>
                                        {idx === 0 && <Medal className="w-3.5 h-3.5 text-amber-500" />}
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
                                        <span className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 700 }}>
                                            {r.revenda}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="text-slate-500 dark:text-slate-400">
                                            <span style={{ fontWeight: 700 }}>{r.simEvid}/{r.total}</span> evid
                                        </span>
                                        <span className="tabular-nums text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                            {r.evid}/{r.possivel} pts
                                        </span>
                                        <span className="tabular-nums w-12 text-right" style={{ fontWeight: 900, color: pctColor(r.pctEvid) }}>
                                            {r.pctEvid}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all"
                                        style={{ width: `${r.pctEvid}%`, background: `linear-gradient(90deg, ${cor}, ${pctColor(r.pctEvid)})` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Qtd de evidências respondidas vs total por Micro-Área */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4 flex items-start justify-between gap-2 flex-wrap">
                    <div>
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <ClipboardList className="w-4 h-4 text-cyan-500" /> Quantidade de Evidências Respondidas por Micro-Área
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Itens com evidência "Sim" vs total de indicadores na micro-área (recorte do filtro)
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#34C78A" }} /> Respondida
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: isDark ? "#475569" : "#CBD5E1" }} /> Pendente
                        </span>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(300, evidQtdPorMicro.length * 28 + 80)}>
                    <BarChart data={evidQtdPorMicro} margin={{ top: 24, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false}
                            interval={0} angle={-30} textAnchor="end" height={70} />
                        <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                            cursor={{ fill: "rgba(99,102,241,0.06)" }}
                            contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                            formatter={(v: number, name: string, props: any) => {
                                if (name === "respondida") return [`${v} de ${props.payload.total} (${props.payload.pct}%)`, "Respondidas"];
                                if (name === "pendente") return [`${v} de ${props.payload.total}`, "Pendentes"];
                                return [v, name];
                            }}
                        />
                        <Bar dataKey="respondida" name="respondida" stackId="evid" fill="#34C78A" radius={[0, 0, 0, 0]}>
                            <LabelList dataKey="respondida" position="inside" style={{ fontSize: 11, fill: "#fff", fontWeight: 800 }}
                                formatter={(v: any) => Number(v) > 0 ? v : ""} />
                        </Bar>
                        <Bar dataKey="pendente" name="pendente" stackId="evid" fill={isDark ? "#475569" : "#CBD5E1"} radius={[4, 4, 0, 0]}>
                            <LabelList dataKey="total" position="top" style={{ fontSize: 11, fill: tickColor, fontWeight: 800 }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Pontos por Micro-Área */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <BarChart3 className="w-4 h-4 text-indigo-500" /> Pontos Conquistados por Micro-Área
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Pontos via evidência por revenda
                    </p>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(280, microPorRevenda.rows.length * 50)}>
                    <BarChart data={microPorRevenda.rows} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: tickColor }}
                            width={140} axisLine={false} tickLine={false} />
                        <Tooltip
                            cursor={{ fill: "rgba(99,102,241,0.06)" }}
                            contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {microPorRevenda.revendas.map(rev => (
                            <Bar key={rev} dataKey={rev} name={rev} fill={corRevenda(rev)} radius={[0, 4, 4, 0]} >
                                <LabelList dataKey={rev} position="right" style={{ fontSize: 12, fill: tickColor, fontWeight: 800 }} />
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Pirâmide + Padrinho */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <div className="mb-4">
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <Target className="w-4 h-4 text-purple-500" /> Aderência por Pirâmide
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Pontos conquistados vs possíveis
                        </p>
                    </div>
                    <div className="space-y-3">
                        {piramideData.map(p => (
                            <div key={p.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
                                        <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-500 dark:text-slate-400 tabular-nums">{p.evid}/{p.possivel}</span>
                                        <span className="tabular-nums w-10 text-right" style={{ fontWeight: 900, color: pctColor(p.pct) }}>{p.pct}%</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: p.fill }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <div className="mb-4">
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <Users className="w-4 h-4 text-emerald-500" /> Performance por Padrinho
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Indicadores patrocinados e % atendido
                        </p>
                    </div>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {padrinhoStats.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">Sem padrinhos no recorte atual</p>
                        ) : padrinhoStats.map((p, idx) => (
                            <div key={p.nome} className="flex items-center gap-3 text-xs">
                                <span className="w-5 text-slate-400 tabular-nums" style={{ fontWeight: 700 }}>{idx + 1}.</span>
                                <span className="flex-1 text-slate-700 dark:text-slate-200 truncate" style={{ fontWeight: 600 }}>{p.nome}</span>
                                <span className="text-slate-500 dark:text-slate-400 tabular-nums">{p.simEvid}/{p.total}</span>
                                <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full" style={{ width: `${p.pctSim}%`, background: pctColor(p.pctSim) }} />
                                </div>
                                <span className="tabular-nums w-10 text-right" style={{ fontWeight: 800, color: pctColor(p.pctSim) }}>{p.pctSim}%</span>
                                <span className="tabular-nums text-slate-400 text-[10px] w-12 text-right">{p.pontos} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <LayersIcon className="w-4 h-4 text-rose-500" /> Heatmap · Revenda × Micro-Área
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        % de aderência. Verde = forte, vermelho = gap crítico.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr>
                                <th className="px-2 py-2 text-left text-slate-500 dark:text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                                    Revenda
                                </th>
                                {heatmap.micros.map(m => (
                                    <th key={m} className="px-2 py-2 text-center text-slate-500 dark:text-slate-400 text-[10px] tracking-wider" style={{ fontWeight: 700 }}>
                                        {m}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {heatmap.revendas.map((rev, ri) => (
                                <tr key={rev} className="border-t border-slate-100 dark:border-[var(--sidebar-border)]">
                                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap" style={{ fontWeight: 700 }}>
                                        <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                                            style={{ background: corRevenda(rev) }} />
                                        {rev}
                                    </td>
                                    {heatmap.cells[ri].map((cell, ci) => {
                                        const cor = cell.hasData ? pctColor(cell.pct) : "#E5E7EB";
                                        const opacity = cell.hasData ? Math.max(0.18, cell.pct / 100) : 0.25;
                                        return (
                                            <td key={ci} className="px-1 py-1 text-center">
                                                <div className="rounded-md px-1.5 py-2 flex flex-col items-center justify-center"
                                                    style={{
                                                        background: cell.hasData ? `${cor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}` : (isDark ? "#1e293b" : "#F8FAFC"),
                                                        border: `1px solid ${cell.hasData ? cor : isDark ? "#334155" : "#E5E7EB"}`,
                                                        minWidth: 56,
                                                    }}
                                                    title={cell.hasData ? `${rev} · ${heatmap.micros[ci]}\n${cell.evid}/${cell.possivel} pts (${cell.pct}%)` : "sem dados"}>
                                                    <span className="tabular-nums text-sm"
                                                        style={{ fontWeight: 900, color: cell.hasData ? cor : "#94A3B8" }}>
                                                        {cell.hasData ? `${cell.pct}%` : "—"}
                                                    </span>
                                                    {cell.hasData && (
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                            {cell.evid}/{cell.possivel}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tabela detalhada */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base" style={{ fontWeight: 800 }}>
                        Respostas detalhadas
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {filtradas.length} respostas no filtro atual · {MESES_RES[selectedMes - 1].label}/{selectedAno}
                    </p>
                </div>
                <div className="overflow-x-auto max-h-[520px]">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-[var(--accent)] sticky top-0 z-10">
                            <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Revenda</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>ID</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Micro</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Pirâmide</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Descrição</th>
                                <th className="px-3 py-2.5 text-center" style={{ fontWeight: 700 }}>Auto</th>
                                <th className="px-3 py-2.5 text-center" style={{ fontWeight: 700 }}>Evid.</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Padrinho</th>
                                <th className="px-3 py-2.5 text-right" style={{ fontWeight: 700 }}>Pts</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                            {filtradas.map((r, idx) => {
                                const corP = PIRAMIDE_COR[r.piramide] || "#94A3B8";
                                const corR = corRevenda(r.revenda);
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[var(--accent)]">
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                                                style={{ background: corR }} />
                                            <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 600 }}>{r.revenda}</span>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                            {r.shortId}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.microArea}</td>
                                        <td className="px-3 py-2">
                                            <span className="px-1.5 py-0.5 rounded-md text-xs"
                                                style={{ background: `${corP}33`, color: corP, fontWeight: 700 }}>
                                                {r.piramide}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 max-w-xs">
                                            <p className="text-slate-600 dark:text-slate-300 truncate" style={{ fontWeight: 500 }}>
                                                {r.descricao}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {r.autoavaliacao === "Sim"
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                : <X className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {r.evidencia === "Sim"
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                : <X className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-[11px]">
                                            {r.padrinho === "Sem padrinho" ? <span className="italic text-slate-300 dark:text-slate-600">—</span> : r.padrinho}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            <span className={r.pontosEvidencia > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}
                                                style={{ fontWeight: 700 }}>
                                                {r.pontosEvidencia}/{r.pontoPossivel}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-center py-2">
                <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                    MetricFlow · Resultados Assessment · {MESES_RES[selectedMes - 1].label}/{selectedAno} · {respostas.length} respostas
                </p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// RespostasView — formulário CRUD de respostas mensais por revenda
// ─────────────────────────────────────────────────────────────────────────────

const MESES_R = [
    { num: 1, label: "Jan" }, { num: 2, label: "Fev" }, { num: 3, label: "Mar" },
    { num: 4, label: "Abr" }, { num: 5, label: "Mai" }, { num: 6, label: "Jun" },
    { num: 7, label: "Jul" }, { num: 8, label: "Ago" }, { num: 9, label: "Set" },
    { num: 10, label: "Out" }, { num: 11, label: "Nov" }, { num: 12, label: "Dez" },
] as const;

type RowState = {
    autoavaliacao: "Sim" | "Não";
    evidencia: "Sim" | "Não";
    padrinho: string;
    hora: string;
    data: string;
    pontosEvidencia: number;
    pontosAutoavaliacao: number;
    pontoPossivel: number;
    saving: boolean;
    saved: boolean;
};

function RespostasView({ data, indicadores, dbRevendas, isDark: _dark, cardBorder, cardShadow: _cs }: {
    data: ResultadosData | null;
    indicadores: Indicador[];
    dbRevendas: { id: number; nome: string; codigo: string }[];
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
}) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    // Até o dia 10 do mês ainda estamos no prazo de lançar evidências do mês anterior
    const inGracePeriod = today.getDate() <= 10;
    const defaultMes = inGracePeriod ? (currentMonth === 1 ? 12 : currentMonth - 1) : currentMonth;
    const defaultAno = inGracePeriod && currentMonth === 1 ? currentYear - 1 : currentYear;

    // ── Seleção ────────────────────────────────────────────────────────────
    const [selectedAno, setSelectedAno] = useState<number>(defaultAno);
    const [selectedRevenda, setSelectedRevenda] = useState<string>("");
    const [selectedMes, setSelectedMes] = useState<number>(defaultMes);

    // ── Filtros linha 2 ────────────────────────────────────────────────────
    const [fBusca, setFBusca] = useState("");
    const [fMacro, setFMacro] = useState("");
    const [fMicro, setFMicro] = useState("");
    const [fPiramide, setFPiramide] = useState("");
    const [fEvid, setFEvid] = useState("");
    const [fAutoav, setFAutoav] = useState("");

    // ── Padrinhos ──────────────────────────────────────────────────────────
    const [padrinhos, setPadrinhos] = useState<string[]>(["Sem padrinho"]);
    const [novoInput, setNovoInput] = useState<{ rowKey: string; text: string } | null>(null);

    // ── Estado editável das linhas ─────────────────────────────────────────
    const [rows, setRows] = useState<Record<string, RowState>>({});
    const initRef = useRef("");

    // ── tRPC ───────────────────────────────────────────────────────────────
    const dbQuery = trpc.assessment.list.useQuery(
        { revenda: selectedRevenda, ano: selectedAno, mes: selectedMes },
        { enabled: !!selectedRevenda, retry: false },
    );
    const upsert = trpc.assessment.upsert.useMutation({
        onError: () => toast.error("Erro ao salvar. Verifique a conexão com o banco."),
    });

    // ── Anos disponíveis ───────────────────────────────────────────────────
    const anos = useMemo(() => {
        const ys = new Set<number>([currentYear]);
        data?.respostas.forEach(r => ys.add(Number(r.data.split("-")[0])));
        return Array.from(ys).sort((a, b) => b - a);
    }, [data, currentYear]);

    const revendas = dbRevendas.length > 0
        ? dbRevendas.map(r => r.nome)
        : (data?.revendas ?? []);

    // ── Mapa revenda → operação (derivado das respostas do JSON) ───────────
    const revendaOpMap = useMemo(() => {
        const map: Record<string, number> = {};
        data?.respostas.forEach(r => { map[r.revenda] = r.operacao; });
        return map;
    }, [data]);

    // ── Meses com dados ────────────────────────────────────────────────────
    const mesesComDados = useMemo(() => {
        const s = new Set<number>();
        data?.respostas.forEach(r => {
            const [yr, mo] = r.data.split("-").map(Number);
            if (yr !== selectedAno) return;
            if (selectedRevenda && r.revenda !== selectedRevenda) return;
            s.add(mo);
        });
        dbQuery.data?.forEach(d => { if (d.mes) s.add(d.mes); });
        return s;
    }, [data, selectedAno, selectedRevenda, dbQuery.data]);

    // ── Lista completa de 92 indicadores para a revenda selecionada ────────
    // Fonte: assessment_indicadores.json (todos os indicadores, incluindo os
    // não respondidos no resultados.json)
    const baseIndicadores = useMemo<RespostaResultado[]>(() => {
        if (!selectedRevenda || !indicadores.length) return [];
        const operacao = revendaOpMap[selectedRevenda] ?? 0;
        const mesStr = String(selectedMes).padStart(2, "0");

        // Filtra indicadores pelo número de operação da revenda, deduplica por código
        const seen = new Set<string>();
        const indRevenda = indicadores.filter(i => {
            if (operacao && Number(i.idOperacao) !== operacao) return false;
            const cod = i.idIndicador.split(" - ")[0].trim();
            if (seen.has(cod)) return false;
            seen.add(cod);
            return true;
        });

        return indRevenda.map(i => {
            const itemCode = i.idIndicador.split(" - ")[0].trim(); // "ADM01"

            // Tenta encontrar resposta existente no JSON para o mês/revenda
            const existing = data?.respostas.find(r =>
                r.revenda === selectedRevenda &&
                r.item === itemCode &&
                Number(r.data.split("-")[0]) === selectedAno &&
                Number(r.data.split("-")[1]) === selectedMes,
            );
            if (existing) return existing;

            // Template zerado para meses sem dados
            return {
                data: `${selectedAno}-${mesStr}-01`,
                operacao,
                revenda: selectedRevenda,
                shortId: itemCode,
                item: itemCode,
                autoavaliacao: "Não",
                evidencia: "Não",
                padrinho: "Sem padrinho",
                hora: null,
                macroArea: i.macroArea,
                microArea: i.microArea,
                piramide: i.piramide,
                descricao: i.descricaoItem,
                tipoResposta: i.tipoResposta,
                pontoPossivel: i.pontoPossivel,
                pontosEvidencia: 0,
                pontosAutoavaliacao: 0,
            } as RespostaResultado;
        });
    }, [indicadores, selectedRevenda, selectedAno, selectedMes, data, revendaOpMap]);

    // ── Inicializar rows (DB → JSON → vazio) ───────────────────────────────
    const selKey = `${selectedRevenda}|${selectedAno}|${selectedMes}`;
    useEffect(() => {
        const dbRows = dbQuery.data;
        const k = selKey + (dbRows !== undefined ? "|db" : "|seed");
        if (initRef.current === k) return;
        initRef.current = k;
        const next: Record<string, RowState> = {};
        baseIndicadores.forEach(r => {
            const db = dbRows?.find(d => d.item === r.item);
            next[r.item] = db ? {
                autoavaliacao: (db.autoavaliacao ?? "Não") as "Sim" | "Não",
                evidencia: (db.evidencia ?? "Não") as "Sim" | "Não",
                padrinho: db.padrinho ?? "Sem padrinho",
                hora: db.horaCheck ?? "",
                data: db.data ?? r.data,
                pontosEvidencia: db.pontosEvidencia ?? 0,
                pontosAutoavaliacao: db.pontosAutoavaliacao ?? 0,
                pontoPossivel: r.pontoPossivel,
                saving: false, saved: false,
            } : {
                autoavaliacao: r.autoavaliacao as "Sim" | "Não",
                evidencia: r.evidencia as "Sim" | "Não",
                padrinho: r.padrinho ?? "Sem padrinho",
                hora: r.hora ?? "",
                data: r.data,
                pontosEvidencia: r.pontosEvidencia,
                pontosAutoavaliacao: r.pontosAutoavaliacao,
                pontoPossivel: r.pontoPossivel,
                saving: false, saved: false,
            };
        });
        setRows(next);
    }, [baseIndicadores, dbQuery.data, selKey]);

    // ── Padrinhos do JSON ──────────────────────────────────────────────────
    useEffect(() => {
        if (!data?.padrinhos) return;
        setPadrinhos(prev => Array.from(new Set(["Sem padrinho", ...data.padrinhos, ...prev])));
    }, [data]);

    // ── Limpar filtros ao mudar seleção ────────────────────────────────────
    useEffect(() => {
        setFBusca(""); setFMacro(""); setFMicro(""); setFPiramide(""); setFEvid(""); setFAutoav("");
    }, [selectedRevenda, selectedAno, selectedMes]);

    // ── Opções dos selects de filtro ───────────────────────────────────────
    const opcMacro = useMemo(() => Array.from(new Set(baseIndicadores.map(r => r.macroArea))).sort(), [baseIndicadores]);
    const opcMicro = useMemo(() => {
        const b = fMacro ? baseIndicadores.filter(r => r.macroArea === fMacro) : baseIndicadores;
        return Array.from(new Set(b.map(r => r.microArea))).sort();
    }, [baseIndicadores, fMacro]);
    const opcPiramide = useMemo(() => Array.from(new Set(baseIndicadores.map(r => r.piramide))).sort(), [baseIndicadores]);

    // ── Filtro aplicado ────────────────────────────────────────────────────
    const indicadoresFiltrados = useMemo(() => {
        const q = fBusca.toLowerCase().trim();
        return baseIndicadores.filter(r => {
            if (fMacro && r.macroArea !== fMacro) return false;
            if (fMicro && r.microArea !== fMicro) return false;
            if (fPiramide && r.piramide !== fPiramide) return false;
            const st = rows[r.item];
            if (fEvid && st?.evidencia !== fEvid) return false;
            if (fAutoav && st?.autoavaliacao !== fAutoav) return false;
            if (q) {
                const blob = `${r.item} ${r.descricao} ${r.microArea} ${st?.padrinho ?? ""}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }, [baseIndicadores, fMacro, fMicro, fPiramide, fEvid, fAutoav, fBusca, rows]);

    const temFiltro = !!(fBusca || fMacro || fMicro || fPiramide || fEvid || fAutoav);

    // ── KPIs ───────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        let evidSim = 0, autoavSim = 0, ptEvid = 0, ptPoss = 0;
        indicadoresFiltrados.forEach(r => {
            const st = rows[r.item];
            if (!st) return;
            if (st.evidencia === "Sim") evidSim++;
            if (st.autoavaliacao === "Sim") autoavSim++;
            ptEvid += st.pontosEvidencia;
            ptPoss += st.pontoPossivel;
        });
        const total = indicadoresFiltrados.length;
        const pct = ptPoss > 0 ? Math.round(ptEvid / ptPoss * 100) : 0;
        return { total, evidSim, autoavSim, ptEvid, ptPoss, pct };
    }, [indicadoresFiltrados, rows]);

    // ── Persistência no banco ──────────────────────────────────────────────
    const saveToDb = useCallback(async (r: RespostaResultado, st: RowState) => {
        setRows(prev => ({ ...prev, [r.item]: { ...prev[r.item], saving: true, saved: false } }));
        try {
            await upsert.mutateAsync({
                ano: selectedAno, mes: selectedMes,
                data: st.data || r.data,
                operacao: r.operacao,
                revenda: r.revenda,
                item: r.item,
                autoavaliacao: st.autoavaliacao,
                evidencia: st.evidencia,
                padrinho: st.padrinho,
                horaCheck: st.hora,
                macroArea: r.macroArea, microArea: r.microArea, piramide: r.piramide,
                descricao: r.descricao, tipoResposta: r.tipoResposta,
                pontoPossivel: r.pontoPossivel,
                pontosEvidencia: st.pontosEvidencia,
                pontosAutoavaliacao: st.pontosAutoavaliacao,
            });
            setRows(prev => ({ ...prev, [r.item]: { ...prev[r.item], saving: false, saved: true } }));
            setTimeout(() => setRows(prev => ({ ...prev, [r.item]: { ...prev[r.item], saved: false } })), 2500);
        } catch {
            setRows(prev => ({ ...prev, [r.item]: { ...prev[r.item], saving: false } }));
        }
    }, [upsert, selectedAno, selectedMes]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const nowHora = () => {
        const n = new Date();
        return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
    };

    const handleCheck = useCallback((r: RespostaResultado, field: "autoavaliacao" | "evidencia", checked: boolean) => {
        const cur = rows[r.item];
        if (!cur) return;
        const updated: RowState = {
            ...cur,
            [field]: checked ? "Sim" : "Não",
            hora: cur.hora || nowHora(),
            data: cur.data || new Date().toISOString().split("T")[0],
            ...(field === "evidencia" ? { pontosEvidencia: checked ? r.pontoPossivel : 0 } : {}),
            ...(field === "autoavaliacao" ? { pontosAutoavaliacao: checked ? r.pontoPossivel : 0 } : {}),
        };
        setRows(prev => ({ ...prev, [r.item]: updated }));
        saveToDb(r, updated);
    }, [rows, saveToDb]);

    const handlePadrinho = useCallback((r: RespostaResultado, val: string) => {
        if (val === "__novo__") { setNovoInput({ rowKey: r.item, text: "" }); return; }
        const updated = { ...rows[r.item], padrinho: val };
        setRows(prev => ({ ...prev, [r.item]: updated }));
        saveToDb(r, updated);
    }, [rows, saveToDb]);

    const confirmarNovo = useCallback((r: RespostaResultado) => {
        if (!novoInput) return;
        const nome = novoInput.text.trim();
        if (!nome) { setNovoInput(null); return; }
        if (!padrinhos.includes(nome)) setPadrinhos(prev => [...prev, nome]);
        const updated = { ...rows[r.item], padrinho: nome };
        setRows(prev => ({ ...prev, [r.item]: updated }));
        saveToDb(r, updated);
        setNovoInput(null);
    }, [novoInput, padrinhos, rows, saveToDb]);

    // ── Helpers visuais ────────────────────────────────────────────────────
    const selCls = "text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200";
    const pctColor = (p: number) => p >= 80 ? "#22C55E" : p >= 50 ? "#F59E0B" : "#EF4444";
    const CS = "0 1px 4px rgba(0,0,0,0.04)";

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">

            {/* ── Linha 1: Ano + Revenda ──────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-6"
                style={{ border: cardBorder, boxShadow: CS }}>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Ano</label>
                    <select value={selectedAno} onChange={e => { setSelectedAno(Number(e.target.value)); initRef.current = ""; }} className={selCls}>
                        {anos.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Revenda / Operação</label>
                    <select value={selectedRevenda} onChange={e => { setSelectedRevenda(e.target.value); initRef.current = ""; }} className={selCls}>
                        <option value="">— selecione —</option>
                        {revendas.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                {dbQuery.isFetching && <span className="text-xs text-indigo-400 animate-pulse">Carregando banco…</span>}
                {dbQuery.isError && <span className="text-xs text-amber-500">Banco indisponível — usando dados locais</span>}
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                    {MESES_R[selectedMes - 1].label}/{selectedAno}{selectedRevenda ? ` · ${selectedRevenda}` : ""}
                </span>
            </div>

            {/* ── Linha 2: Filtros ─────────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4"
                style={{ border: cardBorder, boxShadow: CS }}>
                <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>
                    <Filter className="w-3.5 h-3.5" /> Filtros
                </span>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-3 py-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input type="text" placeholder="Buscar indicador…" value={fBusca} onChange={e => setFBusca(e.target.value)}
                        className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none w-36" style={{ fontWeight: 500 }} />
                    {fBusca && <button onClick={() => setFBusca("")}><X className="w-3 h-3 text-slate-400" /></button>}
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Macro Área</label>
                    <select value={fMacro} onChange={e => { setFMacro(e.target.value); setFMicro(""); }} className={selCls}>
                        <option value="">Todas</option>{opcMacro.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Micro Área</label>
                    <select value={fMicro} onChange={e => setFMicro(e.target.value)} className={selCls}>
                        <option value="">Todas</option>{opcMicro.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Pirâmide</label>
                    <select value={fPiramide} onChange={e => setFPiramide(e.target.value)} className={selCls}>
                        <option value="">Todas</option>{opcPiramide.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Evidência</label>
                    <select value={fEvid} onChange={e => setFEvid(e.target.value)} className={selCls}>
                        <option value="">Todos</option><option value="Sim">Sim</option><option value="Não">Não</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Autoavaliação</label>
                    <select value={fAutoav} onChange={e => setFAutoav(e.target.value)} className={selCls}>
                        <option value="">Todos</option><option value="Sim">Sim</option><option value="Não">Não</option>
                    </select>
                </div>
                {temFiltro && (
                    <button onClick={() => { setFBusca(""); setFMacro(""); setFMicro(""); setFPiramide(""); setFEvid(""); setFAutoav(""); }}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--accent)] transition-all"
                        style={{ fontWeight: 600 }}>
                        <X className="w-3.5 h-3.5" /> Limpar
                    </button>
                )}
            </div>

            {/* ── Linha 3: Tabs meses ──────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-3 flex items-center gap-1 overflow-x-auto"
                style={{ border: cardBorder, boxShadow: CS }}>
                {MESES_R.map(m => {
                    const ativo = selectedMes === m.num;
                    const temDados = mesesComDados.has(m.num);
                    return (
                        <button key={m.num} onClick={() => { setSelectedMes(m.num); initRef.current = ""; }}
                            className={classNames(
                                "relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs transition-all whitespace-nowrap",
                                ativo ? "bg-indigo-500 text-white shadow-sm"
                                    : temDados ? "bg-slate-100 dark:bg-[var(--accent)] text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                        : "text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-[var(--accent)] opacity-60",
                            )} style={{ fontWeight: 700 }}>
                            {m.label}
                            {temDados && <span className={classNames("w-1.5 h-1.5 rounded-full", ativo ? "bg-white/70" : "bg-emerald-400")} />}
                        </button>
                    );
                })}
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 pl-4 shrink-0">
                    {mesesComDados.size} {mesesComDados.size === 1 ? "mês" : "meses"} com dados
                </span>
            </div>

            {/* ── KPIs ─────────────────────────────────────────────────── */}
            {kpis.total > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                        { label: "Indicadores", valor: kpis.total, sub: "No filtro atual" },
                        { label: "Evidência ✓", valor: kpis.evidSim, sub: `${Math.round(kpis.evidSim / kpis.total * 100)}% respondidos` },
                        { label: "Autoav. ✓", valor: kpis.autoavSim, sub: `${Math.round(kpis.autoavSim / kpis.total * 100)}% respondidos` },
                        { label: "Pts Evidência", valor: kpis.ptEvid, sub: `de ${kpis.ptPoss} possíveis` },
                        { label: "Aderência", valor: `${kpis.pct}%`, sub: "Pts evidência / possíveis" },
                    ].map(k => (
                        <div key={k.label} className="bg-white dark:bg-[var(--card)] rounded-2xl p-4" style={{ border: cardBorder, boxShadow: CS }}>
                            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider" style={{ fontWeight: 700 }}>{k.label}</p>
                            <p className="text-2xl text-slate-800 dark:text-slate-100 mt-1 tabular-nums" style={{ fontWeight: 900 }}>{k.valor}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>{k.sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Tabela CRUD ───────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden" style={{ border: cardBorder, boxShadow: CS }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <PenLine className="w-4 h-4 text-indigo-500" />
                            Formulário de Respostas — {MESES_R[selectedMes - 1].label}/{selectedAno}
                            {selectedRevenda && <span className="text-indigo-500"> · {selectedRevenda}</span>}
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {indicadoresFiltrados.length} de {baseIndicadores.length} indicadores · salvo automaticamente ao alterar
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 inline-block" />Sim
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 inline-block" />Não
                        </span>
                    </div>
                </div>

                {!selectedRevenda ? (
                    <div className="px-5 py-20 text-center space-y-3">
                        <PenLine className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-700" />
                        <p className="text-sm text-slate-400 dark:text-slate-500">Selecione uma revenda para registrar as respostas do período.</p>
                    </div>
                ) : baseIndicadores.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <p className="text-sm text-slate-400 dark:text-slate-500">Sem indicadores para esta revenda.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Item</th>
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Descrição</th>
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Área</th>
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Pirâmide</th>
                                    <th className="px-3 py-3 text-center w-24" style={{ fontWeight: 700 }}>Autoav.</th>
                                    <th className="px-3 py-3 text-center w-24" style={{ fontWeight: 700 }}>Evidência</th>
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Padrinho</th>
                                    <th className="px-3 py-3 text-center w-20" style={{ fontWeight: 700 }}>Hora</th>
                                    <th className="px-3 py-3 text-right w-20" style={{ fontWeight: 700 }}>Pts</th>
                                    <th className="px-3 py-3 w-8" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                {indicadoresFiltrados.map(r => {
                                    const st = rows[r.item];
                                    if (!st) return null;
                                    const corP = PIRAMIDE_COR[r.piramide] || "#94A3B8";
                                    const isEvid = st.evidencia === "Sim";
                                    const isAutoav = st.autoavaliacao === "Sim";
                                    const isNovoThis = novoInput?.rowKey === r.item;
                                    return (
                                        <tr key={r.item} className={classNames(
                                            "transition-colors",
                                            (isEvid || isAutoav) ? "bg-emerald-50/40 dark:bg-emerald-500/5" : "hover:bg-slate-50/80 dark:hover:bg-[var(--accent)]/40",
                                        )}>
                                            {/* Item */}
                                            <td className="px-3 py-2.5">
                                                <span className="font-mono text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>{r.item}</span>
                                            </td>
                                            {/* Descrição */}
                                            <td className="px-3 py-2.5 max-w-[200px]">
                                                <p className="text-slate-600 dark:text-slate-300 truncate" title={r.descricao} style={{ fontWeight: 500 }}>{r.descricao}</p>
                                                <p className="text-slate-400 dark:text-slate-500 text-[10px]">{r.tipoResposta}</p>
                                            </td>
                                            {/* Área */}
                                            <td className="px-3 py-2.5">
                                                <p className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 600 }}>{r.macroArea}</p>
                                                <p className="text-slate-400 dark:text-slate-500">{r.microArea}</p>
                                            </td>
                                            {/* Pirâmide */}
                                            <td className="px-3 py-2.5">
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px]" style={{ background: `${corP}33`, color: corP, fontWeight: 700 }}>{r.piramide}</span>
                                            </td>
                                            {/* Autoavaliação */}
                                            <td className="px-3 py-2.5 text-center">
                                                <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                                                    <div className={classNames(
                                                        "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                                                        isAutoav ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white dark:bg-[var(--input)] border-slate-300 dark:border-slate-600 hover:border-emerald-400",
                                                    )}>
                                                        <input type="checkbox" className="sr-only" checked={isAutoav} onChange={e => handleCheck(r, "autoavaliacao", e.target.checked)} />
                                                        {isAutoav && <CheckCircle2 className="w-4 h-4" />}
                                                    </div>
                                                    <span className={classNames("text-[10px]", isAutoav ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")} style={{ fontWeight: 700 }}>
                                                        {st.autoavaliacao}
                                                    </span>
                                                </label>
                                            </td>
                                            {/* Evidência */}
                                            <td className="px-3 py-2.5 text-center">
                                                <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                                                    <div className={classNames(
                                                        "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                                                        isEvid ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white dark:bg-[var(--input)] border-slate-300 dark:border-slate-600 hover:border-indigo-400",
                                                    )}>
                                                        <input type="checkbox" className="sr-only" checked={isEvid} onChange={e => handleCheck(r, "evidencia", e.target.checked)} />
                                                        {isEvid && <FileCheck2 className="w-4 h-4" />}
                                                    </div>
                                                    <span className={classNames("text-[10px]", isEvid ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} style={{ fontWeight: 700 }}>
                                                        {st.evidencia}
                                                    </span>
                                                </label>
                                            </td>
                                            {/* Padrinho */}
                                            <td className="px-3 py-2.5">
                                                {isNovoThis ? (
                                                    <div className="flex items-center gap-1">
                                                        <input autoFocus type="text" value={novoInput.text}
                                                            onChange={e => setNovoInput({ rowKey: r.item, text: e.target.value })}
                                                            onKeyDown={e => { if (e.key === "Enter") confirmarNovo(r); if (e.key === "Escape") setNovoInput(null); }}
                                                            placeholder="Nome do padrinho…"
                                                            className="text-xs border border-indigo-300 dark:border-indigo-500/50 rounded-lg px-2 py-1 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 dark:text-slate-200 w-32"
                                                            style={{ fontWeight: 500 }} />
                                                        <button onClick={() => confirmarNovo(r)}
                                                            className="text-xs px-2 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors" style={{ fontWeight: 700 }}>✓</button>
                                                        <button onClick={() => setNovoInput(null)}
                                                            className="text-xs px-1.5 py-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[var(--accent)] transition-colors">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <select value={st.padrinho} onChange={e => handlePadrinho(r, e.target.value)}
                                                        className={classNames(
                                                            "text-xs rounded-lg px-2 py-1 border focus:outline-none focus:ring-2 focus:ring-indigo-200 w-full max-w-[185px]",
                                                            st.padrinho === "Sem padrinho"
                                                                ? "bg-slate-50 dark:bg-[var(--input)] border-slate-200 dark:border-[var(--border)] text-slate-400 dark:text-slate-500"
                                                                : "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
                                                        )} style={{ fontWeight: st.padrinho === "Sem padrinho" ? 400 : 700 }}>
                                                        {padrinhos.map(p => <option key={p} value={p}>{p}</option>)}
                                                        <option disabled>──────────</option>
                                                        <option value="__novo__">➕ Adicionar padrinho…</option>
                                                    </select>
                                                )}
                                            </td>
                                            {/* Hora — auto-capturada */}
                                            <td className="px-3 py-2.5 text-center tabular-nums text-slate-500 dark:text-slate-400">
                                                {st.hora || <span className="text-slate-300 dark:text-slate-600">—</span>}
                                            </td>
                                            {/* Pts */}
                                            <td className="px-3 py-2.5 text-right tabular-nums">
                                                <span style={{ fontWeight: 800, color: isEvid ? "#22C55E" : "#94A3B8" }}>{st.pontosEvidencia}</span>
                                                <span className="text-slate-300 dark:text-slate-600">/{r.pontoPossivel}</span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-2 py-2.5 text-center">
                                                {st.saving
                                                    ? <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mx-auto" />
                                                    : st.saved
                                                        ? <div className="w-3 h-3 rounded-full bg-emerald-400 mx-auto" title="Salvo" />
                                                        : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {kpis.total > 0 && (
                                <tfoot className="bg-slate-50 dark:bg-[var(--accent)] border-t-2 border-slate-100 dark:border-[var(--sidebar-border)]">
                                    <tr>
                                        <td colSpan={8} className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>
                                            Total ({indicadoresFiltrados.length} itens) · Evidência: {kpis.evidSim} Sim · Autoav.: {kpis.autoavSim} Sim
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums text-xs" style={{ fontWeight: 900, color: pctColor(kpis.pct) }}>
                                            {kpis.ptEvid}/{kpis.ptPoss}
                                            <span className="text-slate-400 font-normal ml-1">({kpis.pct}%)</span>
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>

            <div className="text-center py-1">
                <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                    MetricFlow · Respostas · {MESES_R[selectedMes - 1].label}/{selectedAno}{selectedRevenda ? ` · ${selectedRevenda}` : ""}
                </p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// EquipeView — CRUD de colaboradores + mapeamento de responsabilidades
// ─────────────────────────────────────────────────────────────────────────────
function EquipeView({
    indicadores,
    isDark: _dark,
    cardBorder,
    cardShadow,
}: {
    indicadores: Indicador[];
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
}) {
    const now = new Date();
    const [revendaId, setRevendaId] = useState<number | null>(null);
    const [subTab, setSubTab] = useState<"visao-geral" | "colaboradores" | "responsabilidades">("visao-geral");
    const [form, setForm] = useState<{ id?: number; nome: string; cargo: string; whatsapp: string } | null>(null);
    const [selectedAno, setSelectedAno] = useState(now.getFullYear());
    const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);

    const utils = trpc.useUtils();
    const revendasQ = trpc.assessment.listRevendas.useQuery();
    const colaboradoresQ = trpc.assessment.listColaboradores.useQuery(
        { revendaId: revendaId ?? undefined },
        { enabled: revendaId !== null },
    );
    const responsabilidadesQ = trpc.assessment.listResponsabilidades.useQuery(
        { revendaId: revendaId! },
        { enabled: revendaId !== null },
    );

    const upsertColab = trpc.assessment.upsertColaborador.useMutation({
        onSuccess: () => {
            utils.assessment.listColaboradores.invalidate();
            toast.success("Colaborador salvo!");
            setForm(null);
        },
        onError: () => toast.error("Erro ao salvar colaborador"),
    });

    const upsertResp = trpc.assessment.upsertResponsabilidade.useMutation({
        onSuccess: () => utils.assessment.listResponsabilidades.invalidate(),
        onError: () => toast.error("Erro ao salvar responsabilidade"),
    });

    const colabs = colaboradoresQ.data ?? [];

    const respMap = useMemo(() => {
        const m = new Map<string, { responsavelId: number | null; apoioId: number | null }>();
        responsabilidadesQ.data?.forEach(r => {
            m.set(r.item, { responsavelId: r.responsavelId ?? null, apoioId: r.apoioId ?? null });
        });
        return m;
    }, [responsabilidadesQ.data]);

    const itensList = useMemo(() => {
        const seen = new Set<string>();
        return indicadores
            .filter(i => {
                const cod = i.idIndicador.split(" - ")[0].trim();
                if (seen.has(cod)) return false;
                seen.add(cod);
                return true;
            })
            .map(i => ({
                item: i.idIndicador.split(" - ")[0].trim(),
                macroArea: i.macroArea,
                microArea: i.microArea,
                descricao: i.descricaoItem,
            }));
    }, [indicadores]);

    const macroGroups = useMemo(() => {
        const groups = new Map<string, typeof itensList>();
        itensList.forEach(i => {
            if (!groups.has(i.macroArea)) groups.set(i.macroArea, []);
            groups.get(i.macroArea)!.push(i);
        });
        return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [itensList]);

    const revendaNome = revendasQ.data?.find(r => r.id === revendaId)?.nome ?? "";

    const alocacaoStats = useMemo(() => {
        const total = itensList.length;
        let comResp = 0, comApoio = 0, completo = 0, semNenhum = 0;

        const porMacro = macroGroups.map(([macro, items]) => {
            let mResp = 0, mApoio = 0;
            items.forEach(i => {
                const cur = respMap.get(i.item);
                if (cur?.responsavelId) mResp++;
                if (cur?.apoioId) mApoio++;
            });
            return { macro, total: items.length, comResp: mResp, comApoio: mApoio };
        });

        itensList.forEach(i => {
            const cur = respMap.get(i.item);
            const hasR = !!(cur?.responsavelId);
            const hasA = !!(cur?.apoioId);
            if (hasR) comResp++;
            if (hasA) comApoio++;
            if (hasR && hasA) completo++;
            if (!hasR && !hasA) semNenhum++;
        });

        return { total, comResp, comApoio, completo, semNenhum, porMacro };
    }, [itensList, macroGroups, respMap]);

    const statusQuery = trpc.assessment.list.useQuery(
        { revenda: revendaNome, ano: selectedAno, mes: selectedMes },
        { enabled: revendaId !== null && !!revendaNome && subTab === "responsabilidades" },
    );

    const statusMap = useMemo(() => {
        const m = new Map<string, string | null>();
        statusQuery.data?.forEach(r => m.set(r.item, r.statusFinal ?? null));
        return m;
    }, [statusQuery.data]);

    return (
        <div className="space-y-6">
            {/* Seletor de revenda */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 flex flex-wrap gap-2 items-center"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <span className="text-xs text-slate-500 dark:text-slate-400 mr-2" style={{ fontWeight: 700 }}>
                    <Users className="w-3.5 h-3.5 inline mr-1" /> Revenda
                </span>
                {revendasQ.isLoading && <span className="text-xs text-slate-400">Carregando revendas…</span>}
                {revendasQ.data?.map(r => (
                    <button key={r.id}
                        onClick={() => setRevendaId(r.id)}
                        className={classNames(
                            "text-xs px-3 py-1.5 rounded-lg border transition-all",
                            revendaId === r.id
                                ? "bg-indigo-500 text-white border-indigo-500"
                                : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                        )}
                        style={{ fontWeight: 700 }}>
                        {r.nome}
                    </button>
                ))}
            </div>

            {revendaId !== null && (
                <>
                    {/* Sub-tabs */}
                    <div className="flex items-center gap-2">
                        {([
                            { id: "visao-geral",       label: "Visão Geral",       icon: <BarChart2 className="w-3.5 h-3.5" /> },
                            { id: "colaboradores",     label: "Colaboradores",     icon: <Briefcase className="w-3.5 h-3.5" /> },
                            { id: "responsabilidades", label: "Responsabilidades", icon: <UserCheck className="w-3.5 h-3.5" /> },
                        ] as const).map(t => (
                            <button key={t.id}
                                onClick={() => setSubTab(t.id)}
                                className={classNames(
                                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all",
                                    subTab === t.id
                                        ? "bg-indigo-500 text-white border-indigo-500"
                                        : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                                )}
                                style={{ fontWeight: 700 }}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Visão Geral ──────────────────────────────────────── */}
                    {subTab === "visao-geral" && (
                        <div className="space-y-4">
                            {responsabilidadesQ.isLoading ? (
                                <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Carregando…</div>
                            ) : (
                                <>
                                    {/* KPI cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: "Total de itens",    value: alocacaoStats.total,    color: "text-slate-700 dark:text-slate-200", bg: "bg-slate-50 dark:bg-[var(--accent)]" },
                                            { label: "Com responsável",   value: alocacaoStats.comResp,  color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
                                            { label: "Com apoio",         value: alocacaoStats.comApoio, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10" },
                                            { label: "Sem alocação",      value: alocacaoStats.semNenhum, color: "text-rose-600 dark:text-rose-400",   bg: "bg-rose-50 dark:bg-rose-500/10" },
                                        ].map(k => (
                                            <div key={k.label}
                                                className={`${k.bg} rounded-2xl p-4 flex flex-col gap-1`}
                                                style={{ border: cardBorder, boxShadow: cardShadow }}>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>{k.label}</span>
                                                <span className={`text-3xl tabular-nums ${k.color}`} style={{ fontWeight: 900 }}>{k.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Barra de progresso geral */}
                                    <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 space-y-3"
                                        style={{ border: cardBorder, boxShadow: cardShadow }}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-700 dark:text-slate-200" style={{ fontWeight: 800 }}>
                                                Alocação geral — {revendaNome}
                                            </span>
                                            <span className="text-sm tabular-nums" style={{ fontWeight: 900, color: alocacaoStats.comResp / alocacaoStats.total >= 0.8 ? "#10b981" : alocacaoStats.comResp / alocacaoStats.total >= 0.5 ? "#f59e0b" : "#f43f5e" }}>
                                                {alocacaoStats.total > 0 ? Math.round(alocacaoStats.comResp / alocacaoStats.total * 100) : 0}% com responsável
                                            </span>
                                        </div>
                                        {/* Barra empilhada: responsável + apoio apenas + sem nada */}
                                        {(() => {
                                            const t = alocacaoStats.total || 1;
                                            const pResp   = Math.round(alocacaoStats.completo / t * 100);
                                            const pApoio  = Math.round((alocacaoStats.comApoio - alocacaoStats.completo) / t * 100);
                                            const pSoloR  = Math.round((alocacaoStats.comResp - alocacaoStats.completo) / t * 100);
                                            const pVazio  = 100 - pResp - pApoio - pSoloR;
                                            return (
                                                <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                                                    {pResp  > 0 && <div className="bg-emerald-400"   style={{ width: `${pResp}%`  }} title={`Completo (resp + apoio): ${pResp}%`} />}
                                                    {pSoloR > 0 && <div className="bg-indigo-400"    style={{ width: `${pSoloR}%` }} title={`Só responsável: ${pSoloR}%`} />}
                                                    {pApoio > 0 && <div className="bg-violet-400"    style={{ width: `${pApoio}%` }} title={`Só apoio: ${pApoio}%`} />}
                                                    {pVazio > 0 && <div className="bg-slate-200 dark:bg-slate-700" style={{ width: `${pVazio}%` }} title={`Sem alocação: ${pVazio}%`} />}
                                                </div>
                                            );
                                        })()}
                                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Resp + Apoio ({alocacaoStats.completo})</span>
                                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 inline-block" /> Só responsável ({alocacaoStats.comResp - alocacaoStats.completo})</span>
                                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-400 inline-block" /> Só apoio ({alocacaoStats.comApoio - alocacaoStats.completo})</span>
                                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-700 inline-block" /> Sem alocação ({alocacaoStats.semNenhum})</span>
                                        </div>
                                    </div>

                                    {/* Tabela por macro área */}
                                    <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                                        style={{ border: cardBorder, boxShadow: cardShadow }}>
                                        <div className="p-5 border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                                            <h3 className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>Por macro área</h3>
                                        </div>
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                                <tr>
                                                    <th className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Macro Área</th>
                                                    <th className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 w-16" style={{ fontWeight: 700 }}>Itens</th>
                                                    <th className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 w-24" style={{ fontWeight: 700 }}>C/ Resp.</th>
                                                    <th className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 w-24" style={{ fontWeight: 700 }}>C/ Apoio</th>
                                                    <th className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400 w-48" style={{ fontWeight: 700 }}>Cobertura</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                                {alocacaoStats.porMacro.map(({ macro, total: mt, comResp: mr, comApoio: ma }) => {
                                                    const pct = mt > 0 ? Math.round(mr / mt * 100) : 0;
                                                    const pctColor = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#f43f5e";
                                                    return (
                                                        <tr key={macro} className="hover:bg-slate-50 dark:hover:bg-[var(--accent)]/50 transition-colors">
                                                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>{macro}</td>
                                                            <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>{mt}</td>
                                                            <td className="px-4 py-2.5 text-right tabular-nums" style={{ fontWeight: 700, color: pctColor }}>{mr}/{mt}</td>
                                                            <td className="px-4 py-2.5 text-right tabular-nums text-violet-500 dark:text-violet-400" style={{ fontWeight: 600 }}>{ma}/{mt}</td>
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                                        <div className="h-full rounded-full transition-all"
                                                                            style={{ width: `${pct}%`, backgroundColor: pctColor }} />
                                                                    </div>
                                                                    <span className="text-[10px] tabular-nums w-8 text-right" style={{ fontWeight: 700, color: pctColor }}>{pct}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-slate-50 dark:bg-[var(--accent)] border-t border-slate-200 dark:border-[var(--sidebar-border)]">
                                                <tr>
                                                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200" style={{ fontWeight: 800 }}>Total</td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200" style={{ fontWeight: 800 }}>{alocacaoStats.total}</td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ fontWeight: 800, color: alocacaoStats.total > 0 ? (alocacaoStats.comResp / alocacaoStats.total >= 0.8 ? "#10b981" : "#f59e0b") : undefined }}>
                                                        {alocacaoStats.comResp}/{alocacaoStats.total}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-violet-500 dark:text-violet-400" style={{ fontWeight: 800 }}>
                                                        {alocacaoStats.comApoio}/{alocacaoStats.total}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                                <div className="h-full rounded-full bg-emerald-400 transition-all"
                                                                    style={{ width: `${alocacaoStats.total > 0 ? Math.round(alocacaoStats.comResp / alocacaoStats.total * 100) : 0}%` }} />
                                                            </div>
                                                            <span className="text-[10px] tabular-nums w-8 text-right text-emerald-500" style={{ fontWeight: 800 }}>
                                                                {alocacaoStats.total > 0 ? Math.round(alocacaoStats.comResp / alocacaoStats.total * 100) : 0}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Colaboradores ────────────────────────────────────── */}
                    {subTab === "colaboradores" && (
                        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                            style={{ border: cardBorder, boxShadow: cardShadow }}>
                            <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                                <h3 className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                                    Equipe — {revendaNome}
                                </h3>
                                <button
                                    onClick={() => setForm({ nome: "", cargo: "", whatsapp: "" })}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                                    style={{ fontWeight: 700 }}>
                                    <UserPlus className="w-3.5 h-3.5" /> Novo colaborador
                                </button>
                            </div>

                            {/* Formulário inline */}
                            {form && (
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-500/30 flex flex-wrap gap-3 items-end">
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" style={{ fontWeight: 600 }}>Nome</label>
                                        <input type="text"
                                            value={form.nome}
                                            onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))}
                                            placeholder="Nome completo"
                                            className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-48"
                                            style={{ fontWeight: 500 }} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" style={{ fontWeight: 600 }}>Cargo</label>
                                        <input type="text"
                                            value={form.cargo}
                                            onChange={e => setForm(f => f && ({ ...f, cargo: e.target.value }))}
                                            placeholder="Ex: Gerente"
                                            className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-36"
                                            style={{ fontWeight: 500 }} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" style={{ fontWeight: 600 }}>
                                            <Phone className="w-3 h-3 inline mr-0.5" /> WhatsApp
                                        </label>
                                        <input type="text"
                                            value={form.whatsapp}
                                            onChange={e => setForm(f => f && ({ ...f, whatsapp: e.target.value }))}
                                            placeholder="5551999999999"
                                            className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-40"
                                            style={{ fontWeight: 500 }} />
                                    </div>
                                    <button
                                        disabled={!form.nome.trim() || upsertColab.isPending}
                                        onClick={() => upsertColab.mutate({ ...form, revendaId: revendaId! })}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                        style={{ fontWeight: 700 }}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {upsertColab.isPending ? "Salvando…" : "Salvar"}
                                    </button>
                                    <button onClick={() => setForm(null)}
                                        className="text-xs p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[var(--accent)] transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                    <tr>
                                        {["Nome", "Cargo", "WhatsApp", "Ativo", ""].map(h => (
                                            <th key={h} className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                    {colaboradoresQ.isLoading && (
                                        <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Carregando…</td></tr>
                                    )}
                                    {!colaboradoresQ.isLoading && colabs.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Nenhum colaborador cadastrado.</td></tr>
                                    )}
                                    {colabs.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-[var(--accent)]/50 transition-colors">
                                            <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200" style={{ fontWeight: 600 }}>{c.nome}</td>
                                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{c.cargo || "—"}</td>
                                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono">{c.whatsapp || "—"}</td>
                                            <td className="px-4 py-2.5">
                                                <span className={`w-2 h-2 rounded-full inline-block ${c.ativo ? "bg-emerald-400" : "bg-slate-300 dark:bg-slate-600"}`} />
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <button
                                                    onClick={() => setForm({ id: c.id, nome: c.nome, cargo: c.cargo ?? "", whatsapp: c.whatsapp ?? "" })}
                                                    className="text-xs px-2 py-1 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                                    style={{ fontWeight: 600 }}>Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Responsabilidades ────────────────────────────────── */}
                    {subTab === "responsabilidades" && (
                        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                            style={{ border: cardBorder, boxShadow: cardShadow }}>
                            <div className="p-5 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex flex-wrap gap-4 items-start justify-between">
                                <div>
                                    <h3 className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                                        Responsabilidades — {revendaNome}
                                    </h3>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                        Defina o responsável direto e o apoio (padrinho) para cada item
                                    </p>
                                    {colabs.length === 0 && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-lg" style={{ fontWeight: 600 }}>
                                            Cadastre colaboradores primeiro para poder atribuir responsabilidades.
                                        </p>
                                    )}
                                </div>
                                {/* Seletor de período para ver status */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-slate-400 dark:text-slate-500" style={{ fontWeight: 600 }}>Status de:</span>
                                    <select
                                        value={selectedMes}
                                        onChange={e => setSelectedMes(Number(e.target.value))}
                                        className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                        {MESES_RES.map(m => (
                                            <option key={m.num} value={m.num}>{m.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedAno}
                                        onChange={e => setSelectedAno(Number(e.target.value))}
                                        className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                        {[2025, 2026, 2027].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="overflow-auto max-h-[70vh]">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-[var(--accent)] sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 w-20" style={{ fontWeight: 700 }}>Item</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 w-24" style={{ fontWeight: 700 }}>Status</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Micro Área</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Descrição</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 w-44" style={{ fontWeight: 700 }}>Responsável</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 w-44" style={{ fontWeight: 700 }}>Apoio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                        {macroGroups.map(([macro, items]) => (
                                            <Fragment key={macro}>
                                                <tr className="bg-slate-100/60 dark:bg-[var(--accent)]">
                                                    <td colSpan={6} className="px-3 py-1.5 text-slate-600 dark:text-slate-300 uppercase tracking-wide text-[10px]" style={{ fontWeight: 800 }}>
                                                        {macro}
                                                    </td>
                                                </tr>
                                                {items.map(i => {
                                                    const cur = respMap.get(i.item);
                                                    const st = statusMap.get(i.item);
                                                    const badge = st === "Sim"
                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" style={{ fontWeight: 700 }}>Sim</span>
                                                        : st === "Parcial"
                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" style={{ fontWeight: 700 }}>Parcial</span>
                                                        : st === "Não"
                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" style={{ fontWeight: 700 }}>Não</span>
                                                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500" style={{ fontWeight: 600 }}>—</span>;
                                                    return (
                                                        <tr key={i.item} className="hover:bg-slate-50/60 dark:hover:bg-[var(--accent)]/40 transition-colors">
                                                            <td className="px-3 py-2 font-mono text-indigo-600 dark:text-indigo-400" style={{ fontWeight: 700 }}>{i.item}</td>
                                                            <td className="px-3 py-2">{badge}</td>
                                                            <td className="px-3 py-2 text-slate-400 dark:text-slate-500">{i.microArea}</td>
                                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs">
                                                                <span className="block truncate" title={i.descricao}>{i.descricao}</span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <select
                                                                    value={cur?.responsavelId ?? ""}
                                                                    disabled={colabs.length === 0}
                                                                    onChange={e => upsertResp.mutate({
                                                                        revendaId: revendaId!,
                                                                        item: i.item,
                                                                        responsavelId: e.target.value ? Number(e.target.value) : null,
                                                                        apoioId: cur?.apoioId ?? null,
                                                                    })}
                                                                    className="text-xs bg-white dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-40 disabled:opacity-50"
                                                                    style={{ fontWeight: cur?.responsavelId ? 700 : 400 }}>
                                                                    <option value="">— nenhum —</option>
                                                                    {colabs.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <select
                                                                    value={cur?.apoioId ?? ""}
                                                                    disabled={colabs.length === 0}
                                                                    onChange={e => upsertResp.mutate({
                                                                        revendaId: revendaId!,
                                                                        item: i.item,
                                                                        responsavelId: cur?.responsavelId ?? null,
                                                                        apoioId: e.target.value ? Number(e.target.value) : null,
                                                                    })}
                                                                    className="text-xs bg-white dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-40 disabled:opacity-50"
                                                                    style={{ fontWeight: cur?.apoioId ? 700 : 400 }}>
                                                                    <option value="">— nenhum —</option>
                                                                    {colabs.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

