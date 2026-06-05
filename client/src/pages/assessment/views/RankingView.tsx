import { useState, useMemo } from "react";
import { CheckCircle2, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { pctColor, MESES, MEDAL, POSITION_COLORS, DEFAULT_COLOR } from "../constants";

export function RankingView({ isDark: _isDark, cardBorder, cardShadow }: {
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
}) {
    const hoje = new Date();
    const [selectedAno, setSelectedAno] = useState(hoje.getFullYear());
    const [selectedMes, setSelectedMes] = useState(hoje.getMonth() + 1);

    const allQuery = trpc.assessment.listAll.useQuery({ ano: selectedAno, mes: selectedMes });
    const revendasQ = trpc.assessment.listRevendas.useQuery();

    const ranking = useMemo(() => {
        const respostas = allQuery.data ?? [];
        const revendas = revendasQ.data ?? [];

        // Agrupa respostas por revenda
        type Stats = {
            revenda: string;
            totalItens: number;
            sim: number;
            parcial: number;
            nao: number;
            evidSim: number;
        };
        const map = new Map<string, Stats>();

        for (const r of respostas) {
            if (!map.has(r.revenda)) {
                map.set(r.revenda, { revenda: r.revenda, totalItens: 0, sim: 0, parcial: 0, nao: 0, evidSim: 0 });
            }
            const s = map.get(r.revenda)!;
            s.totalItens++;
            if (r.statusFinal === "Sim")          s.sim++;
            else if (r.statusFinal === "Parcial") s.parcial++;
            else if (r.statusFinal === "Não")     s.nao++;
            if (r.evidencia === "Sim")            s.evidSim++;
        }

        // Garante que todas as revendas aparecem, mesmo sem respostas
        for (const rev of revendas) {
            if (!map.has(rev.nome)) {
                map.set(rev.nome, { revenda: rev.nome, totalItens: 0, sim: 0, parcial: 0, nao: 0, ptPossivel: 0, ptAutoav: 0, ptEvid: 0 });
            }
        }

        return Array.from(map.values())
            .sort((a, b) => {
                const simA  = a.totalItens > 0 ? a.sim     / a.totalItens : 0;
                const simB  = b.totalItens > 0 ? b.sim     / b.totalItens : 0;
                const evA   = a.totalItens > 0 ? a.evidSim / a.totalItens : 0;
                const evB   = b.totalItens > 0 ? b.evidSim / b.totalItens : 0;
                return (evB - evA) || (simB - simA);
            });
    }, [allQuery.data, revendasQ.data]);

    const isLoading = allQuery.isLoading || revendasQ.isLoading;
    const mesLabel = MESES.find(m => m.num === selectedMes)?.label ?? "";

    return (
        <div className="space-y-5">
            {/* Cabeçalho + seletor */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-base text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                        Ranking de Revendas
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Classificação por score de autoavaliação — {mesLabel}/{selectedAno}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500" style={{ fontWeight: 600 }}>Período:</span>
                    <select value={selectedMes} onChange={e => setSelectedMes(Number(e.target.value))}
                        className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                        {MESES.map(m => <option key={m.num} value={m.num}>{m.label}</option>)}
                    </select>
                    <select value={selectedAno} onChange={e => setSelectedAno(Number(e.target.value))}
                        className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                        {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                </div>
            )}

            {!isLoading && ranking.every(r => r.totalItens === 0) && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                    <Trophy className="w-10 h-10 opacity-30" />
                    <p className="text-sm" style={{ fontWeight: 600 }}>Nenhum dado sincronizado para {mesLabel}/{selectedAno}.</p>
                    <p className="text-xs">Use o botão Sincronizar para importar os dados do período.</p>
                </div>
            )}

            {!isLoading && ranking.some(r => r.totalItens > 0) && (
                <>
                    {/* Pódio — top 3 em destaque */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {ranking.slice(0, 3).map((r, idx) => {
                            const pctAutoav = r.totalItens > 0 ? Math.round(r.sim     / r.totalItens * 100) : 0;
                            const pctEvid   = r.totalItens > 0 ? Math.round(r.evidSim / r.totalItens * 100) : 0;
                            const col = POSITION_COLORS[idx];
                            return (
                                <div key={r.revenda}
                                    className={`bg-gradient-to-br ${col.bg} rounded-2xl p-5 border ${col.border} relative overflow-hidden`}
                                    style={{ boxShadow: cardShadow }}>
                                    {/* Posição */}
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`text-xs px-2.5 py-1 rounded-full ${col.badge}`} style={{ fontWeight: 800 }}>
                                            {MEDAL[idx] ?? `#${idx + 1}`} {idx + 1}º
                                        </span>
                                        <span className="text-3xl font-black tabular-nums" style={{ color: pctColor(pctAutoav) }}>
                                            {pctAutoav}%
                                        </span>
                                    </div>

                                    {/* Nome */}
                                    <p className="text-sm text-slate-800 dark:text-slate-100 mb-4 leading-tight" style={{ fontWeight: 800 }}>
                                        {r.revenda}
                                    </p>

                                    {/* Barra dupla autoav / evidência */}
                                    <div className="space-y-1.5 mb-4">
                                        <div>
                                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                                                <span style={{ fontWeight: 600 }}>Autoavaliação (Sim)</span>
                                                <span style={{ fontWeight: 700 }}>{r.sim}/{r.totalItens} respostas</span>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${pctAutoav}%`, backgroundColor: pctColor(pctAutoav) }} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                                                <span style={{ fontWeight: 600 }}>Evidência (Sim)</span>
                                                <span style={{ fontWeight: 700 }}>{r.evidSim}/{r.totalItens} respostas</span>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                                                <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pctEvid}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pills Sim/Parcial/Não */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" style={{ fontWeight: 700 }}>
                                            <CheckCircle2 className="w-2.5 h-2.5" /> {r.sim} Sim
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" style={{ fontWeight: 700 }}>
                                            {r.parcial} Parcial
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" style={{ fontWeight: 700 }}>
                                            {r.nao} Não
                                        </span>
                                        <span className="ml-auto text-[10px] text-slate-400 tabular-nums" style={{ fontWeight: 600 }}>
                                            {r.totalItens} itens
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Posições 4ª e 5ª — linha compacta */}
                    {ranking.length > 3 && (
                        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                            style={{ border: cardBorder, boxShadow: cardShadow }}>
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400 w-12" style={{ fontWeight: 700 }}>#</th>
                                        <th className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Revenda</th>
                                        <th className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 w-28" style={{ fontWeight: 700 }}>Autoavaliação</th>
                                        <th className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 w-28" style={{ fontWeight: 700 }}>Evidência</th>
                                        <th className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400 w-48" style={{ fontWeight: 700 }}>Score</th>
                                        <th className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400 w-16" style={{ fontWeight: 700 }}>Sim</th>
                                        <th className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400 w-20" style={{ fontWeight: 700 }}>Parcial</th>
                                        <th className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400 w-16" style={{ fontWeight: 700 }}>Não</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                    {ranking.slice(3).map((r, i) => {
                                        const pos = i + 4;
                                        const pctAutoav = r.totalItens > 0 ? Math.round(r.sim     / r.totalItens * 100) : 0;
                                        const pctEvid   = r.totalItens > 0 ? Math.round(r.evidSim / r.totalItens * 100) : 0;
                                        const col = DEFAULT_COLOR;
                                        return (
                                            <tr key={r.revenda} className="hover:bg-slate-50 dark:hover:bg-[var(--accent)]/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${col.badge}`} style={{ fontWeight: 800 }}>#{pos}</span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-800 dark:text-slate-100" style={{ fontWeight: 700 }}>{r.revenda}</td>
                                                <td className="px-4 py-3 text-right tabular-nums" style={{ fontWeight: 700, color: pctColor(pctAutoav) }}>{pctAutoav}%</td>
                                                <td className="px-4 py-3 text-right tabular-nums text-indigo-500 dark:text-indigo-400" style={{ fontWeight: 700 }}>{pctEvid}%</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                            <div className="h-full rounded-full transition-all" style={{ width: `${pctAutoav}%`, backgroundColor: pctColor(pctAutoav) }} />
                                                        </div>
                                                        <span className="text-[10px] w-7 text-right tabular-nums" style={{ fontWeight: 700, color: pctColor(pctAutoav) }}>{pctAutoav}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 tabular-nums" style={{ fontWeight: 700 }}>{r.sim}</td>
                                                <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400 tabular-nums" style={{ fontWeight: 700 }}>{r.parcial}</td>
                                                <td className="px-4 py-3 text-center text-rose-600 dark:text-rose-400 tabular-nums" style={{ fontWeight: 700 }}>{r.nao}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Barra comparativa horizontal */}
                    <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 space-y-3"
                        style={{ border: cardBorder, boxShadow: cardShadow }}>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3" style={{ fontWeight: 700 }}>Comparativo geral — Autoavaliação vs Evidência</p>
                        {ranking.filter(r => r.totalItens > 0).map((r, idx) => {
                            const pctAutoav = r.totalItens > 0 ? Math.round(r.sim     / r.totalItens * 100) : 0;
                            const pctEvid   = r.totalItens > 0 ? Math.round(r.evidSim / r.totalItens * 100) : 0;
                            return (
                                <div key={r.revenda} className="grid grid-cols-[24px_140px_1fr] items-center gap-3">
                                    <span className="text-[10px] text-slate-400 tabular-nums text-right" style={{ fontWeight: 700 }}>#{idx + 1}</span>
                                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate" style={{ fontWeight: 700 }}>{r.revenda}</span>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${pctAutoav}%`, backgroundColor: pctColor(pctAutoav) }} />
                                            </div>
                                            <span className="text-[10px] w-8 text-right tabular-nums" style={{ fontWeight: 700, color: pctColor(pctAutoav) }}>{pctAutoav}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pctEvid}%` }} />
                                            </div>
                                            <span className="text-[10px] w-8 text-right tabular-nums text-indigo-400" style={{ fontWeight: 600 }}>{pctEvid}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-[var(--sidebar-border)]">
                            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-emerald-400 inline-block" /> Autoavaliação</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-sm bg-indigo-400 inline-block" /> Evidência</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
