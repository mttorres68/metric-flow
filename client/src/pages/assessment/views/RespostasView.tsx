import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
    CheckCircle2, Filter, PenLine, FileCheck2, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { classNames, MESES, PIRAMIDE_COR } from "../constants";
import type { Indicador, ResultadosData, RespostaResultado } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type RowState = {
    autoavaliacao: "Sim" | "Não";
    evidencia: "Sim" | "Não";
    padrinho: string;
    hora: string;
    data: string;
    pontosEvidencia: number;
    pontosAutoavaliacao: number;
    pontoPossivel: number;
    saving: boolean;
    saved: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// RespostasView
// ─────────────────────────────────────────────────────────────────────────────
export function RespostasView({ data, indicadores, dbRevendas, isDark: _dark, cardBorder, cardShadow: _cs }: {
    data: ResultadosData | null;
    indicadores: Indicador[];
    dbRevendas: { id: number; nome: string; codigo: string }[];
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
}) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    // Até o dia 10 do mês ainda estamos no prazo de lançar evidências do mês anterior
    const inGracePeriod = today.getDate() <= 10;
    const defaultMes = inGracePeriod ? (currentMonth === 1 ? 12 : currentMonth - 1) : currentMonth;
    const defaultAno = inGracePeriod && currentMonth === 1 ? currentYear - 1 : currentYear;

    // ── Seleção ────────────────────────────────────────────────────────────
    const [selectedAno, setSelectedAno] = useState<number>(defaultAno);
    const [selectedRevenda, setSelectedRevenda] = useState<string>("");
    const [selectedMes, setSelectedMes] = useState<number>(defaultMes);

    // ── Filtros linha 2 ────────────────────────────────────────────────────
    const [fBusca, setFBusca] = useState("");
    const [fMacro, setFMacro] = useState("");
    const [fMicro, setFMicro] = useState("");
    const [fPiramide, setFPiramide] = useState("");
    const [fEvid, setFEvid] = useState("");
    const [fAutoav, setFAutoav] = useState("");

    // ── Padrinhos ──────────────────────────────────────────────────────────
    const [padrinhos, setPadrinhos] = useState<string[]>(["Sem padrinho"]);
    const [novoInput, setNovoInput] = useState<{ rowKey: string; text: string } | null>(null);

    // ── Estado editável das linhas ─────────────────────────────────────────
    const [rows, setRows] = useState<Record<string, RowState>>({});
    const initRef = useRef("");

    // ── tRPC ───────────────────────────────────────────────────────────────
    const dbQuery = trpc.assessment.list.useQuery(
        { revenda: selectedRevenda, ano: selectedAno, mes: selectedMes },
        { enabled: !!selectedRevenda, retry: false },
    );
    const upsert = trpc.assessment.upsert.useMutation({
        onError: () => toast.error("Erro ao salvar. Verifique a conexão com o banco."),
    });

    // ── Anos disponíveis ───────────────────────────────────────────────────
    const anos = useMemo(() => {
        const ys = new Set<number>([currentYear]);
        data?.respostas.forEach(r => ys.add(Number(r.data.split("-")[0])));
        return Array.from(ys).sort((a, b) => b - a);
    }, [data, currentYear]);

    const revendas = dbRevendas.length > 0
        ? dbRevendas.map(r => r.nome)
        : (data?.revendas ?? []);

    // ── Mapa revenda → operação (derivado das respostas do JSON) ───────────
    const revendaOpMap = useMemo(() => {
        const map: Record<string, number> = {};
        data?.respostas.forEach(r => { map[r.revenda] = r.operacao; });
        return map;
    }, [data]);

    // ── Meses com dados ────────────────────────────────────────────────────
    const mesesComDados = useMemo(() => {
        const s = new Set<number>();
        data?.respostas.forEach(r => {
            const [yr, mo] = r.data.split("-").map(Number);
            if (yr !== selectedAno) return;
            if (selectedRevenda && r.revenda !== selectedRevenda) return;
            s.add(mo);
        });
        dbQuery.data?.forEach(d => { if (d.mes) s.add(d.mes); });
        return s;
    }, [data, selectedAno, selectedRevenda, dbQuery.data]);

    // ── Lista completa de 92 indicadores para a revenda selecionada ────────
    // Fonte: assessment_indicadores.json (todos os indicadores, incluindo os
    // não respondidos no resultados.json)
    const baseIndicadores = useMemo<RespostaResultado[]>(() => {
        if (!selectedRevenda || !indicadores.length) return [];
        const operacao = revendaOpMap[selectedRevenda] ?? 0;
        const mesStr = String(selectedMes).padStart(2, "0");

        // Filtra indicadores pelo número de operação da revenda, deduplica por código
        const seen = new Set<string>();
        const indRevenda = indicadores.filter(i => {
            if (operacao && Number(i.idOperacao) !== operacao) return false;
            const cod = i.idIndicador.split(" - ")[0].trim();
            if (seen.has(cod)) return false;
            seen.add(cod);
            return true;
        });

        return indRevenda.map(i => {
            const itemCode = i.idIndicador.split(" - ")[0].trim(); // "ADM01"

            // Tenta encontrar resposta existente no JSON para o mês/revenda
            const existing = data?.respostas.find(r =>
                r.revenda === selectedRevenda &&
                r.item === itemCode &&
                Number(r.data.split("-")[0]) === selectedAno &&
                Number(r.data.split("-")[1]) === selectedMes,
            );
            if (existing) return existing;

            // Template zerado para meses sem dados
            return {
                data: `${selectedAno}-${mesStr}-01`,
                operacao,
                revenda: selectedRevenda,
                shortId: itemCode,
                item: itemCode,
                autoavaliacao: "Não",
                evidencia: "Não",
                padrinho: "Sem padrinho",
                hora: null,
                macroArea: i.macroArea,
                microArea: i.microArea,
                piramide: i.piramide,
                descricao: i.descricaoItem,
                tipoResposta: i.tipoResposta,
                pontoPossivel: i.pontoPossivel,
                pontosEvidencia: 0,
                pontosAutoavaliacao: 0,
            } as RespostaResultado;
        });
    }, [indicadores, selectedRevenda, selectedAno, selectedMes, data, revendaOpMap]);

    // ── Inicializar rows (DB → JSON → vazio) ───────────────────────────────
    const selKey = `${selectedRevenda}|${selectedAno}|${selectedMes}`;
    useEffect(() => {
        const dbRows = dbQuery.data;
        const k = selKey + (dbRows !== undefined ? "|db" : "|seed");
        if (initRef.current === k) return;
        initRef.current = k;
        const next: Record<string, RowState> = {};
        baseIndicadores.forEach(r => {
            const db = dbRows?.find(d => d.item === r.item);
            next[r.item] = db ? {
                autoavaliacao: (db.autoavaliacao ?? "Não") as "Sim" | "Não",
                evidencia: (db.evidencia ?? "Não") as "Sim" | "Não",
                padrinho: db.padrinho ?? "Sem padrinho",
                hora: db.horaCheck ?? "",
                data: db.data ?? r.data,
                pontosEvidencia: db.pontosEvidencia ?? 0,
                pontosAutoavaliacao: db.pontosAutoavaliacao ?? 0,
                pontoPossivel: r.pontoPossivel,
                saving: false, saved: false,
            } : {
                autoavaliacao: r.autoavaliacao as "Sim" | "Não",
                evidencia: r.evidencia as "Sim" | "Não",
                padrinho: r.padrinho ?? "Sem padrinho",
                hora: r.hora ?? "",
                data: r.data,
                pontosEvidencia: r.pontosEvidencia,
                pontosAutoavaliacao: r.pontosAutoavaliacao,
                pontoPossivel: r.pontoPossivel,
                saving: false, saved: false,
            };
        });
        setRows(next);
    }, [baseIndicadores, dbQuery.data, selKey]);

    // ── Padrinhos do JSON ──────────────────────────────────────────────────
    useEffect(() => {
        if (!data?.padrinhos) return;
        setPadrinhos(prev => Array.from(new Set(["Sem padrinho", ...data.padrinhos, ...prev])));
    }, [data]);

    // ── Limpar filtros ao mudar seleção ────────────────────────────────────
    useEffect(() => {
        setFBusca(""); setFMacro(""); setFMicro(""); setFPiramide(""); setFEvid(""); setFAutoav("");
    }, [selectedRevenda, selectedAno, selectedMes]);

    // ── Opções dos selects de filtro ───────────────────────────────────────
    const opcMacro = useMemo(() => Array.from(new Set(baseIndicadores.map(r => r.macroArea))).sort(), [baseIndicadores]);
    const opcMicro = useMemo(() => {
        const b = fMacro ? baseIndicadores.filter(r => r.macroArea === fMacro) : baseIndicadores;
        return Array.from(new Set(b.map(r => r.microArea))).sort();
    }, [baseIndicadores, fMacro]);
    const opcPiramide = useMemo(() => Array.from(new Set(baseIndicadores.map(r => r.piramide))).sort(), [baseIndicadores]);

    // ── Filtro aplicado ────────────────────────────────────────────────────
    const indicadoresFiltrados = useMemo(() => {
        const q = fBusca.toLowerCase().trim();
        return baseIndicadores.filter(r => {
            if (fMacro && r.macroArea !== fMacro) return false;
            if (fMicro && r.microArea !== fMicro) return false;
            if (fPiramide && r.piramide !== fPiramide) return false;
            const st = rows[r.item];
            if (fEvid && st?.evidencia !== fEvid) return false;
            if (fAutoav && st?.autoavaliacao !== fAutoav) return false;
            if (q) {
                const blob = `${r.item} ${r.descricao} ${r.microArea} ${st?.padrinho ?? ""}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }, [baseIndicadores, fMacro, fMicro, fPiramide, fEvid, fAutoav, fBusca, rows]);

    const temFiltro = !!(fBusca || fMacro || fMicro || fPiramide || fEvid || fAutoav);

    // ── KPIs ───────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        let evidSim = 0, autoavSim = 0, ptEvid = 0, ptPoss = 0;
        indicadoresFiltrados.forEach(r => {
            const st = rows[r.item];
            if (!st) return;
            if (st.evidencia === "Sim") evidSim++;
            if (st.autoavaliacao === "Sim") autoavSim++;
            ptEvid += st.pontosEvidencia;
            ptPoss += st.pontoPossivel;
        });
        const total = indicadoresFiltrados.length;
        const pct = ptPoss > 0 ? Math.round(ptEvid / ptPoss * 100) : 0;
        return { total, evidSim, autoavSim, ptEvid, ptPoss, pct };
    }, [indicadoresFiltrados, rows]);

    // ── Persistência no banco ──────────────────────────────────────────────
    const saveToDb = useCallback(async (r: RespostaResultado, st: RowState) => {
        setRows(prev => ({ ...prev, [r.item]: { ...prev[r.item], saving: true, saved: false } }));
        try {
            await upsert.mutateAsync({
                ano: selectedAno, mes: selectedMes,
                data: st.data || r.data,
                operacao: r.operacao,
                revenda: r.revenda,
                item: r.item,
                autoavaliacao: st.autoavaliacao,
                evidencia: st.evidencia,
                padrinho: st.padrinho,
                horaCheck: st.hora,
                macroArea: r.macroArea, microArea: r.microArea, piramide: r.piramide,
                descricao: r.descricao, tipoResposta: r.tipoResposta,
                pontoPossivel: r.pontoPossivel,
                pontosEvidencia: st.pontosEvidencia,
                pontosAutoavaliacao: st.pontosAutoavaliacao,
            });
            setRows(prev => ({ ...prev, [r.item]: { ...prev[r.item], saving: false, saved: true } }));
            setTimeout(() => setRows(prev => ({ ...prev, [r.item]: { ...prev[r.item], saved: false } })), 2500);
        } catch {
            setRows(prev => ({ ...prev, [r.item]: { ...prev[r.item], saving: false } }));
        }
    }, [upsert, selectedAno, selectedMes]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const nowHora = () => {
        const n = new Date();
        return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
    };

    const handleCheck = useCallback((r: RespostaResultado, field: "autoavaliacao" | "evidencia", checked: boolean) => {
        const cur = rows[r.item];
        if (!cur) return;
        const updated: RowState = {
            ...cur,
            [field]: checked ? "Sim" : "Não",
            hora: cur.hora || nowHora(),
            data: cur.data || new Date().toISOString().split("T")[0],
            ...(field === "evidencia" ? { pontosEvidencia: checked ? r.pontoPossivel : 0 } : {}),
            ...(field === "autoavaliacao" ? { pontosAutoavaliacao: checked ? r.pontoPossivel : 0 } : {}),
        };
        setRows(prev => ({ ...prev, [r.item]: updated }));
        saveToDb(r, updated);
    }, [rows, saveToDb]);

    const handlePadrinho = useCallback((r: RespostaResultado, val: string) => {
        if (val === "__novo__") { setNovoInput({ rowKey: r.item, text: "" }); return; }
        const updated = { ...rows[r.item], padrinho: val };
        setRows(prev => ({ ...prev, [r.item]: updated }));
        saveToDb(r, updated);
    }, [rows, saveToDb]);

    const confirmarNovo = useCallback((r: RespostaResultado) => {
        if (!novoInput) return;
        const nome = novoInput.text.trim();
        if (!nome) { setNovoInput(null); return; }
        if (!padrinhos.includes(nome)) setPadrinhos(prev => [...prev, nome]);
        const updated = { ...rows[r.item], padrinho: nome };
        setRows(prev => ({ ...prev, [r.item]: updated }));
        saveToDb(r, updated);
        setNovoInput(null);
    }, [novoInput, padrinhos, rows, saveToDb]);

    // ── Helpers visuais ────────────────────────────────────────────────────
    const selCls = "text-xs bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200";
    const pctColor = (p: number) => p >= 80 ? "#22C55E" : p >= 50 ? "#F59E0B" : "#EF4444";
    const CS = "0 1px 4px rgba(0,0,0,0.04)";

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">

            {/* ── Linha 1: Ano + Revenda ──────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-6"
                style={{ border: cardBorder, boxShadow: CS }}>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Ano</label>
                    <select value={selectedAno} onChange={e => { setSelectedAno(Number(e.target.value)); initRef.current = ""; }} className={selCls}>
                        {anos.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Revenda / Operação</label>
                    <select value={selectedRevenda} onChange={e => { setSelectedRevenda(e.target.value); initRef.current = ""; }} className={selCls}>
                        <option value="">— selecione —</option>
                        {revendas.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                {dbQuery.isFetching && <span className="text-xs text-indigo-400 animate-pulse">Carregando banco…</span>}
                {dbQuery.isError && <span className="text-xs text-amber-500">Banco indisponível — usando dados locais</span>}
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                    {MESES[selectedMes - 1].label}/{selectedAno}{selectedRevenda ? ` · ${selectedRevenda}` : ""}
                </span>
            </div>

            {/* ── Linha 2: Filtros ─────────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4"
                style={{ border: cardBorder, boxShadow: CS }}>
                <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>
                    <Filter className="w-3.5 h-3.5" /> Filtros
                </span>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-3 py-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input type="text" placeholder="Buscar indicador…" value={fBusca} onChange={e => setFBusca(e.target.value)}
                        className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none w-36" style={{ fontWeight: 500 }} />
                    {fBusca && <button onClick={() => setFBusca("")}><X className="w-3 h-3 text-slate-400" /></button>}
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Macro Área</label>
                    <select value={fMacro} onChange={e => { setFMacro(e.target.value); setFMicro(""); }} className={selCls}>
                        <option value="">Todas</option>{opcMacro.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Micro Área</label>
                    <select value={fMicro} onChange={e => setFMicro(e.target.value)} className={selCls}>
                        <option value="">Todas</option>{opcMicro.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Pirâmide</label>
                    <select value={fPiramide} onChange={e => setFPiramide(e.target.value)} className={selCls}>
                        <option value="">Todas</option>{opcPiramide.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Evidência</label>
                    <select value={fEvid} onChange={e => setFEvid(e.target.value)} className={selCls}>
                        <option value="">Todos</option><option value="Sim">Sim</option><option value="Não">Não</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>Autoavaliação</label>
                    <select value={fAutoav} onChange={e => setFAutoav(e.target.value)} className={selCls}>
                        <option value="">Todos</option><option value="Sim">Sim</option><option value="Não">Não</option>
                    </select>
                </div>
                {temFiltro && (
                    <button onClick={() => { setFBusca(""); setFMacro(""); setFMicro(""); setFPiramide(""); setFEvid(""); setFAutoav(""); }}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--accent)] transition-all"
                        style={{ fontWeight: 600 }}>
                        <X className="w-3.5 h-3.5" /> Limpar
                    </button>
                )}
            </div>

            {/* ── Linha 3: Tabs meses ──────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-3 flex items-center gap-1 overflow-x-auto"
                style={{ border: cardBorder, boxShadow: CS }}>
                {MESES.map(m => {
                    const ativo = selectedMes === m.num;
                    const temDados = mesesComDados.has(m.num);
                    return (
                        <button key={m.num} onClick={() => { setSelectedMes(m.num); initRef.current = ""; }}
                            className={classNames(
                                "relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs transition-all whitespace-nowrap",
                                ativo ? "bg-indigo-500 text-white shadow-sm"
                                    : temDados ? "bg-slate-100 dark:bg-[var(--accent)] text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                        : "text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-[var(--accent)] opacity-60",
                            )} style={{ fontWeight: 700 }}>
                            {m.label}
                            {temDados && <span className={classNames("w-1.5 h-1.5 rounded-full", ativo ? "bg-white/70" : "bg-emerald-400")} />}
                        </button>
                    );
                })}
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 pl-4 shrink-0">
                    {mesesComDados.size} {mesesComDados.size === 1 ? "mês" : "meses"} com dados
                </span>
            </div>

            {/* ── KPIs ─────────────────────────────────────────────────── */}
            {kpis.total > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                        { label: "Indicadores", valor: kpis.total, sub: "No filtro atual" },
                        { label: "Evidência ✓", valor: kpis.evidSim, sub: `${Math.round(kpis.evidSim / kpis.total * 100)}% respondidos` },
                        { label: "Autoav. ✓", valor: kpis.autoavSim, sub: `${Math.round(kpis.autoavSim / kpis.total * 100)}% respondidos` },
                        { label: "Pts Evidência", valor: kpis.ptEvid, sub: `de ${kpis.ptPoss} possíveis` },
                        { label: "Aderência", valor: `${kpis.pct}%`, sub: "Pts evidência / possíveis" },
                    ].map(k => (
                        <div key={k.label} className="bg-white dark:bg-[var(--card)] rounded-2xl p-4" style={{ border: cardBorder, boxShadow: CS }}>
                            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider" style={{ fontWeight: 700 }}>{k.label}</p>
                            <p className="text-2xl text-slate-800 dark:text-slate-100 mt-1 tabular-nums" style={{ fontWeight: 900 }}>{k.valor}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>{k.sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Tabela CRUD ───────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden" style={{ border: cardBorder, boxShadow: CS }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <PenLine className="w-4 h-4 text-indigo-500" />
                            Formulário de Respostas — {MESES[selectedMes - 1].label}/{selectedAno}
                            {selectedRevenda && <span className="text-indigo-500"> · {selectedRevenda}</span>}
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {indicadoresFiltrados.length} de {baseIndicadores.length} indicadores · salvo automaticamente ao alterar
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 inline-block" />Sim
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 inline-block" />Não
                        </span>
                    </div>
                </div>

                {!selectedRevenda ? (
                    <div className="px-5 py-20 text-center space-y-3">
                        <PenLine className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-700" />
                        <p className="text-sm text-slate-400 dark:text-slate-500">Selecione uma revenda para registrar as respostas do período.</p>
                    </div>
                ) : baseIndicadores.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <p className="text-sm text-slate-400 dark:text-slate-500">Sem indicadores para esta revenda.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Item</th>
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Descrição</th>
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Área</th>
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Pirâmide</th>
                                    <th className="px-3 py-3 text-center w-24" style={{ fontWeight: 700 }}>Autoav.</th>
                                    <th className="px-3 py-3 text-center w-24" style={{ fontWeight: 700 }}>Evidência</th>
                                    <th className="px-3 py-3 text-left" style={{ fontWeight: 700 }}>Padrinho</th>
                                    <th className="px-3 py-3 text-center w-20" style={{ fontWeight: 700 }}>Hora</th>
                                    <th className="px-3 py-3 text-right w-20" style={{ fontWeight: 700 }}>Pts</th>
                                    <th className="px-3 py-3 w-8" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                {indicadoresFiltrados.map(r => {
                                    const st = rows[r.item];
                                    if (!st) return null;
                                    const corP = PIRAMIDE_COR[r.piramide] || "#94A3B8";
                                    const isEvid = st.evidencia === "Sim";
                                    const isAutoav = st.autoavaliacao === "Sim";
                                    const isNovoThis = novoInput?.rowKey === r.item;
                                    return (
                                        <tr key={r.item} className={classNames(
                                            "transition-colors",
                                            (isEvid || isAutoav) ? "bg-emerald-50/40 dark:bg-emerald-500/5" : "hover:bg-slate-50/80 dark:hover:bg-[var(--accent)]/40",
                                        )}>
                                            {/* Item */}
                                            <td className="px-3 py-2.5">
                                                <span className="font-mono text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>{r.item}</span>
                                            </td>
                                            {/* Descrição */}
                                            <td className="px-3 py-2.5 max-w-[200px]">
                                                <p className="text-slate-600 dark:text-slate-300 truncate" title={r.descricao} style={{ fontWeight: 500 }}>{r.descricao}</p>
                                                <p className="text-slate-400 dark:text-slate-500 text-[10px]">{r.tipoResposta}</p>
                                            </td>
                                            {/* Área */}
                                            <td className="px-3 py-2.5">
                                                <p className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 600 }}>{r.macroArea}</p>
                                                <p className="text-slate-400 dark:text-slate-500">{r.microArea}</p>
                                            </td>
                                            {/* Pirâmide */}
                                            <td className="px-3 py-2.5">
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px]" style={{ background: `${corP}33`, color: corP, fontWeight: 700 }}>{r.piramide}</span>
                                            </td>
                                            {/* Autoavaliação */}
                                            <td className="px-3 py-2.5 text-center">
                                                <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                                                    <div className={classNames(
                                                        "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                                                        isAutoav ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white dark:bg-[var(--input)] border-slate-300 dark:border-slate-600 hover:border-emerald-400",
                                                    )}>
                                                        <input type="checkbox" className="sr-only" checked={isAutoav} onChange={e => handleCheck(r, "autoavaliacao", e.target.checked)} />
                                                        {isAutoav && <CheckCircle2 className="w-4 h-4" />}
                                                    </div>
                                                    <span className={classNames("text-[10px]", isAutoav ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")} style={{ fontWeight: 700 }}>
                                                        {st.autoavaliacao}
                                                    </span>
                                                </label>
                                            </td>
                                            {/* Evidência */}
                                            <td className="px-3 py-2.5 text-center">
                                                <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                                                    <div className={classNames(
                                                        "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                                                        isEvid ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white dark:bg-[var(--input)] border-slate-300 dark:border-slate-600 hover:border-indigo-400",
                                                    )}>
                                                        <input type="checkbox" className="sr-only" checked={isEvid} onChange={e => handleCheck(r, "evidencia", e.target.checked)} />
                                                        {isEvid && <FileCheck2 className="w-4 h-4" />}
                                                    </div>
                                                    <span className={classNames("text-[10px]", isEvid ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} style={{ fontWeight: 700 }}>
                                                        {st.evidencia}
                                                    </span>
                                                </label>
                                            </td>
                                            {/* Padrinho */}
                                            <td className="px-3 py-2.5">
                                                {isNovoThis ? (
                                                    <div className="flex items-center gap-1">
                                                        <input autoFocus type="text" value={novoInput.text}
                                                            onChange={e => setNovoInput({ rowKey: r.item, text: e.target.value })}
                                                            onKeyDown={e => { if (e.key === "Enter") confirmarNovo(r); if (e.key === "Escape") setNovoInput(null); }}
                                                            placeholder="Nome do padrinho…"
                                                            className="text-xs border border-indigo-300 dark:border-indigo-500/50 rounded-lg px-2 py-1 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 dark:text-slate-200 w-32"
                                                            style={{ fontWeight: 500 }} />
                                                        <button onClick={() => confirmarNovo(r)}
                                                            className="text-xs px-2 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors" style={{ fontWeight: 700 }}>✓</button>
                                                        <button onClick={() => setNovoInput(null)}
                                                            className="text-xs px-1.5 py-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[var(--accent)] transition-colors">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <select value={st.padrinho} onChange={e => handlePadrinho(r, e.target.value)}
                                                        className={classNames(
                                                            "text-xs rounded-lg px-2 py-1 border focus:outline-none focus:ring-2 focus:ring-indigo-200 w-full max-w-[185px]",
                                                            st.padrinho === "Sem padrinho"
                                                                ? "bg-slate-50 dark:bg-[var(--input)] border-slate-200 dark:border-[var(--border)] text-slate-400 dark:text-slate-500"
                                                                : "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
                                                        )} style={{ fontWeight: st.padrinho === "Sem padrinho" ? 400 : 700 }}>
                                                        {padrinhos.map(p => <option key={p} value={p}>{p}</option>)}
                                                        <option disabled>──────────</option>
                                                        <option value="__novo__">➕ Adicionar padrinho…</option>
                                                    </select>
                                                )}
                                            </td>
                                            {/* Hora — auto-capturada */}
                                            <td className="px-3 py-2.5 text-center tabular-nums text-slate-500 dark:text-slate-400">
                                                {st.hora || <span className="text-slate-300 dark:text-slate-600">—</span>}
                                            </td>
                                            {/* Pts */}
                                            <td className="px-3 py-2.5 text-right tabular-nums">
                                                <span style={{ fontWeight: 800, color: isEvid ? "#22C55E" : "#94A3B8" }}>{st.pontosEvidencia}</span>
                                                <span className="text-slate-300 dark:text-slate-600">/{r.pontoPossivel}</span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-2 py-2.5 text-center">
                                                {st.saving
                                                    ? <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mx-auto" />
                                                    : st.saved
                                                        ? <div className="w-3 h-3 rounded-full bg-emerald-400 mx-auto" title="Salvo" />
                                                        : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {kpis.total > 0 && (
                                <tfoot className="bg-slate-50 dark:bg-[var(--accent)] border-t-2 border-slate-100 dark:border-[var(--sidebar-border)]">
                                    <tr>
                                        <td colSpan={8} className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>
                                            Total ({indicadoresFiltrados.length} itens) · Evidência: {kpis.evidSim} Sim · Autoav.: {kpis.autoavSim} Sim
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums text-xs" style={{ fontWeight: 900, color: pctColor(kpis.pct) }}>
                                            {kpis.ptEvid}/{kpis.ptPoss}
                                            <span className="text-slate-400 font-normal ml-1">({kpis.pct}%)</span>
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>

            <div className="text-center py-1">
                <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                    MetricFlow · Respostas · {MESES[selectedMes - 1].label}/{selectedAno}{selectedRevenda ? ` · ${selectedRevenda}` : ""}
                </p>
            </div>
        </div>
    );
}
