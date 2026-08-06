import { Fragment, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import {
    LEGENDA_REGRA_RECORRENCIA,
    LEGENDA_SCORE_CRITICO,
    LEGENDA_FLAGS_RECORRENCIA,
    LEGENDA_FLAGS_DIARIAS,
} from "@shared/const";
import { trpc } from "@/lib/trpc";
import { Badge } from "../components/Badge";
import { FilterSelect } from "../components/FilterControls";

type Granularidade = "diario" | "semanal" | "mensal";
type Metrica = "scoreCritico" | "flagsDiarias";

const TABS: { id: Granularidade; label: string }[] = [
    { id: "diario", label: "Diário" },
    { id: "semanal", label: "Semanal" },
    { id: "mensal", label: "Mensal" },
];

const METRICAS: { id: Metrica; label: string }[] = [
    { id: "scoreCritico", label: "Score Crítico (recorrência)" },
    { id: "flagsDiarias", label: "Flags Diárias (manual)" },
];

const QUANTIDADES = [4, 6, 8, 12];

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
                    {metrica === "scoreCritico" ? (
                        <>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{LEGENDA_SCORE_CRITICO.label}:</span>{" "}
                                {LEGENDA_SCORE_CRITICO.desc}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold">{LEGENDA_REGRA_RECORRENCIA.label}:</span> {LEGENDA_REGRA_RECORRENCIA.desc}
                            </p>
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
                                                    <div className="flex items-center gap-1.5">
                                                        <ChevronDown size={12} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                                                        {rev}
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
        </div>
    );
}
