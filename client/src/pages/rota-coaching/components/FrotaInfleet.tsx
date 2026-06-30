import { fmtMin } from "../lib/types";
import React from "react";

interface Veiculo {
    id: string;
    nome: string;
    placa: string;
}

interface ResumoVeiculo {
    vehicleId: string;
    // Métricas de rota (routeVehicleDetails)
    kmRodado: number;
    tempoLigadoMin: number;
    tempoParadoMin: number;
    tempoOciosoMin: number;
    velMediaKmh: number;
    velMaxKmh: number;
    // Contadores de paradas (dailyVehicleEventSummary)
    qtdParadas: number;          // deviceStopped — transições → parado
    qtdOciosas: number;          // deviceIdle — parado c/ motor ligado
    qtdIgnicoes: number;         // ignitionOn — partidas
    qtdIgnicoesOff: number;      // ignitionOff — desligamentos
    qtdParadasForaCerca: number; // stoppedOutsideGeofence
    // Geocerca
    tempoNaSedeMin: number;
    dormiuNaSede?: boolean;
    // Legado
    maiorTempoParadoMin: number;
}

interface Viagem {
    ignitionOn: { time: string; city: string };
    ignitionOff: { time: string; city: string } | null;
    duracaoMin: number | null;
}

interface ViagemVeiculo {
    vehicleId: string;
    viagens: Viagem[];
}

interface Props {
    veiculosInfleet: Veiculo[];
    vehiclesSel: string[];
    setVehiclesSel: React.Dispatch<React.SetStateAction<string[]>>;
    resumoInfleet: ResumoVeiculo[];
    loadingInfleet: boolean;
    viagensInfleet: ViagemVeiculo[];
    loadingViagens: boolean;
    dateStart: string;
    dateEnd: string;
    geocercaId: string | undefined;
}

const TH = ({ children }: { children: React.ReactNode }) => (
    <th className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left whitespace-nowrap"
        style={{ fontWeight: 700 }}>
        {children}
    </th>
);

