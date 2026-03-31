/*
 * MetricFlow — Página de Relatório
 * Espelha a visão do relatório Python (.docx) com melhorias:
 * filtros persistidos, alertas visuais, ordenação, config de métricas.
 */

import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useConfigMetricas, ConfigPanel } from "@/components/ConfigPanel";
import { useFilterState } from "@/hooks/useFilterState";
import { trpc } from "@/lib/trpc";
import {
    AlertTriangle,
    Clock,
    Settings2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtPerc(val: number, casas = 0): string {
    return `${val.toFixed(casas)}%`;
}

function fmtFrac(num: number, den: number): string {
    return `(${num}/${den})`;
}

// Converte "HH:MM:SS" → "HH:MM"
function fmtHora(h: string): string {
    if (!h || h === "ND") return "—";
    return h.substring(0, 5);
}

// Retorna classe de cor baseada num limiar
function alertClass(valor: number, limiar: number, direcao: "acima" | "abaixo"): string {
    const emAlerta = direcao === "acima" ? valor > limiar : valor < limiar;
    return emAlerta ? "text-red-600" : "text-slate-700";
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function Relatorio() {
    const [activePage, setActivePage] = useState("relatorio");

    // Reutiliza os mesmos hooks do Home para manter filtros e config em sincronia
    const {
        filters,
        setVendedor: setFiltroVendedor,
        setStatus: setFiltroStatus,
        setGerente: setFiltroGerente,
        setRevenda: setFiltroRevenda,
        setDataInicio: setFiltroDataInicio,
        setDataFim: setFiltroDataFim,
        reset: resetFiltros,
    } = useFilterState();

    const { config, apply: applyConfig, reset: resetConfig, isDirty: isConfigDirty } = useConfigMetricas();
    const { isCollapsed } = useSidebarCollapse();

    const { data: dashboardData, isLoading, error } = trpc.dashboard.getMetrics.useQuery({
        vendedor: filters.vendedor,
        status: filters.status as any,
        gerente: filters.gerente,
        revenda: filters.revenda,
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        config,
    });

    // ── Navegação ───────────────────────────────────────────────────────────────
    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching",analises: "/analises",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "relatorio") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };
    console.log(handleNavigate);
    

    // Agrupa vendedores por revenda — campo agora vem do backend
    const porRevenda = useMemo(() => {
        if (!dashboardData?.graficos?.vendedores) return {};
        const mapa: Record<string, typeof dashboardData.graficos.vendedores> = {};
        for (const v of dashboardData.graficos.vendedores) {
            const rev = (v as any).revenda ?? "Sem Revenda";
            if (!mapa[rev]) mapa[rev] = [];
            mapa[rev].push(v);
        }
        return mapa;
    }, [dashboardData]);

    // KPIs gerais para linha "Geral" da tabela
    const kpis = dashboardData?.kpis;

    if (isLoading) return (
        <PageShell activePage={activePage} onNavigate={handleNavigate}>
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500" style={{ fontWeight: 600 }}>Gerando relatório...</p>
                </div>
            </div>
        </PageShell>
    );

    if (error || !dashboardData) return (
        <PageShell activePage={activePage} onNavigate={handleNavigate}>
            <div className="flex-1 flex items-center justify-center">
                <p className="text-red-500" style={{ fontWeight: 600 }}>Erro ao carregar dados</p>
            </div>
        </PageShell>
    );

    const vendedores = dashboardData.graficos.vendedores ?? [];

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-60'}`}>
                {/* Header */}
                <header
                    className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm px-8 py-4 border-b border-slate-100 flex items-center justify-between"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                >
                    <div>
                        <h1 className="text-xl text-slate-800" style={{ fontWeight: 900 }}>Relatório de Campo</h1>
                        <p className="text-xs text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                            Jornada, cobertura e qualidade dos atendimentos
                            {filters.revenda && ` · ${filters.revenda}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {kpis && (kpis.alertas.cobertura || kpis.alertas.curtas || kpis.alertas.tarde) && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-amber-600 bg-amber-50 border border-amber-100" style={{ fontWeight: 700 }}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {[kpis.alertas.cobertura && "Cobertura", kpis.alertas.curtas && "Relâmpagos", kpis.alertas.tarde && "Tarde"].filter(Boolean).join(" · ")} em alerta
                            </div>
                        )}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 bg-emerald-50 border border-emerald-100" style={{ fontWeight: 700 }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ao vivo
                        </div>
                    </div>
                </header>

                <div className="px-8 py-6 space-y-6">

                    {/* ── Filtros ──────────────────────────────────────────────────── */}
                    <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
                        style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                        <FilterInput label="Revenda" type="text"
                            placeholder="Nome da revenda..."
                            value={filters.revenda ?? ""}
                            onChange={v => setFiltroRevenda(v || undefined)} />

                        <FilterInput label="Data Início" type="date"
                            value={filters.dataInicio ?? ""}
                            onChange={v => setFiltroDataInicio(v || undefined)} />

                        <FilterInput label="Data Fim" type="date"
                            value={filters.dataFim ?? ""}
                            onChange={v => setFiltroDataFim(v || undefined)} />

                        <div className="ml-auto flex items-center gap-2">
                            {(filters.revenda || filters.dataInicio || filters.dataFim) && (
                                <button onClick={resetFiltros}
                                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-all"
                                    style={{ fontWeight: 600 }}>
                                    Limpar
                                </button>
                            )}
                            {/* ConfigPanel reutilizado do Home */}
                            <ConfigPanel
                                config={config}
                                onApply={applyConfig}
                                onReset={resetConfig}
                                isDirty={isConfigDirty}
                            />
                        </div>
                    </div>

                    {/* ── Legenda de alertas ────────────────────────────────────────── */}
                    <div className="flex items-center gap-4 text-xs text-slate-400" style={{ fontWeight: 500 }}>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                            Valor em alerta
                        </span>
                        <span>Raio PDV: {config.raioPDV}m · Relâmpago: &lt;{config.minutosCurta}min · Alerta tarde: &lt;{config.alertaTardePerc}% · Alerta curtas: &gt;{config.alertaCurtasPerc}%</span>
                    </div>

                    {/* ── Uma tabela por revenda ────────────────────────────────── */}
                    {Object.keys(porRevenda).length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center text-slate-400"
                            style={{ border: "1px solid oklch(0.93 0.006 240)" }}>
                            Nenhum dado encontrado para os filtros selecionados.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(porRevenda).map(([revenda, vendedores]) => (
                                <TabelaRevenda
                                    key={revenda}
                                    revenda={revenda}
                                    vendedores={vendedores as any[]}
                                    config={config}
                                    kpisGerais={kpis}
                                />
                            ))}
                        </div>
                    )}

                    <div className="text-center py-4">
                        <p className="text-xs text-slate-300" style={{ fontWeight: 500 }}>
                            MetricFlow · Relatório de Campo · {new Date().toLocaleDateString("pt-BR")}
                            {isConfigDirty && " · Configuração personalizada ativa"}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabelaRevenda — uma tabela completa por revenda
// ─────────────────────────────────────────────────────────────────────────────

function TabelaRevenda({ revenda, vendedores, config, kpisGerais }: {
    revenda: string;
    vendedores: any[];
    config: ReturnType<typeof useConfigMetricas>["config"];
    kpisGerais: any;
}) {
    // Calcula linha "Geral" desta revenda somando os campos dos vendedores
    const geral = useMemo(() => {
        const totalAlmoco = vendedores.reduce((s, v) => s + (v.visitasAlmoco ?? 0), 0);
        const totalTarde = vendedores.reduce((s, v) => s + (v.visitasTarde ?? 0), 0);
        const totalBrutas = vendedores.reduce((s, v) => s + (v.visitasBrutasRaio ?? 0), 0);
        const totalUnicas = vendedores.reduce((s, v) => s + (v.visitasUnicasRaio ?? v.clientes ?? 0), 0);
        const totalCarteira = vendedores.reduce((s, v) => s + (v.totalCarteira ?? 0), 0);
        const totalCurtas = vendedores.reduce((s, v) => s + (v.curtasCount ?? 0), 0);

        return {
            almoco: totalAlmoco,
            percTarde: totalBrutas > 0 ? (totalTarde / totalBrutas) * 100 : 0,
            numTarde: totalTarde,
            denTarde: totalBrutas,
            percCobertura: totalCarteira > 0 ? (totalUnicas / totalCarteira) * 100 : 0,
            numCob: totalUnicas,
            denCob: totalCarteira,
            percCurtas: totalUnicas > 0 ? (totalCurtas / totalUnicas) * 100 : 0,
            numCurtas: totalCurtas,
            denCurtas: totalUnicas,
            alertaTarde: totalBrutas > 0 && (totalTarde / totalBrutas) * 100 < config.alertaTardePerc,
            alertaCob: totalCarteira > 0 && (totalUnicas / totalCarteira) * 100 < config.alertaCoberturaPerc,
            alertaCurtas: totalUnicas > 0 && (totalCurtas / totalUnicas) * 100 > config.alertaCurtasPerc,
        };
    }, [vendedores, config]);

    return (
        <div className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

            {/* Cabeçalho da revenda */}
            <div className="px-5 py-3 bg-emerald-700 flex items-center justify-between">
                <div>
                    <h2 className="text-white text-sm" style={{ fontWeight: 800 }}>{revenda}</h2>
                    <p className="text-emerald-200 text-xs mt-0.5" style={{ fontWeight: 500 }}>
                        Detalhamento da jornada de trabalho, cobertura de clientes e qualidade dos atendimentos.
                    </p>
                </div>
                <span className="text-emerald-200 text-xs">{vendedores.length} vendedores</span>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-emerald-700 border-t border-emerald-600">
                            {["Vendedor", "Início", "Fim", "12:15 a 13:45", "Após às 14h", "Visitas", "Visitas Relâmpagos"].map(label => (
                                <th key={label}
                                    className={`px-4 py-3 text-xs text-white uppercase tracking-wide ${label === "Vendedor" ? "text-left" : "text-center"}`}
                                    style={{ fontWeight: 700 }}>
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {vendedores.map((v, idx) => {
                            const percTarde = v.percTarde ?? 0;
                            const percCob = v.percCobertura ?? v.cobertura_perc ?? 0;
                            const percCurtas = v.percCurtas ?? v.curtas_perc ?? 0;
                            const almoco = v.visitasAlmoco ?? 0;

                            return (
                                <tr key={v.vendedor}
                                    className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>

                                    <td className="px-4 py-3 text-sm text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>
                                        {v.vendedorCod ?? v.vendedor}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <HoraCell hora={fmtHora(v.hrInicio ?? "ND")} limiar={config.limiteInicioTardio} tipo="inicio" />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 text-center tabular-nums">
                                        {fmtHora(v.hrFim ?? "ND")}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {almoco > 0
                                            ? <span className="text-sm text-red-500 tabular-nums" style={{ fontWeight: 700 }}>{almoco}</span>
                                            : <span className="text-sm text-slate-400">—</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <MetricCell perc={percTarde} num={v.visitasTarde ?? 0} den={v.visitasBrutasRaio ?? 0}
                                            emAlerta={percTarde < config.alertaTardePerc} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <MetricCell perc={percCob} num={v.visitasUnicasRaio ?? v.clientes ?? 0} den={v.totalCarteira ?? 0}
                                            emAlerta={percCob < config.alertaCoberturaPerc} alertaDirecao="abaixo" />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <MetricCell perc={percCurtas} num={v.curtasCount ?? 0} den={v.visitasUnicasRaio ?? v.clientes ?? 0}
                                            emAlerta={percCurtas > config.alertaCurtasPerc} />
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Linha Geral desta revenda */}
                        <tr className="bg-emerald-700 border-t-2 border-emerald-600">
                            <td className="px-4 py-3 text-sm text-white" style={{ fontWeight: 800 }}>Geral</td>
                            <td className="px-4 py-3 text-center text-emerald-300 text-xs">—</td>
                            <td className="px-4 py-3 text-center text-emerald-300 text-xs">—</td>
                            <td className="px-4 py-3 text-center text-sm text-white tabular-nums" style={{ fontWeight: 700 }}>
                                {geral.almoco > 0 ? geral.almoco : "—"}
                            </td>
                            <GeralCell perc={geral.percTarde} num={geral.numTarde} den={geral.denTarde} emAlerta={geral.alertaTarde} />
                            <GeralCell perc={geral.percCobertura} num={geral.numCob} den={geral.denCob} emAlerta={geral.alertaCob} />
                            <GeralCell perc={geral.percCurtas} num={geral.numCurtas} den={geral.denCurtas} emAlerta={geral.alertaCurtas} />
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes de célula
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

function FilterInput({ label, type, value, onChange, placeholder }: {
    label: string; type: string; value: string;
    onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
        </div>
    );
}

// Célula de hora — fica vermelha se início tardio
function HoraCell({ hora, limiar, tipo }: { hora: string; limiar: string; tipo: "inicio" | "fim" }) {
    if (hora === "—") return <span className="text-sm text-slate-400">—</span>;

    const emAlerta = tipo === "inicio" && limiar && hora !== "—" && hora > limiar;
    return (
        <span
            className={`text-sm tabular-nums ${emAlerta ? "text-red-500" : "text-slate-700"}`}
            style={{ fontWeight: emAlerta ? 700 : 500 }}
        >
            {hora}
        </span>
    );
}

// Célula de métrica: "XX% (N/D)"
function MetricCell({ perc, num, den, emAlerta, alertaDirecao = "acima" }: {
    perc: number; num: number; den: number;
    emAlerta: boolean; alertaDirecao?: "acima" | "abaixo";
}) {
    if (den === 0) return <span className="text-sm text-slate-400">—</span>;
    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className={`text-sm tabular-nums ${emAlerta ? "text-red-500" : "text-slate-700"}`}
                style={{ fontWeight: 700 }}>
                {fmtPerc(perc)}
            </span>
            <span className="text-xs text-slate-400 tabular-nums">{fmtFrac(num, den)}</span>
        </div>
    );
}

// Célula da linha Geral (fundo verde)
function GeralCell({ perc, num, den, emAlerta }: {
    perc: number; num: number; den: number; emAlerta: boolean;
}) {
    return (
        <td className="px-4 py-3 text-center">
            <div className="flex flex-col items-center gap-0.5">
                <span className={`text-sm tabular-nums ${emAlerta ? "text-yellow-300" : "text-white"}`}
                    style={{ fontWeight: 800 }}>
                    {fmtPerc(perc)}
                </span>
                <span className="text-xs text-emerald-200 tabular-nums">{fmtFrac(num, den)}</span>
            </div>
        </td>
    );
}