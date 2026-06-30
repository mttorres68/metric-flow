import { ConformidadeTabela } from "../components/ConformidadeTabela";
import { AnalisesGestor } from "../components/AnalisesGestor";
import { RotaGraficos } from "../components/RotaGraficos";
import type { RotaRow } from "../lib/types";

interface KpiCard {
    label: string;
    value: string | number;
    color: string;
    bg: string;
    border: string;
}

interface Props {
    loading: boolean;
    erro: string | null;
    kpiCards: KpiCard[];
    tabelaFiltrada: RotaRow[];
    expandedRows: Set<number>;
    toggleRow: (i: number) => void;
    mapRowKey: number | null;
    setMapRowKey: (k: number | null) => void;
    revendasUnicas: string[];
    dateStart: string;
    getAnalise: (rev: string) => string;
    setAnalise: (rev: string, html: string) => void;
    baseFiltrado: RotaRow[];
    dadosGA: { ga: string; visitas: number; prog: number }[];
    dadosRevenda: { rev: string; Completo: number; Parcial: number; "Não Realizado": number }[];
}

export function CoachingView({
    loading, erro, kpiCards,
    tabelaFiltrada, expandedRows, toggleRow, mapRowKey, setMapRowKey,
    revendasUnicas, dateStart, getAnalise, setAnalise,
    baseFiltrado, dadosGA, dadosRevenda,
}: Props) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
            </div>
        );
    }

    if (erro) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-6 text-center">
                <p className="text-red-600 dark:text-red-400 text-sm" style={{ fontWeight: 600 }}>⚠️ {erro}</p>
                <p className="text-red-400 dark:text-red-500 text-xs mt-1">
                    Verifique a conexão com o banco e se o processamento de rota coaching já rodou para esta data.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {kpiCards.map(k => (
                    <div
                        key={k.label}
                        className={`bg-gradient-to-br ${k.bg} rounded-2xl p-5 border ${k.border}`}
                        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                    >
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                            {k.label}
                        </p>
                        <p className={`text-3xl mt-2 ${k.color}`} style={{ fontWeight: 900 }}>{k.value}</p>
                    </div>
                ))}
            </div>

            <ConformidadeTabela
                tabelaFiltrada={tabelaFiltrada}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                mapRowKey={mapRowKey}
                setMapRowKey={setMapRowKey}
            />

            <AnalisesGestor
                revendasUnicas={revendasUnicas}
                dateStart={dateStart}
                getAnalise={getAnalise}
                setAnalise={setAnalise}
            />

            {baseFiltrado.some(r => r.agendado) && (
                <RotaGraficos dadosGA={dadosGA} dadosRevenda={dadosRevenda} />
            )}
        </>
    );
}
