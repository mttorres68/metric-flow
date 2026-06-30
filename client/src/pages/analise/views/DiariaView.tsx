import React from "react";
import { useLocation } from "wouter";
import { AlertTriangle, RefreshCw, MapPin, PenLine, Printer } from "lucide-react";
import { EditorAnalise, EditorAnaliseHandle } from "@/components/EditorAnalise";
import { Badge } from "../components/Badge";
import { Th, Td } from "../components/TablePrimitives";
import { pct, minToHM } from "../lib/formatters";
import { SCROLL_TO_REVENDA_KEY } from "../lib/constants";
import type { ColId, AcaoTipo, AcaoVendState } from "../lib/types";

interface DiariaViewProps {
    isLoading: boolean;
    error: { message: string } | null;
    revendasOrdenadas: string[];
    groupedData: Record<string, any[]>;
    col: (id: ColId) => boolean;
    sortBy: string;
    sortDir: "asc" | "desc";
    onToggleSort: (col: string) => void;
    checkboxState: Record<string, Record<string, AcaoVendState>>;
    onToggleCheck: (rev: string, vendedor: string | number, tipo: AcaoTipo) => void;
    getAnalise: (rev: string) => string;
    onSetAnalise: (rev: string, html: string) => void;
    downloadPDF: (revenda?: string) => void;
    downloadingPDF: string | null;
    editorRefs: React.MutableRefObject<Map<string, EditorAnaliseHandle>>;
    dataInicio: string;
    isDark: boolean;
}

