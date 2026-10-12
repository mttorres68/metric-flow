import { Fragment, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus, Info, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { exportarComparativoScoresPDF } from "@/lib/pdfExport";
import {
    LEGENDA_REGRA_RECORRENCIA,
    LEGENDA_SCORE_CRITICO,
    LEGENDA_SCORE_DISTORCAO,
    LEGENDA_FLAGS_RECORRENCIA,
    LEGENDA_FLAGS_DIARIAS,
} from "@shared/const";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "../components/Badge";
import { FilterSelect } from "../components/FilterControls";

type Granularidade = "diario" | "semanal" | "mensal";
type Metrica = "scoreCritico" | "flagsDiarias" | "scoreDistorcao";

const TABS: { id: Granularidade; label: string }[] = [
    { id: "diario", label: "Diário" },
    { id: "semanal", label: "Semanal" },
    { id: "mensal", label: "Mensal" },
];

const METRICAS: { id: Metrica; label: string }[] = [
    { id: "scoreCritico", label: "Score Crítico (recorrência)" },
    { id: "flagsDiarias", label: "Flags Diárias (manual)" },
    { id: "scoreDistorcao", label: "Score de Distorção (soma)" },
];

const QUANTIDADES = [4, 5, 7, 8,15, 12];

// Paleta categórica validada (CVD-safe, ordem fixa) — ver skill dataviz/references/palette.md
const SERIE_CORES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const SERIE_CORES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const MAX_SERIES_GRAFICO = SERIE_CORES_LIGHT.length;

function ordenarVendedores(a: string, b: string): number {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
}

function addDays(iso: string, dias: number): string {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, meses: number): string {
    const d = new Date(iso + "T00:00:00");
    d.setMonth(d.getMonth() + meses);
    return d.toISOString().slice(0, 10);
}

function scoreColor(score: number | null): "green" | "amber" | "red" | "slate" {
    if (score === null) return "slate";
    if (score === 0) return "green";
    if (score < 1) return "amber";
    return "red";
}

function TrendIcon({ atual, anterior }: { atual: number | null; anterior: number | null }) {
    if (atual === null || anterior === null) return null;
    const delta = atual - anterior;
    if (Math.abs(delta) < 0.05) return <Minus className="w-3 h-3 text-slate-400 dark:text-slate-500" />;
    if (delta < 0) return <TrendingDown className="w-3 h-3 text-green-600 dark:text-green-400" />;
    return <TrendingUp className="w-3 h-3 text-red-500 dark:text-red-400" />;
}

export function ComparativoScoresView() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const [granularidade, setGranularidade] = useState<Granularidade>("semanal");
    const [metrica, setMetrica] = useState<Metrica>("scoreCritico");
    const [quantidade, setQuantidade] = useState(6);
    const [dataFim, setDataFim] = useState("");
    const [revendaFiltro, setRevendaFiltro] = useState("");
    const [expandido, setExpandido] = useState<string | null>(null);
    const [legendaAberta, setLegendaAberta] = useState(false);

    const { data: dadosGerais } = trpc.analise.getDados.useQuery({}, { staleTime: 5 * 60 * 1000 });
    const revendas = dadosGerais?.revendas ?? [];

    const { data, isLoading, error } = trpc.analise.getComparativoScores.useQuery(
        { granularidade, metrica, dataFim: dataFim || undefined, quantidade, revenda: revendaFiltro || undefined },
        { staleTime: 5 * 60 * 1000 }
    );

    const periodos = data?.periodos ?? [];
    const porRevenda = data?.porRevenda ?? {};
    const porRevendaVendedor = data?.porRevendaVendedor ?? {};
    const linhasRevenda = Object.keys(porRevenda).sort();

    const seriesGrafico = linhasRevenda.slice(0, MAX_SERIES_GRAFICO);
    const setoresOmitidos = linhasRevenda.length - seriesGrafico.length;
    const dadosGrafico = periodos.map((p, i) => {
        const linha: Record<string, number | string | null> = { periodo: p.label };
        seriesGrafico.forEach(rev => { linha[rev] = porRevenda[rev]?.[i] ?? null; });
        return linha;
    });
    const coresGrafico = isDark ? SERIE_CORES_DARK : SERIE_CORES_LIGHT;

    function handleExportarSetor(rev: string) {
        const setor = {
            nome: rev,
            mediaSetor: porRevenda[rev],
            vendedores: Object.keys(porRevendaVendedor[rev] ?? {})
                .sort(ordenarVendedores)
                .map(v => ({ vendedor: v, valores: porRevendaVendedor[rev][v] })),
        };
        const metricaLabel = METRICAS.find(m => m.id === metrica)?.label ?? metrica;
        const filtroInfo = `Granularidade: ${TABS.find(t => t.id === granularidade)?.label} · Período: ${periodos[0]?.label ?? "—"} – ${periodos[periodos.length - 1]?.label ?? "—"}`;
        const explicacao = metrica === "flagsDiarias"
            ? {
                label: "Flags Diárias",
                desc: "Marcações manuais feitas pelo gestor por vendedor/dia na tela Diária. O valor exibido é a média de flags marcadas (0 a 3) entre os dias com registro salvo no período.",
                itens: LEGENDA_FLAGS_DIARIAS,
            }
            : {
                ...(metrica === "scoreCritico" ? LEGENDA_SCORE_CRITICO : LEGENDA_SCORE_DISTORCAO),
                itens: LEGENDA_FLAGS_RECORRENCIA,
            };
        exportarComparativoScoresPDF(periodos, [setor], metricaLabel, filtroInfo, explicacao);
    }

    const podeAvancar = !data || !data.dataMaxDisponivel || data.dataFimUsada < data.dataMaxDisponivel;

    function shiftJanela(direcao: -1 | 1) {
        const base = dataFim || data?.dataFimUsada;
        if (!base) return;
        if (granularidade === "diario") setDataFim(addDays(base, direcao * quantidade));
        else if (granularidade === "semanal") setDataFim(addDays(base, direcao * quantidade * 7));
        else setDataFim(addMonths(base, direcao * quantidade));
    }

    return (
        <div className="px-6 pb-6 pt-4 flex flex-col gap-4">
            {/* ── Controles ── */}
            <div
                className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
                style={{ border: "1px solid oklch(0.93 0.006 240)" }}
            >
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setGranularidade(t.id)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                granularidade === t.id
                                    ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">Métrica</label>
                    <select
                        value={metrica}
                        onChange={e => { setMetrica(e.target.value as Metrica); setDataFim(""); }}
                        className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                        {METRICAS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <button
                        onClick={() => setLegendaAberta(v => !v)}
                        className={`flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${
                            legendaAberta
                                ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                : "border-slate-200 dark:border-[var(--border)] text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                        title="O que essa métrica mede?"
                    >
                        <Info size={13} />
                    </button>
                </div>

                <FilterSelect
                    label="Setor"
                    value={revendaFiltro}
                    onChange={setRevendaFiltro}
                    placeholder="Todos"
                    options={revendas.map((r: string) => ({ value: r, label: r }))}
                />

                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">Períodos</label>
                    <select
                        value={quantidade}
                        onChange={e => setQuantidade(Number(e.target.value))}
                        className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                        {QUANTIDADES.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-1 ml-auto">
                    <button
                        onClick={() => shiftJanela(-1)}
                        disabled={!data}
                        className="flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-[var(--border)] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                        title="Janela anterior"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold px-2 whitespace-nowrap">
                        {periodos.length > 0 ? `${periodos[0].label} — ${periodos[periodos.length - 1].label}` : "—"}
                    </span>
                    <button
                        onClick={() => shiftJanela(1)}
                        disabled={!data || !podeAvancar}
                        className="flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-[var(--border)] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                        title="Próxima janela"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* ── Legenda da métrica ── */}
            {legendaAberta && (
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-4 flex flex-col gap-2 border border-slate-100 dark:border-[var(--border)]">
                    {metrica === "scoreCritico" || metrica === "scoreDistorcao" ? (
                        <>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                    {(metrica === "scoreCritico" ? LEGENDA_SCORE_CRITICO : LEGENDA_SCORE_DISTORCAO).label}:
                                </span>{" "}
                                {(metrica === "scoreCritico" ? LEGENDA_SCORE_CRITICO : LEGENDA_SCORE_DISTORCAO).desc}
                            </p>
                            {metrica === "scoreCritico" && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    <span className="font-semibold">{LEGENDA_REGRA_RECORRENCIA.label}:</span> {LEGENDA_REGRA_RECORRENCIA.desc}
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
                                {LEGENDA_FLAGS_RECORRENCIA.map(item => (
                                    <p key={item.label} className="text-xs text-slate-500 dark:text-slate-400">
                                        <span className="font-semibold text-slate-600 dark:text-slate-300">{item.label}:</span> {item.desc}
                                    </p>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">Flags Diárias:</span>{" "}
                                Marcações manuais feitas pelo gestor por vendedor/dia na tela Diária. O valor exibido é a média de flags
                                marcadas (0 a 3) entre os dias com registro salvo no período.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
                                {LEGENDA_FLAGS_DIARIAS.map(item => (
                                    <p key={item.label} className="text-xs text-slate-500 dark:text-slate-400">
                                        <span className="font-semibold text-slate-600 dark:text-slate-300">{item.label}:</span> {item.desc}
                                    </p>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Estados ── */}
            {isLoading && (
                <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500 text-sm">
                    <RefreshCw size={16} className="animate-spin mr-2" /> Carregando comparativo…
                </div>
            )}
            {error && (
                <div className="flex items-center justify-center py-20 text-red-500 text-sm gap-2">
                    <AlertTriangle size={16} /> {error.message}
                </div>
            )}
            {!isLoading && !error && linhasRevenda.length === 0 && (
                <div className="px-6 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                    Nenhum dado encontrado para o período selecionado.
                </div>
            )}

            {/* ── Tabela ── */}
            {!isLoading && !error && linhasRevenda.length > 0 && (
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-green-950 text-slate-100">
                                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">Setor</th>
                                    {periodos.map((p, i) => (
                                        <th key={i} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide whitespace-nowrap">
                                            {p.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {linhasRevenda.map((rev, i) => {
                                    const scores = porRevenda[rev];
                                    const isOpen = expandido === rev;
                                    const vendedores = Object.keys(porRevendaVendedor[rev] ?? {}).sort(ordenarVendedores);

                                    return (
                                        <Fragment key={rev}>
                                            <tr
                                                onClick={() => setExpandido(isOpen ? null : rev)}
                                                className={`cursor-pointer hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 ${i % 2 ? "bg-slate-50 dark:bg-slate-800/30" : ""}`}
                                            >
                                                <td className="px-3 py-2 font-bold text-indigo-600 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-700/40">
                                                    <div className="flex items-center justify-between gap-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <ChevronDown size={12} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                                                            {rev}
                                                        </div>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleExportarSetor(rev); }}
                                                            className="flex items-center justify-center w-5 h-5 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                                                            title={`Exportar PDF de ${rev}`}
                                                        >
                                                            <Printer size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                                {scores.map((s, idx) => (
                                                    <td key={idx} className="px-2 py-2 text-center border-b border-slate-100 dark:border-slate-700/40">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Badge color={scoreColor(s)}>{s === null ? "—" : s.toFixed(1)}</Badge>
                                                            <TrendIcon atual={s} anterior={idx > 0 ? scores[idx - 1] : null} />
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                            {isOpen && vendedores.map(v => {
                                                const vScores = porRevendaVendedor[rev][v];
                                                return (
                                                    <tr key={`${rev}-${v}`} className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                                        <td className="px-3 py-1.5 pl-8 font-mono text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/40">
                                                            Vend. {v}
                                                        </td>
                                                        {vScores.map((s, idx) => (
                                                            <td key={idx} className="px-2 py-1.5 text-center border-b border-slate-100 dark:border-slate-700/40">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Badge color={scoreColor(s)}>{s === null ? "—" : s.toFixed(1)}</Badge>
                                                                    <TrendIcon atual={s} anterior={idx > 0 ? vScores[idx - 1] : null} />
                                                                </div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Gráfico ── */}
            {!isLoading && !error && linhasRevenda.length > 0 && (
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] p-4">
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={dadosGrafico} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e2a3a" : "#F1F5F9"} vertical={false} />
                            <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: isDark ? "#64748b" : "#94A3B8" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: isDark ? "#64748b" : "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{
                                    background: isDark ? "#1a2436" : "#ffffff",
                                    border: `1px solid ${isDark ? "#2d3f55" : "#E2E8F0"}`,
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: isDark ? "#e2e8f0" : "#334155",
                                }}
                                cursor={{ fill: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)" }}
                            />
                            {seriesGrafico.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                            {seriesGrafico.map((rev, i) => (
                                <Bar key={rev} dataKey={rev} name={rev} fill={coresGrafico[i % coresGrafico.length]} radius={[4, 4, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    {setoresOmitidos > 0 && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 text-center">
                            +{setoresOmitidos} setor(es) não exibido(s) no gráfico — refine o filtro de Setor.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
