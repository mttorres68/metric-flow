/*
 * MetricFlow — Página de Detalhes do Vendedor
 * Análise detalhada de um vendedor específico
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useLocation, useRoute } from "wouter";

const PASTEL_COLORS = ["#A8C5E8", "#A8F4C5", "#C5A8F4", "#F4C5A8", "#F4A8C5"];

export default function VendedorDetalhes() {
  const [activePage, setActivePage] = useState("vendedores");
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/vendedores/:vendedor");

  const vendedorId = params?.vendedor ? Number(params.vendedor) : null;

  const { data: detalhes, isLoading, error } = trpc.vendedores.detalhes.useQuery(
    { vendedor: vendedorId || 0 },
    { enabled: !!vendedorId }
  );

  const { data: clientes } = trpc.vendedores.clientes.useQuery(
    { vendedor: vendedorId || 0 },
    { enabled: !!vendedorId }
  );

  const handleNavigate = (page: string) => {
    if (page === "dashboard") {
      setLocation("/");
    } else if (page === "vendedores") {
      setLocation("/vendedores");
    }
    setActivePage(page);
  };

  if (!match || !vendedorId) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 font-600">Vendedor não encontrado</p>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-600">Carregando detalhes...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !detalhes) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 font-600">Erro ao carregar detalhes</p>
          </div>
        </main>
      </div>
    );
  }

  // Dados para gráfico de motivos
  const dadosMotivos = Object.entries(detalhes.motivosNaoVenda || {}).map(([motivo, quantidade]) => ({
    name: motivo,
    value: quantidade,
  }));

  // Dados para gráfico de status
  const dadosStatus = [
    { name: "Convertidos", value: detalhes.visitasConvertidas, fill: "#34C78A" },
    { name: "Não Convertidos", value: detalhes.totalVisitas - detalhes.visitasConvertidas, fill: "#FF6B6B" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />

      <main className="flex-1 ml-60 min-h-screen">
        {/* Header */}
        <header
          className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm px-8 py-4 border-b border-slate-100 flex items-center justify-between"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/vendedores")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-900 text-slate-800" style={{ fontWeight: 900 }}>
                {detalhes.nomeVendedor}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 font-500" style={{ fontWeight: 500 }}>
                Detalhes de performance e clientes
              </p>
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-700 text-slate-500 uppercase" style={{ fontWeight: 700 }}>
                  Receita
                </span>
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-900 text-slate-800" style={{ fontWeight: 900 }}>
                R$ {detalhes.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-700 text-slate-500 uppercase" style={{ fontWeight: 700 }}>
                  Total Visitas
                </span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-900 text-slate-800" style={{ fontWeight: 900 }}>
                {detalhes.totalVisitas}
              </p>
            </div>

            <div
              className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 border border-orange-100"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-700 text-slate-500 uppercase" style={{ fontWeight: 700 }}>
                  Taxa Conversão
                </span>
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-2xl font-900 text-slate-800" style={{ fontWeight: 900 }}>
                {detalhes.taxaConversao.toFixed(1)}%
              </p>
            </div>

            <div
              className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-5 border border-purple-100"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-700 text-slate-500 uppercase" style={{ fontWeight: 700 }}>
                  Tempo Médio
                </span>
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-900 text-slate-800" style={{ fontWeight: 900 }}>
                {detalhes.totalVisitas > 0 ? (detalhes.totalVisitas / 60).toFixed(1) : "0"} min
              </p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status de Clientes */}
            <div
              className="bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div className="mb-5">
                <h3 className="font-800 text-slate-800 text-base" style={{ fontWeight: 800 }}>
                  Status dos Clientes
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Distribuição de clientes por status</p>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={dadosStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Motivos de Não Conversão */}
            <div
              className="bg-white rounded-2xl p-5"
              style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div className="mb-5">
                <h3 className="font-800 text-slate-800 text-base" style={{ fontWeight: 800 }}>
                  Motivos de Não Conversão
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Principais razões de não venda</p>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={dadosMotivos}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 150, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #E2E8F0",
                      borderRadius: "12px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="value" fill="#FF6B6B" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela de Clientes */}
          <div
            className="bg-white rounded-2xl p-5"
            style={{
              border: "1px solid oklch(0.93 0.006 240)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="mb-5">
              <h3 className="font-800 text-slate-800 text-base" style={{ fontWeight: 800 }}>
                Clientes do Vendedor
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {clientes?.length || 0} clientes no total
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-4 font-700 text-slate-600 text-xs uppercase" style={{ fontWeight: 700 }}>
                      Cliente
                    </th>
                    <th className="text-left py-3 px-4 font-700 text-slate-600 text-xs uppercase" style={{ fontWeight: 700 }}>
                      Código
                    </th>
                    <th className="text-right py-3 px-4 font-700 text-slate-600 text-xs uppercase" style={{ fontWeight: 700 }}>
                      Receita
                    </th>
                    <th className="text-right py-3 px-4 font-700 text-slate-600 text-xs uppercase" style={{ fontWeight: 700 }}>
                      Visitas
                    </th>
                    <th className="text-center py-3 px-4 font-700 text-slate-600 text-xs uppercase" style={{ fontWeight: 700 }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientes?.map((c) => (
                    <tr
                      key={c.codCliente}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-4 font-600 text-slate-700" style={{ fontWeight: 600 }}>
                        {c.cliente}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{c.codCliente}</td>
                      <td className="py-3 px-4 text-right font-800 text-slate-800" style={{ fontWeight: 800 }}>
                        R$ {c.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">{c.visitas}</td>
                      <td className="py-3 px-4 text-center">
                        {c.convertido && (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-700 text-green-600" style={{ fontWeight: 700 }}>
                              Convertido
                            </span>
                          </div>
                        )}
                        {!c.convertido && c.visitas > 0 && (
                          <div className="flex items-center justify-center gap-1">
                            <XCircle className="w-4 h-4 text-red-600" />
                            <span className="text-xs font-700 text-red-600" style={{ fontWeight: 700 }}>
                              Não Conv.
                            </span>
                          </div>
                        )}
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
              MetricFlow · Detalhes do Vendedor · {new Date().toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
