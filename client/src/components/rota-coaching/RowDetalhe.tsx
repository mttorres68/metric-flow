import { RotaRow } from "./types";
import { GeoDetalhesTabela } from "./GeoDetalhesTabela";

interface Props {
    row: RotaRow;
    idx: number;
    mapRowKey: number | null;
    setMapRowKey: (k: number | null) => void;
}

export function RowDetalhe({ row, idx, mapRowKey, setMapRowKey }: Props) {
    return (
        <>
            <div className="grid grid-cols-2 gap-6 border border-slate-200 rounded-xl p-4 bg-white">
                {/* Perguntas de controle */}
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1" style={{ fontWeight: 700 }}>
                        Perguntas de Controle
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            ["GA fez a Rota?",
                                row.agendado
                                    ? (row.gaVis > 0 ? <span className="text-green-600">✅ Sim</span> : <span className="text-red-500">❌ Não</span>)
                                    : <span className="text-slate-400">— Não Agendado</span>
                            ],
                            ["Vendedor no App GA", <span className="font-mono text-indigo-600">{row.agendado && row.gaVis > 0 ? (row.vendedor_no_app || "N/A") : "—"}</span>],
                            ["Clientes Programados", <span className="font-mono">{row.pdvsProg} PDVs</span>],
                            ["Clientes Comuns", <span className="font-mono text-indigo-600">{row.clientes_comuns?.length ?? 0} PDVs</span>],
                        ].map(([lbl, val]) => (
                            <div key={String(lbl)} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <p className="text-xs text-slate-400 mb-1" style={{ fontWeight: 600 }}>{lbl}</p>
                                <div className="text-sm" style={{ fontWeight: 600 }}>{val}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Cobertura de Visitas */}
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1" style={{ fontWeight: 700 }}>
                        Cobertura de Visitas
                    </p>
                    {[
                        { label: "PathTracker (Vendedor visitou)", val: row.pdvsVis, total: row.pdvsProg, color: "bg-indigo-400" },
                        {
                            label: "App do GA (GA acompanhou)", val: row.gaVis, total: row.pdvsProg,
                            color: row.pctGA >= 100 ? "bg-green-400" : row.pctGA > 0 ? "bg-amber-400" : "bg-red-400"
                        },
                    ].map(b => (
                        <div key={b.label} className="mb-4">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>{b.label}</span>
                                <span className="font-mono" style={{ fontWeight: 600 }}>{b.val}/{b.total}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${b.color}`}
                                    style={{ width: `${Math.min(100, b.total > 0 ? (b.val / b.total) * 100 : 0)}%` }} />
                            </div>
                        </div>
                    ))}
                    <p className="text-xs text-slate-400 italic mt-3 pt-2 border-t border-slate-100">
                        {!row.agendado
                            ? "Nenhuma rota agendada para este GA."
                            : row.gaVis === 0
                                ? "GA não enviou formulários no app para esta rota."
                                : row.gaVis >= row.pdvsProg
                                    ? "Conformidade total atingida."
                                    : `GA não completou a rota (faltaram ${row.pdvsProg - row.gaVis} visitas).`}
                    </p>
                </div>
            </div>

            {/* Validação Geográfica */}
            <GeoDetalhesTabela row={row} idx={idx} mapRowKey={mapRowKey} setMapRowKey={setMapRowKey} />

            {/* Sem dados */}
            {(!row.geo_detalhes || row.geo_detalhes.length === 0) && row.agendado && row.gaVis > 0 && (
                <p className="text-xs text-slate-400 italic mt-3 pt-3 border-t border-slate-100">
                    Dados de rota não disponíveis.
                </p>
            )}
        </>
    );
}
