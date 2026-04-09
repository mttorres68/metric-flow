/*
 * MetricFlow — ActivityTable Component
 * Design: Pastel Command Center — dark mode totalmente suportado via CSS variables
 */

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Visita } from "@/lib/data";

interface ActivityTableProps {
  visitas: Visita[];
}

// Classes Tailwind dark-aware por status
const statusConfig = {
  convertido: {
    label: "Convertido",
    wrapperClass:
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-700",
    style: {
      background: "var(--status-ok-bg)",
      color: "var(--status-ok-text)",
    },
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
    icon: CheckCircle2,
  },
  nao_convertido: {
    label: "Não Convertido",
    wrapperClass:
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-700",
    style: {
      background: "var(--status-nok-bg)",
      color: "var(--status-nok-text)",
    },
    dotClass: "bg-red-500 dark:bg-red-400",
    icon: XCircle,
  },
  sem_visita: {
    label: "Sem Visita",
    wrapperClass:
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-700",
    style: {
      background: "var(--status-neutral-bg)",
      color: "var(--status-neutral-text)",
    },
    dotClass: "bg-slate-400 dark:bg-slate-500",
    icon: Clock,
  },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #34C78A, #6C8EF5)",
  "linear-gradient(135deg, #6C8EF5, #A78BFA)",
  "linear-gradient(135deg, #F5956C, #F4C5A8)",
  "linear-gradient(135deg, #A78BFA, #6C8EF5)",
  "linear-gradient(135deg, #F4C5A8, #F5956C)",
];

export default function ActivityTable({ visitas }: ActivityTableProps) {
  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3
            className="text-foreground text-base"
            style={{ fontWeight: 800 }}
          >
            Atividades Recentes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visitas.length} registros encontrados ·{" "}
            {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
        {/* Legenda de status */}
        <div className="flex items-center gap-3">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/40 dark:bg-muted/20">
              <th
                className="text-left px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 700 }}
              >
                Seq.
              </th>
              <th
                className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 700 }}
              >
                Vendedor
              </th>
              <th
                className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 700 }}
              >
                Cliente
              </th>
              <th
                className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 700 }}
              >
                Horário
              </th>
              <th
                className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 700 }}
              >
                Tempo Vis.
              </th>
              <th
                className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 700 }}
              >
                Valor Pedido
              </th>
              <th
                className="text-center px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 700 }}
              >
                Status
              </th>
              <th
                className="text-left px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 700 }}
              >
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
                  className="border-t border-border/50 hover:bg-accent/40 transition-colors"
                >
                  <td className="px-6 py-3.5">
                    <span
                      className="text-xs text-muted-foreground"
                      style={{ fontWeight: 600 }}
                    >
                      #{v.seqPT}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs flex-shrink-0"
                        style={{
                          background:
                            AVATAR_GRADIENTS[(v.vendedor - 1) % AVATAR_GRADIENTS.length],
                          fontWeight: 800,
                        }}
                      >
                        V{v.vendedor}
                      </div>
                      <span
                        className="text-sm text-foreground/80"
                        style={{ fontWeight: 600 }}
                      >
                        {v.nomeVendedor}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className="text-sm text-foreground/70"
                      style={{ fontWeight: 500 }}
                    >
                      {v.cliente.length > 30
                        ? v.cliente.slice(0, 30) + "…"
                        : v.cliente}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className="text-sm text-muted-foreground tabular-nums"
                      style={{ fontWeight: 500 }}
                    >
                      {v.horaInicio === "ND" ? "—" : v.horaInicio}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className="text-sm text-muted-foreground tabular-nums"
                      style={{ fontWeight: 500 }}
                    >
                      {v.tempoVisita === "ND" ? "—" : v.tempoVisita}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    {v.valorNumerico > 0 ? (
                      <span
                        className="text-sm tabular-nums"
                        style={{
                          fontWeight: 800,
                          color: "var(--kpi-green-accent)",
                        }}
                      >
                        R$ {v.valorNumerico.toFixed(2).replace(".", ",")}
                      </span>
                    ) : (
                      <span
                        className="text-sm text-muted-foreground/40"
                        style={{ fontWeight: 500 }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-center">
                    <div
                      className={cfg.wrapperClass}
                      style={{ ...cfg.style, fontWeight: 700 }}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </div>
                  </td>

                  <td className="px-6 py-3.5">
                    <span
                      className="text-xs text-muted-foreground"
                      style={{ fontWeight: 500 }}
                    >
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
            <p
              className="text-muted-foreground text-sm"
              style={{ fontWeight: 500 }}
            >
              Nenhum registro encontrado com os filtros selecionados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
