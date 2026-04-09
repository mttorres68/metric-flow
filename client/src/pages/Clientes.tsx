/*
 * MetricFlow — Página de Clientes
 * Análise individual de clientes: histórico completo de visitas,
 * status, motivos e evolução temporal.
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    Clock,
    MapPin,
    MinusCircle,
    Search,
    Users,
    X,
    XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_KEY = "metricflow:clientes-filters";

const STATUS_CONFIG = {
    convertido: { label: "Convertido", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-100" },
    nao_convertido: { label: "Não Conv.", icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-100" },
    sem_visita: { label: "Sem visita", icon: MinusCircle, color: "text-slate-400", bg: "bg-slate-50 border-slate-200" },
} as const;

type SortKey = "totalVisitas" | "convertidas" | "naoConvertidas" | "ultimaVisita" | "totalDuracaoMin";

// Formata minutos para "Xh YYmin" ou "YYmin"
function formatDuracao(min: number): string {
    if (min <= 0) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}
type SortDir = "asc" | "desc";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de filtro persistido — mesmo padrão do Compliance (callback form)
// ─────────────────────────────────────────────────────────────────────────────

function loadFilters() {
    try { return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch { return {}; }
}

function useFiltroPersistido() {
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);

    const setFiltro = (k: string, v: any) =>
        setFiltros(prev => {
            const next = { ...prev, [k]: v ?? undefined };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });

    // Atualiza múltiplas chaves atomicamente (evita closure stale ao trocar revenda)
    const setFiltrosMulti = (parcial: Record<string, any>) =>
        setFiltros(prev => {
            const next = { ...prev, ...parcial };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });

    const resetFiltros = () => { setFiltros({}); localStorage.removeItem(FILTER_KEY); };
    const temFiltro = Object.values(filtros).some(Boolean);

    return { filtros, setFiltro, setFiltrosMulti, resetFiltros, temFiltro };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function Clientes() {
    const [activePage, setActivePage] = useState("clientes");
    const { filtros, setFiltro, setFiltrosMulti, resetFiltros, temFiltro } = useFiltroPersistido();

    // Busca local + ordenação da tabela
    const [busca, setBusca] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("totalVisitas");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [expandido, setExpandido] = useState<number | null>(null);

    const toggleSort = (k: SortKey) => {
        if (sortKey === k) setSortDir(d => d === "desc" ? "asc" : "desc");
        else { setSortKey(k); setSortDir("desc"); }
    };

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: revendas = [] } = trpc.clientes.revendas.useQuery();

    const { data: vendedoresList = [] } = trpc.clientes.vendedores.useQuery({
        revenda: filtros.revenda,
    });

    const { data: clientes = [], isLoading } = trpc.clientes.listar.useQuery({
        revenda: filtros.revenda,
        vendedor: filtros.vendedor ? Number(filtros.vendedor) : undefined,
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
    });

    // ── Navegação ───────────────────────────────────────────────────────────────
    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching", analises: "/analises",
            trello_atraso: "/trello-atraso",
            whatsapp: "/whatsapp",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "clientes") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    // ── Tabela filtrada e ordenada ────────────────────────────────────────────
    const tabelaFiltrada = useMemo(() => {
        let lista = [...clientes];

        if (busca.trim()) {
            const q = busca.toLowerCase();
            lista = lista.filter(c =>
                c.cliente.toLowerCase().includes(q) ||
                String(c.codCliente).includes(q)
            );
        }

        lista.sort((a, b) => {
            const av = a[sortKey] as any;
            const bv = b[sortKey] as any;
            const diff = typeof av === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
            return sortDir === "desc" ? -diff : diff;
        });

        return lista;
    }, [clientes, busca, sortKey, sortDir]);

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) return (
        <PageShell activePage={activePage} onNavigate={handleNavigate}>
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500" style={{ fontWeight: 600 }}>Carregando clientes...</p>
                </div>
            </div>
        </PageShell>
    );

    return (
        <PageShell activePage={activePage} onNavigate={handleNavigate}>
            {/* Header */}
            <header
                className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm px-8 py-4 border-b border-slate-100 flex items-center justify-between"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
                <div>
                    <h1 className="text-xl text-slate-800" style={{ fontWeight: 900 }}>Análise de Clientes</h1>
                    <p className="text-xs text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                        Histórico completo de visitas por cliente · {clientes.length} clientes
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 bg-emerald-50 border border-emerald-100" style={{ fontWeight: 700 }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ao vivo
                </div>
            </header>

            <div className="px-8 py-6 space-y-6">

                {/* ── Filtros ─────────────────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
                    style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

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
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-all"
                            style={{ fontWeight: 600 }}>
                            <X className="w-3.5 h-3.5" /> Limpar
                        </button>
                    )}
                </div>

                {/* ── Tabela principal ─────────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl overflow-hidden"
                    style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                    {/* Cabeçalho da tabela */}
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Clientes</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {tabelaFiltrada.length} de {clientes.length} · clique para expandir histórico de visitas
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar cliente ou código..."
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                                className="bg-transparent text-xs text-slate-700 placeholder-slate-400 focus:outline-none w-44"
                                style={{ fontWeight: 500 }}
                            />
                            {busca && <button onClick={() => setBusca("")}><X className="w-3 h-3 text-slate-400" /></button>}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>Cliente</th>
                                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>Revenda</th>
                                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>Vendedores</th>
                                    <ThSort k="totalVisitas" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort}>Visitas</ThSort>
                                    <ThSort k="convertidas" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort}>Conv.</ThSort>
                                    <ThSort k="naoConvertidas" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort}>Não Conv.</ThSort>
                                    <ThSort k="totalDuracaoMin" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort}>Duração total</ThSort>
                                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>Status</th>
                                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>Motivo freq.</th>
                                    <ThSort k="ultimaVisita" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} align="left">Última visita</ThSort>
                                </tr>
                            </thead>
                            <tbody>
                                {tabelaFiltrada.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-400">
                                            Nenhum cliente encontrado
                                        </td>
                                    </tr>
                                ) : tabelaFiltrada.map(c => {
                                    const isExp = expandido === c.codCliente;
                                    const statusCfg = STATUS_CONFIG[c.statusPredominante as keyof typeof STATUS_CONFIG];
                                    const StatusIcon = statusCfg.icon;

                                    return (
                                        <>
                                            {/* Linha principal */}
                                            <tr
                                                key={c.codCliente}
                                                className={`border-b border-slate-50 transition-colors cursor-pointer ${isExp ? "bg-indigo-50/40" : "hover:bg-slate-50/80"}`}
                                                onClick={() => setExpandido(isExp ? null : c.codCliente)}
                                            >
                                                <td className="px-5 py-3.5">
                                                    <div>
                                                        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{c.cliente}</p>
                                                        <p className="text-xs text-slate-400 tabular-nums">Cód. {c.codCliente}</p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-500" style={{ fontWeight: 500 }}>{c.revenda}</td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {c.vendedoresList.slice(0, 3).map(v => (
                                                            <span key={v} className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600" style={{ fontWeight: 600 }}>{v}</span>
                                                        ))}
                                                        {c.vendedoresList.length > 3 && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400">+{c.vendedoresList.length - 3}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-slate-700 text-right" style={{ fontWeight: 700 }}>{c.totalVisitas}</td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-green-600 text-right" style={{ fontWeight: 600 }}>{c.convertidas}</td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-right" style={{ fontWeight: 600, color: c.naoConvertidas > 0 ? "#EF4444" : "#94A3B8" }}>{c.naoConvertidas}</td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-right text-slate-600" style={{ fontWeight: 600 }}>
                                                    {formatDuracao(c.totalDuracaoMin)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${statusCfg.bg} ${statusCfg.color}`} style={{ fontWeight: 700 }}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusCfg.label}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 max-w-36">
                                                    {c.motivoFrequente ? (
                                                        <span className="text-xs text-slate-500 truncate block" title={c.motivoFrequente}>{c.motivoFrequente}</span>
                                                    ) : (
                                                        <span className="text-xs text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs text-slate-500 tabular-nums">
                                                            {c.ultimaVisita ? (() => {
                                                                const p = c.ultimaVisita.split("-");
                                                                return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : c.ultimaVisita;
                                                            })() : "—"}
                                                        </span>
                                                        {isExp
                                                            ? <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" />
                                                            : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                                                        }
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Visitas expandidas */}
                                            {isExp && (
                                                <tr key={`${c.codCliente}-exp`} className="border-b border-slate-100">
                                                    <td colSpan={10} className="bg-slate-50/60 px-6 py-4">
                                                        <p className="text-xs text-slate-500 mb-3" style={{ fontWeight: 700 }}>
                                                            HISTÓRICO DE VISITAS — {c.visitas.length} {c.visitas.length === 1 ? "registro" : "registros"}
                                                        </p>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-slate-400 uppercase tracking-widest">
                                                                        <th className="py-1.5 pr-6 text-left" style={{ fontWeight: 700 }}>Data</th>
                                                                        <th className="py-1.5 pr-6 text-left" style={{ fontWeight: 700 }}>Vendedor</th>
                                                                        <th className="py-1.5 pr-6 text-left" style={{ fontWeight: 700 }}>
                                                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Início</span>
                                                                        </th>
                                                                        <th className="py-1.5 pr-6 text-left" style={{ fontWeight: 700 }}>Fim</th>
                                                                        <th className="py-1.5 pr-6 text-left" style={{ fontWeight: 700 }}>Duração</th>
                                                                        <th className="py-1.5 pr-6 text-left" style={{ fontWeight: 700 }}>
                                                                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Dist. PV</span>
                                                                        </th>
                                                                        <th className="py-1.5 pr-6 text-left" style={{ fontWeight: 700 }}>Status</th>
                                                                        <th className="py-1.5 text-left" style={{ fontWeight: 700 }}>Motivo</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {c.visitas.map((v, idx) => {
                                                                        const distNum = parseFloat(v.distPV.replace(",", "."));
                                                                        const distAlta = !isNaN(distNum) && distNum > 500;
                                                                        const sCfg = STATUS_CONFIG[v.status as keyof typeof STATUS_CONFIG];
                                                                        const SIcon = sCfg?.icon ?? MinusCircle;

                                                                        return (
                                                                            <tr key={idx} className={`border-t border-slate-100 ${idx % 2 === 0 ? "" : "bg-white/60"}`}>
                                                                                <td className="py-2 pr-6 text-slate-600 tabular-nums">
                                                                                    {(() => {
                                                                                        const p = v.data.split("-");
                                                                                        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v.data;
                                                                                    })()}
                                                                                </td>
                                                                                <td className="py-2 pr-6 text-slate-600">V0{v.vendedor}</td>
                                                                                <td className="py-2 pr-6 text-slate-600 tabular-nums">{v.horaInicio === "ND" ? "—" : v.horaInicio}</td>
                                                                                <td className="py-2 pr-6 text-slate-600 tabular-nums">{v.horaFim === "ND" ? "—" : v.horaFim}</td>
                                                                                <td className="py-2 pr-6 text-slate-600 tabular-nums">{v.duracao === "ND" ? "—" : v.duracao}</td>
                                                                                <td className="py-2 pr-6 tabular-nums">
                                                                                    <span className={`px-1.5 py-0.5 rounded-md text-xs ${v.distPV === "ND"
                                                                                        ? "text-slate-400"
                                                                                        : distAlta
                                                                                            ? "bg-red-50 text-red-600"
                                                                                            : "bg-green-50 text-green-700"
                                                                                        }`} style={{ fontWeight: 600 }}>
                                                                                        {v.distPV === "ND" ? "—" : `${v.distPV}m`}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="py-2 pr-6">
                                                                                    <div className={`inline-flex items-center gap-1 text-xs ${sCfg?.color ?? "text-slate-400"}`} style={{ fontWeight: 600 }}>
                                                                                        <SIcon className="w-3 h-3" />
                                                                                        {sCfg?.label ?? v.status}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2 text-slate-500 max-w-56">
                                                                                    <span className="truncate block" title={v.motivo}>
                                                                                        {v.motivo === "Pedido realizado" || v.motivo === "Sem visita registrada"
                                                                                            ? <span className="text-slate-300">—</span>
                                                                                            : v.motivo}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="text-center py-4">
                    <p className="text-xs text-slate-300" style={{ fontWeight: 500 }}>
                        MetricFlow · Análise de Clientes · {new Date().toLocaleDateString("pt-BR")}
                    </p>
                </div>
            </div>
        </PageShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────────────────────────────────────

function PageShell({ activePage, onNavigate, children }: {
    activePage: string;
    onNavigate: (p: string) => void;
    children: React.ReactNode;
}) {
    const { isCollapsed } = useSidebarCollapse();
    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar activePage={activePage} onNavigate={onNavigate} />
            <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-60'}`}>{children}</main>
        </div>
    );
}

function FilterSelect({ label, value, onChange, placeholder, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

function FilterDate({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
        </div>
    );
}

function ThSort({ k, sortKey, sortDir, onToggle, children, align = "right" }: {
    k: SortKey;
    sortKey: SortKey;
    sortDir: SortDir;
    onToggle: (k: SortKey) => void;
    children: React.ReactNode;
    align?: "left" | "right";
}) {
    const active = sortKey === k;
    const Icon = active ? (sortDir === "desc" ? ChevronDown : ChevronUp) : ChevronsUpDown;
    return (
        <th
            className={`px-5 py-3 text-xs uppercase tracking-widest cursor-pointer select-none whitespace-nowrap transition-colors
        text-${align} ${active ? "text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            style={{ fontWeight: 700 }}
            onClick={() => onToggle(k)}
        >
            <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
                {children}
                <Icon className="w-3 h-3 opacity-60" />
            </span>
        </th>
    );
}