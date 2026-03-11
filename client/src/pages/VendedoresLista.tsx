/*
 * MetricFlow — Página de Vendedores
 * Lista de vendedores com desempenho e métricas
 */

import Sidebar from "@/components/Sidebar";
import FilterBar from "@/components/FilterBar";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  ChevronRight,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PASTEL_COLORS = ["#A8C5E8", "#A8F4C5", "#C5A8F4", "#F4C5A8", "#F4A8C5"];

export default function VendedoresLista() {
  const [activePage, setActivePage] = useState("vendedores");
  const [, setLocation] = useLocation();
  const [filtroGerente, setFiltroGerente] = useState<number | undefined>(undefined);
  const [filtroRevenda, setFiltroRevenda] = useState<string | undefined>(undefined);
  const [filtroDataInicio, setFiltroDataInicio] = useState<string | undefined>(undefined);
  const [filtroDataFim, setFiltroDataFim] = useState<string | undefined>(undefined);

  const { data: vendedores = [], isLoading, error } = trpc.vendedores.listar.useQuery({
    gerente: filtroGerente,
    revenda: filtroRevenda,
    dataInicio: filtroDataInicio,
    dataFim: filtroDataFim,
  });

  const handleNavigate = (page: string) => {
    if (page !== "vendedores") {
      toast.info(`Módulo "${page}" em breve`, {
        description: "Esta seção está em desenvolvimento.",
      });
      return;
    }
    setActivePage(page);
  };

  const handleReset = () => {
    setFiltroGerente(undefined);
    setFiltroRevenda(undefined);
    setFiltroDataInicio(undefined);
    setFiltroDataFim(undefined);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-600">Carregando vendedores...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 font-600">Erro ao carregar vendedores</p>
          </div>
        </main>
      </div>
    );
  }

  // Calcular KPIs
  const totalReceita = vendedores.reduce((sum, v) => sum + v.receita, 0);
  const totalVisitas = vendedores.reduce((sum, v) => sum + v.totalVisitas, 0);
  const totalConversoes = vendedores.reduce((sum, v) => sum + v.visitasConvertidas, 0);
  const taxaMediaConversao = totalVisitas > 0 ? (totalConversoes / totalVisitas) * 100 : 0;

  // Dados para gráfico de top 10 vendedores
  const top10Vendedores = vendedores.slice(0, 10);

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
            <h1 className="text-xl font-900 text-slate-800" style={{ fontWeight: 900 }}>
              Análise de Vendedores
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-500" style={{ fontWeight: 500 }}>
              Desempenho e métricas de cada vendedor
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
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">
          {/* Filter Bar */}
          <FilterBar
            filtroVendedor={undefined}
            filtroStatus={undefined}
            filtroGerente={filtroGerente}
            filtroRevenda={filtroRevenda}
            filtroDataInicio={filtroDataInicio}
            filtroDataFim={filtroDataFim}
            onVendedorChange={() => {}}
            onStatusChange={() => {}}
            onGerenteChange={setFiltroGerente}
            onRevendaChange={setFiltroRevenda}
            onDataInicioChange={setFiltroDataInicio}
            onDataFimChange={setFiltroDataFim}
            onReset={handleReset}
          />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                background: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-700 text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                    Receita Total
                  </p>
                  <p className="text-2xl font-900 text-slate-800 mt-2" style={{ fontWeight: 900 }}>
                    R$ {totalReceita.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-indigo-400" />
              </div>
            </div>

            <div
              className="bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-700 text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                    Total Visitas
                  </p>
                  <p className="text-2xl font-900 text-slate-800 mt-2" style={{ fontWeight: 900 }}>
                    {totalVisitas}
                  </p>
                </div>
                <Users className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <div
              className="bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                background: "linear-gradient(135deg, #FFF7ED 0%, #FED7AA 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-700 text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                    Conversões
                  </p>
                  <p className="text-2xl font-900 text-slate-800 mt-2" style={{ fontWeight: 900 }}>
                    {totalConversoes}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-400" />
              </div>
            </div>

            <div
              className="bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                background: "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-700 text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                    Taxa Média
                  </p>
                  <p className="text-2xl font-900 text-slate-800 mt-2" style={{ fontWeight: 900 }}>
                    {taxaMediaConversao.toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Gráfico de Top 10 Vendedores */}
          {top10Vendedores.length > 0 && (
            <div
              className="bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div className="mb-5">
                <h3 className="font-800 text-slate-800 text-base" style={{ fontWeight: 800 }}>
                  Top 10 Vendedores por Receita
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Ranking de desempenho</p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top10Vendedores} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="nomeVendedor"
                    tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "Nunito" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "Nunito" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
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
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  />
                  <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                    {top10Vendedores.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PASTEL_COLORS[index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela de Vendedores */}
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{
              border: "1px solid oklch(0.93 0.006 240)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-800 text-slate-800 text-base" style={{ fontWeight: 800 }}>
                Ranking de Vendedores
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-700 text-slate-600 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                      Posição
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-700 text-slate-600 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                      Vendedor
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-700 text-slate-600 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                      Receita
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-700 text-slate-600 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                      Visitas
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-700 text-slate-600 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                      Conversões
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-700 text-slate-600 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                      Taxa
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-700 text-slate-600 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                      Clientes
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-700 text-slate-600 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vendedores.map((v, idx) => (
                    <tr
                      key={v.vendedor}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3 text-sm font-700 text-slate-700" style={{ fontWeight: 700 }}>
                        #{idx + 1}
                      </td>
                      <td className="px-5 py-3 text-sm font-600 text-slate-700" style={{ fontWeight: 600 }}>
                        {v.nomeVendedor}
                      </td>
                      <td className="px-5 py-3 text-sm font-700 text-slate-800 text-right tabular-nums" style={{ fontWeight: 700 }}>
                        R$ {v.receita.toFixed(2).replace(".", ",")}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 text-right">
                        {v.totalVisitas}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 text-right">
                        {v.visitasConvertidas}
                      </td>
                      <td className="px-5 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${v.taxaConversao}%`,
                                background: PASTEL_COLORS[idx % 5],
                              }}
                            />
                          </div>
                          <span className="text-xs font-600 text-slate-600 w-8 text-right" style={{ fontWeight: 600 }}>
                            {v.taxaConversao.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 text-right">
                        {v.clientesUnicos}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => setLocation(`/vendedor/${v.vendedor}`)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-4">
            <p className="text-xs text-slate-300 font-500" style={{ fontWeight: 500 }}>
              MetricFlow · Análise de Vendedores · {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
