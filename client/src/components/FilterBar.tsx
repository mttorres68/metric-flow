/*
 * MetricFlow — FilterBar Component
 * Design: Pastel Command Center — barra de filtros com gerente, revenda, vendedor, status e data
 */

import { Calendar, ChevronDown, Filter, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

interface FilterBarProps {
  filtroVendedor: string | undefined;
  filtroStatus: string | undefined;
  filtroGerente: number | undefined;
  filtroRevenda: string | undefined;
  filtroDataInicio: string | undefined;
  filtroDataFim: string | undefined;
  onVendedorChange: (v: string | undefined) => void;
  onStatusChange: (s: string | undefined) => void;
  onGerenteChange: (g: number | undefined) => void;
  onRevendaChange: (r: string | undefined) => void;
  onDataInicioChange: (d: string | undefined) => void;
  onDataFimChange: (d: string | undefined) => void;
  onReset: () => void;
}

export default function FilterBar({
  filtroVendedor,
  filtroStatus,
  filtroGerente,
  filtroRevenda,
  filtroDataInicio,
  filtroDataFim,
  onVendedorChange,
  onStatusChange,
  onGerenteChange,
  onRevendaChange,
  onDataInicioChange,
  onDataFimChange,
  onReset,
}: FilterBarProps) {
  const { data: vendedores = [] } = trpc.dashboard.getVendedores.useQuery();
  const { data: gerentes = [] } = trpc.dashboard.getGerentes.useQuery();
  const { data: revendas = [] } = trpc.dashboard.getRevendas.useQuery();
  const { data: dateRange } = trpc.dashboard.getDateRange.useQuery();

  const [dataInicio, setDataInicio] = useState(filtroDataInicio || "");
  const [dataFim, setDataFim] = useState(filtroDataFim || "");

  useEffect(() => {
    setDataInicio(filtroDataInicio || "");
  }, [filtroDataInicio]);

  useEffect(() => {
    setDataFim(filtroDataFim || "");
  }, [filtroDataFim]);

  const handleDataInicioChange = (value: string) => {
    setDataInicio(value);
    onDataInicioChange(value || undefined);
  };

  const handleDataFimChange = (value: string) => {
    setDataFim(value);
    onDataFimChange(value || undefined);
  };

  return (
    <div
      className="bg-white rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-3"
      style={{
        border: "1px solid oklch(0.93 0.006 240)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Filtro Data Início */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-700 text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>
          Data Início
        </span>
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => handleDataInicioChange(e.target.value)}
          min={dateRange?.minDate}
          max={dateRange?.maxDate}
          className="pl-3 pr-3 py-1.5 rounded-xl text-sm font-600 text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
          style={{ fontWeight: 600 }}
        />
      </div>

      {/* Filtro Data Fim */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-700 text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>
          Data Fim
        </span>
        <input
          type="date"
          value={dataFim}
          onChange={(e) => handleDataFimChange(e.target.value)}
          min={dateRange?.minDate}
          max={dateRange?.maxDate}
          className="pl-3 pr-3 py-1.5 rounded-xl text-sm font-600 text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
          style={{ fontWeight: 600 }}
        />
      </div>

      <div className="w-px h-6 bg-slate-100" />

      {/* Filtro Gerente */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-700 text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>
          Gerente
        </span>
        <div className="relative">
          <select
            value={filtroGerente !== undefined ? String(filtroGerente) : "todos"}
            onChange={(e) =>
              onGerenteChange(e.target.value === "todos" ? undefined : Number(e.target.value))
            }
            className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-sm font-600 text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
            style={{ fontWeight: 600 }}
          >
            <option value="todos">Todos</option>
            {gerentes.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filtro Revenda */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-700 text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>
          Revenda
        </span>
        <div className="relative">
          <select
            value={filtroRevenda || "todos"}
            onChange={(e) => onRevendaChange(e.target.value === "todos" ? undefined : e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-sm font-600 text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
            style={{ fontWeight: 600 }}
          >
            <option value="todos">Todas</option>
            {revendas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filtro Vendedor */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-700 text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>
          Vendedor
        </span>
        <div className="relative">
          <select
            value={filtroVendedor || "todos"}
            onChange={(e) => onVendedorChange(e.target.value === "todos" ? undefined : e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-sm font-600 text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
            style={{ fontWeight: 600 }}
          >
            <option value="todos">Todos</option>
            {vendedores.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filtro Status */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-700 text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>
          Status
        </span>
        <div className="relative">
          <select
            value={filtroStatus || "todos"}
            onChange={(e) => onStatusChange(e.target.value === "todos" ? undefined : e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-sm font-600 text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
            style={{ fontWeight: 600 }}
          >
            <option value="todos">Todos</option>
            <option value="convertido">Convertido</option>
            <option value="nao_convertido">Não Convertido</option>
            <option value="sem_visita">Sem Visita</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Botão Limpar */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 text-slate-500 hover:bg-slate-50 border border-slate-200 transition-all"
          style={{ fontWeight: 600 }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Limpar
        </button>
      </div>
    </div>
  );
}
