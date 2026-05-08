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
    FileCheck2,
    Filter,
    GitBranch,
    LayersIcon,
    Link2,
    Network,
    Search,
    Sparkles,
    Target,
    TrendingUp,
    Waves,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
    const [view, setView] = useState<"overview" | "clusters">("overview");

    // ─── Dados ───────────────────────────────────────────────────────────────
    const [indicadores, setIndicadores] = useState<Indicador[]>([]);
    const [clusters, setClusters] = useState<ClustersData | null>(null);
    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        Promise.all([
            fetch("/assessment_indicadores.json").then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            }),
            fetch("/assessment_clusters.json").then(r => r.ok ? r.json() : null).catch(() => null),
        ])
            .then(([ind, cl]: [Indicador[], ClustersData | null]) => {
                if (!alive) return;
                setIndicadores(ind);
                setClusters(cl);
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
                        </div>
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
                    <span className={`px-2 py-0.5 rounded-md text-xs ${
                        item.tipoResposta === "Maturidade"
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
