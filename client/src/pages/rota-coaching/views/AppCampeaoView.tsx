import { useState, useMemo } from "react";
import { RefreshCw, Trophy, Users, Filter, X, CalendarDays, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";

const REGIONAIS = {
    R1: { label: "R1 · Duttra", revendas: ["Duttra FLO", "Duttra MA", "Duttra SRN"] },
    R2: { label: "R2 · Forte",  revendas: ["Forte Aracati", "Forte Quixada"] },
} as const;

type Regional = keyof typeof REGIONAIS;

const COR_REGIONAL: Record<Regional, { badge: string; btn: string; btnAtivo: string }> = {
    R1: {
        badge:    "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
        btn:      "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600",
        btnAtivo: "bg-indigo-50 dark:bg-indigo-900/25 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300",
    },
    R2: {
        badge:    "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        btn:      "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300 hover:text-emerald-600",
        btnAtivo: "bg-emerald-50 dark:bg-emerald-900/25 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300",
    },
};

function todayIso() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Fortaleza",
        year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
}

function shiftDay(iso: string, delta: number) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
}

function isColunaOculta(col: string) {
    return col.startsWith("_") || col === "";
}

export function AppCampeaoView() {
    const today = todayIso();
    const [dateStart, setDateStart] = useState(today);
    const [dateEnd,   setDateEnd]   = useState(today);
    const [filtroRegional, setFiltroRegional] = useState<Regional | "">("");
    const [filtroRevenda,  setFiltroRevenda]  = useState("");
    const [busca, setBusca] = useState("");

    const { data: rows = [], isLoading, error, refetch } = trpc.appCampeao.getAll.useQuery(
        { dateStart, dateEnd },
        { staleTime: 5 * 60 * 1000, retry: 1 },
    );

    const { mutate: invalidar, isPending: invalidando } = trpc.appCampeao.invalidateCache.useMutation({
        onSuccess: () => refetch(),
    });

    const colunas = useMemo(() => {
        if (!rows.length) return [];
        return Object.keys(rows[0]).filter(c => !isColunaOculta(c));
    }, [rows]);

    const campoRevenda = useMemo(
        () => colunas.find(c => /revenda|loja|filial/i.test(c)),
        [colunas],
    );

    const revendasUnicas = useMemo(() => {
        if (!campoRevenda) return [];
        return [...new Set(rows.map(r => String(r[campoRevenda] ?? "")))].filter(Boolean).sort();
    }, [rows, campoRevenda]);

    const dadosFiltrados = useMemo(() => {
        let d = rows;
        if (filtroRegional) d = d.filter(r => r._regional === filtroRegional);
        if (filtroRevenda && campoRevenda) d = d.filter(r => String(r[campoRevenda] ?? "") === filtroRevenda);
        if (busca.trim()) {
            const q = busca.toLowerCase();
            d = d.filter(r => colunas.some(c => String(r[c] ?? "").toLowerCase().includes(q)));
        }
        return d;
    }, [rows, filtroRegional, filtroRevenda, busca, campoRevenda, colunas]);

    const kpis = useMemo(() => {
        const por: Record<Regional, number> = { R1: 0, R2: 0 };
        rows.forEach(r => { if (r._regional === "R1" || r._regional === "R2") por[r._regional as Regional]++; });
        return por;
    }, [rows]);

    // Coluna de GA: detecta automaticamente por nome
    const campoGA = useMemo(
        () => colunas.find(c => /gerentedearea|gestor|^ga$|id_ga/i.test(c)),
        [colunas],
    );

    const dadosGrafico = useMemo(() => {
        if (!campoGA) return [];
        const m: Record<string, { ga: string; total: number; R1: number; R2: number }> = {};
        dadosFiltrados.forEach(r => {
            const ga = String(r[campoGA] ?? "—");
            if (!m[ga]) m[ga] = { ga, total: 0, R1: 0, R2: 0 };
            m[ga].total++;
            if (r._regional === "R1") m[ga].R1++;
            if (r._regional === "R2") m[ga].R2++;
        });
        return Object.values(m).sort((a, b) => b.total - a.total);
    }, [dadosFiltrados, campoGA]);

    const { theme } = useTheme();
    const isDark = theme === "dark";

    function navegarDia(delta: number) {
        setDateStart(s => shiftDay(s, delta));
        setDateEnd(e => shiftDay(e, delta));
    }

    const temFiltro = !!(filtroRegional || filtroRevenda || busca);

    // ── Barra de controles compacta ──────────────────────────────────────────────
    const controlesBar = (
        <div className="shrink-0 px-5 py-2.5 border-b border-slate-100 dark:border-[var(--border)] bg-white dark:bg-[var(--card)] flex flex-wrap items-center gap-2">

            {/* Navegação de data */}
            <div className="flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <button onClick={() => navegarDia(-1)} className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs" />
                <span className="text-xs text-slate-400">–</span>
                <input type="date" value={dateEnd} min={dateStart} onChange={e => setDateEnd(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs" />
                <button onClick={() => navegarDia(1)} className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {dateStart !== today && (
                    <button onClick={() => { setDateStart(today); setDateEnd(today); }}
                        className="text-xs text-indigo-500 font-semibold hover:underline">
                        Hoje
                    </button>
                )}
            </div>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />

            {/* Cards de regional compactos */}
            {(Object.entries(REGIONAIS) as [Regional, typeof REGIONAIS[Regional]][]).map(([reg, info]) => {
                const ativo = filtroRegional === reg;
                return (
                    <button key={reg} onClick={() => setFiltroRegional(prev => prev === reg ? "" : reg)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${ativo ? COR_REGIONAL[reg].btnAtivo : COR_REGIONAL[reg].btn}`}>
                        <Trophy className="w-3 h-3 shrink-0" />
                        <span>{info.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-black ${ativo ? "bg-white/60 dark:bg-black/20" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                            {kpis[reg]}
                        </span>
                    </button>
                );
            })}

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />

            {/* Filtro por revenda */}
            {revendasUnicas.length > 0 && (
                <select value={filtroRevenda} onChange={e => setFiltroRevenda(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <option value="">Todas as revendas</option>
                    {revendasUnicas.map(rv => <option key={rv} value={rv}>{rv}</option>)}
                </select>
            )}

            {/* Busca */}
            <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800">
                <Filter className="w-3 h-3 text-slate-400 shrink-0" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
                    className="text-xs bg-transparent text-slate-700 dark:text-slate-200 outline-none w-32" />
            </div>

            {temFiltro && (
                <button onClick={() => { setFiltroRegional(""); setFiltroRevenda(""); setBusca(""); }}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-3 h-3" /> Limpar
                </button>
            )}

            {/* Contagem + atualizar */}
            <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {dadosFiltrados.length}
                </span>
                <button onClick={() => invalidar()} disabled={invalidando}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
                    <RefreshCw className={`w-3 h-3 ${invalidando ? "animate-spin" : ""}`} /> Atualizar
                </button>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="h-full flex flex-col">
                {controlesBar}
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex flex-col">
                {controlesBar}
                <div className="flex-1 flex items-center justify-center px-8">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-6 text-center max-w-md">
                        <p className="text-red-600 dark:text-red-400 text-sm font-semibold">⚠️ {error.message}</p>
                        <p className="text-red-400 text-xs mt-1">
                            Verifique se <code>APPS_SCRIPT_URL</code> está configurado no .env e se o Apps Script foi publicado.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {controlesBar}

            {/* Gráfico de barras por GA — altura fixa, visível só com dados */}
            {dadosGrafico.length > 0 && (
                <div className="shrink-0 border-b border-slate-100 dark:border-[var(--border)] bg-white dark:bg-[var(--card)] px-5 py-3">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            Registros por GA
                        </span>
                        <span className="text-xs text-slate-400">{dadosGrafico.length} GAs</span>
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={dadosGrafico} margin={{ top: 14, right: 12, left: -20, bottom: 0 }} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#f1f5f9"} />
                            <XAxis
                                dataKey="ga"
                                tick={{ fontSize: 10, fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600 }}
                                axisLine={false} tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: isDark ? "#94a3b8" : "#64748b" }}
                                axisLine={false} tickLine={false} allowDecimals={false}
                            />
                            <Tooltip
                                cursor={{ fill: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)" }}
                                contentStyle={{
                                    background: isDark ? "#1e293b" : "#fff",
                                    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                                    borderRadius: 10,
                                    fontSize: 11,
                                }}
                                formatter={(value: number, name: string) => [value, name === "R1" ? "R1 · Duttra" : "R2 · Forte"]}
                                labelStyle={{ fontWeight: 700, color: isDark ? "#e2e8f0" : "#1e293b" }}
                            />
                            <Bar dataKey="R1" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]}>
                                <LabelList dataKey="total" position="top" style={{ fontSize: 9, fontWeight: 700, fill: isDark ? "#cbd5e1" : "#475569" }} />
                            </Bar>
                            <Bar dataKey="R2" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Tabela — ocupa o espaço restante */}
            <div className="flex-1 min-h-0 overflow-auto">
                {colunas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-3">
                        <Trophy className="w-10 h-10 opacity-20" />
                        <span>
                            {rows.length === 0
                                ? "Nenhum registro para este período."
                                : "Sem dados para exibir."}
                        </span>
                    </div>
                ) : (
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-[var(--border)]">
                                <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">Regional</th>
                                {colunas.map(c => (
                                    <th key={c} className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dadosFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={colunas.length + 1} className="text-center py-16 text-slate-400">Nenhum registro encontrado</td>
                                </tr>
                            ) : (
                                dadosFiltrados.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-3 py-1.5">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold border ${COR_REGIONAL[row._regional as Regional]?.badge ?? ""}`}>
                                                {row._regional} · {row._grupo}
                                            </span>
                                        </td>
                                        {colunas.map(c => (
                                            <td key={c} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{String(row[c] ?? "")}</td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
