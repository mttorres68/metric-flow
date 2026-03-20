/*
 * MetricFlow — Página de Vendedores
 * Lista de vendedores com desempenho e métricas
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  DollarSign,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PASTEL_COLORS = [
  "#A8C5E8", "#A8F4C5", "#C5A8F4", "#F4C5A8",
  "#F4A8C5", "#A8D4F4", "#F4E8A8", "#F4A8A8",
];

const FILTER_KEY = "metricflow:vendedores-filters";

function loadFilters() {
  try {
    const s = localStorage.getItem(FILTER_KEY);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

type SortKey = "receita" | "totalVisitas" | "visitasConvertidas" | "taxaConversao" | "clientesUnicos";
type SortDir = "asc" | "desc";

export default function VendedoresLista() {
  const [activePage, setActivePage] = useState("vendedores");
  const [, setLocation] = useLocation();

  // Filtros persistidos no localStorage
  const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);
  const setFiltro = (k: string, v: any) => {
    const next = { ...filtros, [k]: v };
    setFiltros(next);
    localStorage.setItem(FILTER_KEY, JSON.stringify(next));
  };
  const resetFiltros = () => {
    setFiltros({});
    localStorage.removeItem(FILTER_KEY);
  };

  // Busca e ordenação
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("receita");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const { data: vendedores = [], isLoading, error } = trpc.vendedores.listar.useQuery({
    gerente: filtros.gerente,
    revenda: filtros.revenda,
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
  });

  // ── Navegação ───────────────────────────────────────────────────────────────
  const handleNavigate = (page: string) => {
    const rotas: Record<string, string> = {
      dashboard: "/", vendedores: "/vendedores",
      compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
      relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching",
    };
    if (rotas[page]) { window.location.href = rotas[page]; return; }
    if (page !== "vendedores") toast.info(`Módulo "${page}" em breve`);
    else setActivePage(page);
  };

  // Tabela filtrada + ordenada
  const tabelaFiltrada = useMemo(() => {
    let lista = [...vendedores];
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(v =>
        v.nomeVendedor.toLowerCase().includes(q) ||
        String(v.vendedor).includes(q)
      );
    }
    lista.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "desc" ? -diff : diff;
    });
    return lista;
  }, [vendedores, busca, sortKey, sortDir]);

  const top10 = useMemo(
    () => [...vendedores].sort((a, b) => b.receita - a.receita).slice(0, 10),
    [vendedores]
  );

  // KPIs gerais
  const totalReceita = vendedores.reduce((s, v) => s + v.receita, 0);
  const totalVisitas = vendedores.reduce((s, v) => s + v.totalVisitas, 0);
  const totalConversoes = vendedores.reduce((s, v) => s + v.visitasConvertidas, 0);
  const taxaMedia = totalVisitas > 0 ? (totalConversoes / totalVisitas) * 100 : 0;

  const temFiltro = Object.values(filtros).some(v => v !== undefined && v !== "");

  // ── Loading / error ───────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500" style={{ fontWeight: 600 }}>Carregando vendedores...</p>
        </div>
      </main>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      <main className="flex-1 ml-60 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500" style={{ fontWeight: 600 }}>Erro ao carregar vendedores</p>
          <p className="text-slate-400 text-sm mt-1">{error.message}</p>
        </div>
      </main>
    </div>
  );

  // Cabeçalho de coluna ordenável
  function ThSort({ k, children, align = "right" }: { k: SortKey; children: React.ReactNode; align?: string }) {
    const active = sortKey === k;
    const Icon = active ? (sortDir === "desc" ? ChevronDown : ChevronUp) : ChevronsUpDown;
    return (
      <th
        className={`px-5 py-3 text-xs uppercase tracking-widest cursor-pointer select-none whitespace-nowrap transition-colors
          ${align === "right" ? "text-right" : "text-left"}
          ${active ? "text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        style={{ fontWeight: 700 }}
        onClick={() => toggleSort(k)}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
          {children}
          <Icon className="w-3 h-3 opacity-60" />
        </span>
      </th>
    );
  }

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
            <h1 className="text-xl text-slate-800" style={{ fontWeight: 900 }}>Análise de Vendedores</h1>
            <p className="text-xs text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
              Desempenho e métricas individuais · {vendedores.length} vendedores
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-emerald-600 bg-emerald-50 border border-emerald-100" style={{ fontWeight: 700 }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ao vivo
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">

          {/* Filtros */}
          <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>Data Início</label>
              <input type="date" value={filtros.dataInicio ?? ""}
                onChange={e => setFiltro("dataInicio", e.target.value || undefined)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>Data Fim</label>
              <input type="date" value={filtros.dataFim ?? ""}
                onChange={e => setFiltro("dataFim", e.target.value || undefined)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            {temFiltro && (
              <button onClick={resetFiltros}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-all"
                style={{ fontWeight: 600 }}>
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              { label: "Receita Total", value: `R$ ${totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: <DollarSign className="w-8 h-8 text-indigo-400" />, bg: "linear-gradient(135deg,#F0F9FF 0%,#E0F2FE 100%)" },
              { label: "Total Visitas", value: totalVisitas, icon: <Users className="w-8 h-8 text-emerald-400" />, bg: "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)" },
              { label: "Conversões", value: totalConversoes, icon: <TrendingUp className="w-8 h-8 text-orange-400" />, bg: "linear-gradient(135deg,#FFF7ED 0%,#FEF3C7 100%)" },
              { label: "Taxa Média", value: `${taxaMedia.toFixed(1)}%`, icon: <BarChart3 className="w-8 h-8 text-purple-400" />, bg: "linear-gradient(135deg,#FAF5FF 0%,#F3E8FF 100%)" },
            ] as const).map(({ label, value, icon, bg }) => (
              <div key={label} className="rounded-2xl p-5" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", background: bg }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>{label}</p>
                    <p className="text-2xl text-slate-800 mt-2" style={{ fontWeight: 900 }}>{value}</p>
                  </div>
                  {icon}
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico top 10 */}
          {top10.length > 0 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="mb-5">
                <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Top 10 por Receita</h3>
                <p className="text-xs text-slate-400 mt-0.5">Ordenado por maior faturamento</p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={top10} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="nomeVendedor" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: 12 }}
                    formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Receita"]}
                  />
                  <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="receita" position="top"
                      style={{ fontSize: 10, fontWeight: 700, fill: "#64748B" }}
                      formatter={(v: number) => `R$${(v / 1000).toFixed(1)}k`} />
                    {top10.map((_, i) => <Cell key={i} fill={PASTEL_COLORS[i % PASTEL_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Ranking de Vendedores</h3>
                <p className="text-xs text-slate-400 mt-0.5">{tabelaFiltrada.length} de {vendedores.length} vendedores</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar vendedor..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 placeholder-slate-400 focus:outline-none w-40"
                  style={{ fontWeight: 500 }}
                />
                {busca && <button onClick={() => setBusca("")}><X className="w-3 h-3 text-slate-400" /></button>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>#</th>
                    <th className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>Vendedor</th>
                    <ThSort k="receita">Receita</ThSort>
                    <ThSort k="totalVisitas">Visitas</ThSort>
                    <ThSort k="visitasConvertidas">Conv.</ThSort>
                    <ThSort k="taxaConversao">Taxa %</ThSort>
                    <ThSort k="clientesUnicos">Clientes</ThSort>
                    <th className="px-5 py-3 text-center text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 700 }}>Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelaFiltrada.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                        Nenhum vendedor encontrado
                      </td>
                    </tr>
                  ) : tabelaFiltrada.map((v, idx) => (
                    <tr
                      key={v.vendedor}
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/vendedor/${v.vendedor}`)}
                    >
                      <td className="px-5 py-3.5 text-sm text-slate-400 tabular-nums" style={{ fontWeight: 600 }}>#{idx + 1}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-white shrink-0"
                            style={{ fontWeight: 800, background: PASTEL_COLORS[idx % PASTEL_COLORS.length] }}>
                            {String(v.vendedor).slice(-2)}
                          </div>
                          <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{v.nomeVendedor}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right tabular-nums text-slate-800" style={{ fontWeight: 700 }}>
                        R$ {v.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right text-slate-600 tabular-nums">{v.totalVisitas}</td>
                      <td className="px-5 py-3.5 text-sm text-right text-slate-600 tabular-nums">{v.visitasConvertidas}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(v.taxaConversao, 100)}%`, background: PASTEL_COLORS[idx % PASTEL_COLORS.length] }} />
                          </div>
                          <span className="text-xs tabular-nums text-slate-600 w-9 text-right" style={{ fontWeight: 600 }}>{v.taxaConversao.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right text-slate-600 tabular-nums">{v.clientesUnicos}</td>
                      <td className="px-5 py-3.5 text-center" onClick={e => { e.stopPropagation(); setLocation(`/vendedor/${v.vendedor}`); }}>
                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 transition-colors">
                          <ChevronRight className="w-4 h-4 text-slate-400" />
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
              MetricFlow · Análise de Vendedores · {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}