function SortIcon({ sortBy, col, sortDir }: { sortBy: string; col: string; sortDir: "asc" | "desc" }) {
    if (sortBy !== col) return <span className="opacity-30 ml-0.5">↕</span>;
    return <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export function DiariaView({
    isLoading, error, revendasOrdenadas, groupedData, col,
    sortBy, sortDir, onToggleSort,
    checkboxState, onToggleCheck,
    getAnalise, onSetAnalise,
    downloadPDF, downloadingPDF,
    editorRefs, dataInicio, isDark,
}: DiariaViewProps) {
    const [, setLocation] = useLocation();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
                <RefreshCw size={16} className="animate-spin mr-2" /> Carregando...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-40 text-red-500 text-sm gap-2">
                <AlertTriangle size={16} /> {error.message}
            </div>
        );
    }

    return (
        <div className="px-6 pb-6">
            <div className="flex flex-col gap-6">
                {revendasOrdenadas.length === 0 && (
                    <div className="bg-white dark:bg-[var(--card)] p-12 rounded-xl text-center text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-[var(--border)]">
                        Nenhum dado para os filtros selecionados
                    </div>
                )}
                {revendasOrdenadas.map(rev => (
                    <div key={rev} id={`revenda-${rev}`}
                        className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] overflow-hidden"
                        style={{ boxShadow: isDark ? "0 1px 8px rgba(0,0,0,0.3)" : "0 1px 8px rgba(0,0,0,0.06)" }}
                    >
                        <div className="px-5 py-3 border-b border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase">
                                Revenda: <span className="text-indigo-600 dark:text-indigo-400">{rev}</span>
                            </h2>
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const maiorFim = groupedData[rev]
                                        .map(r => r.fim)
                                        .filter((f): f is string => !!f && f !== "ND")
                                        .sort()
                                        .at(-1);
                                    return maiorFim ? (
                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            Último fim: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{maiorFim.substring(0, 5)}</span>
                                        </span>
                                    ) : null;
                                })()}
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{groupedData[rev].length} Vendedor(es)</span>
                                <button
                                    onClick={() => {
                                        sessionStorage.setItem(SCROLL_TO_REVENDA_KEY, rev);
                                        setLocation(`/analises/foera-raio/${encodeURIComponent(rev)}/${dataInicio || new Date().toISOString().slice(0, 10)}`);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors font-semibold whitespace-nowrap"
                                    title="Ver clientes visitados fora do raio permitido"
                                >
                                    <MapPin size={12} /> Fora do Raio
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                            <table className="w-full text-xs">
                                <thead className="bg-green-950 text-slate-100 sticky top-0 z-10">
                                    <tr>
                                        <Th title="Código do vendedor">
                                            <button onClick={() => onToggleSort("vendedor")} className="flex items-center gap-0.5">
                                                Vend. <SortIcon sortBy={sortBy} col="vendedor" sortDir={sortDir} />
                                            </button>
                                        </Th>
                                        <Th title="Marcar ocorrências para gerar texto automático na análise abaixo" center>Ações</Th>
                                        {col("data") && <Th title="Data">Data</Th>}
                                        {col("inicio") && <Th title="Hora da primeira visita dentro do raio" center>Início</Th>}
                                        {col("fim") && <Th title="Hora da última visita dentro do raio" center>Fim</Th>}
                                        {col("almoco") && <Th title="Visitas na janela 12:15-13:45 (almoço)" center>Almoço</Th>}
                                        {col("apos14h") && <Th title="Visitas com início após 14h" center>Após 14h</Th>}
                                        {col("visitas") && <Th title="Visitas únicas dentro do raio / carteira total" center>Visitas</Th>}
                                        {col("pdv_sem_visita") && <Th title="PDVs na carteira sem visita no dia" center>PDV S/Visita</Th>}
                                        {col("relampago") && (
                                            <Th title="Visitas únicas dentro do raio com duração < 3min" center>
                                                <button onClick={() => onToggleSort("relampago_pct")} className="flex items-center gap-0.5 mx-auto">
                                                    Relâmpago <SortIcon sortBy={sortBy} col="relampago_pct" sortDir={sortDir} />
                                                </button>
                                            </Th>
                                        )}
                                        {col("sfa") && <Th title="Pedidos realizados via sistema SFA" center>SFA</Th>}
                                        {col("heishop") && <Th title="Pedidos realizados via Heishop" center>Heishop</Th>}
                                        {col("heishop_verif") && <Th title="Pedidos Heishop verificados (Tipo Cobr. preenchida)" center>H. Verif.</Th>}
                                        {col("iv") && (
                                            <Th title="IV = visitados dentro do raio / carteira total" center>
                                                <button onClick={() => onToggleSort("iv")} className="flex items-center gap-0.5 mx-auto">
                                                    IV <SortIcon sortBy={sortBy} col="iv" sortDir={sortDir} />
                                                </button>
                                            </Th>
                                        )}
                                        {col("iav") && <Th title="IAV = Heishop verificado / Heishop total" center>IAV</Th>}
                                        {col("atend_35") && <Th title="Visitas com duração > 35 minutos dentro do raio" center>Atend. &gt;35</Th>}
                                        {col("soma_35") && <Th title="Soma do tempo de todos os atendimentos > 35 min" center>Σ &gt;35min</Th>}
                                        {col("t_menor") && <Th title="Menor tempo de visita dentro do PDV" center>T. Menor</Th>}
                                        {col("t_maior") && <Th title="Maior tempo de visita dentro do PDV" center>T. Maior</Th>}
                                        {col("t_medio") && <Th title="Média do tempo de visita dentro do PDV" center>T. Médio</Th>}
                                        {col("t_total") && <Th title="Soma de todos os tempos de visita dentro do PDV" center>Σ TEMPO</Th>}
                                        {col("soma_percurso") && <Th title="Soma de todos os intervalos entre visitas consecutivas (≤ 60min)" center>Σ Percurso</Th>}
                                        {col("percurso") && <Th title="Maior intervalo entre visitas consecutivas (≤ 60min)" center>Maior Percurso</Th>}
                                        {col("ini_percurso") && <Th title="Início do maior intervalo entre visitas" center>Ini. Percurso</Th>}
                                        {col("fim_percurso") && <Th title="Fim do maior intervalo entre visitas" center>Fim Percurso</Th>}
                                        {col("pdvs_percurso") && <Th title="PDVs atendidos dentro do raio após o maior percurso" center>PDVs p/ Percurso</Th>}
                                        {col("t_nao_atend") && (
                                            <Th title="Tempo fora de atendimento (trava às 17:00). Jornada − tempo em visita" center>
                                                <button onClick={() => onToggleSort("tempo_nao_atend")} className="flex items-center gap-0.5 mx-auto">
                                                    T. Ñ Atend. <SortIcon sortBy={sortBy} col="tempo_nao_atend" sortDir={sortDir} />
                                                </button>
                                            </Th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedData[rev].map((r, i) => {
                                        const rowBg = i % 2 === 1 ? "bg-slate-50 dark:bg-slate-800/30" : "dark:bg-[var(--card)]";
                                        return (
                                            <tr key={`${r.vendedor}-${r.data}`} className={`hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors ${rowBg}`}>
                                                <Td mono>
                                                    <button
                                                        onClick={() => {
                                                            sessionStorage.setItem(SCROLL_TO_REVENDA_KEY, r.revenda);
                                                            setLocation(`/analises/vendedor/${encodeURIComponent(r.revenda)}/${r.vendedor}/${r.data}`);
                                                        }}
                                                        className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline inline-flex items-center gap-1 transition-all"
                                                    >
                                                        {r.vendedor}
                                                    </button>
                                                </Td>
                                                <Td center>
                                                    <div className="flex flex-col gap-0.5 items-start">
                                                        <label className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap">
                                                            <input
                                                                type="checkbox"
                                                                className="accent-amber-500 w-3 h-3 shrink-0"
                                                                checked={!!(checkboxState[rev]?.[String(r.vendedor)]?.deslocamento)}
                                                                onChange={() => onToggleCheck(rev, r.vendedor, "deslocamento")}
                                                            />
                                                            <span className="text-[10px] text-amber-700 dark:text-amber-400">Desl.</span>
                                                        </label>
                                                        <label className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap">
                                                            <input
                                                                type="checkbox"
                                                                className="accent-red-500 w-3 h-3 shrink-0"
                                                                checked={!!(checkboxState[rev]?.[String(r.vendedor)]?.problema)}
                                                                onChange={() => onToggleCheck(rev, r.vendedor, "problema")}
                                                            />
                                                            <span className="text-[10px] text-red-700 dark:text-red-400">Prob.</span>
                                                        </label>
                                                        <label className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap">
                                                            <input
                                                                type="checkbox"
                                                                className="accent-slate-500 w-3 h-3 shrink-0"
                                                                checked={!!(checkboxState[rev]?.[String(r.vendedor)]?.nao_iniciou_rota)}
                                                                onChange={() => onToggleCheck(rev, r.vendedor, "nao_iniciou_rota")}
                                                            />
                                                            <span className="text-[10px] text-slate-600 dark:text-slate-400">ÑIR</span>
                                                        </label>
                                                    </div>
                                                </Td>
                                                {col("data") && <Td mono className="text-slate-500 dark:text-slate-400">{r.data}</Td>}
                                                {col("inicio") && <Td center mono className={r.inicio && r.inicio > "08:45" ? "text-amber-700 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-300"}>{r.inicio ?? "—"}</Td>}
                                                {col("fim") && <Td center mono className="text-slate-600 dark:text-slate-300">{r.fim ?? "—"}</Td>}
                                                {col("almoco") && (
                                                    <Td center>
                                                        {r.almoco > 0 ? <Badge color="amber">{r.almoco}</Badge> : <span className="text-slate-300">—</span>}
                                                    </Td>
                                                )}
                                                {col("apos14h") && (
                                                    <Td center>
                                                        {r.apos14h > 0
                                                            ? <span className={r.apos14h_pct < 25 ? "text-red-500 font-bold" : "text-slate-600 dark:text-slate-300 font-bold"}>{pct(r.apos14h_pct, 0)} <span className="text-slate-400 dark:text-slate-500 font-normal">({r.apos14h}/{r.apos14h_total})</span></span>
                                                            : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                    </Td>
                                                )}
                                                {col("visitas") && (
                                                    <Td center>
                                                        <span className={r.visitas_pct === 100 ? "text-green-600 font-extrabold" : r.visitas_pct >= 90 ? "text-amber-600 font-extrabold" : "text-red-500 font-extrabold"}>
                                                            {pct(r.visitas_pct, 0)} <span className="text-slate-400 dark:text-slate-500 font-normal">({r.visitas}/{r.visitas_total})</span>
                                                        </span>
                                                    </Td>
                                                )}
                                                {col("pdv_sem_visita") && (
                                                    <Td center>
                                                        {r.pdvs_sem_visita > 0 ? <Badge color="red">{r.pdvs_sem_visita}</Badge> : <span className="text-slate-300 dark:text-slate-600">0</span>}
                                                    </Td>
                                                )}
                                                {col("relampago") && (
                                                    <Td center>
                                                        <span className={r.relampago_pct >= 30 ? "text-red-600 font-bold" : r.relampago_pct >= 15 ? "text-amber-600 font-semibold" : "text-green-600"}>
                                                            {pct(r.relampago_pct, 0)} <span className="text-slate-400 dark:text-slate-500 font-normal">({r.relampago}/{r.visitas_total_dentro_raio})</span>
                                                        </span>
                                                    </Td>
                                                )}
                                                {col("sfa") && <Td center mono>{r.pedido_sfa > 0 ? <span className="text-blue-600 dark:text-blue-400 font-semibold">{r.pedido_sfa}</span> : <span className="text-slate-300 dark:text-slate-600">0</span>}</Td>}
                                                {col("heishop") && <Td center mono>{r.pedido_heishop > 0 ? <span className="text-amber-600 dark:text-amber-400 font-semibold">{r.pedido_heishop}</span> : <span className="text-slate-300 dark:text-slate-600">0</span>}</Td>}
                                                {col("heishop_verif") && <Td center mono>{r.heishop_verif > 0 ? <Badge color="green">{r.heishop_verif}</Badge> : <span className="text-slate-300">0</span>}</Td>}
                                                {col("iv") && (
                                                    <Td center>
                                                        <span className={r.iv >= 80 ? "text-green-600 font-semibold" : r.iv >= 60 ? "text-amber-600" : "text-red-500"}>
                                                            {pct(r.iv)}
                                                        </span>
                                                    </Td>
                                                )}
                                                {col("iav") && (
                                                    <Td center>
                                                        {r.iav > 0 ? <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{pct(r.iav)}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                    </Td>
                                                )}
                                                {col("atend_35") && <Td center>{r.atend_maior35 > 0 ? <Badge color="amber">{r.atend_maior35}</Badge> : <span className="text-slate-300 dark:text-slate-600">0</span>}</Td>}
                                                {col("soma_35") && <Td center mono className="text-slate-600 dark:text-slate-300">{r.soma_maior35_fmt}</Td>}
                                                {col("t_menor") && <Td center mono className={r.tempo_menor !== null && r.tempo_menor < 3 ? "text-red-700 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}>{r.tempo_menor_fmt}</Td>}
                                                {col("t_maior") && <Td center mono className={r.tempo_maior !== null && r.tempo_maior > 35 ? "text-red-500" : "text-slate-600 dark:text-slate-300"}>{r.tempo_maior_fmt}</Td>}
                                                {col("t_medio") && <Td center mono className="text-slate-600 dark:text-slate-300">{r.tempo_medio_fmt}</Td>}
                                                {col("t_total") && <Td center mono className={`${r.tempo_total_fmt && r.tempo_total_fmt < "02:00:00" ? "text-red-500" : "text-indigo-600 dark:text-indigo-400 font-semibold"}`}>{r.tempo_total_fmt}</Td>}
                                                {col("soma_percurso") && (
                                                    <Td center mono className="text-slate-600 dark:text-slate-300">
                                                        {r.total_percurso !== null ? minToHM(r.total_percurso) : "—"}
                                                    </Td>
                                                )}
                                                {col("percurso") && (
                                                    <Td center mono className={r.maior_percurso !== null && r.maior_percurso > 30 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-600 dark:text-slate-300"}>
                                                        {r.maior_percurso !== null ? minToHM(r.maior_percurso) : "—"}
                                                    </Td>
                                                )}
                                                {col("ini_percurso") && <Td center mono className="text-slate-500 dark:text-slate-400">{r.percurso_ini ?? "—"}</Td>}
                                                {col("fim_percurso") && <Td center mono className="text-slate-500 dark:text-slate-400">{r.percurso_fim ?? "—"}</Td>}
                                                {col("pdvs_percurso") && <Td center mono>{r.pdvs_apos_gap > 0 ? <span className="text-slate-700 dark:text-slate-200 font-semibold">{r.pdvs_apos_gap}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}</Td>}
                                                {col("t_nao_atend") && (
                                                    <Td center mono className={r.tempo_nao_atend !== null && r.tempo_nao_atend > 120 ? "text-red-500 font-bold" : r.tempo_nao_atend !== null && r.tempo_nao_atend > 60 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-600 dark:text-slate-300"}>
                                                        {r.tempo_nao_atend_fmt}
                                                    </Td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-5 py-4 border-t border-slate-100 dark:border-[var(--border)] bg-slate-50/40 dark:bg-[var(--background)]/40">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <PenLine className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                    <span className="text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-widest font-bold">
                                        Análise · {rev}
                                    </span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-1 font-normal">
                                        — será incluída no PDF
                                    </span>
                                </div>
                                <button
                                    onClick={() => downloadPDF(rev)}
                                    disabled={downloadingPDF !== null}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50 font-bold"
                                    title={`Baixar PDF completo — ${rev}`}
                                >
                                    <Printer className="w-3 h-3" />
                                    {downloadingPDF === rev ? "Gerando..." : "Baixar PDF"}
                                </button>
                            </div>
                            <EditorAnalise
                                ref={(el) => { if (el) editorRefs.current.set(rev, el); else editorRefs.current.delete(rev); }}
                                id={`editor-revenda-${rev}`}
                                html={getAnalise(rev)}
                                onChange={html => onSetAnalise(rev, html)}
                                placeholder={`Registre aqui a análise da revenda ${rev} — destaques, pontos de atenção, planos de ação...`}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
