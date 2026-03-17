/*
 * MetricFlow — Dashboard Principal
 * Design: Pastel Command Center
 */

import ActivityTable from "@/components/ActivityTable";
import FilterBar from "@/components/FilterBar";
import KPICard from "@/components/KPICard";
import Sidebar from "@/components/Sidebar";
import { useConfigMetricas } from "@/components/ConfigPanel";
import { useFilterState } from "@/hooks/useFilterState";
import {
  BarChart2,
  Clock,
  DollarSign,
  MapPin,
  Target,
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const PASTEL_COLORS = [
  "#A8C5E8", "#A8F4C5", "#C5A8F4", "#F4C5A8",
  "#F4A8C5", "#A8D4F4", "#F4E8A8", "#F4A8A8",
];

export default function Home() {
  const [activePage, setActivePage] = useState("dashboard");

  // Filtros de dados — persistidos no localStorage via useFilterState
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

  // Configuração de regras de negócio — persiste no localStorage
  const { config, apply: applyConfig, reset: resetConfig, isDirty: isConfigDirty } = useConfigMetricas();

  const { data: dashboardData, isLoading, error } = trpc.dashboard.getMetrics.useQuery({
    vendedor: filters.vendedor,
    status: filters.status as "convertido" | "nao_convertido" | "sem_visita" | undefined,
    gerente: filters.gerente,
    revenda: filters.revenda,
    dataInicio: filters.dataInicio,
    dataFim: filters.dataFim,
    config,
  });

  const handleNavigate = (page: string) => {
    if (page === "vendedores") { window.location.href = "/vendedores"; return; }
    if (page === "compliance") { window.location.href = "/compliance"; return; }

    if (page !== "dashboard") {
      toast.info(`Módulo "${page}" em breve`, { description: "Esta seção está em desenvolvimento." });
      return;
    }
    setActivePage(page);
  };

  const handleReset = () => resetFiltros();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-500" style={{ fontWeight: 600 }}>Carregando dados...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500" style={{ fontWeight: 600 }}>Erro ao carregar dados</p>
            <p className="text-slate-400 text-sm mt-2">{error?.message || "Tente novamente"}</p>
          </div>
        </main>
      </div>
    );
  }

  const { kpis, visitas, graficos } = dashboardData;

  const ticketMedio = kpis.clientes_unicos_visitados > 0
    ? kpis.receita_total / kpis.clientes_unicos_visitados
    : 0;


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
            <h1 className="text-xl text-slate-800" style={{ fontWeight: 900 }}>Painel de Análise</h1>
            <p className="text-xs text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
              Visão geral em tempo real · {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(kpis.alertas.cobertura || kpis.alertas.curtas || kpis.alertas.tarde) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-amber-600 bg-amber-50 border border-amber-100" style={{ fontWeight: 700 }}>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {[
                  kpis.alertas.cobertura && "Cobertura",
                  kpis.alertas.curtas && "Relâmpagos",
                  kpis.alertas.tarde && "Tarde",
                ].filter(Boolean).join(" · ")} em alerta
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 bg-emerald-50 border border-emerald-100" style={{ fontWeight: 700 }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ao vivo
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xs" style={{ fontWeight: 800 }}>
              AD
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">
          {/* FilterBar — recebe config e handlers do hook */}
          <FilterBar
            filtroVendedor={filters.vendedor}
            filtroStatus={filters.status}
            filtroGerente={filters.gerente}
            filtroRevenda={filters.revenda}
            filtroDataInicio={filters.dataInicio}
            filtroDataFim={filters.dataFim}
            onVendedorChange={setFiltroVendedor}
            onStatusChange={setFiltroStatus}
            onGerenteChange={setFiltroGerente}
            onRevendaChange={setFiltroRevenda}
            onDataInicioChange={setFiltroDataInicio}
            onDataFimChange={setFiltroDataFim}
            onReset={handleReset}
            config={config}
            onApply={applyConfig}
            onConfigReset={resetConfig}
            isConfigDirty={isConfigDirty}
          />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Receita Total"
              value={`R$ ${kpis.receita_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              icon={<DollarSign className="w-5 h-5" />}
              colorClass="green"
              trend={Number(ticketMedio.toFixed(1))}
              trendLabel="Ticket Médio"
              delay={0}
            />
            <KPICard
              title="Cobertura"
              value={`${kpis.cobertura_perc.toFixed(1)}%`}
              icon={<Target className="w-5 h-5" />}
              colorClass={kpis.alertas.cobertura ? "orange" : "green"}
              //trend={kpis.clientes_unicos_visitados}
              trendLabel={`${kpis.clientes_unicos_visitados}/${kpis.total_carteira} clientes`}
              delay={50}
            />
            <KPICard
              title="Visitas Relâmpago"
              value={`${kpis.visitas_curtas_perc.toFixed(1)}%`}
              icon={<Clock className="w-5 h-5" />}
              colorClass={kpis.alertas.curtas ? "orange" : "blue"}
              trend={kpis.visitas_curtas_count}
              trendLabel={`${kpis.visitas_curtas_count}/${kpis.visitas_brutas_raio} visitas`}
              delay={100}
            />
            <KPICard
              title="Visitas no Almoço"
              value={String(kpis.visitas_almoco)}
              icon={<MapPin className="w-5 h-5" />}
              colorClass="purple"
              trend={Number(kpis.visitas_tarde_perc.toFixed(1))}
              trendLabel={`% Após 14h${kpis.alertas.tarde ? " ⚠" : ""}`}
              delay={150}
            />
            <KPICard
              title="Tempo Médio"
              value={`${kpis.tempo_medio_visita.toFixed(1)} min`}
              icon={<Clock className="w-5 h-5" />}
              colorClass="blue"
              trendLabel={`(${kpis.visitas_com_duracao_valida}) visitas com duração`}
              delay={200}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-white rounded-2xl p-5" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Evolução de Receita no Dia</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Acumulado por horário de visita</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100">
                  <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs text-indigo-600" style={{ fontWeight: 700 }}>{new Date().toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={graficos.evolucao_horaria ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C8EF5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6C8EF5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradVisitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34C78A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#34C78A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} width={55} />
                  <Tooltip contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="acumulado" name="Receita" stroke="#6C8EF5" strokeWidth={2.5} fill="url(#gradReceita)" dot={{ fill: "#6C8EF5", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Area type="monotone" dataKey="visitas" name="Visitas" stroke="#34C78A" strokeWidth={2} fill="url(#gradVisitas)" dot={{ fill: "#34C78A", r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl p-5" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="mb-5">
                <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Clientes por Vendedor</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Raio: {config.raioPDV >= 1000 ? `${config.raioPDV / 1000}km` : `${config.raioPDV}m`}
                </p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                {(() => {
                  const vendedoresOrdenados = [...(graficos.vendedores ?? [])].sort((a: any, b: any) => b.clientes - a.clientes);
                  return (
                    <BarChart data={vendedoresOrdenados} margin={{ top: 22, right: 5, left: -20, bottom: 0 }} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="vendedor" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={true} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={true} />
                      <Tooltip
                        contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: 12 }}
                        formatter={(value: any, name: string) => [
                          name === "curtas_perc" ? `${Number(value).toFixed(1)}%` : value,
                          name === "curtas_perc" ? "% Relâmpago" : "Clientes",
                        ]}
                      />
                      <Bar dataKey="clientes" name="Clientes" radius={[6, 6, 0, 0]}>
                        <LabelList
                          dataKey="clientes"
                          position="insideTop"
                          style={{ fontSize: 11, fontWeight: 700, fill: "#64748B" }}
                        />
                        {(graficos.vendedores ?? []).map((_: any, i: number) => (
                          <Cell key={`cell-${i}`} fill={PASTEL_COLORS[i % PASTEL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  );
                })()}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Table */}
          <ActivityTable
            visitas={visitas.map((v) => ({
              id: v.id,
              vendedor: v.vendedor,
              nomeVendedor: `V0${v.vendedor}`,
              cliente: v.cliente,
              codCliente: v.codCliente,
              seqERP: v.seqERP,
              seqPT: v.seqPT,
              valorPedido: v.valorPedido,
              valorNumerico: v.valorNumerico,
              tipoCobr: v.tipoCobr,
              horaInicio: v.horaInicio,
              horaFim: v.horaFim,
              tempoVisita: v.tempoVisita,
              distR: v.distR,
              status: v.status,
              motivo: v.motivo,
            }))}
          />

          <div className="text-center py-4">
            <p className="text-xs text-slate-300" style={{ fontWeight: 500 }}>
              MetricFlow · {new Date().toLocaleTimeString("pt-BR")}
              {isConfigDirty && " · Configuração personalizada ativa"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}