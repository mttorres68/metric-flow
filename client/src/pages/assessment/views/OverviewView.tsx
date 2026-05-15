import {
    CheckCircle2, ClipboardList, FileCheck2, LayersIcon, Target, TrendingUp,
} from "lucide-react";
import {
    Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PIRAMIDE_COR } from "../constants";
import type { Indicador } from "../types";
import { FragmentRow } from "../components/FragmentRow";
import { KpiCard } from "../components/KpiCard";

interface OverviewViewProps {
    indicadores: Indicador[];
    indicadoresFiltrados: Indicador[];
    expandido: string | null;
    setExpandido: (id: string | null) => void;
    totalIndicadores: number;
    totalPontos: number;
    totalEvidencia: number;
    microAreasUnicas: number;
    dadosPiramide: { name: string; indicadores: number; pontos: number; fill: string }[];
    dadosMicroArea: { name: string; indicadores: number; pontos: number; macro: string; fill: string }[];
    dadosTipoResposta: { name: string; value: number; fill: string }[];
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
    tickColor: string;
    gridColor: string;
}

export function OverviewView({
    indicadores,
    indicadoresFiltrados,
    expandido,
    setExpandido,
    totalIndicadores,
    totalPontos,
    totalEvidencia,
    microAreasUnicas,
    dadosPiramide,
    dadosMicroArea,
    dadosTipoResposta,
    isDark,
    cardBorder,
    cardShadow,
    tickColor,
    gridColor,
}: OverviewViewProps) {
    return (
        <>
            {/* ─── KPIs ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard titulo="Indicadores" valor={totalIndicadores} icone={ClipboardList} cor="from-indigo-400 to-purple-400" subtitulo="No filtro atual" />
                <KpiCard titulo="Pontos Possíveis" valor={totalPontos} icone={Target} cor="from-amber-400 to-orange-400" subtitulo={`Máx ${totalIndicadores ? (totalPontos / totalIndicadores).toFixed(1) : "0"} pts/ind.`} />
                <KpiCard titulo="Evidência Obrigatória" valor={totalEvidencia} icone={FileCheck2} cor="from-emerald-400 to-teal-400" subtitulo={`${totalIndicadores ? Math.round(totalEvidencia / totalIndicadores * 100) : 0}% do total`} />
                <KpiCard titulo="Micro Áreas" valor={microAreasUnicas} icone={LayersIcon} cor="from-rose-400 to-pink-400" subtitulo="Cobertas no recorte" />
            </div>

            {/* ─── Gráficos: Pirâmide, Micro Áreas & Tipo Resposta ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Pirâmide */}
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <div className="mb-4">
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <TrendingUp className="w-4 h-4 text-indigo-500" /> Distribuição por Pirâmide
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Indicadores e pontos possíveis por nível</p>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(220, dadosPiramide.length * 50)}>
                        <BarChart data={dadosPiramide} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: tickColor }}
                                width={100} axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ fill: "rgba(99,102,241,0.06)" }}
                                contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                                formatter={(v: number, name: string) => [v, name === "indicadores" ? "Indicadores" : "Pontos"]}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="indicadores" name="Indicadores" radius={[0, 6, 6, 0]}>
                                {dadosPiramide.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} />
                                ))}
                                <LabelList dataKey="indicadores" position="insideRight" style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }} />
                            </Bar>
                            <Bar dataKey="pontos" name="Pontos" radius={[0, 6, 6, 0]} fill={isDark ? "#A78BFA" : "#C5A8F4"}>
                                <LabelList dataKey="pontos" position="insideRight" style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Micro Áreas */}
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <div className="mb-4">
                        <h3 className="text-slate-800 dark:text-slate-100 text-base" style={{ fontWeight: 800 }}>
                            Pontos por Micro Área
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Onde estão concentrados os pontos no scorecard</p>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(220, dadosMicroArea.length * 28)}>
                        <BarChart data={dadosMicroArea} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: tickColor }}
                                width={120} axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ fill: "rgba(99,102,241,0.06)" }}
                                contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                                formatter={(v: number, _: any, props: any) => [
                                    `${v} pts (${props.payload.indicadores} ind.)`,
                                    props.payload.macro,
                                ]}
                            />
                            <Bar dataKey="pontos" radius={[0, 6, 6, 0]}>
                                {dadosMicroArea.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} />
                                ))}
                                <LabelList dataKey="pontos" position="insideRight" style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Tipo Resposta — Pie */}
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <div className="mb-4">
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tipo de Resposta
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Distribuição entre Binária e Maturidade</p>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie data={dadosTipoResposta} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                innerRadius={50} outerRadius={85} paddingAngle={3}
                                label={({ name, value }) => `${name}: ${value}`}
                                labelLine={false}
                            >
                                {dadosTipoResposta.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                        {dadosTipoResposta.map(d => (
                            <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                                {d.name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── Tabela detalhada ─────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 className="text-slate-800 dark:text-slate-100 text-base" style={{ fontWeight: 800 }}>
                            Indicadores detalhados
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {indicadoresFiltrados.length} de {indicadores.length} · clique para expandir descrição completa
                        </p>
                    </div>
                </div>

                {indicadoresFiltrados.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                        Nenhum indicador encontrado com os filtros atuais.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>ID</th>
                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Macro / Micro</th>
                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Pirâmide</th>
                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Descrição</th>
                                    <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Tipo</th>
                                    <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Evid.</th>
                                    <th className="px-4 py-3 text-right" style={{ fontWeight: 700 }}>Pts</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                {indicadoresFiltrados.map(i => {
                                    const aberto = expandido === i.idIndicador;
                                    const corPiramide = PIRAMIDE_COR[i.piramide] || "#94A3B8";
                                    return (
                                        <FragmentRow
                                            key={i.idIndicador}
                                            item={i}
                                            aberto={aberto}
                                            corPiramide={corPiramide}
                                            onToggle={() => setExpandido(aberto ? null : i.idIndicador)}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="text-center py-4">
                <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                    MetricFlow · Assessment · {new Date().toLocaleDateString("pt-BR")}
                </p>
            </div>
        </>
    );
}
