import { useState, useMemo } from "react";
import {
    BarChart2, BarChart3, CheckCircle2, ClipboardList, Crown, Filter,
    LayersIcon, Medal, Percent, Search, Target, TrendingDown, TrendingUp,
    Trophy, UserCheck, Users, X,
} from "lucide-react";
import {
    Bar, BarChart, CartesianGrid, Cell, LabelList, Legend,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { classNames, corRevenda, pctColor, MESES, PIRAMIDE_COR } from "../constants";
import type { RespostaResultado } from "../types";
import { KpiCard } from "../components/KpiCard";

export function ResultadosView({ isDark, cardBorder, cardShadow }: {
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
    palette: string[];
}) {
    const hoje = new Date();
    const [selectedAno, setSelectedAno] = useState(hoje.getFullYear());
    const [selectedMes, setSelectedMes] = useState(hoje.getMonth() + 1);

    // Filtros
    const [fRevendas, setFRevendas] = useState<string[]>([]);
    const [fPadrinhos, setFPadrinhos] = useState<string[]>([]);
    const [fMacro, setFMacro] = useState<string>("");
    const [fMicro, setFMicro] = useState<string>("");
    const [fPiramide, setFPiramide] = useState<string>("");
    const [fStatusEvid, setFStatusEvid] = useState<string>("");
    const [busca, setBusca] = useState("");

    const dbQuery = trpc.assessment.listAll.useQuery(
        { ano: selectedAno, mes: selectedMes },
        { retry: false },
    );

    const respostas = useMemo<RespostaResultado[]>(() =>
        (dbQuery.data ?? []).map(r => ({
            data:                r.data ?? `${r.ano}-${String(r.mes).padStart(2, "0")}-01`,
            operacao:            r.operacao ?? 0,
            revenda:             r.revenda,
            shortId:             r.item,
            item:                r.item,
            autoavaliacao:       (r.autoavaliacao ?? "Não") as "Sim" | "Não",
            evidencia:           (r.evidencia ?? "Não") as "Sim" | "Não",
            padrinho:            r.padrinho || "Sem padrinho",
            hora:                r.horaCheck ?? null,
            macroArea:           r.macroArea ?? "",
            microArea:           r.microArea ?? "",
            piramide:            r.piramide ?? "",
            descricao:           r.descricao ?? "",
            tipoResposta:        r.tipoResposta ?? "",
            pontoPossivel:       r.pontoPossivel ?? 0,
            pontosEvidencia:     r.pontosEvidencia ?? 0,
            pontosAutoavaliacao: r.pontosAutoavaliacao ?? 0,
        })),
    [dbQuery.data]);

    const todasRevendas  = useMemo(() => [...new Set(respostas.map(r => r.revenda))].sort(), [respostas]);
    const todosPadrinhos = useMemo(() =>
        [...new Set(respostas.map(r => r.padrinho).filter(p => p && p !== "Sem padrinho"))].sort(),
    [respostas]);

    // Opções de filtro
    const opcMacro = useMemo(() => Array.from(new Set(respostas.map(r => r.macroArea))).sort(), [respostas]);
    const opcMicro = useMemo(() => {
        const base = fMacro ? respostas.filter(r => r.macroArea === fMacro) : respostas;
        return Array.from(new Set(base.map(r => r.microArea))).sort();
    }, [respostas, fMacro]);
    const opcPiramide = useMemo(() => Array.from(new Set(respostas.map(r => r.piramide))).sort(), [respostas]);

    // Filtragem
    const filtradas = useMemo(() => {
        const q = busca.toLowerCase().trim();
        return respostas.filter(r => {
            if (fRevendas.length > 0 && !fRevendas.includes(r.revenda)) return false;
            if (fPadrinhos.length > 0 && !fPadrinhos.includes(r.padrinho)) return false;
            if (fMacro && r.macroArea !== fMacro) return false;
            if (fMicro && r.microArea !== fMicro) return false;
            if (fPiramide && r.piramide !== fPiramide) return false;
            if (fStatusEvid === "sim" && r.evidencia !== "Sim") return false;
            if (fStatusEvid === "nao" && r.evidencia !== "Não") return false;
            if (q) {
                const blob = `${r.shortId} ${r.descricao} ${r.revenda} ${r.microArea} ${r.padrinho}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }, [respostas, fRevendas, fPadrinhos, fMacro, fMicro, fPiramide, fStatusEvid, busca]);

    const temFiltro = !!(fRevendas.length || fPadrinhos.length || fMacro || fMicro || fPiramide || fStatusEvid || busca);
    const limparFiltros = () => {
        setFRevendas([]); setFPadrinhos([]); setFMacro(""); setFMicro("");
        setFPiramide(""); setFStatusEvid(""); setBusca("");
    };

    // KPIs
    const totalPossivel = filtradas.reduce((s, r) => s + r.pontoPossivel, 0);
    const totalEvid = filtradas.reduce((s, r) => s + r.pontosEvidencia, 0);
    const totalAuto = filtradas.reduce((s, r) => s + r.pontosAutoavaliacao, 0);
    const pctEvid = totalPossivel > 0 ? Math.round(totalEvid / totalPossivel * 100) : 0;
    const totalEvidSim = filtradas.filter(r => r.evidencia === "Sim").length;
    const totalAutoSim = filtradas.filter(r => r.autoavaliacao === "Sim").length;
    const totalIndicadores = filtradas.length;

    // Ranking de revendas
    const rankingRevendas = useMemo(() => {
        const map = new Map<string, { possivel: number; evid: number; auto: number; simEvid: number; simAuto: number; total: number }>();
        filtradas.forEach(r => {
            const cur = map.get(r.revenda) || { possivel: 0, evid: 0, auto: 0, simEvid: 0, simAuto: 0, total: 0 };
            cur.possivel += r.pontoPossivel;
            cur.evid += r.pontosEvidencia;
            cur.auto += r.pontosAutoavaliacao;
            cur.total += 1;
            if (r.evidencia === "Sim") cur.simEvid += 1;
            if (r.autoavaliacao === "Sim") cur.simAuto += 1;
            map.set(r.revenda, cur);
        });
        return Array.from(map.entries())
            .map(([rev, s]) => ({
                revenda: rev,
                possivel: s.possivel,
                evid: s.evid,
                auto: s.auto,
                pctEvid: s.possivel > 0 ? Math.round(s.evid / s.possivel * 100) : 0,
                pctAuto: s.possivel > 0 ? Math.round(s.auto / s.possivel * 100) : 0,
                simEvid: s.simEvid,
                simAuto: s.simAuto,
                total: s.total,
            }))
            .sort((a, b) => b.evid - a.evid);
    }, [filtradas]);

    const melhorRevenda = rankingRevendas[0];
    const piorRevenda = rankingRevendas[rankingRevendas.length - 1];

    // Pontos por Micro-Área (agrupado por revenda)
    const microPorRevenda = useMemo(() => {
        const map = new Map<string, Record<string, number>>();
        const microSet = new Set<string>();
        const possiveis = new Map<string, number>();

        filtradas.forEach(r => {
            microSet.add(r.microArea);
            possiveis.set(r.microArea, (possiveis.get(r.microArea) || 0) + r.pontoPossivel);
            if (!map.has(r.microArea)) map.set(r.microArea, {});
            const inner = map.get(r.microArea)!;
            inner[r.revenda] = (inner[r.revenda] || 0) + r.pontosEvidencia;
        });

        const revendasList = Array.from(new Set(filtradas.map(r => r.revenda)));
        const arr = Array.from(microSet).sort().map(micro => {
            const row: Record<string, number | string> = { name: micro, possivel: possiveis.get(micro) || 0 };
            revendasList.forEach(rev => {
                row[rev] = map.get(micro)?.[rev] || 0;
            });
            return row;
        });
        return { rows: arr, revendas: revendasList };
    }, [filtradas]);

    // Qtd de evidências respondidas vs total por micro-área
    const evidQtdPorMicro = useMemo(() => {
        const map = new Map<string, { respondida: number; total: number }>();
        filtradas.forEach(r => {
            const cur = map.get(r.microArea) || { respondida: 0, total: 0 };
            cur.total += 1;
            if (r.evidencia === "Sim") cur.respondida += 1;
            map.set(r.microArea, cur);
        });
        return Array.from(map.entries())
            .map(([micro, v]) => ({
                name: micro,
                respondida: v.respondida,
                total: v.total,
                pendente: v.total - v.respondida,
                pct: v.total > 0 ? Math.round(v.respondida / v.total * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total);
    }, [filtradas]);

    // Pontos por Pirâmide
    const piramideData = useMemo(() => {
        const map = new Map<string, { evid: number; possivel: number }>();
        filtradas.forEach(r => {
            const cur = map.get(r.piramide) || { evid: 0, possivel: 0 };
            cur.evid += r.pontosEvidencia;
            cur.possivel += r.pontoPossivel;
            map.set(r.piramide, cur);
        });
        return Array.from(map.entries())
            .map(([k, v]) => ({
                name: k,
                evid: v.evid,
                possivel: v.possivel,
                pct: v.possivel > 0 ? Math.round(v.evid / v.possivel * 100) : 0,
                fill: PIRAMIDE_COR[k] || "#94A3B8",
            }))
            .sort((a, b) => b.possivel - a.possivel);
    }, [filtradas]);

    // Performance por padrinho
    const padrinhoStats = useMemo(() => {
        const map = new Map<string, { simEvid: number; total: number; pontos: number }>();
        filtradas.filter(r => r.padrinho && r.padrinho !== "Sem padrinho").forEach(r => {
            const cur = map.get(r.padrinho) || { simEvid: 0, total: 0, pontos: 0 };
            cur.total += 1;
            if (r.evidencia === "Sim") {
                cur.simEvid += 1;
                cur.pontos += r.pontosEvidencia;
            }
            map.set(r.padrinho, cur);
        });
        return Array.from(map.entries())
            .map(([nome, s]) => ({ nome, ...s, pctSim: s.total > 0 ? Math.round(s.simEvid / s.total * 100) : 0 }))
            .sort((a, b) => b.pontos - a.pontos);
    }, [filtradas]);

    // Heatmap: Revenda × Micro-Área (% de aderência)
    const heatmap = useMemo(() => {
        const microSet = new Set<string>();
        const map = new Map<string, Map<string, { evid: number; possivel: number }>>();
        filtradas.forEach(r => {
            microSet.add(r.microArea);
            if (!map.has(r.revenda)) map.set(r.revenda, new Map());
            const inner = map.get(r.revenda)!;
            const cur = inner.get(r.microArea) || { evid: 0, possivel: 0 };
            cur.evid += r.pontosEvidencia;
            cur.possivel += r.pontoPossivel;
            inner.set(r.microArea, cur);
        });
        const revendasList = Array.from(map.keys()).sort();
        const microList = Array.from(microSet).sort();
        return {
            revendas: revendasList,
            micros: microList,
            cells: revendasList.map(rev => microList.map(micro => {
                const cell = map.get(rev)?.get(micro);
                if (!cell || cell.possivel === 0) return { pct: 0, evid: 0, possivel: 0, hasData: false };
                return { pct: Math.round(cell.evid / cell.possivel * 100), evid: cell.evid, possivel: cell.possivel, hasData: true };
            })),
        };
    }, [filtradas]);

    const tickColor = isDark ? "#64748B" : "#94A3B8";
    const gridColor = isDark ? "#1E2A3A" : "#F1F5F9";

    const toggleRevenda = (rev: string) => {
        setFRevendas(prev => prev.includes(rev) ? prev.filter(r => r !== rev) : [...prev, rev]);
    };
    const togglePadrinho = (p: string) => {
        setFPadrinhos(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    if (dbQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-60 bg-white dark:bg-[var(--card)] rounded-2xl"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
            </div>
        );
    }

    const anos = [hoje.getFullYear(), hoje.getFullYear() - 1];

    return (
        <div className="space-y-6">
            {/* Seletor de período */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-4 flex flex-wrap items-center gap-3"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Período</span>
                <div className="flex gap-1">
                    {MESES.map(m => (
                        <button key={m.num}
                            onClick={() => setSelectedMes(m.num)}
                            className={classNames(
                                "text-xs px-2.5 py-1 rounded-lg border transition-all",
                                selectedMes === m.num
                                    ? "bg-indigo-500 text-white border-indigo-500"
                                    : "bg-white dark:bg-[var(--card)] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                            )}
                            style={{ fontWeight: 700 }}>{m.label}</button>
                    ))}
                </div>
                <select value={selectedAno} onChange={e => setSelectedAno(Number(e.target.value))}
                    className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none dark:text-slate-200"
                    style={{ fontWeight: 700 }}>
                    {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {dbQuery.isFetching && (
                    <span className="text-xs text-indigo-400 animate-pulse ml-1">Carregando…</span>
                )}
                <span className="ml-auto text-xs text-slate-400" style={{ fontWeight: 500 }}>
                    {respostas.length} respostas
                </span>
            </div>

            {respostas.length === 0 && !dbQuery.isFetching && (
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-10 text-center"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Nenhum dado para {MESES[selectedMes - 1].label}/{selectedAno}.
                        Execute <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">check.py --sync</code> para importar.
                    </p>
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 space-y-3"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>
                    <Filter className="w-3.5 h-3.5" /> Filtros · {filtradas.length} de {respostas.length} respostas
                    {temFiltro && (
                        <button onClick={limparFiltros}
                            className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--accent)]"
                            style={{ fontWeight: 600 }}>
                            <X className="w-3.5 h-3.5" /> Limpar
                        </button>
                    )}
                </div>

                <div className="flex items-start gap-3">
                    <label className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 shrink-0 w-20" style={{ fontWeight: 600 }}>Revendas</label>
                    <div className="flex flex-wrap gap-1.5">
                        {todasRevendas.map(rev => {
                            const active = fRevendas.includes(rev);
                            const cor = corRevenda(rev);
                            return (
                                <button key={rev}
                                    onClick={() => toggleRevenda(rev)}
                                    className={classNames(
                                        "text-xs px-2.5 py-1 rounded-lg transition-all border",
                                        active
                                            ? "text-white"
                                            : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                                    )}
                                    style={{
                                        fontWeight: 700,
                                        background: active ? cor : undefined,
                                        borderColor: active ? cor : isDark ? "var(--border)" : "#E2E8F0",
                                    }}>
                                    <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                                        style={{ background: active ? "white" : cor }} />
                                    {rev}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <label className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 shrink-0 w-20" style={{ fontWeight: 600 }}>Padrinhos</label>
                    <div className="flex flex-wrap gap-1.5">
                        {todosPadrinhos.map(p => {
                            const active = fPadrinhos.includes(p);
                            return (
                                <button key={p}
                                    onClick={() => togglePadrinho(p)}
                                    className={classNames(
                                        "text-xs px-2.5 py-1 rounded-lg transition-all border",
                                        active
                                            ? "bg-indigo-500 text-white border-indigo-500"
                                            : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                                    )}
                                    style={{ fontWeight: 600 }}>
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Macro</label>
                        <select value={fMacro} onChange={e => { setFMacro(e.target.value); setFMicro(""); }}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                            <option value="">Todas</option>
                            {opcMacro.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Micro</label>
                        <select value={fMicro} onChange={e => setFMicro(e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                            <option value="">Todas</option>
                            {opcMicro.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Pirâmide</label>
                        <select value={fPiramide} onChange={e => setFPiramide(e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                            <option value="">Todas</option>
                            {opcPiramide.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Evidência</label>
                        <select value={fStatusEvid} onChange={e => setFStatusEvid(e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                            <option value="">Todas</option>
                            <option value="sim">Atendeu (Sim)</option>
                            <option value="nao">Não atendeu</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 ml-auto bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-3 py-1.5">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <input type="text" placeholder="Buscar..."
                            value={busca} onChange={e => setBusca(e.target.value)}
                            className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none w-40"
                            style={{ fontWeight: 500 }} />
                        {busca && <button onClick={() => setBusca("")}><X className="w-3 h-3 text-slate-400" /></button>}
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard titulo={`% Aderência`} valor={`${pctEvid}%`} icone={Percent} cor="from-indigo-400 to-purple-400"
                    subtitulo={`${totalEvid}/${totalPossivel} pts`} />
                <KpiCard titulo="Evidências OK" valor={totalEvidSim} icone={CheckCircle2} cor="from-emerald-400 to-teal-400"
                    subtitulo={`${totalIndicadores ? Math.round(totalEvidSim / totalIndicadores * 100) : 0}% dos itens`} />
                <KpiCard titulo="Autoavaliações" valor={totalAutoSim} icone={UserCheck} cor="from-blue-400 to-cyan-400"
                    subtitulo={`${totalPossivel ? Math.round(totalAuto / totalPossivel * 100) : 0}% pts auto`} />
                <KpiCard titulo="Melhor Revenda"
                    valor={melhorRevenda ? `${melhorRevenda.pctEvid}%` : "—"}
                    icone={Crown} cor="from-amber-400 to-orange-400"
                    subtitulo={melhorRevenda ? melhorRevenda.revenda : ""} />
                <KpiCard titulo="Crítica"
                    valor={piorRevenda ? `${piorRevenda.pctEvid}%` : "—"}
                    icone={TrendingDown} cor="from-rose-400 to-pink-400"
                    subtitulo={piorRevenda ? piorRevenda.revenda : ""} />
            </div>

            {/* Ranking */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <Trophy className="w-4 h-4 text-amber-500" /> Ranking de Revendas
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Aderência por evidência (% dos pontos possíveis atingidos)
                    </p>
                </div>
                <div className="space-y-3">
                    {rankingRevendas.map((r, idx) => {
                        const cor = corRevenda(r.revenda);
                        return (
                            <div key={r.revenda} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={classNames(
                                            "inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs",
                                            idx === 0 ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                                                idx === 1 ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" :
                                                    idx === 2 ? "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300" :
                                                        "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                                        )} style={{ fontWeight: 900 }}>
                                            {idx + 1}
                                        </span>
                                        {idx === 0 && <Medal className="w-3.5 h-3.5 text-amber-500" />}
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
                                        <span className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 700 }}>
                                            {r.revenda}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="text-slate-500 dark:text-slate-400">
                                            <span style={{ fontWeight: 700 }}>{r.simEvid}/{r.total}</span> evid
                                        </span>
                                        <span className="tabular-nums text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                            {r.evid}/{r.possivel} pts
                                        </span>
                                        <span className="tabular-nums w-12 text-right" style={{ fontWeight: 900, color: pctColor(r.pctEvid) }}>
                                            {r.pctEvid}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all"
                                        style={{ width: `${r.pctEvid}%`, background: `linear-gradient(90deg, ${cor}, ${pctColor(r.pctEvid)})` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Qtd de evidências respondidas vs total por Micro-Área */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4 flex items-start justify-between gap-2 flex-wrap">
                    <div>
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <ClipboardList className="w-4 h-4 text-cyan-500" /> Quantidade de Evidências Respondidas por Micro-Área
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Itens com evidência "Sim" vs total de indicadores na micro-área (recorte do filtro)
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#34C78A" }} /> Respondida
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: isDark ? "#475569" : "#CBD5E1" }} /> Pendente
                        </span>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(300, evidQtdPorMicro.length * 28 + 80)}>
                    <BarChart data={evidQtdPorMicro} margin={{ top: 24, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false}
                            interval={0} angle={-30} textAnchor="end" height={70} />
                        <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                            cursor={{ fill: "rgba(99,102,241,0.06)" }}
                            contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                            formatter={(v: number, name: string, props: any) => {
                                if (name === "respondida") return [`${v} de ${props.payload.total} (${props.payload.pct}%)`, "Respondidas"];
                                if (name === "pendente") return [`${v} de ${props.payload.total}`, "Pendentes"];
                                return [v, name];
                            }}
                        />
                        <Bar dataKey="respondida" name="respondida" stackId="evid" fill="#34C78A" radius={[0, 0, 0, 0]}>
                            <LabelList dataKey="respondida" position="inside" style={{ fontSize: 11, fill: "#fff", fontWeight: 800 }}
                                formatter={(v: any) => Number(v) > 0 ? v : ""} />
                        </Bar>
                        <Bar dataKey="pendente" name="pendente" stackId="evid" fill={isDark ? "#475569" : "#CBD5E1"} radius={[4, 4, 0, 0]}>
                            <LabelList dataKey="total" position="top" style={{ fontSize: 11, fill: tickColor, fontWeight: 800 }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Pontos por Micro-Área */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <BarChart3 className="w-4 h-4 text-indigo-500" /> Pontos Conquistados por Micro-Área
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Pontos via evidência por revenda
                    </p>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(280, microPorRevenda.rows.length * 50)}>
                    <BarChart data={microPorRevenda.rows} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: tickColor }}
                            width={140} axisLine={false} tickLine={false} />
                        <Tooltip
                            cursor={{ fill: "rgba(99,102,241,0.06)" }}
                            contentStyle={{ background: isDark ? "#1A2436" : "white", border: `1px solid ${isDark ? "#2D3F55" : "#E2E8F0"}`, borderRadius: "12px", fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {microPorRevenda.revendas.map(rev => (
                            <Bar key={rev} dataKey={rev} name={rev} fill={corRevenda(rev)} radius={[0, 4, 4, 0]} >
                                <LabelList dataKey={rev} position="right" style={{ fontSize: 12, fill: tickColor, fontWeight: 800 }} />
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Pirâmide + Padrinho */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <div className="mb-4">
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <Target className="w-4 h-4 text-purple-500" /> Aderência por Pirâmide
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Pontos conquistados vs possíveis
                        </p>
                    </div>
                    <div className="space-y-3">
                        {piramideData.map(p => (
                            <div key={p.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
                                        <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-500 dark:text-slate-400 tabular-nums">{p.evid}/{p.possivel}</span>
                                        <span className="tabular-nums w-10 text-right" style={{ fontWeight: 900, color: pctColor(p.pct) }}>{p.pct}%</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: p.fill }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                    style={{ border: cardBorder, boxShadow: cardShadow }}>
                    <div className="mb-4">
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <Users className="w-4 h-4 text-emerald-500" /> Performance por Padrinho
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Indicadores patrocinados e % atendido
                        </p>
                    </div>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {padrinhoStats.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">Sem padrinhos no recorte atual</p>
                        ) : padrinhoStats.map((p, idx) => (
                            <div key={p.nome} className="flex items-center gap-3 text-xs">
                                <span className="w-5 text-slate-400 tabular-nums" style={{ fontWeight: 700 }}>{idx + 1}.</span>
                                <span className="flex-1 text-slate-700 dark:text-slate-200 truncate" style={{ fontWeight: 600 }}>{p.nome}</span>
                                <span className="text-slate-500 dark:text-slate-400 tabular-nums">{p.simEvid}/{p.total}</span>
                                <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full" style={{ width: `${p.pctSim}%`, background: pctColor(p.pctSim) }} />
                                </div>
                                <span className="tabular-nums w-10 text-right" style={{ fontWeight: 800, color: pctColor(p.pctSim) }}>{p.pctSim}%</span>
                                <span className="tabular-nums text-slate-400 text-[10px] w-12 text-right">{p.pontos} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <LayersIcon className="w-4 h-4 text-rose-500" /> Heatmap · Revenda × Micro-Área
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        % de aderência. Verde = forte, vermelho = gap crítico.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr>
                                <th className="px-2 py-2 text-left text-slate-500 dark:text-slate-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                                    Revenda
                                </th>
                                {heatmap.micros.map(m => (
                                    <th key={m} className="px-2 py-2 text-center text-slate-500 dark:text-slate-400 text-[10px] tracking-wider" style={{ fontWeight: 700 }}>
                                        {m}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {heatmap.revendas.map((rev, ri) => (
                                <tr key={rev} className="border-t border-slate-100 dark:border-[var(--sidebar-border)]">
                                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap" style={{ fontWeight: 700 }}>
                                        <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                                            style={{ background: corRevenda(rev) }} />
                                        {rev}
                                    </td>
                                    {heatmap.cells[ri].map((cell, ci) => {
                                        const cor = cell.hasData ? pctColor(cell.pct) : "#E5E7EB";
                                        const opacity = cell.hasData ? Math.max(0.18, cell.pct / 100) : 0.25;
                                        return (
                                            <td key={ci} className="px-1 py-1 text-center">
                                                <div className="rounded-md px-1.5 py-2 flex flex-col items-center justify-center"
                                                    style={{
                                                        background: cell.hasData ? `${cor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}` : (isDark ? "#1e293b" : "#F8FAFC"),
                                                        border: `1px solid ${cell.hasData ? cor : isDark ? "#334155" : "#E5E7EB"}`,
                                                        minWidth: 56,
                                                    }}
                                                    title={cell.hasData ? `${rev} · ${heatmap.micros[ci]}\n${cell.evid}/${cell.possivel} pts (${cell.pct}%)` : "sem dados"}>
                                                    <span className="tabular-nums text-sm"
                                                        style={{ fontWeight: 900, color: cell.hasData ? cor : "#94A3B8" }}>
                                                        {cell.hasData ? `${cell.pct}%` : "—"}
                                                    </span>
                                                    {cell.hasData && (
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                            {cell.evid}/{cell.possivel}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tabela detalhada */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base" style={{ fontWeight: 800 }}>
                        Respostas detalhadas
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {filtradas.length} respostas no filtro atual · {MESES[selectedMes - 1].label}/{selectedAno}
                    </p>
                </div>
                <div className="overflow-x-auto max-h-[520px]">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-[var(--accent)] sticky top-0 z-10">
                            <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Revenda</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>ID</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Micro</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Pirâmide</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Descrição</th>
                                <th className="px-3 py-2.5 text-center" style={{ fontWeight: 700 }}>Auto</th>
                                <th className="px-3 py-2.5 text-center" style={{ fontWeight: 700 }}>Evid.</th>
                                <th className="px-3 py-2.5 text-left" style={{ fontWeight: 700 }}>Padrinho</th>
                                <th className="px-3 py-2.5 text-right" style={{ fontWeight: 700 }}>Pts</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                            {filtradas.map((r, idx) => {
                                const corP = PIRAMIDE_COR[r.piramide] || "#94A3B8";
                                const corR = corRevenda(r.revenda);
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[var(--accent)]">
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                                                style={{ background: corR }} />
                                            <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 600 }}>{r.revenda}</span>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                            {r.shortId}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.microArea}</td>
                                        <td className="px-3 py-2">
                                            <span className="px-1.5 py-0.5 rounded-md text-xs"
                                                style={{ background: `${corP}33`, color: corP, fontWeight: 700 }}>
                                                {r.piramide}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 max-w-xs">
                                            <p className="text-slate-600 dark:text-slate-300 truncate" style={{ fontWeight: 500 }}>
                                                {r.descricao}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {r.autoavaliacao === "Sim"
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                : <X className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {r.evidencia === "Sim"
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                : <X className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-[11px]">
                                            {r.padrinho === "Sem padrinho" ? <span className="italic text-slate-300 dark:text-slate-600">—</span> : r.padrinho}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            <span className={r.pontosEvidencia > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}
                                                style={{ fontWeight: 700 }}>
                                                {r.pontosEvidencia}/{r.pontoPossivel}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-center py-2">
                <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                    MetricFlow · Resultados Assessment · {MESES[selectedMes - 1].label}/{selectedAno} · {respostas.length} respostas
                </p>
            </div>
        </div>
    );
}
