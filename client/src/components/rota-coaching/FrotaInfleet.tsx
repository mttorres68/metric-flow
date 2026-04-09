import { fmtMin } from "./types";

interface Veiculo {
    id: string;
    nome: string;
    placa: string;
}

interface ResumoVeiculo {
    vehicleId: string;
    kmRodado: number;
    qtdIgnicoes: number;
    tempoLigadoMin: number;
    maiorTempoParadoMin: number;
    tempoNaSedeMin: number;
    tempoOciosoMin: number;
    dormiuNaSede?: boolean;
}

interface Props {
    veiculosInfleet: Veiculo[];
    vehiclesSel: string[];
    setVehiclesSel: React.Dispatch<React.SetStateAction<string[]>>;
    resumoInfleet: ResumoVeiculo[];
    loadingInfleet: boolean;
    dateStart: string;
    dateEnd: string;
    geocercaId: string | undefined;
}

export function FrotaInfleet({ veiculosInfleet, vehiclesSel, setVehiclesSel, resumoInfleet, loadingInfleet, dateStart, dateEnd, geocercaId }: Props) {
    return (
        <div className="space-y-4">
            {/* Seleção de veículos */}
            <div className="bg-white rounded-2xl p-5"
                style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <h3 className="text-slate-700 text-sm mb-3" style={{ fontWeight: 700 }}>
                    Veículos monitorados
                    {veiculosInfleet.length === 0 && (
                        <span className="ml-2 text-amber-500 text-xs" style={{ fontWeight: 500 }}>
                            — Configure INFLEET_TOKEN no servidor para ativar
                        </span>
                    )}
                </h3>
                <div className="flex flex-wrap gap-2">
                    {veiculosInfleet.map(v => (
                        <button key={v.id}
                            onClick={() => setVehiclesSel(prev =>
                                prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id]
                            )}
                            className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${
                                vehiclesSel.includes(v.id)
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                    : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                            }`}
                            style={{ fontWeight: 600 }}>
                            {v.nome} · {v.placa}
                        </button>
                    ))}
                    {veiculosInfleet.length === 0 && (
                        <div className="text-sm text-slate-400 py-2">
                            Nenhum veículo carregado — verifique a configuração da API Infleet.
                        </div>
                    )}
                </div>
            </div>

            {/* Tabela de resumo diário */}
            {vehiclesSel.length > 0 && (
                <div className="bg-white rounded-2xl overflow-hidden"
                    style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>
                            Resumo do Período — {dateStart} a {dateEnd}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">KM rodado, tempo ligado, parado e ocioso por veículo</p>
                    </div>
                    <div className="overflow-x-auto">
                        {loadingInfleet ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        {["Veículo", "KM Rodado", "Ignições", "Tempo Ligado", "Maior Parada", "Tempo na Cerca", "Tempo Ocioso"].map(h => (
                                            <th key={h} className="px-5 py-3 text-xs text-slate-500 uppercase tracking-widest text-left" style={{ fontWeight: 700 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumoInfleet.map((r, i) => {
                                        const veiculo = veiculosInfleet.find(v => v.id === r.vehicleId);
                                        return (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <td className="px-5 py-3.5 text-sm text-slate-700" style={{ fontWeight: 600 }}>
                                                    {veiculo?.nome ?? r.vehicleId}
                                                    <span className="ml-2 text-xs text-slate-400">{veiculo?.placa}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-slate-700" style={{ fontWeight: 700 }}>
                                                    {r.kmRodado} km
                                                </td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-indigo-600" style={{ fontWeight: 700 }}>
                                                    {r.qtdIgnicoes}x
                                                </td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-slate-600">{fmtMin(r.tempoLigadoMin)}</td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-amber-600">{fmtMin(r.maiorTempoParadoMin)}</td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-slate-700">
                                                    {!geocercaId ? (
                                                        <span className="text-slate-300">—</span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <span>{fmtMin(r.tempoNaSedeMin)}</span>
                                                            {r.dormiuNaSede && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200" style={{ fontWeight: 700 }}>
                                                                    🛌 Dormiu
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm tabular-nums text-slate-500">{fmtMin(r.tempoOciosoMin)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {vehiclesSel.length === 0 && veiculosInfleet.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
                    Selecione ao menos um veículo acima para visualizar o resumo do período.
                </div>
            )}
        </div>
    );
}
