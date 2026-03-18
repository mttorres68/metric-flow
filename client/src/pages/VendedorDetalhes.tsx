/*
 * MetricFlow — Página de Detalhes do Vendedor
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  MinusCircle,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocation, useRoute } from "wouter";

const STATUS_COLORS = {
  convertido:    "#34C78A",
  nao_convertido: "#FF6B6B",
  sem_visita:    "#94A3B8",
};

export default function VendedorDetalhes() {
  const [activePage, setActivePage] = useState("vendedores");
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/vendedor/:vendedor");

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
    if (page === "dashboard") setLocation("/");
    if (page === "relatorio") { window.location.href = "/relatorio"; return; }
    else if (page === "vendedores") setLocation("/vendedores");
    setActivePage(page);
  };

  if (!match || !vendedorId) return (
    <LayoutBase activePage={activePage} onNavigate={handleNavigate}>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-500" style={{ fontWeight: 600 }}>Vendedor não encontrado</p>
      </div>
    </LayoutBase>
  );

  if (isLoading) return (
    <LayoutBase activePage={activePage} onNavigate={handleNavigate}>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500" style={{ fontWeight: 600 }}>Carregando detalhes...</p>
        </div>
      </div>
    </LayoutBase>
  );

  if (error || !detalhes) return (
    <LayoutBase activePage={activePage} onNavigate={handleNavigate}>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-500" style={{ fontWeight: 600 }}>Erro ao carregar detalhes</p>
      </div>
    </LayoutBase>
  );

  // Dados para gráfico de status — separa sem_visita
  const naoConvertidos = detalhes.totalVisitas - detalhes.visitasConvertidas - (detalhes.semVisita ?? 0);
  const dadosStatus = [
    { name: "Convertidos",     value: detalhes.visitasConvertidas,       fill: STATUS_COLORS.convertido },
    { name: "Não Convertidos", value: naoConvertidos,                    fill: STATUS_COLORS.nao_convertido },
    { name: "Sem Visita",      value: detalhes.semVisita ?? 0,           fill: STATUS_COLORS.sem_visita },
  ].filter(d => d.value > 0);

  // Motivos ordenados por quantidade
  const dadosMotivos = Object.entries(detalhes.motivosNaoVenda || {})
    .map(([motivo, quantidade]) => ({ name: motivo, value: quantidade as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const tempoMedio = detalhes.tempoMedioVisita ?? 0;

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
            <button onClick={() => setLocation("/vendedores")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl text-slate-800" style={{ fontWeight: 900 }}>{detalhes.nomeVendedor}</h1>
              <p className="text-xs text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                Performance individual · {detalhes.clientesUnicos} clientes
              </p>
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Receita"
              value={`R$ ${detalhes.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              icon={<DollarSign className="w-4 h-4 text-green-600" />}
              bg="from-green-50 to-emerald-50"
              border="border-green-100"
            />
            <KPICard
              label="Total Visitas"
              value={String(detalhes.totalVisitas)}
              icon={<Users className="w-4 h-4 text-blue-600" />}
              bg="from-blue-50 to-indigo-50"
              border="border-blue-100"
              sub={`${detalhes.visitasConvertidas} convertidas`}
            />
            <KPICard
              label="Taxa Conversão"
              value={`${detalhes.taxaConversao.toFixed(1)}%`}
              icon={<TrendingUp className="w-4 h-4 text-orange-600" />}
              bg="from-orange-50 to-amber-50"
              border="border-orange-100"
              sub={`${detalhes.clientesUnicos} clientes únicos`}
            />
            <KPICard
              label="Tempo Médio"
              value={`${tempoMedio.toFixed(1)} min`}
              icon={<Clock className="w-4 h-4 text-purple-600" />}
              bg="from-purple-50 to-violet-50"
              border="border-purple-100"
              sub="por visita com duração"
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Status — com sem_visita separado */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="mb-4">
                <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Distribuição por Status</h3>
                <p className="text-xs text-slate-400 mt-0.5">Todos os clientes da carteira</p>
              </div>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={dadosStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={3} dataKey="value" labelLine={false}>
                      {dadosStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }}
                      formatter={(v: number, name: string) => [v, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3">
                  {dadosStatus.map(s => (
                    <div key={s.name} className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.fill }} />
                      <div>
                        <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>{s.name}</p>
                        <p className="text-lg text-slate-800 leading-none" style={{ fontWeight: 800 }}>{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Motivos de não conversão */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="mb-4">
                <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Motivos de Não Conversão</h3>
                <p className="text-xs text-slate-400 mt-0.5">{dadosMotivos.length} motivos registrados</p>
              </div>
              {dadosMotivos.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosMotivos} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#94A3B8" }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} />
                    <Bar dataKey="value" fill="#FF6B6B" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-slate-400">
                  Sem registros de não conversão
                </div>
              )}
            </div>
          </div>

          {/* Tabela de clientes */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Clientes do Vendedor</h3>
              <p className="text-xs text-slate-400 mt-0.5">{clientes?.length ?? 0} clientes no total</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Cliente", "Código", "Receita", "Visitas", "Status"].map((h, i) => (
                      <th key={h} className={`py-3 px-4 text-xs uppercase tracking-widest text-slate-500 ${i >= 2 ? "text-right" : "text-left"} ${h === "Status" ? "text-center" : ""}`} style={{ fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientes?.map((c) => (
                    <tr key={c.codCliente} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-700" style={{ fontWeight: 600 }}>{c.cliente}</td>
                      <td className="py-3 px-4 text-slate-500 tabular-nums">{c.codCliente}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-800" style={{ fontWeight: 700 }}>
                        R$ {c.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-600">{c.visitas}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {c.visitas === 0 ? (
                            <>
                              <MinusCircle className="w-4 h-4 text-slate-400" />
                              <span className="text-xs text-slate-400" style={{ fontWeight: 600 }}>Sem visita</span>
                            </>
                          ) : c.convertido ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-xs text-green-600" style={{ fontWeight: 700 }}>Convertido</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-xs text-red-500" style={{ fontWeight: 700 }}>Não Conv.</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center py-4">
            <p className="text-xs text-slate-300" style={{ fontWeight: 500 }}>
              MetricFlow · Detalhes do Vendedor · {new Date().toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LayoutBase({ activePage, onNavigate, children }: { activePage: string; onNavigate: (p: string) => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="flex-1 ml-60 min-h-screen flex flex-col">{children}</main>
    </div>
  );
}

function KPICard({ label, value, icon, bg, border, sub }: {
  label: string; value: string; icon: React.ReactNode;
  bg: string; border: string; sub?: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${bg} rounded-2xl p-5 border ${border}`} style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>{label}</span>
        {icon}
      </div>
      <p className="text-2xl text-slate-800" style={{ fontWeight: 900 }}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1" style={{ fontWeight: 500 }}>{sub}</p>}
    </div>
  );
}