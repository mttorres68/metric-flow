/*
 * MetricFlow — Rota Coaching & Monitoramento de Frota
 * Migração do Monitor Rota Coaching (App.jsx) para o MetricFlow.
 *
 * Aba 1 — Rota Coaching : conformidade GA/GV/TRD × agenda × PathTracker
 * Aba 2 — Frota Infleet : KM, tempo ligado/parado, geocercas por veículo/dia
 *
 * Dados do Rota Coaching: lê /rota_coaching_all.json da pasta public
 * Dados do Infleet:       tRPC → infleetRouter (requer INFLEET_TOKEN)
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import {
    AlertTriangle,
    BarChart3,
    Car,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    MapPin,
    RefreshCw,
    Route,
    X,
    XCircle,
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import {
    Bar, BarChart, CartesianGrid, Cell, Legend,
    LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos do JSON de Rota Coaching
// ─────────────────────────────────────────────────────────────────────────────

interface RotaRow {
    data: string;
    rev: string;
    gaId: string;
    vendId: string;
    fonte: string;
    agendado: boolean;
    status: "ok" | "partial" | "nok" | "na";
    pdvsProg: number;
    pdvsVis: number;
    gaVis: number;
    pctGA: number;
    pctV: number;
    atividade?: string;
    vendedor_no_app?: string;
    clientes_comuns?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes visuais
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
    ok: { bg: "bg-green-50 border-green-200 text-green-700", dot: "bg-green-500", label: "Completo" },
    partial: { bg: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-400", label: "Parcial" },
    nok: { bg: "bg-red-50 border-red-200 text-red-600", dot: "bg-red-400", label: "Não Realizado" },
    na: { bg: "bg-slate-50 border-slate-200 text-slate-500", dot: "bg-slate-300", label: "Sem Agenda" },
};

const CHART_COLORS = ["#22d3ee", "#facc15", "#f87171", "#34d399", "#818cf8", "#fb923c"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtMin(min: number): string {
    if (min <= 0) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function periodoHoje(date: string) {
    // Infleet DateTime! exige timezone explícito — usa horário de Brasília (UTC-3)
    return { inicio: `${date}T00:00:00-03:00`, fim: `${date}T23:59:59-03:00` };
}

const FILTER_KEY = "metricflow:rota-coaching-filters";
function loadFilters() {
    try { return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch { return {}; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function RotaCoaching() {
    const [activePage, setActivePage] = useState("rota_coaching");
    const [aba, setAba] = useState<"coaching" | "frota">("coaching");
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);
    const [allData, setAllData] = useState<RotaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Infleet — veículos selecionados
    const [vehiclesSel, setVehiclesSel] = useState<string[]>([]);

    // ── Filtros ─────────────────────────────────────────────────────────────────
    const setFiltro = (k: string, v: any) => {
        setFiltros(prev => {
            const next = { ...prev, [k]: v ?? undefined };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });
    };
    const resetFiltros = () => { setFiltros({}); localStorage.removeItem(FILTER_KEY); };

    const date = filtros.date ?? todayIso();
    const revenda = filtros.revenda ?? "";
    const ga = filtros.ga ?? "";
    const status = filtros.status ?? "";

    // ── Carrega JSON ────────────────────────────────────────────────────────────
    const carregarDados = () => {
        setLoading(true); setErro(null);
        fetch(`/rota_coaching_all.json?t=${Date.now()}`)
            .then(r => { if (!r.ok) throw new Error("rota_coaching_all.json não encontrado na pasta public."); return r.json(); })
            .then((d: RotaRow[]) => { setAllData(d.filter(r => r.gaId && r.gaId !== "-")); setLoading(false); })
            .catch(e => { setErro(e.message); setLoading(false); });
    };

    useEffect(() => { carregarDados(); }, []);

    // ── Filtros derivados ───────────────────────────────────────────────────────
    const baseFiltrado = useMemo(() => {
        let d = allData.filter(r => r.data === date);
        if (revenda) d = d.filter(r => r.rev === revenda);
        if (ga) d = d.filter(r => r.gaId === ga);
        return d;
    }, [allData, date, revenda, ga]);

    const tabelaFiltrada = useMemo(() => {
        let d = baseFiltrado;
        if (status) d = d.filter(r => r.status === status);
        return d;
    }, [baseFiltrado, status]);

    const revendasUnicas = useMemo(() =>
        [...new Set(allData.filter(r => r.data === date && r.rev).map(r => r.rev))].sort(),
        [allData, date]);

    const gasUnicos = useMemo(() =>
        [...new Set(allData.filter(r => r.data === date && r.gaId !== "-").map(r => r.gaId))].sort(),
        [allData, date]);

    // ── KPIs ────────────────────────────────────────────────────────────────────
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

    // ── Dados gráficos ──────────────────────────────────────────────────────────
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

    // ── Toggle linha expandida ──────────────────────────────────────────────────
    const toggleRow = (i: number) => {
        const s = new Set(expandedRows);
        s.has(i) ? s.delete(i) : s.add(i);
        setExpandedRows(s);
    };

    // ── Infleet queries (só ativas na aba frota) ────────────────────────────────
    const { data: veiculosInfleet = [] } = trpc.infleet.veiculos.useQuery(undefined, {
        enabled: aba === "frota",
        retry: false,
        onError: () => { }, // silencia — token pode não estar configurado
    });

    const { data: resumoInfleet = [], isLoading: loadingInfleet } = trpc.infleet.resumoDiario.useQuery(
        { vehicleIds: vehiclesSel, periodo: periodoHoje(date) },
        { enabled: aba === "frota" && vehiclesSel.length > 0, retry: false }
    );

    // ── Navegação ───────────────────────────────────────────────────────────────
    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio", relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching"
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "rota_coaching") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <main className="flex-1 ml-60 min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm px-8 py-4 border-b border-slate-100 flex items-center justify-between"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div>
                        <h1 className="text-xl text-slate-800" style={{ fontWeight: 900 }}>Monitor de Campo</h1>
                        <p className="text-xs text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                            Rota Coaching · Conformidade GA/GV/TRD
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={carregarDados}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all"
                            style={{ fontWeight: 600 }}>
                            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 bg-emerald-50 border border-emerald-100" style={{ fontWeight: 700 }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ao vivo
                        </div>
                    </div>
                </header>

                <div className="px-8 py-6 space-y-6">

                    {/* Abas */}
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                        {([
                            ["coaching", <Route className="w-4 h-4" />, "Rota Coaching"],
                            ["frota", <Car className="w-4 h-4" />, "Frota Infleet"],
                        ] as const).map(([id, icon, label]) => (
                            <button key={id} onClick={() => setAba(id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all ${aba === id
                                        ? "bg-white text-slate-800 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                    }`}
                                style={{ fontWeight: aba === id ? 700 : 500 }}>
                                {icon} {label}
                            </button>
                        ))}
                    </div>

                    {/* ── Filtros (compartilhados pelas duas abas) ─────────────────────── */}
                    <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
                        style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                        <FiltroInput label="Data" type="date" value={date} onChange={v => setFiltro("date", v)} />

                        <FiltroSelect label="Revenda" value={revenda} onChange={v => setFiltro("revenda", v || undefined)}
                            options={revendasUnicas.map(r => ({ value: r, label: r }))} placeholder="Todas" />

                        {aba === "coaching" && <>
                            <FiltroSelect label="GA" value={ga} onChange={v => setFiltro("ga", v || undefined)}
                                options={gasUnicos.map(g => ({ value: g, label: g }))} placeholder="Todos" />

                            <FiltroSelect label="Status" value={status} onChange={v => setFiltro("status", v || undefined)}
                                options={[
                                    { value: "ok", label: "✅ Completo" },
                                    { value: "partial", label: "⚠️ Parcial" },
                                    { value: "nok", label: "❌ Não Realizado" },
                                    { value: "na", label: "➖ Sem Agenda" },
                                ]} placeholder="Todos os status" />
                        </>}

                        {(revenda || ga || status) && (
                            <button onClick={resetFiltros}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-all"
                                style={{ fontWeight: 600 }}>
                                <X className="w-3.5 h-3.5" /> Limpar
                            </button>
                        )}
                    </div>

                    {/* ══════════════════════════════════════════════════════════════════
              ABA: ROTA COACHING
          ══════════════════════════════════════════════════════════════════ */}
                    {aba === "coaching" && (
                        <>
                            {loading && (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                                </div>
                            )}

                            {erro && (
                                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                                    <p className="text-red-600 text-sm" style={{ fontWeight: 600 }}>⚠️ {erro}</p>
                                    <p className="text-red-400 text-xs mt-1">Mova o arquivo rota_coaching_all.json para a pasta public do projeto.</p>
                                </div>
                            )}

                            {!loading && !erro && (
                                <>
                                    {/* KPI Cards */}
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                        {[
                                            { label: "Revendas", value: kpis.revendas, color: "text-indigo-600", bg: "from-indigo-50 to-blue-50", border: "border-indigo-100" },
                                            { label: "Completo", value: kpis.ok, color: "text-green-600", bg: "from-green-50 to-emerald-50", border: "border-green-100" },
                                            { label: "Parcial", value: kpis.par, color: "text-amber-600", bg: "from-amber-50 to-yellow-50", border: "border-amber-100" },
                                            { label: "Não Realizado", value: kpis.nok, color: "text-red-500", bg: "from-red-50 to-rose-50", border: "border-red-100" },
                                            { label: "Taxa Geral", value: kpis.taxa, color: "text-indigo-600", bg: "from-slate-50 to-indigo-50", border: "border-slate-100" },
                                        ].map(k => (
                                            <div key={k.label} className={`bg-gradient-to-br ${k.bg} rounded-2xl p-5 border ${k.border}`}
                                                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                                <p className="text-xs text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>{k.label}</p>
                                                <p className={`text-3xl mt-2 ${k.color}`} style={{ fontWeight: 900 }}>{k.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Tabela de conformidade */}
                                    <div className="bg-white rounded-2xl overflow-hidden"
                                        style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                        <div className="px-5 py-4 border-b border-slate-100">
                                            <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Conformidade de Rota</h3>
                                            <p className="text-xs text-slate-400 mt-0.5">{tabelaFiltrada.length} registros · clique para expandir detalhes</p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="w-10 px-4 py-3" />
                                                        {["Status", "Revenda", "GA", "Vendedor", "Prog / Vis / GA", "Conformidade"].map(h => (
                                                            <th key={h} className="px-4 py-3 text-xs text-slate-500 uppercase tracking-widest text-left" style={{ fontWeight: 700 }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tabelaFiltrada.length === 0 ? (
                                                        <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Nenhum dado encontrado.</td></tr>
                                                    ) : tabelaFiltrada.map((row, idx) => {
                                                        const sc = STATUS_COLORS[row.status];
                                                        const isExp = expandedRows.has(idx);
                                                        const pc = row.pctGA >= 100 ? "text-green-600" : row.pctGA > 0 ? "text-amber-600" : "text-red-500";

                                                        return (
                                                            <React.Fragment key={`row-${idx}`}>
                                                                <tr
                                                                    className={`border-b border-slate-50 cursor-pointer transition-colors ${isExp ? "bg-indigo-50/30" : "hover:bg-slate-50/80"}`}
                                                                    onClick={() => toggleRow(idx)}>
                                                                    <td className="px-4 py-3 text-slate-400 text-center text-xs">
                                                                        {isExp ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.bg}`} style={{ fontWeight: 700 }}>{sc.label}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>{row.rev || "—"}</td>
                                                                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">{row.gaId}</td>
                                                                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">{row.vendId}</td>
                                                                    <td className="px-4 py-3 text-xs text-center font-mono">
                                                                        <span className="text-slate-400">{row.pdvsProg}</span> /
                                                                        <span className="text-indigo-600 mx-0.5">{row.pdvsVis}</span> /
                                                                        <span className={pc}>{row.gaVis}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <span className={`text-xl tabular-nums ${row.agendado ? pc : "text-slate-300"}`} style={{ fontWeight: 800 }}>
                                                                            {row.agendado ? `${row.pctGA}%` : "—"}
                                                                        </span>
                                                                    </td>
                                                                </tr>

                                                                {/* Detalhe expandido */}
                                                                {isExp && (
                                                                    <tr className="border-b border-slate-100">
                                                                        <td colSpan={7} className="bg-slate-50/60 px-6 py-4">
                                                                            <div className="grid grid-cols-2 gap-6 border border-slate-200 rounded-xl p-4 bg-white">
                                                                                {/* Perguntas de controle */}
                                                                                <div>
                                                                                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1" style={{ fontWeight: 700 }}>Perguntas de Controle</p>
                                                                                    <div className="grid grid-cols-2 gap-3">
                                                                                        {[
                                                                                            ["GA fez a Rota?",
                                                                                                row.agendado ? (row.gaVis > 0 ? <span className="text-green-600">✅ Sim</span> : <span className="text-red-500">❌ Não</span>) : <span className="text-slate-400">— Não Agendado</span>],
                                                                                            ["Vendedor no App GA", <span className="font-mono text-indigo-600">{row.agendado && row.gaVis > 0 ? (row.vendedor_no_app || "N/A") : "—"}</span>],
                                                                                            ["Clientes Programados", <span className="font-mono">{row.pdvsProg} PDVs</span>],
                                                                                            ["Clientes Comuns", <span className="font-mono text-indigo-600">{row.clientes_comuns?.length ?? 0} PDVs</span>],
                                                                                        ].map(([lbl, val]) => (
                                                                                            <div key={String(lbl)} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                                                                <p className="text-xs text-slate-400 mb-1" style={{ fontWeight: 600 }}>{lbl}</p>
                                                                                                <div className="text-sm" style={{ fontWeight: 600 }}>{val}</div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Barras de progresso */}
                                                                                <div>
                                                                                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1" style={{ fontWeight: 700 }}>Cobertura de Visitas</p>
                                                                                    {[
                                                                                        { label: "PathTracker (Vendedor visitou)", val: row.pdvsVis, total: row.pdvsProg, color: "bg-indigo-400" },
                                                                                        { label: "App do GA (GA acompanhou)", val: row.gaVis, total: row.pdvsProg, color: row.pctGA >= 100 ? "bg-green-400" : row.pctGA > 0 ? "bg-amber-400" : "bg-red-400" },
                                                                                    ].map(b => (
                                                                                        <div key={b.label} className="mb-4">
                                                                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                                                                <span>{b.label}</span>
                                                                                                <span className="font-mono" style={{ fontWeight: 600 }}>{b.val}/{b.total}</span>
                                                                                            </div>
                                                                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                                                <div className={`h-full rounded-full transition-all ${b.color}`}
                                                                                                    style={{ width: `${Math.min(100, b.total > 0 ? (b.val / b.total) * 100 : 0)}%` }} />
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                    <p className="text-xs text-slate-400 italic mt-3 pt-2 border-t border-slate-100">
                                                                                        {!row.agendado
                                                                                            ? "Nenhuma rota agendada para este GA."
                                                                                            : row.gaVis === 0
                                                                                                ? "GA não enviou formulários no app para esta rota."
                                                                                                : row.gaVis >= row.pdvsProg
                                                                                                    ? "Conformidade total atingida."
                                                                                                    : `GA não completou a rota (faltaram ${row.pdvsProg - row.gaVis} visitas).`}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Gráficos */}
                                    {baseFiltrado.some(r => r.agendado) && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <ChartCard title="Visitas realizadas pelo GA" subtitle="Clientes únicos acompanhados">
                                                <ResponsiveContainer width="100%" height={220}>
                                                    <BarChart data={dadosGA} margin={{ top: 20, right: 10, left: -10, bottom: 0 }} barSize={28}>
                                                        <CartesianGrid vertical={false} stroke="#F1F5F9" />
                                                        <XAxis dataKey="ga" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                                                        <Tooltip contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} />
                                                        <Bar dataKey="visitas" name="Visitas GA" radius={[6, 6, 0, 0]}>
                                                            <LabelList dataKey="visitas" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#64748B" }} />
                                                            {dadosGA.map((e, i) => (
                                                                <Cell key={i} fill={e.visitas >= e.prog ? "#34d399" : e.visitas > 0 ? "#facc15" : "#f87171"} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ChartCard>

                                            <ChartCard title="Conformidade por revenda" subtitle="Distribuição de status">
                                                <ResponsiveContainer width="100%" height={220}>
                                                    <BarChart data={dadosRevenda} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barSize={32}>
                                                        <CartesianGrid vertical={false} stroke="#F1F5F9" />
                                                        <XAxis dataKey="rev" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                        <Tooltip contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} />
                                                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="square" iconSize={8} />
                                                        <Bar dataKey="Completo" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="Parcial" stackId="a" fill="#facc15" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="Não Realizado" stackId="a" fill="#f87171" radius={[6, 6, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ChartCard>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ══════════════════════════════════════════════════════════════════
              ABA: FROTA INFLEET
          ══════════════════════════════════════════════════════════════════ */}
                    {aba === "frota" && (
                        <div className="space-y-4">
                            {/* Seleção de veículos */}
                            <div className="bg-white rounded-2xl p-5"
                                style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                <h3 className="text-slate-700 text-sm mb-3" style={{ fontWeight: 700 }}>
                                    Veículos monitorados
                                    {veiculosInfleet.length === 0 && (
                                        <span className="ml-2 text-amber-500 text-xs" style={{ fontWeight: 500 }}>
                                            — Configure INFLEET_TOKEN no servidor para ativar
                                        </span>
                                    )}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {veiculosInfleet.map(v => (
                                        <button key={v.id}
                                            onClick={() => setVehiclesSel(prev =>
                                                prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id]
                                            )}
                                            className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${vehiclesSel.includes(v.id)
                                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                                    : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                                                }`}
                                            style={{ fontWeight: 600 }}>
                                            {v.nome} · {v.placa}
                                        </button>
                                    ))}
                                    {veiculosInfleet.length === 0 && (
                                        <div className="text-sm text-slate-400 py-2">
                                            Nenhum veículo carregado — verifique a configuração da API Infleet.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tabela de resumo diário */}
                            {vehiclesSel.length > 0 && (
                                <div className="bg-white rounded-2xl overflow-hidden"
                                    style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                    <div className="px-5 py-4 border-b border-slate-100">
                                        <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Resumo do Dia — {date}</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">KM rodado, tempo ligado, parado e ocioso por veículo</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {loadingInfleet ? (
                                            <div className="flex items-center justify-center py-12">
                                                <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                                            </div>
                                        ) : (
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        {["Veículo", "KM Rodado", "Tempo Ligado", "Tempo Parado", "Tempo Ocioso"].map(h => (
                                                            <th key={h} className="px-5 py-3 text-xs text-slate-500 uppercase tracking-widest text-left" style={{ fontWeight: 700 }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {resumoInfleet.map((r, i) => {
                                                        const veiculo = veiculosInfleet.find(v => v.id === r.vehicleId);
                                                        return (
                                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                                <td className="px-5 py-3.5 text-sm text-slate-700" style={{ fontWeight: 600 }}>
                                                                    {veiculo?.nome ?? r.vehicleId}
                                                                    <span className="ml-2 text-xs text-slate-400">{veiculo?.placa}</span>
                                                                </td>
                                                                <td className="px-5 py-3.5 text-sm tabular-nums text-slate-700" style={{ fontWeight: 700 }}>
                                                                    {r.kmRodado} km
                                                                </td>
                                                                <td className="px-5 py-3.5 text-sm tabular-nums text-indigo-600">{fmtMin(r.tempoLigadoMin)}</td>
                                                                <td className="px-5 py-3.5 text-sm tabular-nums text-slate-600">{fmtMin(r.tempoParadoMin)}</td>
                                                                <td className="px-5 py-3.5 text-sm tabular-nums text-amber-600">{fmtMin(r.tempoOciosoMin)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            )}

                            {vehiclesSel.length === 0 && veiculosInfleet.length > 0 && (
                                <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
                                    Selecione ao menos um veículo acima para visualizar o resumo do dia.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="text-center py-4">
                        <p className="text-xs text-slate-300" style={{ fontWeight: 500 }}>
                            MetricFlow · Monitor de Campo · {new Date().toLocaleDateString("pt-BR")}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────────

function FiltroInput({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
    );
}

function FiltroSelect({ label, value, onChange, options, placeholder }: {
    label: string; value: string; onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>; placeholder: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="mb-4">
                <h3 className="text-slate-800 text-sm" style={{ fontWeight: 800 }}>{title}</h3>
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}