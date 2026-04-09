import { MapPin } from "lucide-react";
import { MapPonto, RotaRow } from "./types";
import { RotaMap } from "./RotaMap";

interface Props {
    row: RotaRow;
    idx: number;
    mapRowKey: number | null;
    setMapRowKey: (k: number | null) => void;
}

export function GeoDetalhesTabela({ row, idx, mapRowKey, setMapRowKey }: Props) {
    if (!row.geo_detalhes || row.geo_detalhes.length === 0) return null;

    const temGA = row.geo_detalhes.some(g => g.tem_ga);
    const fontes = row.geo_detalhes.filter(g => g.tem_ga).map(g => g.fonte_distancia ?? 'sem_dado');
    const temApp = fontes.includes('app');
    const temCalc = fontes.includes('haversine');
    const nDentro = row.clientes_dentro_raio?.length ?? 0;
    const nFora = row.clientes_fora_raio?.length ?? 0;

    return (
        <div className="mt-4 pt-4 border-t border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                    Rota do Vendedor
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {temGA && (temApp || temCalc) && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-50 border-blue-200 text-blue-600">
                            {temApp ? '📍 app' : '📐 Haversine'}
                        </span>
                    )}
                    {nDentro > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-green-50 border-green-200 text-green-700 font-bold">
                            ✓ {nDentro} confirmados
                        </span>
                    )}
                    {nFora > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 border-red-200 text-red-600 font-bold">
                            ✗ {nFora} distantes
                        </span>
                    )}
                    {row.pct_geo_confirmado != null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
                            row.pct_geo_confirmado >= 80 ? "bg-green-50 border-green-200 text-green-700"
                            : row.pct_geo_confirmado >= 50 ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-red-50 border-red-200 text-red-600"
                        }`}>
                            {row.pct_geo_confirmado}% confirmados no raio
                        </span>
                    )}
                </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-widest">
                            <th className="px-3 py-2 text-left font-bold w-6">#</th>
                            <th className="px-3 py-2 text-left font-bold">Cliente</th>
                            <th className="px-3 py-2 text-center font-bold">Hr Vendedor</th>
                            <th className="px-3 py-2 text-center font-bold">Resp. Vendedor</th>
                            <th className="px-3 py-2 text-center font-bold">Hr GA</th>
                            <th className="px-3 py-2 text-center font-bold">Resp. GA</th>
                            <th className="px-3 py-2 text-center font-bold">Distância</th>
                            <th className="px-3 py-2 text-center font-bold">Status</th>
                            <th className="px-3 py-2 text-center font-bold">Coords Vendedor</th>
                            <th className="px-3 py-2 text-center font-bold">Coords GA</th>
                            <th className="px-3 py-2 text-center font-bold">Coords PDV</th>
                        </tr>
                    </thead>
                    <tbody>
                        {row.geo_detalhes.map((g, gi) => {
                            const temGa = g.tem_ga ?? false;
                            const dist = g.distancia_m ?? null;
                            const hIni = g.hora_ini_vend ?? null;
                            const hFim = g.hora_fim_vend ?? null;
                            const hGA = g.hora_ga ?? null;
                            const codPt = g.cod_cliente_pt ?? g.cliente;
                            const idGaFull = g.id_cliente_ga ?? null;
                            const idGaShort = idGaFull?.includes('-') ? idGaFull.split('-').slice(-2).join('-') : idGaFull;
                            const valorPed = g.valor_ped ?? '—';
                            const q1 = g.q1_status_pdv ?? null;
                            const razao = g.razao_social ?? '';
                            const latGa = g.lat_ga ?? null;
                            const lonGa = g.lon_ga ?? null;
                            const latVend = g.lat_vend ?? null;
                            const lonVend = g.lon_vend ?? null;
                            const latPdv = g.lat_pdv ?? null;
                            const lonPdv = g.lon_pdv ?? null;

                            const rowBg = temGa
                                ? g.dentro_raio === true ? "bg-green-50/60"
                                    : g.dentro_raio === false ? "bg-red-50/40"
                                        : "bg-blue-50/30"
                                : gi % 2 === 1 ? "bg-slate-50/40" : "";

                            const isVenda = /^\d/.test(valorPed) && valorPed !== '0,00' && valorPed !== '—';
                            const respVendColor = isVenda ? "#16a34a" : "#94a3b8";

                            return (
                                <tr key={gi} className={`border-b border-slate-50 transition-colors ${rowBg}`}>
                                    <td className="px-3 py-2 text-slate-400 tabular-nums">{gi + 1}</td>

                                    <td className="px-3 py-2">
                                        <div className="font-mono text-slate-700 font-semibold">{codPt}</div>
                                        {razao && <div className="text-slate-400 truncate max-w-[180px]" title={razao}>{razao}</div>}
                                        {temGa && idGaShort && (
                                            <div className="text-indigo-400 font-mono text-xs" title={idGaFull ?? ''}>{idGaShort}</div>
                                        )}
                                    </td>

                                    <td className="px-3 py-2 text-center font-mono text-slate-600 whitespace-nowrap">
                                        {hIni
                                            ? <>{hIni.slice(0, 5)}{hFim ? <span className="text-slate-400"> – {hFim.slice(0, 5)}</span> : ''}</>
                                            : <span className="text-slate-300">—</span>
                                        }
                                    </td>

                                    <td className="px-3 py-2 text-center">
                                        <span style={{ color: respVendColor, fontWeight: isVenda ? 600 : 400 }} className="text-xs">
                                            {valorPed}
                                        </span>
                                    </td>

                                    <td className="px-3 py-2 text-center font-mono whitespace-nowrap">
                                        {temGa
                                            ? hGA
                                                ? <span className="text-indigo-500">{hGA}</span>
                                                : <span className="text-slate-300">—</span>
                                            : <span className="text-slate-200">·</span>
                                        }
                                    </td>

                                    <td className="px-3 py-2 text-center">
                                        {temGa
                                            ? q1
                                                ? <span className="text-xs text-indigo-600">{q1}</span>
                                                : <span className="text-slate-300 text-xs">—</span>
                                            : <span className="text-slate-200 text-xs">·</span>
                                        }
                                    </td>

                                    <td className="px-3 py-2 text-center tabular-nums">
                                        {dist !== null
                                            ? <span style={{ fontWeight: 600, color: g.dentro_raio ? "#16a34a" : g.dentro_raio === false ? "#dc2626" : "#94a3b8" }}>
                                                {dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist.toFixed(0)} m`}
                                            </span>
                                            : <span className="text-slate-200">·</span>
                                        }
                                    </td>

                                    <td className="px-3 py-2 text-center">
                                        {temGa
                                            ? g.dentro_raio === true ? <span className="text-green-600 font-semibold">✓ Próximo</span>
                                                : g.dentro_raio === false ? <span className="text-red-500 font-semibold">✗ Distante</span>
                                                    : <span className="text-slate-400">sem coord</span>
                                            : <span className="text-slate-300 text-xs">sem GA</span>
                                        }
                                    </td>

                                    <td className="px-3 py-2 text-center font-mono text-slate-500 text-xs whitespace-nowrap">
                                        {latVend !== null && lonVend !== null
                                            ? `${latVend.toFixed(5)}, ${lonVend.toFixed(5)}`
                                            : <span className="text-slate-200">·</span>
                                        }
                                    </td>

                                    <td className="px-3 py-2 text-center font-mono text-indigo-400 text-xs whitespace-nowrap">
                                        {temGa && latGa !== null && lonGa !== null
                                            ? `${latGa.toFixed(5)}, ${lonGa.toFixed(5)}`
                                            : <span className="text-slate-200">·</span>
                                        }
                                    </td>

                                    <td className="px-3 py-2 text-center font-mono text-slate-400 text-xs whitespace-nowrap">
                                        {latPdv !== null && lonPdv !== null
                                            ? `${latPdv.toFixed(5)}, ${lonPdv.toFixed(5)}`
                                            : <span className="text-slate-200">·</span>
                                        }
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Legenda + botão mapa */}
            <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <div className="flex gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                        <span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" />GA confirmado próximo
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                        <span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" />GA distante
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                        <span className="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block" />GA visitou (sem coord PDV)
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                        <span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 inline-block" />Só vendedor
                    </span>
                </div>
                <button
                    onClick={() => setMapRowKey(mapRowKey === idx ? null : idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        mapRowKey === idx
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    }`}
                >
                    <MapPin size={13} />
                    {mapRowKey === idx ? "Fechar mapa" : "Ver no mapa"}
                </button>
            </div>

            {/* Mapa */}
            {mapRowKey === idx && (() => {
                const pontos: MapPonto[] = [];
                row.geo_detalhes!.forEach(g => {
                    const cli = g.cod_cliente_pt ?? g.cliente;
                    const razao = (g.razao_social ?? '').slice(0, 25);
                    if (g.lat_pdv && g.lon_pdv)
                        pontos.push({ lat: g.lat_pdv, lon: g.lon_pdv, tipo: 'pdv', label: `PDV ${cli}`, info: razao });
                    if (g.lat_ga && g.lon_ga && g.tem_ga)
                        pontos.push({ lat: g.lat_ga, lon: g.lon_ga, tipo: 'ga', label: `GA → ${cli}`, info: `${g.hora_ga ?? ''} ${g.q1_status_pdv ?? ''}` });
                    if (g.lat_vend && g.lon_vend)
                        pontos.push({ lat: g.lat_vend, lon: g.lon_vend, tipo: 'vend', label: `Vend → ${cli}`, info: `${g.hora_ini_vend ?? ''} ${g.valor_ped ?? ''}` });
                });
                return <RotaMap pontos={pontos} gaId={row.gaId} />;
            })()}
        </div>
    );
}