function fmtHora(iso: string): string {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtData(iso: string): string {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function FrotaInfleet({ veiculosInfleet, vehiclesSel, setVehiclesSel, resumoInfleet, loadingInfleet, viagensInfleet, loadingViagens, dateStart, dateEnd, geocercaId }: Props) {
    return (
        <div className="space-y-4">
            {/* Seleção de veículos */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 border border-slate-200 dark:border-[var(--border)]"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 className="text-slate-700 dark:text-slate-200 text-sm mb-3" style={{ fontWeight: 700 }}>
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
                                    ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700/50 text-indigo-700 dark:text-indigo-300"
                                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                            }`}
                            style={{ fontWeight: 600 }}>
                            {v.nome} · {v.placa}
                        </button>
                    ))}
                    {veiculosInfleet.length === 0 && (
                        <div className="text-sm text-slate-400 dark:text-slate-500 py-2">
                            Nenhum veículo carregado — verifique a configuração da API Infleet.
                        </div>
                    )}
                </div>
            </div>

            {/* Tabela de resumo */}
            {vehiclesSel.length > 0 && (
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden border border-slate-200 dark:border-[var(--border)]"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--border)]">
                        <h3 className="text-slate-800 dark:text-slate-100 text-base" style={{ fontWeight: 800 }}>
                            Resumo do Período — {dateStart} a {dateEnd}
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Paradas · Tempos · KM · Velocidade · Geocerca — via dailyVehicleEventSummary + routeVehicleDetails
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        {loadingInfleet ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-[var(--border)]">
                                        <TH>Veículo</TH>
                                        <TH>KM Rodado</TH>
                                        {/* dailyVehicleEventSummary */}
                                        <TH>Qtd Paradas</TH>
                                        <TH>Ignições</TH>
                                        <TH>Fora da Cerca</TH>
                                        {/* routeVehicleDetails */}
                                        <TH>T. Ligado</TH>
                                        <TH>T. Parado</TH>
                                        <TH>T. Ocioso</TH>
                                        <TH>Vel. Média</TH>
                                        <TH>Vel. Máx</TH>
                                        {/* geocerca */}
                                        <TH>Tempo na Cerca</TH>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumoInfleet.map((r, i) => {
                                        const veiculo = veiculosInfleet.find(v => v.id === r.vehicleId);
                                        return (
                                            <tr key={i} className="border-b border-slate-50 dark:border-slate-700/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap" style={{ fontWeight: 600 }}>
                                                    {veiculo?.nome ?? r.vehicleId}
                                                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{veiculo?.placa}</span>
                                                </td>

                                                <td className="px-4 py-3.5 text-sm tabular-nums text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                                    {r.kmRodado} km
                                                </td>

                                                {/* Qtd Paradas — deviceStopped (transições para parado) */}
                                                <td className="px-4 py-3.5 text-sm tabular-nums" style={{ fontWeight: 700 }}>
                                                    <span className="text-red-500">{r.qtdParadas}</span>
                                                    {r.qtdOciosas > 0 && (
                                                        <span className="ml-1.5 text-xs text-amber-400" title="Paradas com motor ligado (ocioso)">
                                                            +{r.qtdOciosas} oc
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Ignições — ignitionOn */}
                                                <td className="px-4 py-3.5 text-sm tabular-nums text-indigo-600 dark:text-indigo-400" style={{ fontWeight: 700 }}>
                                                    {r.qtdIgnicoes}x
                                                    {r.qtdIgnicoesOff !== r.qtdIgnicoes && (
                                                        <span className="ml-1 text-xs text-slate-400" title="Desligamentos">
                                                            /{r.qtdIgnicoesOff}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Paradas fora de geocerca — stoppedOutsideGeofence */}
                                                <td className="px-4 py-3.5 text-sm tabular-nums">
                                                    {r.qtdParadasForaCerca > 0
                                                        ? <span className="text-orange-500" style={{ fontWeight: 700 }}>{r.qtdParadasForaCerca}</span>
                                                        : <span className="text-slate-300">—</span>
                                                    }
                                                </td>

                                                {/* Tempo ligado — totalTimeWithIgnitionOn */}
                                                <td className="px-4 py-3.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                                                    {fmtMin(r.tempoLigadoMin)}
                                                </td>

                                                {/* Tempo parado total — totalTimeStopped */}
                                                <td className="px-4 py-3.5 text-sm tabular-nums text-amber-600 dark:text-amber-400" style={{ fontWeight: 700 }}>
                                                    {fmtMin(r.tempoParadoMin)}
                                                </td>

                                                {/* Tempo ocioso — totalTimeStoppedWithIgnitionOn */}
                                                <td className="px-4 py-3.5 text-sm tabular-nums text-slate-500 dark:text-slate-400">
                                                    {r.tempoOciosoMin > 0 ? fmtMin(r.tempoOciosoMin) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                </td>

                                                <td className="px-4 py-3.5 text-sm tabular-nums text-slate-500 dark:text-slate-400">
                                                    {r.velMediaKmh > 0 ? `${r.velMediaKmh} km/h` : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                </td>

                                                <td className="px-4 py-3.5 text-sm tabular-nums text-slate-500 dark:text-slate-400">
                                                    {r.velMaxKmh > 0 ? `${r.velMaxKmh} km/h` : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                </td>

                                                {/* Geocerca (sede) */}
                                                <td className="px-4 py-3.5 text-sm tabular-nums text-slate-700">
                                                    {!geocercaId ? (
                                                        <span className="text-slate-300">—</span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <span>{fmtMin(r.tempoNaSedeMin)}</span>
                                                            {r.dormiuNaSede && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-700/50" style={{ fontWeight: 700 }}>
                                                                    🛌 Dormiu
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Telemetria: Timeline de Viagens (ignitionOn → ignitionOff) */}
            {vehiclesSel.length > 0 && (
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden border border-slate-200 dark:border-[var(--border)]"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div className="px-5 py-3 border-b border-slate-100 dark:border-[var(--border)] flex items-center justify-between">
                        <h3 className="text-slate-800 dark:text-slate-100 text-sm" style={{ fontWeight: 800 }}>Viagens do Período</h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500">ignitionOn → ignitionOff · cidade · duração · intervalo</p>
                    </div>

                    {loadingViagens ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="flex gap-0 divide-x divide-slate-100 dark:divide-[var(--border)] overflow-x-auto">
                            {viagensInfleet.length === 0 && (
                                <p className="px-5 py-5 text-xs text-slate-400 dark:text-slate-500">Nenhuma viagem encontrada no período.</p>
                            )}
                            {viagensInfleet.map(({ vehicleId, viagens }) => {
                                const veiculo = veiculosInfleet.find(v => v.id === vehicleId);
                                return (
                                    <div key={vehicleId} className="px-4 py-3 flex-1 min-w-[260px]">
                                        {/* cabeçalho do veículo */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                                {veiculo?.nome ?? vehicleId}
                                            </span>
                                            {veiculo?.placa && (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">
                                                    {veiculo.placa}
                                                </span>
                                            )}
                                            <span className="ml-auto text-[10px] text-slate-400">
                                                {viagens.length} {viagens.length === 1 ? "viagem" : "viagens"}
                                            </span>
                                        </div>

                                        {viagens.length === 0 ? (
                                            <p className="text-[11px] text-slate-400">Sem viagens registradas.</p>
                                        ) : (
                                            <div className="inline-flex flex-col gap-0">
                                                {viagens.map((v, i) => {
                                                    const prev = viagens[i - 1];
                                                    const intervaloMin = prev?.ignitionOff
                                                        ? Math.round(
                                                            (new Date(v.ignitionOn.time).getTime() -
                                                             new Date(prev.ignitionOff.time).getTime()) / 60_000
                                                          )
                                                        : null;

                                                    return (
                                                        <React.Fragment key={i}>
                                                            {/* Conector: tempo parado entre viagens */}
                                                            {intervaloMin !== null && intervaloMin >= 0 && (
                                                                <div className="flex items-center gap-1 py-0.5 pl-6">
                                                                    <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                                                                    <span className="text-[10px] text-slate-400 tabular-nums">
                                                                        ⏸ {fmtMin(intervaloMin)} parado
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Linha de viagem — sem flex-1, tudo compacto */}
                                                            <div className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-[11px] whitespace-nowrap">
                                                                {/* Índice */}
                                                                <span className="w-4 text-center text-[10px] text-slate-300 tabular-nums" style={{ fontWeight: 700 }}>
                                                                    {i + 1}
                                                                </span>

                                                                {/* Partida: hora · data · cidade */}
                                                                <span className="tabular-nums text-indigo-600 dark:text-indigo-400" style={{ fontWeight: 700 }}>
                                                                    {fmtHora(v.ignitionOn.time)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">{fmtData(v.ignitionOn.time)}</span>
                                                                <span className="text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                                                                    {v.ignitionOn.city}
                                                                </span>

                                                                <span className="text-slate-300 dark:text-slate-600 px-0.5">→</span>

                                                                {/* Chegada: cidade · data · hora */}
                                                                {v.ignitionOff ? (
                                                                    <>
                                                                        <span className="text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                                                                            {v.ignitionOff.city}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400">{fmtData(v.ignitionOff.time)}</span>
                                                                        <span className="tabular-nums text-emerald-600" style={{ fontWeight: 700 }}>
                                                                            {fmtHora(v.ignitionOff.time)}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-amber-500 text-[10px]" style={{ fontWeight: 600 }}>
                                                                        em andamento
                                                                    </span>
                                                                )}

                                                                {/* Duração */}
                                                                {v.duracaoMin !== null && (
                                                                    <span className="ml-0.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 tabular-nums text-[10px]" style={{ fontWeight: 700 }}>
                                                                        {fmtMin(v.duracaoMin)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {vehiclesSel.length === 0 && veiculosInfleet.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-[var(--border)]">
                    Selecione ao menos um veículo acima para visualizar o resumo do período.
                </div>
            )}
        </div>
    );
}
