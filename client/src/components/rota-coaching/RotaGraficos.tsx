import React from "react";
import {
    Bar, BarChart, CartesianGrid, Cell, Legend,
    LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface DadoGA {
    ga: string;
    visitas: number;
    prog: number;
}

interface DadoRevenda {
    rev: string;
    Completo: number;
    Parcial: number;
    "Não Realizado": number;
}

interface Props {
    dadosGA: DadoGA[];
    dadosRevenda: DadoRevenda[];
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="mb-4">
                <h3 className="text-slate-800 text-sm" style={{ fontWeight: 800 }}>{title}</h3>
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

export function RotaGraficos({ dadosGA, dadosRevenda }: Props) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Visitas realizadas pelo GA" subtitle="Clientes únicos acompanhados">
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dadosGA} margin={{ top: 20, right: 10, left: -10, bottom: 0 }} barSize={28}>
                        <CartesianGrid vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="ga" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} />
                        <Bar dataKey="visitas" name="Visitas GA" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="visitas" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#64748B" }} />
                            {dadosGA.map((e, i) => (
                                <Cell key={i} fill={e.visitas >= e.prog ? "#34d399" : e.visitas > 0 ? "#facc15" : "#f87171"} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Conformidade por revenda" subtitle="Distribuição de status">
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dadosRevenda} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barSize={32}>
                        <CartesianGrid vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="rev" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="square" iconSize={8} />
                        <Bar dataKey="Completo" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Parcial" stackId="a" fill="#facc15" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Não Realizado" stackId="a" fill="#f87171" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>
        </div>
    );
}
