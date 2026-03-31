/*
 * MetricFlow — Análise
 * Visão analítica detalhada por vendedor/dia.
 * Combina métricas existentes (Visitas, Relâmpago, Após 14h) com novas
 * (Heishop, IV, IAV, Tempos, Percurso, Tempo Ñ Atendimento, Ranking Crítico).
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { EditorAnalise } from "@/components/EditorAnalise";
import {
    AlertTriangle, BarChart3,
    Clock, RefreshCw, TrendingDown, TrendingUp, X, FileText, PenLine
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { generateWordReport } from "@/lib/wordGenerator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number, decimals = 1) {
    return `${v.toFixed(decimals)}%`;
}

function fmt(v: number | null | undefined, suffix = "") {
    if (v === null || v === undefined) return "—";
    return `${v}${suffix}`;
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
    const styles: Record<string, string> = {
        green: "bg-green-50 text-green-700 border-green-200",
        red: "bg-red-50 text-red-600 border-red-200",
        amber: "bg-amber-50 text-amber-700 border-amber-200",
        blue: "bg-blue-50 text-blue-600 border-blue-200",
        slate: "bg-slate-50 text-slate-500 border-slate-200",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${styles[color] ?? styles.slate}`}>
            {children}
        </span>
    );
}

// Coluna com tooltip de descrição
function Th({ children, title, center }: { children: React.ReactNode; title?: string; center?: boolean }) {
    return (
        <th
            title={title}
            className={`px-2 py-2.5 text-xs font-bold text-slate-100 uppercase tracking-wider whitespace-nowrap border-b border-slate-100 ${center ? "text-center" : "text-left"} cursor-help`}
        >
            {children}
        </th>
    );
}

function Td({ children, center, mono, className = "" }: {
    children: React.ReactNode; center?: boolean; mono?: boolean; className?: string
}) {
    return (
        <td className={`px-2 py-2 text-xs border-b border-slate-100 ${center ? "text-center" : ""} ${mono ? "font-mono" : ""} ${className}`}>
            {children}
        </td>
    );
}

// ─── Helpers de filtro persistido ─────────────────────────────────────────────

const FILTER_KEY = "metricflow:analises-filters";

// ─── Persistência de análises por revenda ─────────────────────────────────────

const ANALISES_REVENDA_KEY = "metricflow:analises-revenda";

function carregarAnalisesRevenda(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(ANALISES_REVENDA_KEY) || "{}"); }
    catch { return {}; }
}

function useAnalisesRevenda(dataInicio: string, dataFim: string) {
    const [analises, setAnalises] = useState<Record<string, string>>(carregarAnalisesRevenda);

    const pkAnalise = (revenda: string) => `${revenda}__${dataInicio}__${dataFim}`;

    const getAnalise = useCallback((revenda: string): string =>
        analises[pkAnalise(revenda)] || "",
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [analises, dataInicio, dataFim]);

    const setAnalise = useCallback((revenda: string, html: string) => {
        setAnalises(prev => {
            const next = { ...prev, [pkAnalise(revenda)]: html };
            localStorage.setItem(ANALISES_REVENDA_KEY, JSON.stringify(next));
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataInicio, dataFim]);

    // Retorna todas as análises do período atual como { revenda: html }
    const analisesDoPeríodo = useCallback((): Record<string, string> => {
        const resultado: Record<string, string> = {};
        Object.entries(analises).forEach(([key, html]) => {
            if (key.endsWith(`__${dataInicio}__${dataFim}`) && html.trim()) {
                const revenda = key.replace(`__${dataInicio}__${dataFim}`, "");
                resultado[revenda] = html;
            }
        });
        return resultado;
    }, [analises, dataInicio, dataFim]);

    return { getAnalise, setAnalise, analisesDoPeríodo };
}

function loadFilters() {
    try {
        const stored = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}");
        if (!("dataInicio" in stored) && !("dataFim" in stored)) {
            stored.dataInicio = new Date().toISOString().slice(0, 10);
            stored.dataFim = new Date().toISOString().slice(0, 10);
        }
        return stored;
    } catch {
        const today = new Date().toISOString().slice(0, 10);
        return { dataInicio: today, dataFim: today };
    }
}

function useFiltroPersistido() {
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);

    const setFiltro = (k: string, v: any) =>
        setFiltros(prev => {
            const next = { ...prev, [k]: v };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });

    const setFiltrosMulti = (parcial: Record<string, any>) =>
        setFiltros(prev => {
            const next = { ...prev, ...parcial };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });

    const resetFiltros = () => {
        const today = new Date().toISOString().slice(0, 10);
        const defaultFilters = { dataInicio: today, dataFim: today };
        setFiltros(defaultFilters);
        localStorage.setItem(FILTER_KEY, JSON.stringify(defaultFilters));
    };

    const currentToday = new Date().toISOString().slice(0, 10);
    const temFiltro = Object.keys(filtros).some(k => {
        if (k === 'dataInicio' || k === 'dataFim') return filtros[k] !== currentToday && filtros[k] !== "";
        return Boolean(filtros[k]);
    });

    return { filtros, setFiltro, setFiltrosMulti, resetFiltros, temFiltro };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Analise() {
    const [, setLocation] = useLocation();
    const [activePage, setActivePage] = useState("analises");
    const { filtros, setFiltro, setFiltrosMulti, resetFiltros, temFiltro } = useFiltroPersistido();
    const { isCollapsed } = useSidebarCollapse();
    const { getAnalise, setAnalise, analisesDoPeríodo } = useAnalisesRevenda(
        filtros.dataInicio || "",
        filtros.dataFim || ""
    );

    const [sortBy, setSortBy] = useState<string>("ranking_critico");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [expandedHelp, setExpandedHelp] = useState(false);

    const { data: vendedoresList = [] } = trpc.clientes.vendedores.useQuery({
        revenda: filtros.revenda,
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
    const datas = result?.datas ?? [];
    const revendas = result?.revendas ?? [];

    console.log(dados);
    //console.log(datas);
    //console.log(revendas);


    // ── Ordenação ────────────────────────────────────────────────────────────────
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

    // ── Agrupamento por Revenda ──────────────────────────────────────────────────
    const { revendasOrdenadas, groupedData } = useMemo(() => {
        const groups: Record<string, typeof sorted> = {};
        sorted.forEach(r => {
            if (!groups[r.revenda]) groups[r.revenda] = [];
            groups[r.revenda].push(r);
        });
        return {
            revendasOrdenadas: Object.keys(groups).sort(),
            groupedData: groups
        };
    }, [sorted]);

    function toggleSort(col: string) {
        if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortBy(col); setSortDir("asc"); }
    }

    function SortIcon({ col }: { col: string }) {
        if (sortBy !== col) return <span className="opacity-30 ml-0.5">↕</span>;
        return <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
    }

    // ── KPIs resumo ──────────────────────────────────────────────────────────────
    const totais = useMemo(() => ({
        vendedores: dados.length,
        pdvs: dados.reduce((s, r) => s + r.pdvs_visitados, 0),
        pdvs_total: dados.reduce((s, r) => s + r.pdvs_total, 0),
        heishop: dados.reduce((s, r) => s + r.pedido_heishop, 0),
        relampago_avg: dados.length
            ? dados.reduce((s, r) => s + r.relampago_pct, 0) / dados.length : 0,
        iv_avg: dados.length
            ? dados.reduce((s, r) => s + r.iv, 0) / dados.length : 0,
    }), [dados]);

    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching", analises: "/analises",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "analises") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-60'}`}>
                {/* Header */}
                <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 size={20} className="text-indigo-500" />
                            Análise de Vendedores
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">Métricas detalhadas por vendedor e dia</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setExpandedHelp(h => !h)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50"
                        >
                            <AlertTriangle size={12} /> Glossário
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    await generateWordReport(
                                        groupedData,
                                        revendasOrdenadas,
                                        filtros.dataInicio || "",
                                        filtros.dataFim || "",
                                        analisesDoPeríodo()
                                    );
                                    toast.success("Relatório baixado com sucesso!");
                                } catch (e) {
                                    toast.error("Erro ao gerar relatório Word.");
                                    console.error(e);
                                }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-indigo-600 hover:bg-indigo-50"
                        >
                            <FileText size={12} /> Exportar Word
                        </button>
                        <button
                            onClick={() => refetch()}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100"
                        >
                            <RefreshCw size={12} /> Atualizar
                        </button>
                    </div>
                </div>

                {/* Glossário colapsável */}
                {expandedHelp && (
                    <div className="bg-amber-50 border-b border-amber-100 px-6 py-3">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-600 max-w-5xl">
                            {[
                                ["Pedido SFA", "Pedidos realizados pelo vendedor via sistema SFA"],
                                ["Pedido Heishop", "Pedidos realizados via plataforma Heishop"],
                                ["Heishop Verificado", "Pedidos Heishop confirmados (com Tipo Cobr. preenchida)"],
                                ["IV", "Índice de Visita = visitados dentro do raio / carteira total"],
                                ["IAV", "Índice de Atendimento = Heishop verificado / Heishop total"],
                                ["Ranking Crítico", "1 = pior desempenho (maior % relâmpago)"],
                                ["Atend. > 35min", "Visitas com duração > 35min dentro do raio"],
                                ["Maior Percurso", "Maior gap entre visitas consecutivas (≤ 60min)"],
                                ["PDVs após gap", "Atendimentos realizados após o maior intervalo"],
                                ["Tempo Ñ Atend.", "Jornada − tempo em visita. Trava às 17:00"],
                            ].map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                    <span className="font-semibold text-slate-700 min-w-[140px]">{k}:</span>
                                    <span>{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Filtros ─────────────────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4 mx-6 mt-4"
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
                    <span className="text-xs text-slate-400 ml-auto" style={{ fontWeight: 500 }}>{sorted.length} vendedor(es)</span>
                </div>

                {/* KPI Cards */}
                <div className="px-6 pt-4 pb-2 grid grid-cols-5 gap-3">
                    {[
                        { label: "Vendedores", value: totais.vendedores, color: "text-slate-700", icon: <BarChart3 size={16} className="text-indigo-400" /> },
                        { label: "PDVs Visitados", value: totais.pdvs, sub: totais.pdvs_total, color: "text-slate-700", icon: <TrendingUp size={16} className="text-green-400" /> },
                        { label: "Pedidos Heishop", value: totais.heishop, color: "text-amber-600", icon: <AlertTriangle size={16} className="text-amber-400" /> },
                        { label: "Relâmpago médio", value: pct(totais.relampago_avg), color: totais.relampago_avg > 20 ? "text-red-600" : "text-green-600", icon: <TrendingDown size={16} className="text-red-400" /> },
                        { label: "IV médio", value: pct(totais.iv_avg), color: "text-indigo-600", icon: <Clock size={16} className="text-indigo-400" /> },
                    ].map(k => (
                        <div key={k.label} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                            {k.icon}
                            <div>
                                <div className={`text-lg font-bold ${k.color}`}>{k.value}{k.sub ? <span className="text-xs text-slate-400">/{k.sub}</span> : ""}</div>
                                <div className="text-xs text-slate-400">{k.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tabela */}
                <div className="flex-1 overflow-auto px-6 pb-6">
                    {isLoading && (
                        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                            <RefreshCw size={16} className="animate-spin mr-2" /> Carregando...
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center justify-center h-40 text-red-500 text-sm gap-2">
                            <AlertTriangle size={16} /> {error.message}
                        </div>
                    )}
                    {!isLoading && !error && (
                        <div className="flex flex-col gap-6">
                            {revendasOrdenadas.length === 0 && (
                                <div className="bg-white p-12 rounded-xl text-center text-slate-400 border border-slate-100">Nenhum dado para os filtros selecionados</div>
                            )}
                            {revendasOrdenadas.map(rev => (
                                <div key={rev} className="bg-white rounded-xl border border-slate-100 overflow-hidden" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
                                    <div className="px-5 py-3 border-b border-indigo-100 bg-indigo-50/50 flex items-center justify-between">
                                        <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Revenda: <span className="text-indigo-600">{rev}</span></h2>
                                        <span className="text-xs font-semibold text-slate-500">{groupedData[rev].length} Vendedor(es)</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-green-950 text-slate-100">
                                                <tr>
                                                    {/* Identidade */}
                                                    <Th title="Código do vendedor">
                                                        <button onClick={() => toggleSort("vendedor")} className="flex items-center gap-0.5">
                                                            Vend. <SortIcon col="vendedor" />
                                                        </button>
                                                    </Th>
                                                    <Th title="Data">Data</Th>

                                                    {/* Ranking 
                                                    <Th title="Ranking Crítico: 1 = pior (mais relâmpago)" center>
                                                        <button onClick={() => toggleSort("ranking_critico")} className="flex items-center gap-0.5 mx-auto">
                                                            Ranking <SortIcon col="ranking_critico" />
                                                        </button>
                                                    </Th>
                                                    */}

                                                    {/* Horários */}
                                                    <Th title="Hora da primeira visita dentro do raio" center>Início</Th>
                                                    <Th title="Hora da última visita dentro do raio" center>Fim</Th>
                                                    <Th title="Visitas na janela 12:15-13:45 (almoço)" center>Almoço</Th>
                                                    <Th title="Visitas com início após 14h" center>Após 14h</Th>

                                                    {/* Cobertura */}
                                                    <Th title="Visitas únicas dentro do raio / carteira total" center>Visitas</Th>
                                                    {/* <Th title="PDVs com visita registrada (duração preenchida)" center>PDV Visit.</Th> */}
                                                    <Th title="PDVs na carteira sem visita no dia" center>PDV S/Visita</Th>

                                                    {/* Relâmpago */}
                                                    <Th title="Visitas únicas dentro do raio com duração < 3min" center>
                                                        <button onClick={() => toggleSort("relampago_pct")} className="flex items-center gap-0.5 mx-auto">
                                                            Relâmpago <SortIcon col="relampago_pct" />
                                                        </button>
                                                    </Th>

                                                    {/* Pedidos */}
                                                    <Th title="Pedidos realizados via sistema SFA" center>SFA</Th>
                                                    <Th title="Pedidos realizados via Heishop" center>Heishop</Th>
                                                    <Th title="Pedidos Heishop verificados (Tipo Cobr. preenchida)" center>H. Verif.</Th>

                                                    {/* Índices */}
                                                    <Th title="IV = visitados dentro do raio / carteira total" center>
                                                        <button onClick={() => toggleSort("iv")} className="flex items-center gap-0.5 mx-auto">
                                                            IV <SortIcon col="iv" />
                                                        </button>
                                                    </Th>
                                                    <Th title="IAV = Heishop verificado / Heishop total" center>IAV</Th>

                                                    {/* Atendimento */}
                                                    <Th title="Visitas com duração > 35 minutos dentro do raio" center>Atend. &gt;35</Th>
                                                    <Th title="Soma do tempo de todos os atendimentos > 35 min" center>Σ &gt;35min</Th>
                                                    <Th title="Menor tempo de visita dentro do PDV" center>T. Menor</Th>
                                                    <Th title="Maior tempo de visita dentro do PDV" center>T. Maior</Th>
                                                    <Th title="Média do tempo de visita dentro do PDV" center>T. Médio</Th>
                                                    <Th title="Soma de todos os tempos de visita dentro do PDV" center>T. Total</Th>

                                                    {/* Percurso */}
                                                    <Th title="Maior intervalo entre visitas consecutivas (≤ 60min)" center>Maior Percurso</Th>
                                                    <Th title="Início do maior intervalo entre visitas" center>Ini. Percurso</Th>
                                                    <Th title="Fim do maior intervalo entre visitas" center>Fim Percurso</Th>
                                                    <Th title="PDVs atendidos dentro do raio após o maior percurso" center>PDVs p/ Percurso</Th>
                                                    <Th title="Tempo fora de atendimento (trava às 17:00). Jornada − tempo em visita" center>
                                                        <button onClick={() => toggleSort("tempo_nao_atend")} className="flex items-center gap-0.5 mx-auto">
                                                            T. Ñ Atend. <SortIcon col="tempo_nao_atend" />
                                                        </button>
                                                    </Th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupedData[rev].map((r, i) => {
                                                    const rowBg = i % 2 === 1 ? "bg-slate-50" : "";
                                                    const isRuim = r.ranking_critico <= 3;
                                                    return (
                                                        <tr key={`${r.vendedor}-${r.data}`} className={`hover:bg-indigo-50/80 transition-colors ${rowBg}`}>
                                                            {/* Identidade */}
                                                            <Td mono>
                                                                <button onClick={() => setLocation(`/analises/vendedor/${encodeURIComponent(r.revenda)}/${r.vendedor}/${r.data}`)} className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 transition-all">
                                                                    {r.vendedor}
                                                                </button>
                                                            </Td>
                                                            <Td mono className="text-slate-500">{r.data}</Td>

                                                            {/* Ranking 
                                                            <Td center>
                                                                <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${r.ranking_critico === 1 ? "bg-red-100 text-red-700" :
                                                                    r.ranking_critico === 2 ? "bg-orange-100 text-orange-700" :
                                                                        r.ranking_critico === 3 ? "bg-amber-100 text-amber-700" :
                                                                            "bg-slate-100 text-slate-500"
                                                                    }`}>{r.ranking_critico}</span>
                                                            </Td>
                                                            */}
                                                            {/* Horários */}
                                                            <Td center mono className={r.inicio && (r.inicio < "07:30" || r.inicio > "08:45") ? "text-amber-700 font-bold" : "text-slate-600"}>{r.inicio ?? "—"}</Td>
                                                            <Td center mono className="text-slate-600">{r.fim ?? "—"}</Td>
                                                            <Td center>
                                                                {r.almoco > 0 ? <Badge color="amber">{r.almoco}</Badge> : <span className="text-slate-300">—</span>}
                                                            </Td>
                                                            <Td center>
                                                                {r.apos14h > 0
                                                                    ? <span className="text-amber-600 font-semibold">{pct(r.apos14h_pct, 0)} <span className="text-slate-400 font-normal">({r.apos14h}/{r.apos14h_total})</span></span>
                                                                    : <span className="text-slate-300">—</span>
                                                                }
                                                            </Td>

                                                            {/* Cobertura */}
                                                            <Td center>
                                                                <span className={r.visitas_pct == 100 ? "text-green-600 font-extrabold" : r.visitas_pct >= 90 ? "text-amber-600 font-extrabold" : "text-red-500 font-extrabold"}>
                                                                    {pct(r.visitas_pct, 0)} <span className="text-slate-400 font-normal">({r.visitas}/{r.visitas_total})</span>
                                                                </span>
                                                            </Td>
                                                            {/* <Td center mono className="text-slate-700">{r.pdvs_visitados}</Td> */}
                                                            <Td center>
                                                                {r.pdvs_sem_visita > 0 ? <Badge color="red">{r.pdvs_sem_visita}</Badge> : <span className="text-slate-300">0</span>}
                                                            </Td>

                                                            {/* Relâmpago */}
                                                            <Td center>
                                                                <span className={r.relampago_pct >= 30 ? "text-red-600 font-bold" : r.relampago_pct >= 15 ? "text-amber-600 font-semibold" : "text-green-600"}>
                                                                    {pct(r.relampago_pct, 0)} <span className="text-slate-400 font-normal">({r.relampago}/{r.visitas_total_dentro_raio})</span>
                                                                </span>
                                                            </Td>

                                                            {/* Pedidos */}
                                                            <Td center mono>{r.pedido_sfa > 0 ? <span className="text-blue-600 font-semibold">{r.pedido_sfa}</span> : <span className="text-slate-300">0</span>}</Td>
                                                            <Td center mono>{r.pedido_heishop > 0 ? <span className="text-amber-600 font-semibold">{r.pedido_heishop}</span> : <span className="text-slate-300">0</span>}</Td>
                                                            <Td center mono>{r.heishop_verif > 0 ? <Badge color="green">{r.heishop_verif}</Badge> : <span className="text-slate-300">0</span>}</Td>

                                                            {/* Índices */}
                                                            <Td center>
                                                                <span className={r.iv >= 80 ? "text-green-600 font-semibold" : r.iv >= 60 ? "text-amber-600" : "text-red-500"}>
                                                                    {pct(r.iv)}
                                                                </span>
                                                            </Td>
                                                            <Td center>
                                                                {r.iav > 0 ? <span className="text-indigo-600 font-semibold">{pct(r.iav)}</span> : <span className="text-slate-300">—</span>}
                                                            </Td>

                                                            {/* Atendimento */}
                                                            <Td center>{r.atend_maior35 > 0 ? <Badge color="amber">{r.atend_maior35}</Badge> : <span className="text-slate-300">0</span>}</Td>
                                                            <Td center mono className="text-slate-600">{r.soma_maior35_fmt}</Td>
                                                            <Td center mono className="text-green-700">{r.tempo_menor_fmt}</Td>
                                                            <Td center mono className={r.tempo_maior !== null && r.tempo_maior > 35 ? "text-red-500" : "text-slate-600"}>{r.tempo_maior_fmt}</Td>
                                                            <Td center mono className="text-slate-600">{r.tempo_medio_fmt}</Td>
                                                            <Td center mono className="text-indigo-600 font-semibold">{r.tempo_total_fmt}</Td>

                                                            {/* Percurso */}
                                                            <Td center mono className={r.maior_percurso !== null && r.maior_percurso > 30 ? "text-amber-600 font-semibold" : "text-slate-600"}>
                                                                {r.maior_percurso !== null ? minToHM_display(r.maior_percurso) : "—"}
                                                            </Td>
                                                            <Td center mono className="text-slate-500">{r.percurso_ini ?? "—"}</Td>
                                                            <Td center mono className="text-slate-500">{r.percurso_fim ?? "—"}</Td>
                                                            <Td center mono>{r.pdvs_apos_gap > 0 ? <span className="text-slate-700 font-semibold">{r.pdvs_apos_gap}</span> : <span className="text-slate-300">—</span>}</Td>
                                                            <Td center mono className={r.tempo_nao_atend !== null && r.tempo_nao_atend > 120 ? "text-red-500 font-bold" : r.tempo_nao_atend !== null && r.tempo_nao_atend > 60 ? "text-amber-600 font-semibold" : "text-slate-600"}>
                                                                {r.tempo_nao_atend_fmt}
                                                            </Td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* ── Editor de análise por revenda ── */}
                                    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40">
                                        <div className="flex items-center gap-2 mb-2">
                                            <PenLine className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-xs text-indigo-700 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                                                Análise · {rev}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-1" style={{ fontWeight: 400 }}>
                                                — será incluída no Word
                                            </span>
                                        </div>
                                        <EditorAnalise
                                            id={`editor-revenda-${rev}`}
                                            html={getAnalise(rev)}
                                            onChange={html => setAnalise(rev, html)}
                                            placeholder={`Registre aqui a análise da revenda ${rev} — destaques, pontos de atenção, planos de ação...`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper local para exibição de minutos como HH:MM sem segundos
function minToHM_display(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h === 0) return `${m}min`;
    return `${h}h${String(m).padStart(2, "0")}`;
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