/*
 * MetricFlow — Página de Compliance
 * Análise de justificativas de não conversão: visão macro e micro
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import {
    AlertCircle,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Clock,
    MapPin,
    Search,
    Users,
    X,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { toast } from "sonner";

const PASTEL_COLORS = [
    "#F4A8A8", "#F4C5A8", "#F4E8A8", "#A8F4C5",
    "#A8C5E8", "#C5A8F4", "#F4A8C5", "#A8D4F4",
];

const FILTER_KEY = "metricflow:compliance-filters";
function loadFilters() {
    try { return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch { return {}; }
}

export default function Compliance() {
    const [activePage, setActivePage] = useState("compliance");

    // ── Filtros persistidos ────────────────────────────────────────────────
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);

    // Usa callback form do setState para sempre partir do estado mais recente,
    // evitando o problema de closure stale quando duas atualizações seguidas ocorrem.
    const setFiltro = (k: string, v: any) => {
        setFiltros(prev => {
            const next = { ...prev, [k]: v ?? undefined };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });
    };

    // Atualiza múltiplas chaves de uma vez — necessário ao trocar revenda,
    // que deve também zerar o vendedor selecionado em um único render.
    const setFiltrosMulti = (parcial: Record<string, any>) => {
        setFiltros(prev => {
            const next = { ...prev, ...parcial };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });
    };

    const resetFiltros = () => { setFiltros({}); localStorage.removeItem(FILTER_KEY); };
    const temFiltro = Object.values(filtros).some(Boolean);

    // ── Motivo selecionado (drill-down) ────────────────────────────────────
    const [motivoSelecionado, setMotivoSelecionado] = useState<string | null>(null);
    const [buscaCliente, setBuscaCliente] = useState("");
    const [clienteExpandido, setClienteExpandido] = useState<number | null>(null);

    // ── Queries ────────────────────────────────────────────────────────────
    const { data: revendas = [] } = trpc.compliance.revendas.useQuery();

    const { data: vendedoresList = [] } = trpc.compliance.vendedores.useQuery({
        revenda: filtros.revenda,
    });

    const { data: macro, isLoading: loadingMacro } = trpc.compliance.resumoMotivos.useQuery({
        revenda: filtros.revenda,
        vendedor: filtros.vendedor ? Number(filtros.vendedor) : undefined,
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
    });

    const { data: micro, isLoading: loadingMicro } = trpc.compliance.clientesPorMotivo.useQuery(
        {
            motivo: motivoSelecionado!,
            revenda: filtros.revenda,
            vendedor: filtros.vendedor ? Number(filtros.vendedor) : undefined,
            dataInicio: filtros.dataInicio,
            dataFim: filtros.dataFim,
        },
        { enabled: !!motivoSelecionado }
    );

    const { data: temporal, isLoading: loadingTemporal } = trpc.compliance.evolucaoTemporal.useQuery({
        revenda: filtros.revenda,
        vendedor: filtros.vendedor ? Number(filtros.vendedor) : undefined,
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        topN: 5,
    });

    // ── Navegação ───────────────────────────────────────────────────────────────
    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "compliance") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    // Clientes filtrados por busca
    const clientesFiltrados = useMemo(() => {
        if (!micro) return [];
        const q = buscaCliente.toLowerCase().trim();
        if (!q) return micro;
        return micro.filter(c =>
            c.cliente.toLowerCase().includes(q) ||
            String(c.codCliente).includes(q)
        );
    }, [micro, buscaCliente]);

    // Dados para o gráfico macro
    const dadosGrafico = useMemo(() =>
        (macro?.motivos ?? []).map((m, i) => ({
            name: m.motivo.length > 22 ? m.motivo.slice(0, 22) + "…" : m.motivo,
            nomeCompleto: m.motivo,
            value: m.total,
            perc: m.perc,
            fill: PASTEL_COLORS[i % PASTEL_COLORS.length],
        })),
        [macro]
    );

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <main className="flex-1 ml-60 min-h-screen">
                {/* Header */}
                <header
                    className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm px-8 py-4 border-b border-slate-100 flex items-center justify-between"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                >
                    <div>
                        <h1 className="text-xl text-slate-800" style={{ fontWeight: 900 }}>Compliance de Visitas</h1>
                        <p className="text-xs text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                            Análise de justificativas de não conversão
                            {macro && ` · ${macro.total} registros`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 bg-emerald-50 border border-emerald-100" style={{ fontWeight: 700 }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ao vivo
                    </div>
                </header>

                <div className="px-8 py-6 space-y-6">

                    {/* Filtros */}
                    <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
                        style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>Revenda</label>
                            <select value={filtros.revenda ?? ""} onChange={e => setFiltrosMulti({ revenda: e.target.value || undefined, vendedor: undefined })}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                <option value="">Todas</option>
                                {revendas.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>Vendedor</label>
                            <select value={filtros.vendedor ?? ""} onChange={e => setFiltro("vendedor", e.target.value || undefined)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                <option value="">Todos</option>
                                {vendedoresList.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>Data Início</label>
                            <input type="date" value={filtros.dataInicio ?? ""}
                                onChange={e => setFiltro("dataInicio", e.target.value || undefined)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>Data Fim</label>
                            <input type="date" value={filtros.dataFim ?? ""}
                                onChange={e => setFiltro("dataFim", e.target.value || undefined)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                        </div>

                        {temFiltro && (
                            <button onClick={resetFiltros}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-all"
                                style={{ fontWeight: 600 }}>
                                <X className="w-3.5 h-3.5" /> Limpar
                            </button>
                        )}
                    </div>

                    {/* ── MACRO ──────────────────────────────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                        {/* Gráfico de barras horizontais */}
                        <div className="lg:col-span-3 bg-white rounded-2xl p-5"
                            style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Ranking de Motivos</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Clique em um motivo para análise detalhada</p>
                                </div>
                                {motivoSelecionado && (
                                    <button onClick={() => setMotivoSelecionado(null)}
                                        className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-all"
                                        style={{ fontWeight: 600 }}>
                                        <X className="w-3 h-3" /> Limpar seleção
                                    </button>
                                )}
                            </div>

                            {loadingMacro ? (
                                <div className="flex items-center justify-center h-60">
                                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={Math.max(220, dadosGrafico.length * 36)}>
                                    <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }}
                                        onClick={(d) => { if (d?.activePayload?.[0]) setMotivoSelecionado(d.activePayload[0].payload.nomeCompleto); }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#64748B" }}
                                            width={160} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            cursor={{ fill: "rgba(99,102,241,0.06)" }}
                                            contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }}
                                            formatter={(v: number, _: any, props: any) => [
                                                `${v} ocorrências (${props.payload.perc.toFixed(1)}%)`, "Total"
                                            ]}
                                            labelFormatter={(label) => macro?.motivos.find(m => m.motivo.startsWith(label.replace("…", "")))?.motivo ?? label}
                                        />
                                        <Bar dataKey="value" radius={[0, 6, 6, 0]} cursor="pointer">
                                            {dadosGrafico.map((entry, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={entry.fill}
                                                    opacity={motivoSelecionado && motivoSelecionado !== entry.nomeCompleto ? 0.35 : 1}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Cards de motivos com top vendedores */}
                        <div className="lg:col-span-2 space-y-3 overflow-y-auto max-h-[520px] pr-1">
                            {loadingMacro ? (
                                <div className="flex items-center justify-center h-40">
                                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                                </div>
                            ) : (macro?.motivos ?? []).map((m, i) => (
                                <button key={m.motivo}
                                    onClick={() => setMotivoSelecionado(m.motivo === motivoSelecionado ? null : m.motivo)}
                                    className={`w-full text-left rounded-xl p-4 border transition-all ${motivoSelecionado === m.motivo
                                        ? "border-indigo-300 bg-indigo-50 shadow-sm"
                                        : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/80"
                                        }`}
                                    style={{ boxShadow: motivoSelecionado === m.motivo ? "0 2px 8px rgba(99,102,241,0.12)" : "0 1px 3px rgba(0,0,0,0.04)" }}>

                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <p className="text-xs text-slate-700 leading-snug" style={{ fontWeight: 700 }}>{m.motivo}</p>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-base text-slate-800 tabular-nums" style={{ fontWeight: 900 }}>{m.total}</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                    </div>

                                    {/* Barra de progresso */}
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                                        <div className="h-full rounded-full transition-all"
                                            style={{ width: `${m.perc}%`, background: PASTEL_COLORS[i % PASTEL_COLORS.length] }} />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400">{m.perc.toFixed(1)}% do total</span>
                                        <span className="text-xs text-slate-400">{m.clientesUnicos} clientes únicos</span>
                                    </div>

                                    {/* Top vendedores */}
                                    {m.topVendedores.length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap gap-1">
                                            {m.topVendedores.slice(0, 4).map(v => (
                                                <span key={v.vendedor}
                                                    className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600"
                                                    style={{ fontWeight: 600 }}>
                                                    {v.vendedor} <span className="text-slate-400">({v.count})</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── EVOLUÇÃO TEMPORAL ──────────────────────────────────────── */}
                    {(loadingTemporal || (temporal?.pontos?.length ?? 0) > 0) && (
                        <div className="bg-white rounded-2xl p-5"
                            style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Evolução Temporal</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Top 5 motivos ao longo do período</p>
                                </div>
                                {temporal && temporal.series.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {temporal.series.map((s, i) => (
                                            <span key={s} className="flex items-center gap-1.5 text-xs text-slate-600" style={{ fontWeight: 600 }}>
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PASTEL_COLORS[i % PASTEL_COLORS.length] }} />
                                                {s.length > 20 ? s.slice(0, 20) + "…" : s}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {loadingTemporal ? (
                                <div className="flex items-center justify-center h-52">
                                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                                </div>
                            ) : temporal && temporal.pontos.length === 1 ? (
                                // Só um dia de dados — exibe barras em vez de linha
                                <div className="space-y-3 py-2">
                                    <p className="text-xs text-slate-400 mb-3">Dados de {temporal.datas[0]} — use o filtro de período para ver a evolução</p>
                                    {temporal.series.map((s, i) => {
                                        const val = temporal.pontos[0][s] ?? 0;
                                        const max = Math.max(...temporal.series.map(ss => temporal.pontos[0][ss] ?? 0));
                                        return (
                                            <div key={s} className="flex items-center gap-3">
                                                <span className="text-xs text-slate-600 w-44 text-right truncate" style={{ fontWeight: 600 }}>{s}</span>
                                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all"
                                                        style={{ width: max > 0 ? `${(val / max) * 100}%` : "0%", background: PASTEL_COLORS[i % PASTEL_COLORS.length] }} />
                                                </div>
                                                <span className="text-xs tabular-nums text-slate-700 w-6 text-right" style={{ fontWeight: 700 }}>{val}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={temporal?.pontos ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                        <XAxis dataKey="data" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                                            tickFormatter={d => {
                                                // Formata YYYY-MM-DD → DD/MM
                                                const parts = d.split("-");
                                                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
                                            }}
                                        />
                                        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                                        <Tooltip
                                            contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }}
                                            labelFormatter={d => {
                                                const parts = d.split("-");
                                                return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
                                            }}
                                        />
                                        {(temporal?.series ?? []).map((serie, i) => (
                                            <Line key={serie} type="monotone" dataKey={serie}
                                                name={serie.length > 22 ? serie.slice(0, 22) + "…" : serie}
                                                stroke={PASTEL_COLORS[i % PASTEL_COLORS.length]}
                                                strokeWidth={2.5}
                                                dot={{ r: 3, fill: PASTEL_COLORS[i % PASTEL_COLORS.length], strokeWidth: 0 }}
                                                activeDot={{ r: 5 }}
                                                connectNulls
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    )}

                    {/* ── MICRO: drill-down ──────────────────────────────────────────── */}
                    {motivoSelecionado && (
                        <div className="bg-white rounded-2xl overflow-hidden"
                            style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                            {/* Sub-header */}
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-500" />
                                        <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>
                                            "{motivoSelecionado}"
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {loadingMicro ? "Carregando..." : `${clientesFiltrados.length} clientes · clique para expandir visitas`}
                                    </p>
                                </div>
                                {/* Busca */}
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                    <Search className="w-3.5 h-3.5 text-slate-400" />
                                    <input type="text" placeholder="Buscar cliente..."
                                        value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
                                        className="bg-transparent text-xs text-slate-700 placeholder-slate-400 focus:outline-none w-36"
                                        style={{ fontWeight: 500 }} />
                                    {buscaCliente && <button onClick={() => setBuscaCliente("")}><X className="w-3 h-3 text-slate-400" /></button>}
                                </div>
                            </div>

                            {loadingMicro ? (
                                <div className="flex items-center justify-center h-40">
                                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                                </div>
                            ) : clientesFiltrados.length === 0 ? (
                                <div className="px-5 py-10 text-center text-sm text-slate-400">Nenhum cliente encontrado</div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {clientesFiltrados.map(c => {
                                        const expandido = clienteExpandido === c.codCliente;
                                        return (
                                            <div key={c.codCliente}>
                                                {/* Linha do cliente */}
                                                <button
                                                    className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors text-left"
                                                    onClick={() => setClienteExpandido(expandido ? null : c.codCliente)}
                                                >
                                                    {/* Ocorrências badge */}
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs text-white shrink-0 ${c.ocorrencias >= 3 ? "bg-red-400" : c.ocorrencias === 2 ? "bg-amber-400" : "bg-slate-300"
                                                        }`} style={{ fontWeight: 800 }}>
                                                        {c.ocorrencias}x
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-800 truncate" style={{ fontWeight: 600 }}>{c.cliente}</p>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="text-xs text-slate-400">Cód. {c.codCliente}</span>
                                                            <span className="flex items-center gap-1 text-xs text-slate-400">
                                                                <Users className="w-3 h-3" />
                                                                {c.vendedores} {c.vendedores === 1 ? "vendedor" : "vendedores"}
                                                            </span>
                                                            <span className="text-xs text-slate-400">
                                                                {c.vendedoresList.join(", ")}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Chip de frequência */}
                                                    {c.ocorrencias >= 3 && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 shrink-0" style={{ fontWeight: 700 }}>
                                                            Recorrente
                                                        </span>
                                                    )}

                                                    {expandido ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                                                </button>

                                                {/* Visitas expandidas */}
                                                {expandido && (
                                                    <div className="bg-slate-50/60 px-5 pb-3">
                                                        <table className="w-full text-xs mt-1">
                                                            <thead>
                                                                <tr className="text-slate-400 uppercase tracking-widest">
                                                                    <th className="py-2 text-left" style={{ fontWeight: 700 }}>Data</th>
                                                                    <th className="py-2 text-left" style={{ fontWeight: 700 }}>Vendedor</th>
                                                                    <th className="py-2 text-left" style={{ fontWeight: 700 }}>
                                                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Início</span>
                                                                    </th>
                                                                    <th className="py-2 text-left" style={{ fontWeight: 700 }}>Duração</th>
                                                                    <th className="py-2 text-left" style={{ fontWeight: 700 }}>
                                                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Dist. PV</span>
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {c.visitas.map((v, idx) => (
                                                                    <tr key={idx} className="border-t border-slate-100">
                                                                        <td className="py-2 text-slate-600 tabular-nums">{v.data}</td>
                                                                        <td className="py-2 text-slate-600">V0{v.vendedor}</td>
                                                                        <td className="py-2 text-slate-600 tabular-nums">{v.horaInicio === "ND" ? "—" : v.horaInicio}</td>
                                                                        <td className="py-2 text-slate-600 tabular-nums">{v.duracao === "ND" ? "—" : v.duracao}</td>
                                                                        <td className="py-2 tabular-nums">
                                                                            <span className={`px-1.5 py-0.5 rounded-md ${v.distPV === "ND" ? "text-slate-400" :
                                                                                parseFloat(v.distPV.replace(",", ".")) > 500 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                                                                                }`} style={{ fontWeight: 600 }}>
                                                                                {v.distPV === "ND" ? "—" : `${v.distPV}m`}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="text-center py-4">
                        <p className="text-xs text-slate-300" style={{ fontWeight: 500 }}>
                            MetricFlow · Compliance · {new Date().toLocaleDateString("pt-BR")}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}