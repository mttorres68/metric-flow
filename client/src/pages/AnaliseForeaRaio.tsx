/*
 * MetricFlow — Análise de Clientes Fora do Raio
 * Exibe clientes visitados fora do raio de distância permitido (300m)
 * com filtros por hora.
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useLocation, useRoute } from "wouter";
import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
    ArrowLeft,
    Clock,
    MapPin,
    DollarSign,
    RefreshCw,
    AlertTriangle,
    X,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const FILTER_KEY = "metricflow:analise-foera-raio-filters";

function loadFilters() {
    try {
        const stored = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}");
        return stored;
    } catch {
        return {};
    }
}

function useFiltroPersistido() {
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);

    const setFiltro = useCallback((k: string, v: any) => {
        setFiltros(prev => {
            const next = { ...prev, [k]: v ?? undefined };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const resetFiltros = useCallback(() => {
        setFiltros({});
        localStorage.removeItem(FILTER_KEY);
    }, []);

    return { filtros, setFiltro, resetFiltros };
}

interface ClienteForeaRaio {
    setor: number;
    cliente: string;
    codCliente: string;
    horaInicio: string;
    horaFim: string;
    tempo: string;
    distancia: string;
    valorPedido: string;
    visitasCount?: number;
}

interface SeTorData {
    setor: number;
    clientes: ClienteForeaRaio[];
}

export default function AnaliseForeaRaio() {
    const [match, params] = useRoute("/analises/foera-raio/:revenda/:data");
    const [, setLocation] = useLocation();
    const { filtros, setFiltro, resetFiltros } = useFiltroPersistido();
    const { isCollapsed } = useSidebarCollapse();
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const revendaParam = params?.revenda ? decodeURIComponent(params.revenda) : "";
    const dataParam = params?.data ?? "";

    const revenda = revendaParam || filtros.revenda || "";
    const data = dataParam || filtros.data || "";

    const [activePage, setActivePage] = useState("analises");

    // Query para buscar clientes fora do raio
    const { data: clientesForeaRaio = [], isLoading, error, refetch } = trpc.analise.getClientesForeaRaio.useQuery(
        {
            revenda,
            data,
            horaInicio: filtros.horaInicio,
            horaFim: filtros.horaFim,
        },
        { enabled: !!revenda && !!data }
    );

    // Navegação
    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/",
            vendedores: "/vendedores",
            compliance: "/compliance",
            clientes: "/clientes",
            relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal",
            rota_coaching: "/rota-coaching",
            analises: "/analises",
            trello_atraso: "/trello-atraso",
            whatsapp: "/whatsapp",
            assessment: "/assessment",
        };
        if (rotas[page]) {
            window.location.href = rotas[page];
            return;
        }
    };

    const handleVoltar = () => {
        setLocation("/analises");
    };

    useEffect(() => {
        if (revendaParam || dataParam) {
            setFiltro("revenda", revendaParam);
            setFiltro("data", dataParam);
        }
    }, [revendaParam, dataParam, setFiltro]);

    if (!match || !revenda || !data) {
        return (
            <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
                <Sidebar activePage={activePage} onNavigate={handleNavigate} />
                <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                    <p className="text-red-500 font-semibold">Parâmetros de rota inválidos ou incompletos</p>
                </div>
            </div>
        );
    }

    // Formatação de dados
    const formatData = (data: string) => {
        if (!data) return "";
        return new Date(data + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    const setorVisitasFiltro = filtros.setorVisitas || "all";
    console.log("Clientes fora do raio (raw):", clientesForeaRaio);

    const setoresFiltrados = useMemo(() => {
        if (setorVisitasFiltro === "unicas") {
            return clientesForeaRaio
                .map(setorData => ({
                    ...setorData,
                    clientes: setorData.clientes.filter(cliente => cliente.visitasCount === 1),
                }))
                .filter(setorData => setorData.clientes.length > 0);
        }

        if (setorVisitasFiltro === "multiplas") {
            return clientesForeaRaio
                .map(setorData => ({
                    ...setorData,
                    clientes: setorData.clientes.filter(cliente => (cliente.visitasCount ?? 0) > 1),
                }))
                .filter(setorData => setorData.clientes.length > 0);
        }

        return clientesForeaRaio;
    }, [clientesForeaRaio, setorVisitasFiltro]);

    // Cálculos de resumo
    const resumo = useMemo(() => {
        let totalClientes = 0;
        let totalSetores = setoresFiltrados.length;
        setoresFiltrados.forEach(setor => {
            totalClientes += setor.clientes.length;
        });
        return { totalSetores, totalClientes };
    }, [setoresFiltrados]);

    console.log({ clientesForeaRaio, setoresFiltrados, resumo });

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
                {/* Header */}
                <div className="bg-white dark:bg-[var(--card)] border-b border-slate-100 dark:border-[var(--border)] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleVoltar}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                            title="Voltar para Análise"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <MapPin size={20} className="text-amber-500 dark:text-amber-400" />
                                Clientes Fora do Raio
                            </h1>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                Clientes visitados fora do raio permitido (300m) — {revenda} • {formatData(data)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                    >
                        <RefreshCw size={12} /> Atualizar
                    </button>
                </div>

                {/* Filtros */}
                <div className="bg-white dark:bg-[var(--card)] border-b border-slate-100 dark:border-[var(--border)] px-6 py-4 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">
                            Hora Início
                        </label>
                        <input
                            type="time"
                            value={filtros.horaInicio || ""}
                            onChange={e => setFiltro("horaInicio", e.target.value || undefined)}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">
                            Hora Fim
                        </label>
                        <input
                            type="time"
                            value={filtros.horaFim || ""}
                            onChange={e => setFiltro("horaFim", e.target.value || undefined)}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">
                            Setores
                        </label>
                        <select
                            value={setorVisitasFiltro}
                            onChange={e => setFiltro("setorVisitas", e.target.value === "all" ? undefined : e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                            <option value="all">Todos</option>
                            <option value="unicas">Visitas únicas</option>
                            <option value="multiplas">Múltiplas visitas</option>
                        </select>
                    </div>

                    {(filtros.horaInicio || filtros.horaFim || setorVisitasFiltro !== "all") && (
                        <button
                            onClick={() => {
                                setFiltro("horaInicio", undefined);
                                setFiltro("horaFim", undefined);
                                setFiltro("setorVisitas", undefined);
                            }}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all font-semibold"
                        >
                            <X className="w-3.5 h-3.5" /> Limpar Filtros
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
                    {isLoading && (
                        <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
                            <RefreshCw size={16} className="animate-spin mr-2" /> Carregando...
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center justify-center h-40 text-red-500 text-sm gap-2">
                            <AlertTriangle size={16} /> {error.message}
                        </div>
                    )}

                    {!isLoading && !error && setoresFiltrados.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40">
                            <MapPin size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Nenhum cliente encontrado fora do raio para o filtro selecionado
                            </p>
                        </div>
                    )}

                    {!isLoading && !error && setoresFiltrados.length > 0 && (
                        <div className="space-y-6">
                            {/* Resumo */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white dark:bg-[var(--card)] rounded-lg border border-slate-200 dark:border-[var(--border)] p-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Total de Setores</p>
                                    <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{resumo.totalSetores}</p>
                                </div>
                                <div className="bg-white dark:bg-[var(--card)] rounded-lg border border-slate-200 dark:border-[var(--border)] p-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Total de Clientes</p>
                                    <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{resumo.totalClientes}</p>
                                </div>
                            </div>

                            {/* Setores */}
                            {setoresFiltrados.map((setorData: SeTorData) => (
                                <div
                                    key={setorData.setor}
                                    className="bg-white dark:bg-[var(--card)] rounded-lg border border-slate-200 dark:border-[var(--border)] overflow-hidden"
                                >
                                    {/* Cabeçalho do setor */}
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 px-4 py-3 border-b border-slate-200 dark:border-[var(--border)]">
                                        <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                            SETOR {String(setorData.setor).padStart(2, "0")}
                                        </h3>
                                    </div>

                                    {/* Clientes do setor */}
                                    <div className="divide-y divide-slate-200 dark:divide-slate-700/40">
                                        {setorData.clientes.map((cliente, idx) => (
                                            <div key={idx} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <div className="space-y-1.5">
                                                    {/* Cliente */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                            {cliente.cliente}
                                                        </span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                            {cliente.codCliente}
                                                        </span>
                                                        {cliente.visitasCount && cliente.visitasCount > 1 && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                                {cliente.visitasCount}x
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Horário e tempo */}
                                                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                        <Clock size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                                        <span className="font-mono">
                                                            {cliente.horaInicio}–{cliente.horaFim}
                                                        </span>
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            {cliente.tempo}
                                                        </span>
                                                    </div>

                                                    {/* Distância */}
                                                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                        <MapPin size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
                                                        <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                                                            {cliente.distancia}
                                                        </span>
                                                    </div>

                                                    {/* Valor do pedido */}
                                                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                        <DollarSign size={14} className="text-green-500 dark:text-green-400 shrink-0" />
                                                        <span className="font-mono">
                                                            {cliente.valorPedido}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
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
