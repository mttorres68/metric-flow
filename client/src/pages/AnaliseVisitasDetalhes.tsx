import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import Sidebar from "@/components/Sidebar";
import { ArrowLeft, MapPin, Clock, FileText, CheckCircle2, XCircle } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useTheme } from "@/contexts/ThemeContext";
import {
    Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";

export default function AnaliseVisitasDetalhes() {
    const [match, params] = useRoute("/analises/vendedor/:revenda/:vendedor/:data");
    const [, setLocation] = useLocation();
    const [activePage, setActivePage] = useState("analises");
    const { isCollapsed } = useSidebarCollapse();
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const revendaRef = params?.revenda ? decodeURIComponent(params.revenda) : "";
    const vendedorId = params?.vendedor ? Number(params.vendedor) : null;
    const dataRef = params?.data || "";

    const { data: visitas, isLoading, error } = trpc.analise.getVisitasDoDia.useQuery(
        { vendedor: vendedorId || 0, revenda: revendaRef, data: dataRef },
        { enabled: !!vendedorId && !!dataRef && !!revendaRef }
    );

    const [rangeInicio, setRangeInicio] = useState(dataRef);
    const [rangeFim, setRangeFim] = useState(dataRef);

    const { data: dadosRange, isLoading: loadingRange } = trpc.analise.getDados.useQuery(
        { vendedor: vendedorId || 0, revenda: revendaRef, dataInicio: rangeInicio, dataFim: rangeFim },
        { enabled: !!vendedorId && !!revendaRef && !!rangeInicio && !!rangeFim }
    );

    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching", analises: "/analises",
            trello_atraso: "/trello-atraso",
            whatsapp: "/whatsapp", assessment: "/assessment",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "analises") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    if (!match || !vendedorId || !dataRef || !revendaRef) return (
        <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />
            <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-60'}`}>
                <p className="text-red-500 font-semibold">Parâmetros inválidos</p>
            </div>
        </div>
    );

    const formatDataBR = (dt: string) => {
        const partes = dt.split("-");
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return dt;
    };

    const fmtBRL = (val: number) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const parseDist = (s: string): number => {
        if (!s || s === "ND") return NaN;
        if (s === "AC") return 299;
        let clean: string;
        if (s.includes(",") && s.includes(".")) {
            clean = s.replace(/\./g, "").replace(",", ".");
        } else if (s.includes(",")) {
            clean = s.replace(",", ".");
        } else {
            clean = s;
        }
        return parseFloat(clean.replace(/[^0-9.\-]/g, ""));
    };

    const fmtDist = (s: string) => {
        if (!s || s === "ND") return "—";
        const d = parseDist(s);
        if (isNaN(d)) return "—";
        if (d >= 1000) return `${(d / 1000).toFixed(1)} km`;
        return `${d.toFixed(0)} m`;
    };

    const clientVisitCount = useMemo(() => {
        if (!visitas) return {} as Record<string, number>;
        const count: Record<string, number> = {};
        for (const v of visitas) {
            count[v.codCliente] = (count[v.codCliente] || 0) + 1;
        }
        return count;
    }, [visitas]);

    const resumoStats = useMemo(() => {
        if (!visitas || visitas.length === 0) return null;
        const visitados = visitas.filter(v => v.horaInicio && v.horaInicio !== "ND");
        const vendas = visitados.filter(v => v.status === "convertido");
        const semVisita = visitas.filter(v => !v.horaInicio || v.horaInicio === "ND");
        const clientesDuplos = Object.values(clientVisitCount).filter(c => c > 1).length;
        let totalPedido = 0;
        for (const v of visitados) {
            if (v.valorPedido && v.valorPedido !== "0,00" && v.valorPedido !== "—" && !v.valorPedido.toUpperCase().includes("HEISHOP")) {
                const clean = v.valorPedido.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
                const val = parseFloat(clean);
                if (!isNaN(val)) totalPedido += val;
            }
        }
        const sortedInicio = [...visitados].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        const comFim = visitados.filter(v => v.horaFim && v.horaFim !== "ND");
        const sortedFim = [...comFim].sort((a, b) => b.horaFim.localeCompare(a.horaFim));
        const motivosCounts: Record<string, number> = {};
        for (const v of visitas) {
            const m = (v.motivo || "").trim();
            if (m && m !== "ND" && m !== "-") {
                motivosCounts[m] = (motivosCounts[m] || 0) + 1;
            }
        }
        const valoresPedCounts: Record<string, number> = {};
        for (const v of visitas) {
            const vp = (v.valorPedido || "").trim();
            if (vp && vp !== "0,00" && vp !== "—" && vp !== "-") {
                valoresPedCounts[vp] = (valoresPedCounts[vp] || 0) + 1;
            }
        }
        const valoresPedData = Object.entries(valoresPedCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value }));
        return {
            total: visitas.length,
            visitados: visitados.length,
            semVisita: semVisita.length,
            vendas: vendas.length,
            naoVendas: visitados.length - vendas.length,
            clientesDuplos,
            totalPedido,
            primeiraVisita: sortedInicio[0]?.horaInicio?.substring(0, 5) || "—",
            ultimaVisita: sortedFim[0]?.horaFim?.substring(0, 5) || "—",
            taxaConversao: visitados.length > 0 ? Math.round((vendas.length / visitados.length) * 100) : 0,
            motivosCounts,
            valoresPedData,
        };
    }, [visitas, clientVisitCount]);

    const dadosGrafico = useMemo(() => {
        if (!dadosRange?.dados?.length) return [];
        const byDate: Record<string, { validas: number; total: number; semVisita: number }> = {};
        for (const row of dadosRange.dados) {
            if (!byDate[row.data]) byDate[row.data] = { validas: 0, total: 0, semVisita: 0 };
            byDate[row.data].validas += row.pdvs_visitados;
            byDate[row.data].total += row.pdvs_total;
            byDate[row.data].semVisita += row.pdvs_sem_visita;
        }
        return Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([data, v]) => ({
                name: formatDataBR(data),
                "Visitas Válidas": v.validas,
                "Total Carteira": v.total,
                "Sem Visita": v.semVisita,
            }));
    }, [dadosRange]);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-60'}`}>
                {/* Header */}
                <header
                    className="bg-white dark:bg-[var(--card)] border-b border-slate-100 dark:border-[var(--border)] flex items-center px-6 py-4"
                    style={{ boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.25)" : "0 1px 4px rgba(0,0,0,0.04)" }}
                >
                    <div className="flex items-center gap-4">
                        <button onClick={() => setLocation("/analises")}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors flex items-center gap-2">
                            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                Sequência de Visitas · Vendedor {vendedorId}
                            </h1>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                Data: {formatDataBR(dataRef)} {visitas && `· ${visitas.length} clientes na carteira`}
                            </p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col px-6 py-6 gap-4">
                    {isLoading && (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl font-semibold">
                            Erro ao carregar os dados: {error.message}
                        </div>
                    )}

                    {!isLoading && !error && visitas && visitas.length > 0 && (
                        <>
                        <div className="flex-1 flex flex-col bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] overflow-hidden" style={{ boxShadow: isDark ? "0 1px 8px rgba(0,0,0,0.3)" : "0 1px 8px rgba(0,0,0,0.06)" }}>
                            <div className="flex-1 overflow-x-auto overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider w-10">#</th>
                                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Cliente</th>
                                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider" title="Tempo Percorrido (Intervalo entre o fim da visita anterior e o início desta)">T. Perc</th>
                                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Início</th>
                                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Fim</th>
                                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Tempo</th>
                                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Distância</th>
                                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Valor Ped.</th>
                                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Tipo Cobr.</th>
                                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Motivo/Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visitas.map((v, i) => {
                                            const hasTime = v.horaInicio && v.horaInicio !== "ND";
                                            const isVenda = v.status === "convertido";
                                            const isDuplicate = (clientVisitCount[v.codCliente] || 0) > 1;
                                            const rowBg = isDuplicate
                                                ? "bg-purple-50/70 dark:bg-purple-900/20"
                                                : (!hasTime
                                                    ? "bg-slate-50/50 dark:bg-slate-800/20 opacity-80"
                                                    : (i % 2 === 1 ? "bg-slate-50/70 dark:bg-slate-800/30" : "dark:bg-[var(--card)]"));
                                            const isHeishop = v.valorPedido.toUpperCase().includes("HEISHOP");

                                            // Calcula raio
                                            let indRaio = null;
                                            if (v.distPV && v.distPV !== "ND") {
                                                const d = parseDist(v.distPV);
                                                if (!isNaN(d)) indRaio = d <= 300;
                                            }

                                            // Calcula Tempo Perc
                                            let tempoPerc = "—";
                                            let isPercAlto = false;
                                            if (i > 0 && hasTime) {
                                                // Find the most recent previous visit that HAS time.
                                                // (If there are non-visits in between, skip them for time calc)
                                                // preciso incluir os segundos na exibição da tabela para ficar hora:minuto:segundos
                                                let prevIdx = i - 1;
                                                while (prevIdx >= 0) {
                                                    const prev = visitas[prevIdx];
                                                    if (prev.horaFim && prev.horaFim !== "ND") {
                                                        const parseTime = (t: string) => {
                                                            const [h, m, s] = t.split(":");
                                                            return Number(h) * 60 + Number(m);
                                                        };
                                                        const diffMin = parseTime(v.horaInicio) - parseTime(prev.horaFim);
                                                        if (diffMin >= 0) {
                                                            if (diffMin >= 60) {
                                                                tempoPerc = `${Math.floor(diffMin / 60)}h ${diffMin % 60}m ${diffMin % 60}s`;
                                                            } else {
                                                                tempoPerc = `${diffMin}m ${diffMin % 60}s`;
                                                            }
                                                            if (diffMin > 30) isPercAlto = true;
                                                        }
                                                        break;
                                                    }
                                                    prevIdx--;
                                                }
                                            }

                                            return (
                                                <tr key={`${v.codCliente}-${i}`} className={`border-b border-slate-100 dark:border-slate-700/40 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 ${rowBg}`}>
                                                    <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500">{i + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            {v.cliente}
                                                            {isDuplicate && (
                                                                <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-bold border border-purple-200 dark:border-purple-700/50 shrink-0">
                                                                    ×{clientVisitCount[v.codCliente]}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">{v.codCliente}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono">
                                                        <span className={isPercAlto ? "text-amber-600 font-semibold" : "text-slate-500 dark:text-slate-400"}>
                                                            {tempoPerc}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-bold text-green-900 dark:text-green-400">
                                                        {hasTime ? v.horaInicio.substring(0, 8) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-bold text-green-700 dark:text-green-500">
                                                        {hasTime ? v.horaFim.substring(0, 8) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                                                        {v.tempoVisita && v.tempoVisita !== "ND" ? (
                                                            v.tempoVisita.split(":")[1] === "00" && v.tempoVisita.split(":")[0] === "00" ? "< 1m" : v.tempoVisita.substring(0, 8)
                                                        ) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono">
                                                        {v.distPV && v.distPV !== "ND" ? (
                                                            <span className={indRaio ? "text-green-600 font-semibold" : "text-amber-600"}>
                                                                {fmtDist(v.distPV)}
                                                            </span>
                                                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono">
                                                        {v.valorPedido !== "0,00" && v.valorPedido !== "—" ? (
                                                            <span className={isHeishop ? "text-amber-600 font-bold" : "text-blue-600 dark:text-blue-400 font-bold"}>
                                                                {v.valorPedido}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-[10px] font-semibold">
                                                        {v.tipoCobr && String(v.tipoCobr) !== "-" && String(v.tipoCobr).trim() !== "" ? (
                                                            <span className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 inline-block truncate max-w-[100px]" title={String(v.tipoCobr)}>
                                                                {v.tipoCobr}
                                                            </span>
                                                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex flex-col flex-wrap items-center justify-center gap-1">
                                                            {!hasTime ? (
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                                                                    Sem Visita
                                                                </span>
                                                            ) : isVenda ? (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-700/50">
                                                                    <CheckCircle2 className="w-3 h-3" /> Venda
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-700/50">
                                                                        <XCircle className="w-3 h-3" /> Não Venda
                                                                    </span>
                                                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold text-center block max-w-[120px] truncate" title={v.motivo}>
                                                                        {v.motivo}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Gráfico + Resumo do Vendedor */}
                        <div className="grid grid-cols-2 gap-4 flex-shrink-0 h-[280px]">
                            {/* Gráfico de visitas — comparativo por intervalo */}
                            <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] px-5 py-4 overflow-hidden flex flex-col" style={{ boxShadow: isDark ? "0 1px 8px rgba(0,0,0,0.3)" : "0 1px 8px rgba(0,0,0,0.06)" }}>
                                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Resumo de Visitas</h3>
                                    <div className="flex items-center gap-2 text-xs">
                                        <label className="text-slate-500 dark:text-slate-400 font-semibold">De</label>
                                        <input
                                            type="date"
                                            value={rangeInicio}
                                            onChange={e => setRangeInicio(e.target.value)}
                                            className="border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--input)] rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        />
                                        <label className="text-slate-500 dark:text-slate-400 font-semibold">Até</label>
                                        <input
                                            type="date"
                                            value={rangeFim}
                                            onChange={e => setRangeFim(e.target.value)}
                                            className="border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--input)] rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        />
                                    </div>
                                </div>

                                {loadingRange ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                                    </div>
                                ) : dadosGrafico.length === 0 ? (
                                    <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm font-medium">
                                        Sem dados para o período selecionado
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={160}>
                                        <BarChart data={dadosGrafico} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e2a3a" : "#F1F5F9"} vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? "#64748b" : "#94A3B8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: isDark ? "#64748b" : "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{ background: isDark ? "#1a2436" : "white", border: `1px solid ${isDark ? "#2d3f55" : "#E2E8F0"}`, borderRadius: "10px", fontSize: 12, color: isDark ? "#e2e8f0" : undefined }}
                                                cursor={{ fill: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)" }}
                                            />
                                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                            <Bar dataKey="Visitas Válidas" fill="#34C78A" radius={[4, 4, 0, 0]} maxBarSize={32}>
                                                <LabelList dataKey="Visitas Válidas" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#34C78A" }} />
                                            </Bar>
                                            <Bar dataKey="Total Carteira" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={32}>
                                                <LabelList dataKey="Total Carteira" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#6366F1" }} />
                                            </Bar>
                                            <Bar dataKey="Sem Visita" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={32}>
                                                <LabelList dataKey="Sem Visita" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#94A3B8" }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Resumo do Vendedor */}
                            <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] px-5 py-4 overflow-hidden flex flex-col" style={{ boxShadow: isDark ? "0 1px 8px rgba(0,0,0,0.3)" : "0 1px 8px rgba(0,0,0,0.06)" }}>
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex-shrink-0">Resumo do Dia</h3>
                                {resumoStats ? (
                                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-0.5">
                                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">Horário</span>
                                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">{resumoStats.primeiraVisita} → {resumoStats.ultimaVisita}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide">Carteira</div>
                                                <div className="text-xl font-black text-slate-700 dark:text-slate-200">{resumoStats.total}</div>
                                            </div>
                                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
                                                <div className="text-[9px] text-indigo-500 dark:text-indigo-400 font-semibold uppercase tracking-wide">Visitados</div>
                                                <div className="text-xl font-black text-indigo-700 dark:text-indigo-400">{resumoStats.visitados}</div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide">Sem Visita</div>
                                                <div className="text-xl font-black text-slate-500 dark:text-slate-400">{resumoStats.semVisita}</div>
                                            </div>
                                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                                                <div className="text-[9px] text-green-600 dark:text-green-400 font-semibold uppercase tracking-wide">Vendas</div>
                                                <div className="text-xl font-black text-green-700 dark:text-green-400">{resumoStats.vendas}</div>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                                                <div className="text-[9px] text-red-500 dark:text-red-400 font-semibold uppercase tracking-wide">Não Vendas</div>
                                                <div className="text-xl font-black text-red-600 dark:text-red-400">{resumoStats.naoVendas}</div>
                                            </div>
                                            <div className={`rounded-lg px-3 py-2 ${resumoStats.taxaConversao >= 50 ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                                                <div className={`text-[9px] font-semibold uppercase tracking-wide ${resumoStats.taxaConversao >= 50 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>Conversão</div>
                                                <div className={`text-xl font-black ${resumoStats.taxaConversao >= 50 ? "text-green-700 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>{resumoStats.taxaConversao}%</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold uppercase tracking-wide">Vis. Duplas</span>
                                                <span className="text-sm font-black text-purple-700 dark:text-purple-300">{resumoStats.clientesDuplos}</span>
                                            </div>
                                            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide">Total Ped.</span>
                                                <span className="text-sm font-black text-blue-700 dark:text-blue-400">{fmtBRL(resumoStats.totalPedido)}</span>
                                            </div>
                                        </div>

                                        {/* Justificativas */}
                                        {Object.keys(resumoStats.motivosCounts).length > 0 && (
                                            <div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Justificativas</div>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {Object.entries(resumoStats.motivosCounts)
                                                        .sort(([, a], [, b]) => b - a)
                                                        .map(([motivo, count]) => (
                                                            <div key={motivo} className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2 py-1.5 border border-amber-100 dark:border-amber-800/30">
                                                                <div className="text-sm font-black text-amber-700 dark:text-amber-400">{count}</div>
                                                                <div className="text-[9px] text-amber-600 dark:text-amber-500 font-semibold uppercase leading-tight truncate" title={motivo}>{motivo}</div>
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        )}

                                        {/* Gráfico Valor PED. */}
                                        {resumoStats.valoresPedData.length > 0 && (
                                            <div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-1">Valor Ped.</div>
                                                <ResponsiveContainer width="100%" height={Math.max(60, resumoStats.valoresPedData.length * 26 + 12)}>
                                                    <BarChart
                                                        layout="vertical"
                                                        data={resumoStats.valoresPedData}
                                                        margin={{ top: 0, right: 36, left: 4, bottom: 0 }}
                                                    >
                                                        <XAxis type="number" tick={{ fontSize: 9, fill: isDark ? "#64748b" : "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                        <YAxis
                                                            type="category"
                                                            dataKey="name"
                                                            width={120}
                                                            tick={{ fontSize: 9, fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 600 }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tickFormatter={(v: string) => v.length > 20 ? v.substring(0, 20) + "…" : v}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{ background: isDark ? "#1a2436" : "white", border: `1px solid ${isDark ? "#2d3f55" : "#E2E8F0"}`, borderRadius: "8px", fontSize: 11, color: isDark ? "#e2e8f0" : undefined }}
                                                            cursor={{ fill: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)" }}
                                                            formatter={(value: number) => [value, "ocorrências"]}
                                                        />
                                                        <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} maxBarSize={18}>
                                                            <LabelList dataKey="value" position="right" style={{ fontSize: 10, fontWeight: 700, fill: isDark ? "#818cf8" : "#6366F1" }} />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm font-medium">Sem dados</div>
                                )}
                            </div>
                        </div>
                        </>
                    )}

                    {!isLoading && !error && visitas && visitas.length === 0 && (
                        <div className="flex items-center justify-center h-40 bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] text-slate-500 dark:text-slate-400 font-medium">
                            Nenhuma visita encontrada para os parâmetros informados.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
