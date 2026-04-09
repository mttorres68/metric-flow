import { ChevronDown, ChevronUp } from "lucide-react";
import React from "react";
import { RotaRow, STATUS_COLORS } from "./types";
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
        <div className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>Conformidade de Rota</h3>
                <p className="text-xs text-slate-400 mt-0.5">{tabelaFiltrada.length} registros · clique para expandir detalhes</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="w-10 px-4 py-3" />
                            {["Status", "Revenda", "GA", "Vendedor", "Prog / Vis / GA", "Conformidade"].map(h => (
                                <th key={h} className="px-4 py-3 text-xs text-slate-500 uppercase tracking-widest text-left" style={{ fontWeight: 700 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tabelaFiltrada.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Nenhum dado encontrado.</td></tr>
                        ) : tabelaFiltrada.map((row, idx) => {
                            const sc = STATUS_COLORS[row.status];
                            const isExp = expandedRows.has(idx);
                            const pc = row.pctGA >= 100 ? "text-green-600" : row.pctGA > 0 ? "text-amber-600" : "text-red-500";

                            return (
                                <React.Fragment key={`row-${idx}`}>
                                    <tr
                                        className={`border-b border-slate-50 cursor-pointer transition-colors ${isExp ? "bg-indigo-50/30" : "hover:bg-slate-50/80"}`}
                                        onClick={() => toggleRow(idx)}>
                                        <td className="px-4 py-3 text-slate-400 text-center text-xs">
                                            {isExp ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.bg}`} style={{ fontWeight: 700 }}>{sc.label}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>{row.rev || "—"}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 font-mono">{row.gaId}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 font-mono">{row.vendId}</td>
                                        <td className="px-4 py-3 text-xs text-center font-mono">
                                            <span className="text-slate-400">{row.pdvsProg}</span> /
                                            <span className="text-indigo-600 mx-0.5">{row.pdvsVis}</span> /
                                            <span className={pc}>{row.gaVis}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xl tabular-nums ${row.agendado ? pc : "text-slate-300"}`} style={{ fontWeight: 800 }}>
                                                {row.agendado ? `${row.pctGA}%` : "—"}
                                            </span>
                                        </td>
                                    </tr>

                                    {isExp && (
                                        <tr className="border-b border-slate-100">
                                            <td colSpan={7} className="bg-slate-50/60 px-6 py-4">
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
