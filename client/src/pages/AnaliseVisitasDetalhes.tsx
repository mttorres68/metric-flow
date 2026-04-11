import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import Sidebar from "@/components/Sidebar";
import { ArrowLeft, MapPin, Clock, FileText, CheckCircle2, XCircle } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import {
    Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";

export default function AnaliseVisitasDetalhes() {
    const [match, params] = useRoute("/analises/vendedor/:revenda/:vendedor/:data");
    const [, setLocation] = useLocation();
    const [activePage, setActivePage] = useState("analises");
    const { isCollapsed } = useSidebarCollapse();

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
            whatsapp: "/whatsapp",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "analises") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    if (!match || !vendedorId || !dataRef || !revendaRef) return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
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

    const fmtDist = (s: string) => {
        if (!s || s === "ND") return "—";
        const clean = s.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
        const d = parseFloat(clean);
        if (isNaN(d)) return "—";
        if (d >= 1000) return `${(d / 1000).toFixed(1)} km`;
        return `${d.toFixed(0)} m`;
    };

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
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-60'}`}>
                {/* Header */}
                <header
                    className="bg-white border-b border-slate-100 flex items-center px-6 py-4"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                >
                    <div className="flex items-center gap-4">
                        <button onClick={() => setLocation("/analises")}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                Sequência de Visitas · Vendedor {vendedorId}
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">
                                Data: {formatDataBR(dataRef)} {visitas && `· ${visitas.length} clientes na carteira`}
                            </p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col px-6 py-6 gap-4">
                    {isLoading && (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl font-semibold">
                            Erro ao carregar os dados: {error.message}
                        </div>
                    )}

                    {!isLoading && !error && visitas && visitas.length > 0 && (
                        <>
                        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-100 overflow-hidden" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
                            <div className="flex-1 overflow-x-auto overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0 z-10">
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
                                            const rowBg = !hasTime ? "bg-slate-50/50 opacity-80" : (i % 2 === 1 ? "bg-slate-50/70" : "");
                                            const isHeishop = v.valorPedido.toUpperCase().includes("HEISHOP");

                                            // Calcula raio
                                            let indRaio = null;
                                            if (v.distPV && v.distPV !== "ND") {
                                                const d = parseFloat(v.distPV.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
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
                                                <tr key={`${v.codCliente}-${i}`} className={`border-b border-slate-100 transition-colors hover:bg-indigo-50/40 ${rowBg}`}>
                                                    <td className="px-4 py-3 font-mono text-slate-400">{i + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-slate-800">{v.cliente}</div>
                                                        <div className="font-mono text-slate-500 text-[10px]">{v.codCliente}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono">
                                                        <span className={isPercAlto ? "text-amber-600 font-semibold" : "text-slate-500"}>
                                                            {tempoPerc}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-bold text-green-950">
                                                        {hasTime ? v.horaInicio.substring(0, 8) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-bold text-green-800">
                                                        {hasTime ? v.horaFim.substring(0, 8) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-medium">
                                                        {v.tempoVisita && v.tempoVisita !== "ND" ? (
                                                            v.tempoVisita.split(":")[1] === "00" && v.tempoVisita.split(":")[0] === "00" ? "< 1m" : v.tempoVisita.substring(0, 8)
                                                        ) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono">
                                                        {v.distPV && v.distPV !== "ND" ? (
                                                            <span className={indRaio ? "text-green-600 font-semibold" : "text-amber-600"}>
                                                                {fmtDist(v.distPV)}
                                                            </span>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono">
                                                        {v.valorPedido !== "0,00" && v.valorPedido !== "—" ? (
                                                            <span className={isHeishop ? "text-amber-600 font-bold" : "text-blue-600 font-bold"}>
                                                                {v.valorPedido}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-[10px] font-semibold">
                                                        {v.tipoCobr && String(v.tipoCobr) !== "-" && String(v.tipoCobr).trim() !== "" ? (
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 inline-block truncate max-w-[100px]" title={String(v.tipoCobr)}>
                                                                {v.tipoCobr}
                                                            </span>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex flex-col flex-wrap items-center justify-center gap-1">
                                                            {!hasTime ? (
                                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                                    Sem Visita
                                                                </span>
                                                            ) : isVenda ? (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                                                    <CheckCircle2 className="w-3 h-3" /> Venda
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                                                        <XCircle className="w-3 h-3" /> Não Venda
                                                                    </span>
                                                                    <span className="text-[9px] text-slate-500 uppercase font-bold text-center block max-w-[120px] truncate" title={v.motivo}>
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

                        {/* Gráfico de visitas — comparativo por intervalo */}
                        <div className="bg-white rounded-xl border border-slate-100 px-5 py-4" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                                <h3 className="text-sm font-bold text-slate-700">Resumo de Visitas</h3>
                                <div className="flex items-center gap-2 text-xs">
                                    <label className="text-slate-500 font-semibold">De</label>
                                    <input
                                        type="date"
                                        value={rangeInicio}
                                        onChange={e => setRangeInicio(e.target.value)}
                                        className="border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    />
                                    <label className="text-slate-500 font-semibold">Até</label>
                                    <input
                                        type="date"
                                        value={rangeFim}
                                        onChange={e => setRangeFim(e.target.value)}
                                        className="border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    />
                                </div>
                            </div>

                            {loadingRange ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                                </div>
                            ) : dadosGrafico.length === 0 ? (
                                <div className="flex items-center justify-center h-32 text-slate-400 text-sm font-medium">
                                    Sem dados para o período selecionado
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={dadosGrafico} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "10px", fontSize: 12 }}
                                            cursor={{ fill: "rgba(99,102,241,0.04)" }}
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
                        </>
                    )}

                    {!isLoading && !error && visitas && visitas.length === 0 && (
                        <div className="flex items-center justify-center h-40 bg-white rounded-xl border border-slate-100 text-slate-500 font-medium">
                            Nenhuma visita encontrada para os parâmetros informados.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
