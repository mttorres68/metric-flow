/*
 * MetricFlow — Dashboard Principal
 * Design: Pastel Command Center
 * Dados: Google Sheets + Python Metrics Calculator
 */

import ActivityTable from "@/components/ActivityTable";
import FilterBar from "@/components/FilterBar";
import KPICard from "@/components/KPICard";
import Sidebar from "@/components/Sidebar";
import {
  BarChart2,
  Clock,
  DollarSign,
  MapPin,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const PASTEL_COLORS = ["#A8C5E8", "#A8F4C5", "#C5A8F4", "#F4C5A8", "#F4A8C5", "#A8D4F4", "#F4E8A8", "#F4A8A8"];

export default function Home() {
  const [activePage, setActivePage] = useState("dashboard");
  const [filtroVendedor, setFiltroVendedor] = useState<string | undefined>(undefined);
  const [filtroStatus, setFiltroStatus] = useState<string | undefined>(undefined);
  const [filtroGerente, setFiltroGerente] = useState<number | undefined>(undefined);
  const [filtroRevenda, setFiltroRevenda] = useState<string | undefined>(undefined);
  const [filtroDataInicio, setFiltroDataInicio] = useState<string | undefined>(undefined);
  const [filtroDataFim, setFiltroDataFim] = useState<string | undefined>(undefined);

  // Carregar dados do backend
  const { data: dashboardData, isLoading, error } = trpc.dashboard.getMetrics.useQuery({
    vendedor: filtroVendedor,
    status: filtroStatus as "convertido" | "nao_convertido" | "sem_visita" | undefined,
    gerente: filtroGerente,
    revenda: filtroRevenda,
    dataInicio: filtroDataInicio,
    dataFim: filtroDataFim,
  });

  const handleNavigate = (page: string) => {
    if (page === "vendedores") {
      window.location.href = "/vendedores";
      return;
    }
    if (page !== "dashboard") {
      toast.info(`Módulo "${page}" em breve`, {
        description: "Esta seção está em desenvolvimento.",
      });
      return;
    }
    setActivePage(page);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-600">Carregando dados...</p>
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
            <p className="text-red-500 font-600">Erro ao carregar dados</p>
            <p className="text-slate-400 text-sm mt-2">{error?.message || "Tente novamente"}</p>
          </div>
        </main>
      </div>
    );
  }

  const { kpis, visitas, graficos } = dashboardData;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">
        {/* Header */}
        <header
          className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm px-8 py-4 border-b border-slate-100 flex items-center justify-between"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div>
            <h1 className="text-xl font-900 text-slate-800" style={{ fontWeight: 900 }}>
              Painel de Análise
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-500" style={{ fontWeight: 500 }}>
              Visão geral em tempo real · {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-700 text-emerald-600 bg-emerald-50 border border-emerald-100"
              style={{ fontWeight: 700 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ao vivo
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xs font-800" style={{ fontWeight: 800 }}>
              AD
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">
          {/* Filter Bar */}
          <FilterBar
            filtroVendedor={filtroVendedor}
            filtroStatus={filtroStatus}
            filtroGerente={filtroGerente}
            filtroRevenda={filtroRevenda}
            filtroDataInicio={filtroDataInicio}
            filtroDataFim={filtroDataFim}
            onVendedorChange={setFiltroVendedor}
            onStatusChange={setFiltroStatus}
            onGerenteChange={setFiltroGerente}
            onRevendaChange={setFiltroRevenda}
            onDataInicioChange={setFiltroDataInicio}
            onDataFimChange={setFiltroDataFim}
            onReset={() => {
              setFiltroVendedor(undefined);
              setFiltroStatus(undefined);
              setFiltroGerente(undefined);
              setFiltroRevenda(undefined);
              setFiltroDataInicio(undefined);
              setFiltroDataFim(undefined);
            }}
          />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Receita Total"
              value={`R$ ${kpis.receita_total.toFixed(2).replace(".", ",")}`}
              icon={<DollarSign className="w-5 h-5" />}
              colorClass="green"
              trend={kpis.receita_trend || 0}
              trendLabel="vs. meta"
              delay={0}
            />
            <KPICard
              title="Clientes Visitados"
              value={String(kpis.clientes_visitados)}
              icon={<Users className="w-5 h-5" />}
              colorClass="blue"
              trend={5.2}
              trendLabel="vs. ontem"
              delay={60}
            />
            <KPICard
              title="Taxa de Conversão"
              value={`${kpis.taxa_conversao.toFixed(1)}%`}
              icon={<ShoppingBag className="w-5 h-5" />}
              colorClass="orange"
              trend={kpis.taxa_conversao > 0 ? 1.8 : -2.1}
              trendLabel="vs. média"
              delay={120}
            />
            <KPICard
              title="Tempo Médio Visita"
              value={`${kpis.tempo_medio_visita.toFixed(1)} min`}
              icon={<Clock className="w-5 h-5" />}
              colorClass="purple"
              trend={-3.5}
              trendLabel="vs. semana"
              delay={180}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Gráfico de Linha — Evolução Horária */}
            <div
              className="lg:col-span-3 bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-800 text-slate-800 text-base" style={{ fontWeight: 800 }}>
                    Evolução de Receita no Dia
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Acumulado por horário de visita</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100">
                  <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-700 text-indigo-600" style={{ fontWeight: 700 }}>
                    {new Date().toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={graficos.evolucao_horaria || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                  <XAxis
                    dataKey="hora"
                    tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "Nunito" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "Nunito" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${v}`}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #E2E8F0",
                      borderRadius: "12px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      fontFamily: "Nunito",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Nunito", paddingTop: 8 }} />
                  <Area
                    type="monotone"
                    dataKey="acumulado"
                    stroke="#6C8EF5"
                    strokeWidth={2.5}
                    fill="url(#gradReceita)"
                    dot={{ fill: "#6C8EF5", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#6C8EF5" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="visitas"
                    stroke="#34C78A"
                    strokeWidth={2}
                    fill="url(#gradVisitas)"
                    dot={{ fill: "#34C78A", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#34C78A" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Barras — Por Vendedor */}
            <div
              className="lg:col-span-2 bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div className="mb-5">
                <h3 className="font-800 text-slate-800 text-base" style={{ fontWeight: 800 }}>
                  Clientes por Vendedor
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Total de visitas realizadas</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={graficos.vendedores || []}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  barSize={28}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="vendedor"
                    tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "Nunito" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "Nunito" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #E2E8F0",
                      borderRadius: "12px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      fontFamily: "Nunito",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="clientes" radius={[6, 6, 0, 0]}>
                    {(graficos.vendedores || []).map((_: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PASTEL_COLORS[index % PASTEL_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Table */}
          <ActivityTable visitas={visitas.map(v => ({
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
          }))} />

          {/* Footer */}
          <div className="text-center py-4">
            <p className="text-xs text-slate-300 font-500" style={{ fontWeight: 500 }}>
              MetricFlow · Dados em tempo real do Google Sheets · {new Date().toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
