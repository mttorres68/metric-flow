import { Fragment, useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
    Users, UserCheck, UserPlus, Phone, Briefcase, BarChart2,
    Download, CheckCircle2, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { exportarPdfAlocacao } from "@/lib/pdfExport";
import { classNames, corRevenda, pctColor, PIRAMIDE_COR } from "../constants";
import type { Indicador } from "../types";
import { KpiCard } from "../components/KpiCard";

// ─── Utils ────────────────────────────────────────────────────────────────────
function setColWidths(ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    ws["!cols"] = keys.map(k => ({
        wch: Math.min(60, Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2),
    }));
}

// ─── Tipos locais ─────────────────────────────────────────────────────────────
type ItemSemResp = { item: string; macroArea: string; microArea: string; descricao: string };
type RevSemResp  = { id: number; nome: string; comResp: number; faltando: ItemSemResp[]; semNenhum: number; totalItens: number };

// ─── Constante de meses ───────────────────────────────────────────────────────
const MESES_RES = [
    { num: 1, label: "Jan" }, { num: 2, label: "Fev" }, { num: 3, label: "Mar" },
    { num: 4, label: "Abr" }, { num: 5, label: "Mai" }, { num: 6, label: "Jun" },
    { num: 7, label: "Jul" }, { num: 8, label: "Ago" }, { num: 9, label: "Set" },
    { num: 10, label: "Out" }, { num: 11, label: "Nov" }, { num: 12, label: "Dez" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SemResponsavelList — lista colapsável de itens sem responsável por revenda
// ─────────────────────────────────────────────────────────────────────────────
function SemResponsavelList({ data, allStats, onSelectRevenda, cardBorder, cardShadow }: {
    data: RevSemResp[];
    allStats: RevSemResp[];
    onSelectRevenda: (id: number) => void;
    cardBorder: string;
    cardShadow: string;
}) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const toggle = (id: number) =>
        setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const total = data.reduce((s, r) => s + r.faltando.length, 0);

    function handleExport() {
        exportarPdfAlocacao(allStats.map(r => ({
            nome: r.nome,
            totalItens: r.totalItens,
            comResp: r.comResp,
            faltando: r.faltando,
        })));
    }

    return (
        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
            style={{ border: cardBorder, boxShadow: cardShadow }}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center justify-between">
                <h3 className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                    Itens sem responsável
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" style={{ fontWeight: 700 }}>
                        {total} pendente{total !== 1 ? "s" : ""} no total
                    </span>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        style={{ fontWeight: 700 }}>
                        <Download className="w-3.5 h-3.5" /> Baixar PDF
                    </button>
                </div>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                {data.filter(r => r.faltando.length > 0).map(rev => {
                    const isOpen = expanded.has(rev.id);
                    const macros = Array.from(new Set(rev.faltando.map(i => i.macroArea))).sort();
                    return (
                        <div key={rev.id}>
                            {/* Header da revenda */}
                            <button
                                onClick={() => toggle(rev.id)}
                                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-[var(--accent)]/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    {isOpen
                                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                    <span className="text-xs text-slate-800 dark:text-slate-100" style={{ fontWeight: 700 }}>
                                        {rev.nome}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" style={{ fontWeight: 700 }}>
                                        {rev.faltando.length} item{rev.faltando.length !== 1 ? "s" : ""}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Mini barra */}
                                    <div className="w-24 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                        <div className="h-full rounded-full bg-rose-400"
                                            style={{ width: `${Math.round(rev.faltando.length / rev.totalItens * 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] text-rose-500 dark:text-rose-400 w-8 text-right tabular-nums" style={{ fontWeight: 700 }}>
                                        {Math.round(rev.faltando.length / rev.totalItens * 100)}%
                                    </span>
                                    <button
                                        onClick={e => { e.stopPropagation(); onSelectRevenda(rev.id); }}
                                        className="ml-2 text-[10px] px-2 py-0.5 rounded-lg text-indigo-500 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                        style={{ fontWeight: 700 }}>
                                        Ver revenda →
                                    </button>
                                </div>
                            </button>

                            {/* Tabela expandida */}
                            {isOpen && (
                                <div className="border-t border-slate-50 dark:border-[var(--sidebar-border)]">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50/80 dark:bg-[var(--accent)]">
                                            <tr>
                                                <th className="px-5 py-2 text-left text-slate-500 dark:text-slate-400 w-20" style={{ fontWeight: 700 }}>Item</th>
                                                <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 w-32" style={{ fontWeight: 700 }}>Macro Área</th>
                                                <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 w-40" style={{ fontWeight: 700 }}>Micro Área</th>
                                                <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Descrição</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                            {macros.map(macro => (
                                                <Fragment key={macro}>
                                                    <tr className="bg-slate-100/50 dark:bg-[var(--accent)]/60">
                                                        <td colSpan={4} className="px-5 py-1 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ fontWeight: 800 }}>
                                                            {macro}
                                                        </td>
                                                    </tr>
                                                    {rev.faltando.filter(i => i.macroArea === macro).map(i => (
                                                        <tr key={i.item} className="hover:bg-rose-50/30 dark:hover:bg-rose-500/5 transition-colors">
                                                            <td className="px-5 py-2 font-mono text-rose-600 dark:text-rose-400" style={{ fontWeight: 700 }}>{i.item}</td>
                                                            <td className="px-3 py-2 text-slate-400 dark:text-slate-500">{i.macroArea}</td>
                                                            <td className="px-3 py-2 text-slate-400 dark:text-slate-500">{i.microArea}</td>
                                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs">
                                                                <span className="block truncate" title={i.descricao}>{i.descricao}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// EquipeView — CRUD de colaboradores + mapeamento de responsabilidades
// ─────────────────────────────────────────────────────────────────────────────
export function EquipeView({
    indicadores,
    isDark: _dark,
    cardBorder,
    cardShadow,
}: {
    indicadores: Indicador[];
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
}) {
    const now = new Date();
    const [revendaId, setRevendaId] = useState<number | null>(null);
    const [subTab, setSubTab] = useState<"visao-geral" | "colaboradores" | "responsabilidades">("visao-geral");
    const [form, setForm] = useState<{ id?: number; nome: string; cargo: string; whatsapp: string } | null>(null);
    const [selectedAno, setSelectedAno] = useState(now.getFullYear());
    const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);

    const utils = trpc.useUtils();
    const revendasQ = trpc.assessment.listRevendas.useQuery();
    const colaboradoresQ = trpc.assessment.listColaboradores.useQuery(
        { revendaId: revendaId ?? undefined },
        { enabled: revendaId !== null },
    );
    const responsabilidadesQ = trpc.assessment.listResponsabilidades.useQuery(
        { revendaId: revendaId! },
        { enabled: revendaId !== null },
    );

    const upsertColab = trpc.assessment.upsertColaborador.useMutation({
        onSuccess: () => {
            utils.assessment.listColaboradores.invalidate();
            toast.success("Colaborador salvo!");
            setForm(null);
        },
        onError: () => toast.error("Erro ao salvar colaborador"),
    });

    const upsertResp = trpc.assessment.upsertResponsabilidade.useMutation({
        onSuccess: () => utils.assessment.listResponsabilidades.invalidate(),
        onError: () => toast.error("Erro ao salvar responsabilidade"),
    });

    const colabs = colaboradoresQ.data ?? [];

    const respMap = useMemo(() => {
        const m = new Map<string, { responsavelId: number | null; apoioId: number | null }>();
        responsabilidadesQ.data?.forEach(r => {
            m.set(r.item, { responsavelId: r.responsavelId ?? null, apoioId: r.apoioId ?? null });
        });
        return m;
    }, [responsabilidadesQ.data]);

    const itensList = useMemo(() => {
        const extractCode = (id: string) => id.match(/^([A-Z]+\d+)/)?.[1] ?? id.split(" - ")[0].trim();
        const seen = new Set<string>();
        return indicadores
            .filter(i => {
                const cod = extractCode(i.idIndicador);
                if (seen.has(cod)) return false;
                seen.add(cod);
                return true;
            })
            .map(i => ({
                item: extractCode(i.idIndicador),
                macroArea: i.macroArea,
                microArea: i.microArea,
                descricao: i.descricaoItem,
            }));
    }, [indicadores]);

    const macroGroups = useMemo(() => {
        const groups = new Map<string, typeof itensList>();
        itensList.forEach(i => {
            if (!groups.has(i.macroArea)) groups.set(i.macroArea, []);
            groups.get(i.macroArea)!.push(i);
        });
        return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [itensList]);

    const revendaNome = revendasQ.data?.find(r => r.id === revendaId)?.nome ?? "";

    const alocacaoStats = useMemo(() => {
        const total = itensList.length;
        let comResp = 0, comApoio = 0, completo = 0, semNenhum = 0;

        const porMacro = macroGroups.map(([macro, items]) => {
            let mResp = 0, mApoio = 0;
            items.forEach(i => {
                const cur = respMap.get(i.item);
                if (cur?.responsavelId) mResp++;
                if (cur?.apoioId) mApoio++;
            });
            return { macro, total: items.length, comResp: mResp, comApoio: mApoio };
        });

        itensList.forEach(i => {
            const cur = respMap.get(i.item);
            const hasR = !!(cur?.responsavelId);
            const hasA = !!(cur?.apoioId);
            if (hasR) comResp++;
            if (hasA) comApoio++;
            if (hasR && hasA) completo++;
            if (!hasR && !hasA) semNenhum++;
        });

        return { total, comResp, comApoio, completo, semNenhum, porMacro };
    }, [itensList, macroGroups, respMap]);

    const statusQuery = trpc.assessment.list.useQuery(
        { revenda: revendaNome, ano: selectedAno, mes: selectedMes },
        { enabled: revendaId !== null && !!revendaNome && subTab === "responsabilidades" },
    );

    const statusMap = useMemo(() => {
        const m = new Map<string, string | null>();
        statusQuery.data?.forEach(r => m.set(r.item, r.statusFinal ?? null));
        return m;
    }, [statusQuery.data]);

    const allRespQ = trpc.assessment.listAllResponsabilidades.useQuery(
        undefined,
        { enabled: revendaId === null && subTab === "visao-geral" },
    );

    // ── Queries e estado para export Excel ────────────────────────────────
    const colaborsTodosQ = trpc.assessment.listColaboradores.useQuery({});
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [exporting, setExporting] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showExportMenu) return;
        const handler = (e: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node))
                setShowExportMenu(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showExportMenu]);

    const colaborAllMap = useMemo(() => {
        const m: Record<number, string> = {};
        colaborsTodosQ.data?.forEach(c => { m[c.id] = c.nome; });
        return m;
    }, [colaborsTodosQ.data]);

    const exportarRevenda = useCallback(async () => {
        if (!revendaId || !revendaNome) return;
        setExporting(true);
        try {
            const exportRows: Record<string, unknown>[] = itensList.map(i => {
                const resp = respMap.get(i.item);
                return {
                    "ID": `${revendaId}-${i.item}`,
                    "Revenda": revendaNome,
                    "Item": i.item,
                    "Macro Área": i.macroArea,
                    "Micro Área": i.microArea,
                    "Descrição": i.descricao,
                    "Responsável": resp?.responsavelId ? (colaborAllMap[resp.responsavelId] ?? "") : "",
                    "Apoio": resp?.apoioId ? (colaborAllMap[resp.apoioId] ?? "") : "",
                };
            });
            const ws = XLSX.utils.json_to_sheet(exportRows);
            setColWidths(ws, exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, revendaNome.slice(0, 31));
            XLSX.writeFile(wb, `Responsabilidades_${revendaNome.replace(/\s+/g, "_")}.xlsx`);
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    }, [revendaId, revendaNome, itensList, respMap, colaborAllMap]);

    const exportarTodas = useCallback(async () => {
        setExporting(true);
        try {
            const { data: allRespons } = await allRespQ.refetch();
            const revendasDB = revendasQ.data ?? [];
            const allRows: Record<string, unknown>[] = [];
            for (const rev of revendasDB) {
                const revRespons: Record<string, { responsavelId: number | null; apoioId: number | null }> = {};
                (allRespons ?? []).filter(r => r.revendaId === rev.id).forEach(r => {
                    revRespons[r.item] = { responsavelId: r.responsavelId ?? null, apoioId: r.apoioId ?? null };
                });
                for (const i of itensList) {
                    const resp = revRespons[i.item];
                    allRows.push({
                        "ID": `${rev.id}-${i.item}`,
                        "Revenda": rev.nome,
                        "Item": i.item,
                        "Macro Área": i.macroArea,
                        "Micro Área": i.microArea,
                        "Descrição": i.descricao,
                        "Responsável": resp?.responsavelId ? (colaborAllMap[resp.responsavelId] ?? "") : "",
                        "Apoio": resp?.apoioId ? (colaborAllMap[resp.apoioId] ?? "") : "",
                    });
                }
            }
            const ws = XLSX.utils.json_to_sheet(allRows);
            setColWidths(ws, allRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Todas as Revendas");
            XLSX.writeFile(wb, `Responsabilidades_Todas.xlsx`);
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    }, [allRespQ, revendasQ.data, itensList, colaborAllMap]);

    const allAlocStats = useMemo(() => {
        const revendasDB = revendasQ.data ?? [];
        const totalItens = itensList.length;
        return revendasDB.map(rev => {
            const rows = (allRespQ.data ?? []).filter(r => r.revendaId === rev.id);
            const comResp  = rows.filter(r => r.responsavelId).length;
            const comApoio = rows.filter(r => r.apoioId).length;
            const completo = rows.filter(r => r.responsavelId && r.apoioId).length;
            const pct = totalItens > 0 ? Math.round(comResp / totalItens * 100) : 0;
            return { id: rev.id, nome: rev.nome, comResp, comApoio, completo, semNenhum: totalItens - comResp, pct, totalItens };
        }).sort((a, b) => b.pct - a.pct);
    }, [allRespQ.data, revendasQ.data, itensList]);

    const semRespPorRevenda = useMemo(() => {
        return allAlocStats.map(rev => {
            const alocados = new Set(
                (allRespQ.data ?? [])
                    .filter(r => r.revendaId === rev.id && r.responsavelId)
                    .map(r => r.item),
            );
            const faltando = itensList.filter(i => !alocados.has(i.item));
            return { ...rev, faltando };
        });
    }, [allAlocStats, allRespQ.data, itensList]);

    return (
        <div className="space-y-6">
            {/* Seletor de revenda */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 flex flex-wrap gap-2 items-center"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <span className="text-xs text-slate-500 dark:text-slate-400 mr-2" style={{ fontWeight: 700 }}>
                    <Users className="w-3.5 h-3.5 inline mr-1" /> Revenda
                </span>
                {revendasQ.isLoading && <span className="text-xs text-slate-400">Carregando revendas…</span>}
                {/* Botão "Todas" */}
                <button
                    onClick={() => setRevendaId(null)}
                    className={classNames(
                        "text-xs px-3 py-1.5 rounded-lg border transition-all",
                        revendaId === null
                            ? "bg-indigo-500 text-white border-indigo-500"
                            : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                    )}
                    style={{ fontWeight: 700 }}>
                    Todas
                </button>
                {revendasQ.data?.map(r => (
                    <button key={r.id}
                        onClick={() => setRevendaId(r.id)}
                        className={classNames(
                            "text-xs px-3 py-1.5 rounded-lg border transition-all",
                            revendaId === r.id
                                ? "bg-indigo-500 text-white border-indigo-500"
                                : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                        )}
                        style={{ fontWeight: 700 }}>
                        {r.nome}
                    </button>
                ))}
            </div>

            <>
                    {/* Sub-tabs */}
                    <div className="flex items-center gap-2">
                        {([
                            { id: "visao-geral",       label: "Visão Geral",       icon: <BarChart2 className="w-3.5 h-3.5" /> },
                            { id: "colaboradores",     label: "Colaboradores",     icon: <Briefcase className="w-3.5 h-3.5" /> },
                            { id: "responsabilidades", label: "Responsabilidades", icon: <UserCheck className="w-3.5 h-3.5" /> },
                        ] as const).map(t => (
                            <button key={t.id}
                                onClick={() => setSubTab(t.id)}
                                disabled={revendaId === null && t.id !== "visao-geral"}
                                className={classNames(
                                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all",
                                    subTab === t.id
                                        ? "bg-indigo-500 text-white border-indigo-500"
                                        : "bg-white dark:bg-[var(--card)] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-[var(--accent)]",
                                    revendaId === null && t.id !== "visao-geral" && "opacity-40 cursor-not-allowed",
                                )}
                                style={{ fontWeight: 700 }}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Visão Geral ──────────────────────────────────────── */}
                    {subTab === "visao-geral" && revendaId === null && (
                        <div className="space-y-4">
                            {allRespQ.isLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* KPI totais consolidados */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: "Itens por revenda",       value: itensList.length,                                                                                    color: "text-slate-700 dark:text-slate-200",     bg: "bg-slate-50 dark:bg-[var(--accent)]" },
                                            { label: "Média de alocação",       value: `${Math.round(allAlocStats.reduce((s, r) => s + r.pct, 0) / (allAlocStats.length || 1))}%`,    color: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-50 dark:bg-indigo-500/10" },
                                            { label: "Com responsável (total)", value: allAlocStats.reduce((s, r) => s + r.comResp, 0),                                               color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
                                            { label: "Sem responsável (total)", value: allAlocStats.reduce((s, r) => s + r.semNenhum, 0),                                             color: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-500/10" },
                                        ].map(k => (
                                            <div key={k.label} className={`${k.bg} rounded-2xl p-4 flex flex-col gap-1`}
                                                style={{ border: cardBorder, boxShadow: cardShadow }}>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>{k.label}</span>
                                                <span className={`text-3xl tabular-nums ${k.color}`} style={{ fontWeight: 900 }}>{k.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Ranking de barras comparativo */}
                                    <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                                        style={{ border: cardBorder, boxShadow: cardShadow }}>
                                        <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center justify-between">
                                            <h3 className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                                                Ranking de alocação — todas as revendas
                                            </h3>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-400 inline-block" /> Com responsável</span>
                                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700 inline-block" /> Sem responsável</span>
                                            </div>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            {allAlocStats.map((rev, idx) => {
                                                const pct   = rev.totalItens > 0 ? Math.round(rev.comResp / rev.totalItens * 100) : 0;
                                                const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#f43f5e";
                                                return (
                                                    <div key={rev.id}>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] w-5 text-right text-slate-400 tabular-nums" style={{ fontWeight: 700 }}>#{idx + 1}</span>
                                                                <button
                                                                    onClick={() => setRevendaId(rev.id)}
                                                                    className="text-xs text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                                    style={{ fontWeight: 700 }}>
                                                                    {rev.nome}
                                                                </button>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[10px]">
                                                                <span className="text-slate-500 dark:text-slate-400">
                                                                    <span style={{ fontWeight: 700, color }}>{rev.comResp}</span>/{rev.totalItens} itens
                                                                </span>
                                                                <span className="tabular-nums" style={{ fontWeight: 900, color, minWidth: 36, textAlign: "right" }}>
                                                                    {pct}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {/* Barra simples: com responsável / sem responsável */}
                                                        <div className="flex h-5 rounded-lg overflow-hidden">
                                                            <div className="flex items-center justify-center transition-all"
                                                                style={{ width: `${pct}%`, backgroundColor: color }}>
                                                                {rev.comResp >= 5 && (
                                                                    <span className="text-[9px] text-white" style={{ fontWeight: 800 }}>{rev.comResp}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                                {rev.semNenhum >= 5 && (
                                                                    <span className="text-[9px] text-slate-400" style={{ fontWeight: 700 }}>{rev.semNenhum}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {/* Itens sem responsável por revenda */}
                                    {semRespPorRevenda.some(r => r.faltando.length > 0) && (
                                        <SemResponsavelList
                                            data={semRespPorRevenda.filter(r => r.faltando.length > 0)}
                                            allStats={semRespPorRevenda}
                                            onSelectRevenda={setRevendaId}
                                            cardBorder={cardBorder}
                                            cardShadow={cardShadow}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {subTab === "visao-geral" && revendaId !== null && (
                        <div className="space-y-4">
                            {responsabilidadesQ.isLoading ? (
                                <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Carregando…</div>
                            ) : (
                                <>
                                    {/* KPI cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: "Total de itens",    value: alocacaoStats.total,    color: "text-slate-700 dark:text-slate-200", bg: "bg-slate-50 dark:bg-[var(--accent)]" },
                                            { label: "Com responsável",   value: alocacaoStats.comResp,  color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
                                            { label: "Com apoio",         value: alocacaoStats.comApoio, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10" },
                                            { label: "Sem alocação",      value: alocacaoStats.semNenhum, color: "text-rose-600 dark:text-rose-400",   bg: "bg-rose-50 dark:bg-rose-500/10" },
                                        ].map(k => (
                                            <div key={k.label}
                                                className={`${k.bg} rounded-2xl p-4 flex flex-col gap-1`}
                                                style={{ border: cardBorder, boxShadow: cardShadow }}>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ fontWeight: 700 }}>{k.label}</span>
                                                <span className={`text-3xl tabular-nums ${k.color}`} style={{ fontWeight: 900 }}>{k.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Barra de progresso geral */}
                                    <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 space-y-3"
                                        style={{ border: cardBorder, boxShadow: cardShadow }}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-700 dark:text-slate-200" style={{ fontWeight: 800 }}>
                                                Alocação geral — {revendaNome}
                                            </span>
                                            <span className="text-sm tabular-nums" style={{ fontWeight: 900, color: alocacaoStats.comResp / alocacaoStats.total >= 0.8 ? "#10b981" : alocacaoStats.comResp / alocacaoStats.total >= 0.5 ? "#f59e0b" : "#f43f5e" }}>
                                                {alocacaoStats.total > 0 ? Math.round(alocacaoStats.comResp / alocacaoStats.total * 100) : 0}% com responsável
                                            </span>
                                        </div>
                                        {/* Barra simples: com responsável / sem responsável */}
                                        {(() => {
                                            const t    = alocacaoStats.total || 1;
                                            const pct  = Math.round(alocacaoStats.comResp / t * 100);
                                            const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
                                            return (
                                                <div className="flex h-4 rounded-full overflow-hidden">
                                                    <div style={{ width: `${pct}%`, backgroundColor: color }} title={`Com responsável: ${alocacaoStats.comResp}`} />
                                                    <div className="flex-1 bg-slate-200 dark:bg-slate-700" title={`Sem responsável: ${alocacaoStats.semNenhum}`} />
                                                </div>
                                            );
                                        })()}
                                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 inline-block" /> Com responsável ({alocacaoStats.comResp})</span>
                                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-700 inline-block" /> Sem responsável ({alocacaoStats.semNenhum})</span>
                                        </div>
                                    </div>

                                    {/* Tabela por macro área */}
                                    <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                                        style={{ border: cardBorder, boxShadow: cardShadow }}>
                                        <div className="p-5 border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                                            <h3 className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>Por macro área</h3>
                                        </div>
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                                <tr>
                                                    <th className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Macro Área</th>
                                                    <th className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 w-16" style={{ fontWeight: 700 }}>Itens</th>
                                                    <th className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 w-24" style={{ fontWeight: 700 }}>C/ Resp.</th>
                                                    <th className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400 w-48" style={{ fontWeight: 700 }}>Cobertura</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                                {alocacaoStats.porMacro.map(({ macro, total: mt, comResp: mr }) => {
                                                    const pct = mt > 0 ? Math.round(mr / mt * 100) : 0;
                                                    const pctColor = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#f43f5e";
                                                    return (
                                                        <tr key={macro} className="hover:bg-slate-50 dark:hover:bg-[var(--accent)]/50 transition-colors">
                                                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>{macro}</td>
                                                            <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>{mt}</td>
                                                            <td className="px-4 py-2.5 text-right tabular-nums" style={{ fontWeight: 700, color: pctColor }}>{mr}/{mt}</td>
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                                        <div className="h-full rounded-full transition-all"
                                                                            style={{ width: `${pct}%`, backgroundColor: pctColor }} />
                                                                    </div>
                                                                    <span className="text-[10px] tabular-nums w-8 text-right" style={{ fontWeight: 700, color: pctColor }}>{pct}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-slate-50 dark:bg-[var(--accent)] border-t border-slate-200 dark:border-[var(--sidebar-border)]">
                                                <tr>
                                                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200" style={{ fontWeight: 800 }}>Total</td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200" style={{ fontWeight: 800 }}>{alocacaoStats.total}</td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ fontWeight: 800, color: alocacaoStats.total > 0 ? (alocacaoStats.comResp / alocacaoStats.total >= 0.8 ? "#10b981" : "#f59e0b") : undefined }}>
                                                        {alocacaoStats.comResp}/{alocacaoStats.total}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                                <div className="h-full rounded-full bg-emerald-400 transition-all"
                                                                    style={{ width: `${alocacaoStats.total > 0 ? Math.round(alocacaoStats.comResp / alocacaoStats.total * 100) : 0}%` }} />
                                                            </div>
                                                            <span className="text-[10px] tabular-nums w-8 text-right text-emerald-500" style={{ fontWeight: 800 }}>
                                                                {alocacaoStats.total > 0 ? Math.round(alocacaoStats.comResp / alocacaoStats.total * 100) : 0}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Colaboradores ────────────────────────────────────── */}
                    {subTab === "colaboradores" && revendaId === null && (
                        <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
                            <Users className="w-4 h-4" />
                            Selecione uma revenda para ver os colaboradores.
                        </div>
                    )}
                    {subTab === "colaboradores" && revendaId !== null && (
                        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                            style={{ border: cardBorder, boxShadow: cardShadow }}>
                            <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                                <h3 className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                                    Equipe — {revendaNome}
                                </h3>
                                <button
                                    onClick={() => setForm({ nome: "", cargo: "", whatsapp: "" })}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                                    style={{ fontWeight: 700 }}>
                                    <UserPlus className="w-3.5 h-3.5" /> Novo colaborador
                                </button>
                            </div>

                            {/* Formulário inline */}
                            {form && (
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-500/30 flex flex-wrap gap-3 items-end">
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" style={{ fontWeight: 600 }}>Nome</label>
                                        <input type="text"
                                            value={form.nome}
                                            onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))}
                                            placeholder="Nome completo"
                                            className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-48"
                                            style={{ fontWeight: 500 }} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" style={{ fontWeight: 600 }}>Cargo</label>
                                        <input type="text"
                                            value={form.cargo}
                                            onChange={e => setForm(f => f && ({ ...f, cargo: e.target.value }))}
                                            placeholder="Ex: Gerente"
                                            className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-36"
                                            style={{ fontWeight: 500 }} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" style={{ fontWeight: 600 }}>
                                            <Phone className="w-3 h-3 inline mr-0.5" /> WhatsApp
                                        </label>
                                        <input type="text"
                                            value={form.whatsapp}
                                            onChange={e => setForm(f => f && ({ ...f, whatsapp: e.target.value }))}
                                            placeholder="5551999999999"
                                            className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-40"
                                            style={{ fontWeight: 500 }} />
                                    </div>
                                    <button
                                        disabled={!form.nome.trim() || upsertColab.isPending}
                                        onClick={() => upsertColab.mutate({ ...form, revendaId: revendaId! })}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                        style={{ fontWeight: 700 }}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {upsertColab.isPending ? "Salvando…" : "Salvar"}
                                    </button>
                                    <button onClick={() => setForm(null)}
                                        className="text-xs p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[var(--accent)] transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-[var(--accent)]">
                                    <tr>
                                        {["Nome", "Cargo", "WhatsApp", "Ativo", ""].map(h => (
                                            <th key={h} className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                    {colaboradoresQ.isLoading && (
                                        <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Carregando…</td></tr>
                                    )}
                                    {!colaboradoresQ.isLoading && colabs.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Nenhum colaborador cadastrado.</td></tr>
                                    )}
                                    {colabs.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-[var(--accent)]/50 transition-colors">
                                            <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200" style={{ fontWeight: 600 }}>{c.nome}</td>
                                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{c.cargo || "—"}</td>
                                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono">{c.whatsapp || "—"}</td>
                                            <td className="px-4 py-2.5">
                                                <span className={`w-2 h-2 rounded-full inline-block ${c.ativo ? "bg-emerald-400" : "bg-slate-300 dark:bg-slate-600"}`} />
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <button
                                                    onClick={() => setForm({ id: c.id, nome: c.nome, cargo: c.cargo ?? "", whatsapp: c.whatsapp ?? "" })}
                                                    className="text-xs px-2 py-1 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                                    style={{ fontWeight: 600 }}>Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Responsabilidades ────────────────────────────────── */}
                    {subTab === "responsabilidades" && revendaId === null && (
                        <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
                            <UserCheck className="w-4 h-4" />
                            Selecione uma revenda para ver as responsabilidades.
                        </div>
                    )}
                    {subTab === "responsabilidades" && revendaId !== null && (
                        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                            style={{ border: cardBorder, boxShadow: cardShadow }}>
                            <div className="p-5 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex flex-wrap gap-4 items-start justify-between">
                                <div>
                                    <h3 className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                                        Responsabilidades — {revendaNome}
                                    </h3>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                        Defina o responsável direto e o apoio (padrinho) para cada item
                                    </p>
                                    {colabs.length === 0 && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-lg" style={{ fontWeight: 600 }}>
                                            Cadastre colaboradores primeiro para poder atribuir responsabilidades.
                                        </p>
                                    )}
                                </div>
                                {/* Seletor de período para ver status + export */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-slate-400 dark:text-slate-500" style={{ fontWeight: 600 }}>Status de:</span>
                                    <select
                                        value={selectedMes}
                                        onChange={e => setSelectedMes(Number(e.target.value))}
                                        className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                        {MESES_RES.map(m => (
                                            <option key={m.num} value={m.num}>{m.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedAno}
                                        onChange={e => setSelectedAno(Number(e.target.value))}
                                        className="text-xs border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1 bg-white dark:bg-[var(--input)] focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200">
                                        {[2025, 2026, 2027].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                    {/* ── Export Excel ── */}
                                    <div className="relative" ref={exportMenuRef}>
                                        <button
                                            onClick={() => setShowExportMenu(v => !v)}
                                            disabled={exporting}
                                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                            style={{ fontWeight: 700 }}>
                                            {exporting
                                                ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                                : <Download className="w-3.5 h-3.5" />}
                                            Excel
                                        </button>
                                        {showExportMenu && (
                                            <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[var(--card)] rounded-xl shadow-lg border border-slate-200 dark:border-[var(--border)] z-50 overflow-hidden">
                                                <button
                                                    onClick={exportarRevenda}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-[var(--accent)] transition-colors text-left"
                                                    style={{ fontWeight: 600 }}>
                                                    <Download className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                                                    <div>
                                                        <p className="text-slate-700 dark:text-slate-200">Revenda selecionada</p>
                                                        <p className="text-slate-400 dark:text-slate-500" style={{ fontWeight: 400 }}>{revendaNome}</p>
                                                    </div>
                                                </button>
                                                <div className="border-t border-slate-100 dark:border-[var(--sidebar-border)]" />
                                                <button
                                                    onClick={exportarTodas}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-[var(--accent)] transition-colors text-left"
                                                    style={{ fontWeight: 600 }}>
                                                    <Download className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                                    <div>
                                                        <p className="text-slate-700 dark:text-slate-200">Todas as revendas</p>
                                                        <p className="text-slate-400 dark:text-slate-500" style={{ fontWeight: 400 }}>Em um único arquivo</p>
                                                    </div>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-auto max-h-[70vh]">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-[var(--accent)] sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 w-20" style={{ fontWeight: 700 }}>Item</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 w-24" style={{ fontWeight: 700 }}>Status</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Micro Área</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400" style={{ fontWeight: 700 }}>Descrição</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 w-44" style={{ fontWeight: 700 }}>Responsável</th>
                                            <th className="px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 w-44" style={{ fontWeight: 700 }}>Apoio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                                        {macroGroups.map(([macro, items]) => (
                                            <Fragment key={macro}>
                                                <tr className="bg-slate-100/60 dark:bg-[var(--accent)]">
                                                    <td colSpan={6} className="px-3 py-1.5 text-slate-600 dark:text-slate-300 uppercase tracking-wide text-[10px]" style={{ fontWeight: 800 }}>
                                                        {macro}
                                                    </td>
                                                </tr>
                                                {items.map(i => {
                                                    const cur = respMap.get(i.item);
                                                    const st = statusMap.get(i.item);
                                                    const badge = st === "Sim"
                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" style={{ fontWeight: 700 }}>Sim</span>
                                                        : st === "Parcial"
                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" style={{ fontWeight: 700 }}>Parcial</span>
                                                        : st === "Não"
                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" style={{ fontWeight: 700 }}>Não</span>
                                                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500" style={{ fontWeight: 600 }}>—</span>;
                                                    return (
                                                        <tr key={i.item} className="hover:bg-slate-50/60 dark:hover:bg-[var(--accent)]/40 transition-colors">
                                                            <td className="px-3 py-2 font-mono text-indigo-600 dark:text-indigo-400" style={{ fontWeight: 700 }}>{i.item}</td>
                                                            <td className="px-3 py-2">{badge}</td>
                                                            <td className="px-3 py-2 text-slate-400 dark:text-slate-500">{i.microArea}</td>
                                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs">
                                                                <span className="block truncate" title={i.descricao}>{i.descricao}</span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <select
                                                                    value={cur?.responsavelId ?? ""}
                                                                    disabled={colabs.length === 0}
                                                                    onChange={e => upsertResp.mutate({
                                                                        revendaId: revendaId!,
                                                                        item: i.item,
                                                                        responsavelId: e.target.value ? Number(e.target.value) : null,
                                                                        apoioId: cur?.apoioId ?? null,
                                                                    })}
                                                                    className="text-xs bg-white dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-40 disabled:opacity-50"
                                                                    style={{ fontWeight: cur?.responsavelId ? 700 : 400 }}>
                                                                    <option value="">— nenhum —</option>
                                                                    {colabs.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <select
                                                                    value={cur?.apoioId ?? ""}
                                                                    disabled={colabs.length === 0}
                                                                    onChange={e => upsertResp.mutate({
                                                                        revendaId: revendaId!,
                                                                        item: i.item,
                                                                        responsavelId: cur?.responsavelId ?? null,
                                                                        apoioId: e.target.value ? Number(e.target.value) : null,
                                                                    })}
                                                                    className="text-xs bg-white dark:bg-[var(--input)] border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-200 w-40 disabled:opacity-50"
                                                                    style={{ fontWeight: cur?.apoioId ? 700 : 400 }}>
                                                                    <option value="">— nenhum —</option>
                                                                    {colabs.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
        </div>
    );
}
