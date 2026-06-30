import { ChevronDown, ChevronUp } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { RotaRow, STATUS_COLORS } from "../lib/types";
import { RowDetalhe } from "./RowDetalhe";

interface Props {
    tabelaFiltrada: RotaRow[];
    expandedRows: Set<number>;
    toggleRow: (i: number) => void;
    mapRowKey: number | null;
    setMapRowKey: (k: number | null) => void;
}

export function ConformidadeTabela({ tabelaFiltrada, expandedRows, toggleRow, mapRowKey, setMapRowKey }: Props) {
    return (
        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden border border-slate-200 dark:border-[var(--border)]"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--border)]">
                <h3 className="text-slate-800 dark:text-slate-100 text-base" style={{ fontWeight: 800 }}>Conformidade de Rota</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{tabelaFiltrada.length} registros · clique para expandir detalhes</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-[var(--border)]">
                            <th className="w-10 px-4 py-3" />
                            {["Revenda", "GA", "Setor (agenda → app)", "Prog / Vis / GA", "Conformidade", "Cobertura", "Status"].map(h => (
                                <th key={h} className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left" style={{ fontWeight: 700 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tabelaFiltrada.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">Nenhum dado encontrado.</td></tr>
                        ) : tabelaFiltrada.map((row, idx) => {
                            const sc = STATUS_COLORS[row.status];
                            const isExp = expandedRows.has(idx);
                            const pc = row.pctGA >= 100 ? "text-green-600" : row.pctGA > 0 ? "text-amber-600" : "text-red-500";

                            return (
                                <React.Fragment key={`row-${idx}`}>
                                    <tr
                                        className={`border-b border-slate-50 dark:border-slate-700/40 cursor-pointer transition-colors ${isExp ? "bg-indigo-50/30 dark:bg-indigo-900/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"}`}
                                        onClick={() => toggleRow(idx)}>
                                        <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-center text-xs">
                                            {isExp ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className={sc.bg}>{row.rev || "—"}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 font-mono">{row.gaId}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 font-mono">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span>{row.setor_agendado || row.vendId || "—"}</span>
                                                {row.vendedor_no_app && row.setor_agendado && row.vendedor_no_app !== row.setor_agendado && (
                                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 text-[10px]"
                                                        title="Setor registrado no app difere do agendado">
                                                        ⚠ app: {row.vendedor_no_app}
                                                    </span>
                                                )}
                                                {(row.setores_app?.length ?? 0) > 1 && (
                                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/25 border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 text-[10px]"
                                                        title={`GA registrou visitas com: ${row.setores_app!.join(", ")}`}>
                                                        {row.setores_app!.length} setores
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-center font-mono">
                                            <span className="text-slate-400 dark:text-slate-500">{row.pdvsProg}</span> /
                                            <span className="text-indigo-600 dark:text-indigo-400 mx-0.5">{row.pdvsVis}</span> /
                                            <span className={pc}>{row.gaVis}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xl tabular-nums ${row.pctGA != null ? pc : "text-slate-300 dark:text-slate-600"}`} style={{ fontWeight: 800 }}>
                                                {row.pctGA != null ? `${row.pctGA}%` : "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}
                                                title="Cobertura: PDVs visitados pelo vendedor que o GA acompanhou">
                                                {row.pctCob != null ? `${row.pctCob}%` : "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-semibold ${sc.bg.split(' ').find(c => c.startsWith('text-'))}`}>{sc.label}</span>
                                        </td>
                                    </tr>

                                    {isExp && (
                                        <tr className="border-b border-slate-100 dark:border-[var(--border)]">
                                            <td colSpan={8} className="bg-slate-50/60 dark:bg-slate-800/40 px-6 py-4">
                                                <RowDetalhe row={row} idx={idx} mapRowKey={mapRowKey} setMapRowKey={setMapRowKey} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
