/*
 * MetricFlow — ActivityTable Component
 * Design: Pastel Command Center — tabela de atividades com status colorido
 */

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Visita } from "@/lib/data";

interface ActivityTableProps {
  visitas: Visita[];
}

const statusConfig = {
  convertido: {
    label: "Convertido",
    bg: "#D1FAE5",
    color: "#059669",
    icon: CheckCircle2,
  },
  nao_convertido: {
    label: "Não Convertido",
    bg: "#FEE2E2",
    color: "#DC2626",
    icon: XCircle,
  },
  sem_visita: {
    label: "Sem Visita",
    bg: "#F3F4F6",
    color: "#6B7280",
    icon: Clock,
  },
};

export default function ActivityTable({ visitas }: ActivityTableProps) {
  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        border: "1px solid oklch(0.93 0.006 240)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-800 text-slate-800 text-base" style={{ fontWeight: 800 }}>
            Atividades Recentes
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {visitas.length} registros encontrados · 28/02/2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: cfg.color }}
              />
              <span className="text-xs text-slate-500">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-700 text-slate-400 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Seq.
              </th>
              <th className="text-left px-4 py-3 text-xs font-700 text-slate-400 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Vendedor
              </th>
              <th className="text-left px-4 py-3 text-xs font-700 text-slate-400 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Cliente
              </th>
              <th className="text-left px-4 py-3 text-xs font-700 text-slate-400 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Horário
              </th>
              <th className="text-left px-4 py-3 text-xs font-700 text-slate-400 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Tempo Vis.
              </th>
              <th className="text-right px-4 py-3 text-xs font-700 text-slate-400 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Valor Pedido
              </th>
              <th className="text-center px-4 py-3 text-xs font-700 text-slate-400 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-700 text-slate-400 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Motivo
              </th>
            </tr>
          </thead>
          <tbody>
            {visitas.map((v, idx) => {
              const cfg = statusConfig[v.status];
              const Icon = cfg.icon;
              return (
                <tr
                  key={v.id}
                  className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                >
                  <td className="px-6 py-3.5">
                    <span className="text-xs font-600 text-slate-400" style={{ fontWeight: 600 }}>
                      #{v.seqPT}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-800 flex-shrink-0"
                        style={{
                          background: [
                            "linear-gradient(135deg, #34C78A, #6C8EF5)",
                            "linear-gradient(135deg, #6C8EF5, #A78BFA)",
                            "linear-gradient(135deg, #F5956C, #F4C5A8)",
                            "linear-gradient(135deg, #A78BFA, #6C8EF5)",
                            "linear-gradient(135deg, #F4C5A8, #F5956C)",
                          ][(v.vendedor - 1) % 5],
                          fontWeight: 800,
                        }}
                      >
                        V{v.vendedor}
                      </div>
                      <span className="text-sm font-600 text-slate-600" style={{ fontWeight: 600 }}>
                        {v.nomeVendedor}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-slate-700 font-500" style={{ fontWeight: 500 }}>
                      {v.cliente.length > 30 ? v.cliente.slice(0, 30) + "…" : v.cliente}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-slate-500 font-500 tabular-nums" style={{ fontWeight: 500 }}>
                      {v.horaInicio === "ND" ? "—" : v.horaInicio}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-slate-500 font-500 tabular-nums" style={{ fontWeight: 500 }}>
                      {v.tempoVisita === "ND" ? "—" : v.tempoVisita}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {v.valorNumerico > 0 ? (
                      <span className="text-sm font-800 text-emerald-600 tabular-nums" style={{ fontWeight: 800 }}>
                        R$ {v.valorNumerico.toFixed(2).replace(".", ",")}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-300 font-500" style={{ fontWeight: 500 }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-700"
                      style={{
                        background: cfg.bg,
                        color: cfg.color,
                        fontWeight: 700,
                      }}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-xs text-slate-400 font-500" style={{ fontWeight: 500 }}>
                      {v.motivo}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visitas.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm font-500" style={{ fontWeight: 500 }}>
              Nenhum registro encontrado com os filtros selecionados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
