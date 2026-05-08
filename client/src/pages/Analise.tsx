/*
 * MetricFlow — Análise
 * Visão analítica detalhada por vendedor/dia.
 * Combina métricas existentes (Visitas, Relâmpago, Após 14h) com novas
 * (Heishop, IV, IAV, Tempos, Percurso, Tempo Ñ Atendimento, Ranking Crítico).
 */

import Sidebar from "@/components/Sidebar";
import { trpc } from "@/lib/trpc";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { EditorAnalise, EditorAnaliseHandle } from "@/components/EditorAnalise";
import {
    AlertTriangle, BarChart3,
    Clock, RefreshCw, TrendingDown, TrendingUp, X, FileText, PenLine, Printer,
    MessageCircle, Send, Loader2, CheckCircle2, AlertCircle, User,
    Play, Wifi, WifiOff, SlidersHorizontal, ChevronDown, ChevronUp,
} from "lucide-react";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { generateWordReport } from "@/lib/wordGenerator";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number, decimals = 1) {
    return `${v.toFixed(decimals)}%`;
}

function fmt(v: number | null | undefined, suffix = "") {
    if (v === null || v === undefined) return "—";
    return `${v}${suffix}`;
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
    const styles: Record<string, string> = {
        green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50",
        red: "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50",
        amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/50",
        blue: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/50",
        slate: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600/50",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700/50",
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${styles[color] ?? styles.slate}`}>
            {children}
        </span>
    );
}

// Coluna com tooltip de descrição
function Th({ children, title, center }: { children: React.ReactNode; title?: string; center?: boolean }) {
    return (
        <th
            title={title}
            className={`px-2 py-2.5 text-xs font-bold text-slate-100 uppercase tracking-wider whitespace-nowrap border-b border-slate-100 ${center ? "text-center" : "text-left"} cursor-help`}
        >
            {children}
        </th>
    );
}

function Td({ children, center, mono, className = "" }: {
    children: React.ReactNode; center?: boolean; mono?: boolean; className?: string
}) {
    return (
        <td className={`px-2 py-2 text-xs border-b border-slate-100 dark:border-slate-700/40 ${center ? "text-center" : ""} ${mono ? "font-mono" : ""} ${className}`}>
            {children}
        </td>
    );
}

// ─── Helpers de filtro persistido ─────────────────────────────────────────────

const FILTER_KEY = "metricflow:analises-filters";

// ─── Visibilidade de colunas ──────────────────────────────────────────────────

const COLS_KEY = "metricflow:analise-cols";

const ALL_COLS = [
    { id: "data", label: "Data" },
    { id: "inicio", label: "Início" },
    { id: "fim", label: "Fim" },
    { id: "almoco", label: "Almoço" },
    { id: "apos14h", label: "Após 14h" },
    { id: "visitas", label: "Visitas" },
    { id: "pdv_sem_visita", label: "PDV S/Visita" },
    { id: "relampago", label: "Relâmpago" },
    { id: "sfa", label: "SFA" },
    { id: "heishop", label: "Heishop" },
    { id: "heishop_verif", label: "H. Verif." },
    { id: "iv", label: "IV" },
    { id: "iav", label: "IAV" },
    { id: "atend_35", label: "Atend. >35" },
    { id: "soma_35", label: "Σ >35min" },
    { id: "t_menor", label: "T. Menor" },
    { id: "t_maior", label: "T. Maior" },
    { id: "t_medio", label: "T. Médio" },
    { id: "t_total", label: "T. Total" },
    { id: "soma_percurso", label: "Σ Percurso" },
    { id: "percurso", label: "Maior Percurso" },
    { id: "ini_percurso", label: "Ini. Percurso" },
    { id: "fim_percurso", label: "Fim Percurso" },
    { id: "pdvs_percurso", label: "PDVs p/ Percurso" },
    { id: "t_nao_atend", label: "T. Ñ Atend." },
] as const;

type ColId = typeof ALL_COLS[number]["id"];

function useColumnVisibility() {
    const [visible, setVisible] = useState<Record<ColId, boolean>>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(COLS_KEY) || "null");
            if (stored) return stored;
        } catch { /* ignore */ }
        return Object.fromEntries(ALL_COLS.map(c => [c.id, true])) as Record<ColId, boolean>;
    });

    const toggle = (id: ColId) => setVisible(prev => {
        const next = { ...prev, [id]: !prev[id] };
        localStorage.setItem(COLS_KEY, JSON.stringify(next));
        return next;
    });

    const col = (id: ColId) => visible[id] ?? true;

    const allOn = ALL_COLS.every(c => visible[c.id]);
    const toggleAll = () => {
        const next = Object.fromEntries(ALL_COLS.map(c => [c.id, !allOn])) as Record<ColId, boolean>;
        setVisible(next);
        localStorage.setItem(COLS_KEY, JSON.stringify(next));
    };

    const hiddenCount = ALL_COLS.filter(c => !visible[c.id]).length;

    return { col, toggle, toggleAll, allOn, hiddenCount };
}

function ColumnsSelector({ col, toggle, toggleAll, allOn, hiddenCount }: {
    col: (id: ColId) => boolean;
    toggle: (id: ColId) => void;
    toggleAll: () => void;
    allOn: boolean;
    hiddenCount: number;
}) {
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!open) return;
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
                <SlidersHorizontal size={12} />
                Colunas
                {hiddenCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold leading-none">
                        {hiddenCount}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 mt-1 z-50 bg-white dark:bg-[var(--card)] border border-slate-200 dark:border-[var(--border)] rounded-xl shadow-lg p-3 w-52">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Colunas visíveis</span>
                        <button onClick={toggleAll} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
                            {allOn ? "Ocultar todas" : "Mostrar todas"}
                        </button>
                    </div>
                    <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                        {ALL_COLS.map(c => (
                            <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 px-1 py-0.5 rounded">
                                <input
                                    type="checkbox"
                                    checked={col(c.id)}
                                    onChange={() => toggle(c.id)}
                                    className="accent-indigo-500 w-3.5 h-3.5 shrink-0"
                                />
                                <span className="text-xs text-slate-700 dark:text-slate-200">{c.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Persistência de análises por revenda ─────────────────────────────────────

const ANALISES_REVENDA_KEY = "metricflow:analises-revenda";

function carregarAnalisesRevenda(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(ANALISES_REVENDA_KEY) || "{}"); }
    catch { return {}; }
}

function useAnalisesRevenda(dataInicio: string, dataFim: string) {
    const [analises, setAnalises] = useState<Record<string, string>>(carregarAnalisesRevenda);

    const pkAnalise = (revenda: string) => `${revenda}__${dataInicio}__${dataFim}`;

    const getAnalise = useCallback((revenda: string): string =>
        analises[pkAnalise(revenda)] || "",
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [analises, dataInicio, dataFim]);

    // Carrega do banco usando dataInicio como data de referência (DB tem prioridade)
    const { data: dbAnalises } = trpc.analiseGestor.listarPorData.useQuery(
        { data: dataInicio },
        { staleTime: 60_000, enabled: !!dataInicio }
    );
    useEffect(() => {
        if (!dbAnalises?.length) return;
        setAnalises(prev => {
            const merged = { ...prev };
            dbAnalises.forEach((r: { revenda: string; tipo: string; conteudo: string }) => {
                if (r.tipo === "vendedores") merged[pkAnalise(r.revenda)] = r.conteudo;
            });
            localStorage.setItem(ANALISES_REVENDA_KEY, JSON.stringify(merged));
            return merged;
        });
        // Sincroniza análises de GAs (escritas no RotaCoaching) no localStorage desta página
        const gasStored: Record<string, string> = (() => {
            try { return JSON.parse(localStorage.getItem("metricflow:analises-ga") || "{}"); }
            catch { return {}; }
        })();
        let gasAtualizado = false;
        dbAnalises.forEach((r: { revenda: string; tipo: string; conteudo: string }) => {
            if (r.tipo === "gas") {
                gasStored[`${r.revenda}__${dataInicio}`] = r.conteudo;
                gasAtualizado = true;
            }
        });
        if (gasAtualizado) localStorage.setItem("metricflow:analises-ga", JSON.stringify(gasStored));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbAnalises]);

    const salvarMutation = trpc.analiseGestor.salvar.useMutation();

    const setAnalise = useCallback((revenda: string, html: string) => {
        setAnalises(prev => {
            const next = { ...prev, [pkAnalise(revenda)]: html };
            localStorage.setItem(ANALISES_REVENDA_KEY, JSON.stringify(next));
            return next;
        });
        salvarMutation.mutate({ revenda, data: dataInicio, tipo: "vendedores", conteudo: html });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataInicio, dataFim]);

    // Retorna todas as análises do período atual como { revenda: html }
    const analisesDoPeríodo = useCallback((): Record<string, string> => {
        const resultado: Record<string, string> = {};
        Object.entries(analises).forEach(([key, html]) => {
            if (key.endsWith(`__${dataInicio}__${dataFim}`) && html.trim()) {
                const revenda = key.replace(`__${dataInicio}__${dataFim}`, "");
                resultado[revenda] = html;
            }
        });
        return resultado;
    }, [analises, dataInicio, dataFim]);

    return { getAnalise, setAnalise, analisesDoPeríodo };
}

function loadFilters() {
    try {
        const stored = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}");
        if (!("dataInicio" in stored) && !("dataFim" in stored)) {
            stored.dataInicio = new Date().toISOString().slice(0, 10);
            stored.dataFim = new Date().toISOString().slice(0, 10);
        }
        return stored;
    } catch {
        const today = new Date().toISOString().slice(0, 10);
        return { dataInicio: today, dataFim: today };
    }
}

function useFiltroPersistido() {
    const [filtros, setFiltros] = useState<Record<string, any>>(loadFilters);

    const setFiltro = (k: string, v: any) =>
        setFiltros(prev => {
            const next = { ...prev, [k]: v };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });

    const setFiltrosMulti = (parcial: Record<string, any>) =>
        setFiltros(prev => {
            const next = { ...prev, ...parcial };
            localStorage.setItem(FILTER_KEY, JSON.stringify(next));
            return next;
        });

    const resetFiltros = () => {
        const today = new Date().toISOString().slice(0, 10);
        const defaultFilters = { dataInicio: today, dataFim: today };
        setFiltros(defaultFilters);
        localStorage.setItem(FILTER_KEY, JSON.stringify(defaultFilters));
    };

    const currentToday = new Date().toISOString().slice(0, 10);
    const temFiltro = Object.keys(filtros).some(k => {
        if (k === 'dataInicio' || k === 'dataFim') return filtros[k] !== currentToday && filtros[k] !== "";
        return Boolean(filtros[k]);
    });

    return { filtros, setFiltro, setFiltrosMulti, resetFiltros, temFiltro };
}

// ─── Normalização de nomes de revenda (espelha server/db/whatsapp.ts) ────────

const REVENDA_ALIASES: Record<string, string> = {
    "duttra floriano": "Duttra FL",
    "duttra fl": "Duttra FL",
    "duttra ma": "Duttra MA",
    "duttra srn": "Duttra SR",
    "duttra sr": "Duttra SR",
    "forte aracati": "FORTE AR",
    "forte ar": "FORTE AR",
    "forte quixada": "FORTE QX",
    "forte qx": "FORTE QX",
};

function canonicalRevenda(name: string): string {
    return REVENDA_ALIASES[name.toLowerCase().trim()] ?? name;
}

function revendasMatch(stored: string, query: string): boolean {
    return canonicalRevenda(stored).toLowerCase() === canonicalRevenda(query).toLowerCase();
}

// ─── Geração de mensagens a partir dos checkboxes de ações ────────────────────

type AcaoTipo = "deslocamento" | "problema";
type AcaoVendState = { deslocamento: boolean; problema: boolean };

function listSetores(codigos: string[]): string {
    if (codigos.length === 1) return codigos[0];
    return codigos.slice(0, -1).join(", ") + " e " + codigos[codigos.length - 1];
}

function buildMensagensHTML(vendState: Record<string, AcaoVendState>): string {
    const problemas = Object.entries(vendState)
        .filter(([, v]) => v.problema).map(([k]) => k)
        .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    const deslocamentos = Object.entries(vendState)
        .filter(([, v]) => v.deslocamento).map(([k]) => k)
        .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

    const msgs: string[] = [];

    if (problemas.length === 1)
        msgs.push(`<p>O setor ${problemas[0]} apresentou problema no PathTracker.</p>`);
    else if (problemas.length > 1)
        msgs.push(`<p>Os setores ${listSetores(problemas)} apresentaram problema no PathTracker.</p>`);

    if (deslocamentos.length === 1)
        msgs.push(`<p>O setor ${deslocamentos[0]} realizou deslocamento extenso até o primeiro PDV.</p>`);
    else if (deslocamentos.length > 1)
        msgs.push(`<p>Os setores ${listSetores(deslocamentos)} realizaram deslocamento extenso até o primeiro PDV.</p>`);

    return msgs.join("");
}

// ─── Modal Enviar WhatsApp (batch — todas as revendas) ───────────────────────

type RevStatus = "idle" | "generating" | "sending" | "done" | "error" | "skipped"

interface RevState {
    rev: string;
    dests: string[];        // apelidos dos destinatários associados
    destIds: string[];      // IDs dos destinatários
    selectedDestIds: Set<string>;
    checked: boolean;
    status: RevStatus;
    detail: string;         // mensagem de detalhe do status
}

async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function fetchPDFBase64(
    data: string,
    rev: string,
    analises: Record<string, { vendedores: string; gas: string }>
): Promise<{ base64: string; filename: string }> {
    const resp = await fetch("/api/relatorio/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, revenda: rev, analises }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao gerar PDF");
    }
    const blob = await resp.blob();
    const filename =
        resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `${rev}_${data}.pdf`;
    const base64 = await blobToBase64(blob);
    return { base64, filename };
}

async function fetchThumbnail(pdfBase64: string): Promise<string | null> {
    try {
        const resp = await fetch("/api/relatorio/thumbnail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdf: pdfBase64 }),
        });
        if (!resp.ok) return null;
        const { thumbnail } = await resp.json();
        return thumbnail ?? null;
    } catch {
        return null;
    }
}

async function fetchUnifiedPDFBase64(
    data: string,
    analises: Record<string, { vendedores: string; gas: string }>
): Promise<{ base64: string; filename: string }> {
    const resp = await fetch("/api/relatorio/gerar-unificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, analises }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao gerar PDF unificado");
    }
    const blob = await resp.blob();
    const filename =
        resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `relatorios_unificado_${data}.pdf`;
    const base64 = await blobToBase64(blob);
    return { base64, filename };
}

function EnviarWAModal({
    revendasOrdenadas,
    data,
    getAnalise,
    getAnaliseGAs,
    onClose,
}: {
    revendasOrdenadas: string[];
    data: string;
    getAnalise: (rev: string) => string;
    getAnaliseGAs: (rev: string) => string;
    onClose: () => void;
}) {
    const destQuery = trpc.evolution.listDestinatarios.useQuery();
    const statusQuery = trpc.evolution.getStatus.useQuery();
    const sendPDF = trpc.evolution.sendPDF.useMutation();
    const sendMessage = trpc.evolution.sendMessage.useMutation();

    const [preMsg, setPreMsg] = React.useState("");

    const connected = statusQuery.data?.state === "open";
    const allDests = destQuery.data ?? [];

    const dateLabel = data
        ? new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";

    const WA_SEL_KEY = "metricflow:wa-selecoes";

    function loadSavedSelecoes(): Record<string, { checked: boolean; selectedDestIds: string[] }> {
        try { return JSON.parse(localStorage.getItem(WA_SEL_KEY) || "{}"); }
        catch { return {}; }
    }

    function saveSelecoes(rows: RevState[]) {
        const map: Record<string, { checked: boolean; selectedDestIds: string[] }> = {};
        rows.forEach(r => { map[r.rev] = { checked: r.checked, selectedDestIds: [...r.selectedDestIds] }; });
        localStorage.setItem(WA_SEL_KEY, JSON.stringify(map));
    }

    // Monta estado inicial por revenda
    const buildRows = React.useCallback((): RevState[] => {
        const saved = loadSavedSelecoes();
        return revendasOrdenadas.map(rev => {
            const destsForRev = allDests.filter(d => d.revendas.some(r => revendasMatch(r, rev)));
            const dests = destsForRev.map(d => d.apelido || d.nome);
            const destIds = destsForRev.map(d => d.id);
            const s = saved[rev];
            const selectedDestIds = s
                ? new Set(s.selectedDestIds.filter(id => destIds.includes(id)))
                : new Set(destIds);
            const checked = s ? s.checked && selectedDestIds.size > 0 : dests.length > 0;
            return { rev, dests, destIds, selectedDestIds, checked, status: "idle", detail: "" };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revendasOrdenadas, destQuery.data]);

    const [rows, setRows] = React.useState<RevState[]>([]);
    const [sending, setSending] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [mode, setMode] = React.useState<"byRevenda" | "unified">("byRevenda");
    const [unifiedSelected, setUnifiedSelected] = React.useState<Set<string>>(new Set());
    const [unifiedStatus, setUnifiedStatus] = React.useState<{ status: RevStatus; detail: string }>({ status: "idle", detail: "" });

    // Inicializa quando dados de destinatários carregam
    React.useEffect(() => {
        if (!destQuery.isLoading) {
            setRows(buildRows());
            setUnifiedSelected(new Set(allDests.map(d => d.id)));
        }
    }, [buildRows, destQuery.isLoading]);

    async function handleSendUnified() {
        if (!connected) return;
        const targets = allDests.filter(d => unifiedSelected.has(d.id));
        if (!targets.length) return;

        setSending(true);
        setUnifiedStatus({ status: "generating", detail: "Gerando PDF unificado…" });

        const analisesPayload: Record<string, { vendedores: string; gas: string }> = {};
        revendasOrdenadas.forEach(rev => {
            analisesPayload[rev] = { vendedores: getAnalise(rev), gas: getAnaliseGAs(rev) };
        });

        let base64 = "", filename = "";
        try {
            ({ base64, filename } = await fetchUnifiedPDFBase64(data, analisesPayload));
        } catch (e: any) {
            setUnifiedStatus({ status: "error", detail: `PDF: ${e.message}` });
            setSending(false);
            return;
        }

        // Gera thumbnail da primeira página (silencia erros — é opcional)
        const thumbnail = await fetchThumbnail(base64);

        setUnifiedStatus({ status: "sending", detail: `Enviando para ${targets.length} destinatário(s)…` });
        const caption = `Relatório Unificado — ${dateLabel}`;
        const erros: string[] = [];

        for (const dest of targets) {
            try {
                if (preMsg.trim()) await sendMessage.mutateAsync({ telefone: dest.telefone, texto: preMsg.trim() });
                await sendPDF.mutateAsync({ telefone: dest.telefone, base64, filename, caption, ...(thumbnail ? { thumbnail } : {}) });
            } catch (e: any) {
                erros.push(`${dest.apelido || dest.nome}: ${e.message}`);
            }
        }

        setSending(false);
        setDone(true);
        if (erros.length === 0) {
            setUnifiedStatus({ status: "done", detail: `Enviado para ${targets.length} destinatário(s)` });
            toast.success("PDF unificado enviado!");
        } else {
            setUnifiedStatus({ status: "error", detail: erros[0] });
            toast.error(`${erros.length} falha(s) no envio`);
        }
    }

    function toggleRow(rev: string) {
        setRows(prev => {
            const next = prev.map(r => r.rev === rev ? { ...r, checked: !r.checked } : r);
            saveSelecoes(next);
            return next;
        });
    }

    function toggleDest(rev: string, destId: string) {
        setRows(prev => {
            const next = prev.map(r => {
                if (r.rev !== rev) return r;
                const ids = new Set(r.selectedDestIds);
                ids.has(destId) ? ids.delete(destId) : ids.add(destId);
                return { ...r, selectedDestIds: ids, checked: ids.size > 0 };
            });
            saveSelecoes(next);
            return next;
        });
    }

    function setRowStatus(rev: string, status: RevStatus, detail = "") {
        setRows(prev => prev.map(r => r.rev === rev ? { ...r, status, detail } : r));
    }

    async function handleSend() {
        const targets = rows.filter(r => r.checked);
        if (!targets.length || !connected) return;

        setSending(true);

        // Reseta status das selecionadas
        setRows(prev => prev.map(r =>
            r.checked ? { ...r, status: "idle", detail: "" } : r
        ));

        let totalOk = 0, totalFail = 0;

        for (const row of targets) {
            const { rev } = row;
            const destObjs = allDests.filter(d =>
                d.revendas.some(r => revendasMatch(r, rev)) && row.selectedDestIds.has(d.id)
            );

            if (destObjs.length === 0) {
                setRowStatus(rev, "skipped", "Sem destinatários associados");
                continue;
            }

            // 1. Gerar PDF
            setRowStatus(rev, "generating", "Gerando PDF…");
            let base64 = "", filename = "";
            try {
                ({ base64, filename } = await fetchPDFBase64(data, rev, {
                    [rev]: { vendedores: getAnalise(rev), gas: getAnaliseGAs(rev) },
                }));
            } catch (e: any) {
                setRowStatus(rev, "error", `PDF: ${e.message}`);
                totalFail++;
                continue;
            }

            // 2. Gerar thumbnail (silencia erros — é opcional)
            const thumbnail = await fetchThumbnail(base64);

            // 3. Enviar para cada destinatário
            setRowStatus(rev, "sending", `Enviando para ${destObjs.length} destinatário(s)…`);
            const caption = `Relatório ${rev} — ${dateLabel}`;
            const erros: string[] = [];

            for (const dest of destObjs) {
                try {
                    if (preMsg.trim()) {
                        await sendMessage.mutateAsync({ telefone: dest.telefone, texto: preMsg.trim() });
                    }
                    await sendPDF.mutateAsync({ telefone: dest.telefone, base64, filename, caption, ...(thumbnail ? { thumbnail } : {}) });
                } catch (e: any) {
                    erros.push(`${dest.apelido || dest.nome}: ${e.message}`);
                }
            }

            if (erros.length === 0) {
                setRowStatus(rev, "done", `Enviado para ${destObjs.length} destinatário(s)`);
                totalOk++;
            } else if (erros.length < destObjs.length) {
                setRowStatus(rev, "done", `${destObjs.length - erros.length} ok, ${erros.length} falha`);
                totalOk++;
            } else {
                setRowStatus(rev, "error", erros[0]);
                totalFail++;
            }
        }

        setSending(false);
        setDone(true);
        if (totalFail === 0) toast.success(`Relatórios enviados para ${totalOk} revenda(s)`);
        else toast.error(`${totalFail} revenda(s) com falha`);
    }

    const checkedCount = rows.filter(r => r.checked).length;
    const hasAnyDests = rows.some(r => r.dests.length > 0);

    function StatusIcon({ status }: { status: RevStatus }) {
        if (status === "generating" || status === "sending")
            return <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />;
        if (status === "done")
            return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
        if (status === "error")
            return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
        if (status === "skipped")
            return <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 dark:border-[var(--border)] overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-[var(--border)] shrink-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}>
                        <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Enviar relatórios via WhatsApp</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{dateLabel}</p>
                    </div>
                    <button onClick={onClose} disabled={sending}
                        className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs de modo */}
                <div className="flex border-b border-slate-100 dark:border-[var(--border)] shrink-0">
                    {(["byRevenda", "unified"] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => { setMode(m); setDone(false); setUnifiedStatus({ status: "idle", detail: "" }); }}
                            disabled={sending}
                            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${mode === m
                                ? "border-b-2 border-green-500 text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-900/20"
                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                        >
                            {m === "byRevenda" ? "Por Revenda" : "PDF Unificado"}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

                    {/* Mensagem prévia */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            Mensagem prévia <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional — enviada antes do PDF)</span>
                        </label>
                        <textarea
                            value={preMsg}
                            onChange={e => setPreMsg(e.target.value)}
                            disabled={sending}
                            rows={3}
                            placeholder="Digite aqui uma mensagem de texto que será enviada antes de cada PDF…"
                            className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 px-3 py-2.5 resize-none placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-50 transition"
                        />
                    </div>

                    {/* Aviso WA desconectado */}
                    {!connected && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            WhatsApp desconectado. Conecte em <strong>Configurações → WhatsApp</strong>.
                        </div>
                    )}

                    {destQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs py-4">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando destinatários…
                        </div>
                    ) : mode === "byRevenda" ? (
                        <>
                            {!hasAnyDests && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-xs">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    Nenhuma revenda tem destinatários associados. Configure em <strong>WhatsApp → Destinatários</strong>.
                                </div>
                            )}
                            <div className="space-y-2">
                                {rows.map(row => (
                                    <div key={row.rev}
                                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${row.checked ? "bg-indigo-50/70 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700/50" : "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-600"} ${row.dests.length === 0 ? "opacity-50" : ""}`}
                                    >
                                        <input type="checkbox" checked={row.checked} onChange={() => toggleRow(row.rev)}
                                            disabled={sending || row.dests.length === 0}
                                            className="mt-0.5 w-3.5 h-3.5 accent-indigo-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{row.rev}</p>
                                            {row.dests.length > 0 ? (
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                                                    {allDests.filter(d => row.destIds.includes(d.id)).map(dest => {
                                                        const sel = row.selectedDestIds.has(dest.id);
                                                        return (
                                                            <label key={dest.id}
                                                                className={`flex items-center gap-1 cursor-pointer select-none text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${sel ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 line-through"} ${sending ? "pointer-events-none" : ""}`}
                                                            >
                                                                <input type="checkbox" checked={sel}
                                                                    onChange={() => toggleDest(row.rev, dest.id)}
                                                                    disabled={sending}
                                                                    className="w-3 h-3 accent-indigo-500 shrink-0" />
                                                                {dest.apelido || dest.nome}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 italic">sem destinatários associados</p>
                                            )}
                                            {row.detail && (
                                                <p className={`text-[11px] mt-1 font-medium ${row.status === "error" ? "text-red-500" : row.status === "skipped" ? "text-amber-500" : row.status === "done" ? "text-green-600" : "text-indigo-500"}`}>
                                                    {row.detail}
                                                </p>
                                            )}
                                        </div>
                                        <StatusIcon status={row.status} />
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        /* ── Modo Unificado ── */
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Gera um único PDF com todas as revendas e envia para os destinatários selecionados abaixo.
                            </p>
                            {allDests.length === 0 ? (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-xs">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    Nenhum destinatário cadastrado. Configure em <strong>WhatsApp → Destinatários</strong>.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {allDests.map(dest => {
                                        const checked = unifiedSelected.has(dest.id);
                                        return (
                                            <div key={dest.id}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer ${checked ? "bg-green-50/70 dark:bg-green-900/20 border-green-200 dark:border-green-700/50" : "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-600"}`}
                                                onClick={() => !sending && setUnifiedSelected(prev => {
                                                    const next = new Set(prev);
                                                    next.has(dest.id) ? next.delete(dest.id) : next.add(dest.id);
                                                    return next;
                                                })}
                                            >
                                                <input type="checkbox" checked={checked} readOnly disabled={sending}
                                                    className="w-3.5 h-3.5 accent-green-500 shrink-0 pointer-events-none" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{dest.apelido || dest.nome}</p>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{dest.telefone}</p>
                                                </div>
                                                <User className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {unifiedStatus.detail && (
                                <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border ${unifiedStatus.status === "done" ? "bg-green-50 border-green-200 text-green-700" : unifiedStatus.status === "error" ? "bg-red-50 border-red-200 text-red-600" : "bg-indigo-50 border-indigo-200 text-indigo-600"}`}>
                                    <StatusIcon status={unifiedStatus.status} />
                                    {unifiedStatus.detail}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-100 dark:border-[var(--border)] bg-slate-50/60 dark:bg-[var(--card)] shrink-0">
                    {mode === "byRevenda" ? (
                        <button
                            onClick={() => setRows(prev => { const next = prev.map(r => ({ ...r, checked: r.dests.length > 0, selectedDestIds: new Set(r.destIds) })); saveSelecoes(next); return next; })}
                            disabled={sending}
                            className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-40"
                        >
                            Restaurar seleção
                        </button>
                    ) : (
                        <button
                            onClick={() => setUnifiedSelected(new Set(allDests.map(d => d.id)))}
                            disabled={sending}
                            className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-40"
                        >
                            Selecionar todos
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} disabled={sending}
                            className="px-4 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40">
                            {done ? "Fechar" : "Cancelar"}
                        </button>
                        {!done && mode === "unified" && (
                            <button
                                onClick={handleSendUnified}
                                disabled={sending || !connected || unifiedSelected.size === 0}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
                                style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
                            >
                                {sending
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                                    : <><Send className="w-4 h-4" /> Enviar unificado ({unifiedSelected.size})</>}
                            </button>
                        )}
                        {!done && mode === "byRevenda" && (
                            <button
                                onClick={handleSend}
                                disabled={sending || !connected || checkedCount === 0}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
                                style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
                            >
                                {sending
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                                    : <><Send className="w-4 h-4" /> Enviar tudo ({checkedCount})</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const SCROLL_TO_REVENDA_KEY = "metricflow:analise-scroll-revenda";

export default function Analise() {
    const [, setLocation] = useLocation();
    const [activePage, setActivePage] = useState("analises");
    const { filtros, setFiltro, setFiltrosMulti, resetFiltros, temFiltro } = useFiltroPersistido();
    const { isCollapsed } = useSidebarCollapse();
    const { getAnalise, setAnalise, analisesDoPeríodo } = useAnalisesRevenda(
        filtros.dataInicio || "",
        filtros.dataFim || ""
    );

    const { col, toggle, toggleAll, allOn, hiddenCount } = useColumnVisibility();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [sortBy, setSortBy] = useState<string>("vendedor");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [expandedHelp, setExpandedHelp] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
    const [downloadingUnified, setDownloadingUnified] = useState(false);
    const [waModalOpen, setWaModalOpen] = useState(false);
    const [headerExpanded, setHeaderExpanded] = useState(true);
    const [checkboxState, setCheckboxState] = useState<Record<string, Record<string, AcaoVendState>>>({});
    const editorRefs = useRef<Map<string, EditorAnaliseHandle>>(new Map());

    const toggleCheck = useCallback((rev: string, vendedor: string | number, tipo: AcaoTipo) => {
        const prevRevState = checkboxState[rev] ?? {};
        const prevVend = prevRevState[String(vendedor)] ?? { deslocamento: false, problema: false };
        const newRevState = {
            ...prevRevState,
            [String(vendedor)]: { ...prevVend, [tipo]: !prevVend[tipo] },
        };
        setCheckboxState(prev => ({ ...prev, [rev]: newRevState }));
        const mensagens = buildMensagensHTML(newRevState);
        editorRefs.current.get(rev)?.setGeneratedContent(mensagens);
    }, [checkboxState]);

    // Rola até a revenda ao voltar da página de detalhes do vendedor
    useEffect(() => {
        const revenda = sessionStorage.getItem(SCROLL_TO_REVENDA_KEY);
        if (!revenda) return;
        sessionStorage.removeItem(SCROLL_TO_REVENDA_KEY);
        const id = `revenda-${revenda}`;
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            // Aguarda a tabela renderizar antes de tentar novamente
            const timer = setTimeout(() => {
                const el2 = document.getElementById(id);
                if (el2) el2.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const { data: vendedoresList = [] } = trpc.clientes.vendedores.useQuery({
        revenda: filtros.revenda,
    });

    // ── Automação ────────────────────────────────────────────────────────────
    const healthQuery = trpc.automacao.health.useQuery(undefined, {
        refetchInterval: 30_000,
        retry: false,
    });
    const runMutation = trpc.automacao.run.useMutation({
        onSuccess: () => {
            toast.success("Pipeline executado com sucesso! Atualizando dados…");
            refetch();
        },
        onError: (e) => toast.error(`Falha no pipeline: ${e.message}`),
    });

    const { data: result, isLoading, error, refetch } = trpc.analise.getDados.useQuery(
        {
            dataInicio: filtros.dataInicio || undefined,
            dataFim: filtros.dataFim || undefined,
            revenda: filtros.revenda || undefined,
            vendedor: filtros.vendedor ? parseInt(filtros.vendedor, 10) : undefined,
        },
        { staleTime: 5 * 60 * 1000 }
    );

    const dados = result?.dados ?? [];
    const datas = result?.datas ?? [];
    const revendas = result?.revendas ?? [];

    //console.log(datas);
    //console.log(revendas);


    // ── Ordenação ────────────────────────────────────────────────────────────────
    const sorted = useMemo(() => {
        const d = [...dados];
        d.sort((a, b) => {
            const av = (a as any)[sortBy];
            const bv = (b as any)[sortBy];
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
            return sortDir === "asc" ? cmp : -cmp;
        });
        return d;
    }, [dados, sortBy, sortDir]);

    // ── Agrupamento por Revenda ──────────────────────────────────────────────────
    const { revendasOrdenadas, groupedData } = useMemo(() => {
        const groups: Record<string, typeof sorted> = {};
        sorted.forEach(r => {
            if (!groups[r.revenda]) groups[r.revenda] = [];
            groups[r.revenda].push(r);
        });
        return {
            revendasOrdenadas: Object.keys(groups).sort(),
            groupedData: groups
        };
    }, [sorted]);

    // Mapeamento: nome da visita (DB) → nome curto do coaching JSON (mesmo do backend)
    const REVENDA_COACHING_MAP: Record<string, string> = {
        "duttra floriano": "duttra fl",
        "duttra ma": "duttra ma",
        "duttra srn": "duttra sr",
        "forte aracati": "forte ar",
        "forte quixada": "forte qx",
    };

    // Helper: lê análise de GAs do localStorage (gerida pelo RotaCoaching.tsx)
    // Lookup case-insensitive: RotaCoaching salva com capitalização original
    // (ex: "Duttra FL__2026-04-13"), mas o mapa retorna lowercase.
    const getAnaliseGAs = (revenda: string): string => {
        try {
            const stored: Record<string, string> = JSON.parse(localStorage.getItem("metricflow:analises-ga") || "{}");
            // Índice normalizado para busca case-insensitive
            const storedLower: Record<string, string> = Object.fromEntries(
                Object.entries(stored).map(([k, v]) => [k.toLowerCase(), v])
            );
            const nomeCoaching = REVENDA_COACHING_MAP[revenda.toLowerCase()];
            const candidatos = nomeCoaching ? [nomeCoaching, revenda] : [revenda];
            for (const nome of candidatos) {
                const chave = `${nome.toLowerCase()}__${filtros.dataInicio}`;
                if (storedLower[chave]) return storedLower[chave];
            }
            return "";
        } catch { return ""; }
    };

    // Baixa PDF via POST enviando as análises inline (sem MySQL)
    const downloadPDF = async (revenda?: string) => {
        const chave = revenda ?? "__all__";
        setDownloadingPDF(chave);
        try {
            const data = filtros.dataInicio;
            if (!data) { toast.error("Selecione uma data primeiro."); return; }

            const analisesPayload: Record<string, { vendedores: string; gas: string }> = {};
            if (revenda) {
                analisesPayload[revenda] = {
                    vendedores: getAnalise(revenda),
                    gas: getAnaliseGAs(revenda),
                };
            } else {
                const todasAnalises = analisesDoPeríodo();
                revendasOrdenadas.forEach(rev => {
                    analisesPayload[rev] = {
                        vendedores: todasAnalises[rev] ?? "",
                        gas: getAnaliseGAs(rev),
                    };
                });
            }

            const body = { data, ...(revenda ? { revenda } : {}), analises: analisesPayload };
            const resp = await fetch("/api/relatorio/gerar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                toast.error(err.error ?? "Erro ao gerar PDF.");
                return;
            }

            const blob = await resp.blob();
            const filename = resp.headers.get("Content-Disposition")
                ?.match(/filename="([^"]+)"/)?.[1]
                ?? (revenda ? `${revenda}_${data}.pdf` : `relatorios_${data}.zip`);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF baixado com sucesso!");
        } catch (e) {
            console.error(e);
            toast.error("Erro ao baixar PDF.");
        } finally {
            setDownloadingPDF(null);
        }
    };

    const downloadPDFUnificado = async () => {
        setDownloadingUnified(true);
        try {
            const data = filtros.dataInicio;
            if (!data) { toast.error("Selecione uma data primeiro."); return; }

            const todasAnalises = analisesDoPeríodo();
            const analisesPayload: Record<string, { vendedores: string; gas: string }> = {};
            revendasOrdenadas.forEach(rev => {
                analisesPayload[rev] = {
                    vendedores: todasAnalises[rev] ?? "",
                    gas: getAnaliseGAs(rev),
                };
            });

            const resp = await fetch("/api/relatorio/gerar-unificado", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data, analises: analisesPayload }),
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                toast.error(err.error ?? "Erro ao gerar PDF unificado.");
                return;
            }

            const blob = await resp.blob();
            const filename = resp.headers.get("Content-Disposition")
                ?.match(/filename="([^"]+)"/)?.[1]
                ?? `relatorios_unificado_${data}.pdf`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF unificado baixado com sucesso!");
        } catch (e) {
            console.error(e);
            toast.error("Erro ao baixar PDF unificado.");
        } finally {
            setDownloadingUnified(false);
        }
    };

    function toggleSort(col: string) {
        if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortBy(col); setSortDir("asc"); }
    }

    function SortIcon({ col }: { col: string }) {
        if (sortBy !== col) return <span className="opacity-30 ml-0.5">↕</span>;
        return <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
    }

    // ── KPIs resumo ──────────────────────────────────────────────────────────────
    const totais = useMemo(() => ({
        vendedores: dados.length,
        pdvs: dados.reduce((s, r) => s + r.pdvs_visitados, 0),
        pdvs_total: dados.reduce((s, r) => s + r.pdvs_total, 0),
        heishop: dados.reduce((s, r) => s + r.pedido_heishop, 0),
        relampago_avg: dados.length
            ? dados.reduce((s, r) => s + r.relampago_pct, 0) / dados.length : 0,
        iv_avg: dados.length
            ? dados.reduce((s, r) => s + r.iv, 0) / dados.length : 0,
    }), [dados]);

    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores",
            compliance: "/compliance", clientes: "/clientes", relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching", analises: "/analises",
            trello_atraso: "/trello-atraso",
            whatsapp: "/whatsapp", assessment: "/assessment",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "analises") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-60'}`}>
                {/* Header */}
                <div className="bg-white dark:bg-[var(--card)] border-b border-slate-100 dark:border-[var(--border)] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <BarChart3 size={20} className="text-indigo-500 dark:text-indigo-400" />
                            Análise de Vendedores
                        </h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Métricas detalhadas por vendedor e dia</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setExpandedHelp(h => !h)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                            <AlertTriangle size={12} /> Glossário
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    await generateWordReport(
                                        groupedData,
                                        revendasOrdenadas,
                                        filtros.dataInicio || "",
                                        filtros.dataFim || "",
                                        analisesDoPeríodo()
                                    );
                                    toast.success("Relatório baixado com sucesso!");
                                } catch (e) {
                                    toast.error("Erro ao gerar relatório Word.");
                                    console.error(e);
                                }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        >
                            <FileText size={12} /> Exportar Word
                        </button>
                        <button
                            onClick={() => downloadPDF()}
                            disabled={downloadingPDF !== null || downloadingUnified}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                            title="Baixar PDF de todas as revendas (ZIP)"
                        >
                            <Printer size={12} /> {downloadingPDF === "__all__" ? "Gerando..." : "Baixar todos (ZIP)"}
                        </button>
                        <button
                            onClick={() => downloadPDFUnificado()}
                            disabled={downloadingPDF !== null || downloadingUnified}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
                            title="Baixar todas as revendas em um único arquivo PDF"
                        >
                            <Printer size={12} /> {downloadingUnified ? "Gerando..." : "Baixar unificado (PDF)"}
                        </button>
                        <button
                            onClick={() => setWaModalOpen(true)}
                            disabled={revendasOrdenadas.length === 0}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white border border-green-600 disabled:opacity-40"
                            style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
                            title="Enviar relatórios por WhatsApp para todas as revendas"
                        >
                            <MessageCircle size={12} /> Enviar WhatsApp
                        </button>
                        {/* Botão de automação */}
                        <button
                            onClick={() => runMutation.mutate({
                                dataInicio: filtros.dataInicio || new Date().toISOString().slice(0, 10),
                                dataFim: filtros.dataFim || filtros.dataInicio || new Date().toISOString().slice(0, 10),
                            })}
                            disabled={runMutation.isPending || !healthQuery.data?.online}
                            title={
                                !healthQuery.data?.online
                                    ? "API de automação offline — execute: python api.py"
                                    : `Executar pipeline para ${filtros.dataInicio ?? "hoje"}`
                            }
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border disabled:opacity-40 transition-colors"
                            style={
                                healthQuery.data?.online
                                    ? isDark
                                        ? { background: "oklch(0.20 0.06 162 / 0.35)", color: "#4ade80", borderColor: "oklch(0.38 0.12 162)" }
                                        : { background: "#f0fdf4", color: "#16a34a", borderColor: "#86efac" }
                                    : isDark
                                        ? { background: "oklch(0.155 0.020 252)", color: "#64748b", borderColor: "oklch(0.265 0.018 252)" }
                                        : { background: "#f8fafc", color: "#94a3b8", borderColor: "#e2e8f0" }
                            }
                        >
                            {runMutation.isPending
                                ? <><Loader2 size={12} className="animate-spin" /> Executando…</>
                                : healthQuery.data?.online
                                    ? <><Play size={12} /> Executar pipeline</>
                                    : <><WifiOff size={12} /> Pipeline offline</>
                            }
                        </button>
                        <button
                            onClick={() => refetch()}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                        >
                            <RefreshCw size={12} /> Atualizar
                        </button>
                        <button
                            onClick={() => setHeaderExpanded(e => !e)}
                            title={headerExpanded ? "Recolher filtros e KPIs" : "Expandir filtros e KPIs"}
                            className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            {headerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                {/* ── Seção colapsável: Glossário + Filtros + KPIs ── */}
                {headerExpanded && (
                    <>
                        {/* Glossário */}
                        {expandedHelp && (
                            <div className="bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30 px-6 py-3">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-600 dark:text-slate-300 max-w-5xl">
                                    {[
                                        ["Pedido SFA", "Pedidos realizados pelo vendedor via sistema SFA"],
                                        ["Pedido Heishop", "Pedidos realizados via plataforma Heishop"],
                                        ["Heishop Verificado", "Pedidos Heishop confirmados (com Tipo Cobr. preenchida)"],
                                        ["IV", "Índice de Visita = visitados dentro do raio / carteira total"],
                                        ["IAV", "Índice de Atendimento = Heishop verificado / Heishop total"],
                                        ["Ranking Crítico", "1 = pior desempenho (maior % relâmpago)"],
                                        ["Atend. > 35min", "Visitas com duração > 35min dentro do raio"],
                                        ["Maior Percurso", "Maior gap entre visitas consecutivas (≤ 60min)"],
                                        ["PDVs após gap", "Atendimentos realizados após o maior intervalo"],
                                        ["Tempo Ñ Atend.", "Jornada − tempo em visita. Trava às 17:00"],
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex gap-2">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200 min-w-[140px]">{k}:</span>
                                            <span>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Filtros */}
                        <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4 mx-6 mt-4"
                            style={{ border: `1px solid ${isDark ? "oklch(0.265 0.018 252)" : "oklch(0.93 0.006 240)"}`, boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.25)" : "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <FilterSelect
                                label="Revenda"
                                value={filtros.revenda ?? ""}
                                onChange={v => setFiltrosMulti({ revenda: v || undefined, vendedor: undefined })}
                                placeholder="Todas"
                                options={revendas.map(r => ({ value: r, label: r }))}
                            />
                            <FilterSelect
                                label="Vendedor"
                                value={filtros.vendedor ?? ""}
                                onChange={v => setFiltro("vendedor", v || undefined)}
                                placeholder="Todos"
                                options={vendedoresList.map(v => ({ value: String(v.id), label: v.nome }))}
                            />
                            <FilterDate label="Data Início" value={filtros.dataInicio ?? ""} onChange={v => setFiltro("dataInicio", v || undefined)} />
                            <FilterDate label="Data Fim" value={filtros.dataFim ?? ""} onChange={v => setFiltro("dataFim", v || undefined)} />
                            {temFiltro && (
                                <button onClick={resetFiltros}
                                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all"
                                    style={{ fontWeight: 600 }}>
                                    <X className="w-3.5 h-3.5" /> Limpar
                                </button>
                            )}
                            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto" style={{ fontWeight: 500 }}>{sorted.length} vendedor(es)</span>
                            <ColumnsSelector col={col} toggle={toggle} toggleAll={toggleAll} allOn={allOn} hiddenCount={hiddenCount} />
                        </div>

                        {/* KPI Cards */}
                        <div className="px-6 pt-4 pb-2 grid grid-cols-5 gap-3">
                            {[
                                { label: "Vendedores", value: totais.vendedores, color: "text-slate-700 dark:text-slate-200", icon: <BarChart3 size={16} className="text-indigo-400" /> },
                                { label: "PDVs Visitados", value: totais.pdvs, sub: totais.pdvs_total, color: "text-slate-700 dark:text-slate-200", icon: <TrendingUp size={16} className="text-green-400" /> },
                                { label: "Pedidos Heishop", value: totais.heishop, color: "text-amber-600", icon: <AlertTriangle size={16} className="text-amber-400" /> },
                                { label: "Relâmpago médio", value: pct(totais.relampago_avg), color: totais.relampago_avg > 20 ? "text-red-600" : "text-green-600", icon: <TrendingDown size={16} className="text-red-400" /> },
                                { label: "IV médio", value: pct(totais.iv_avg), color: "text-indigo-600", icon: <Clock size={16} className="text-indigo-400" /> },
                            ].map(k => (
                                <div key={k.label} className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] px-4 py-3 flex items-center gap-3" style={{ boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.06)" }}>
                                    {k.icon}
                                    <div>
                                        <div className={`text-lg font-bold ${k.color}`}>{k.value}{k.sub ? <span className="text-xs text-slate-400 dark:text-slate-500">/{k.sub} = {k.sub - k.value}</span> : ""}</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500">{k.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Tabela */}
                <div className="flex-1 overflow-auto px-6 pb-6">
                    {isLoading && (
                        <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
                            <RefreshCw size={16} className="animate-spin mr-2" /> Carregando...
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center justify-center h-40 text-red-500 text-sm gap-2">
                            <AlertTriangle size={16} /> {error.message}
                        </div>
                    )}
                    {!isLoading && !error && (
                        <div className="flex flex-col gap-6">
                            {revendasOrdenadas.length === 0 && (
                                <div className="bg-white dark:bg-[var(--card)] p-12 rounded-xl text-center text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-[var(--border)]">Nenhum dado para os filtros selecionados</div>
                            )}
                            {revendasOrdenadas.map(rev => (
                                <div key={rev} id={`revenda-${rev}`} className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] overflow-hidden" style={{ boxShadow: isDark ? "0 1px 8px rgba(0,0,0,0.3)" : "0 1px 8px rgba(0,0,0,0.06)" }}>
                                    <div className="px-5 py-3 border-b border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center justify-between">
                                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase">Revenda: <span className="text-indigo-600 dark:text-indigo-400">{rev}</span></h2>
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
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                                        <table className="w-full text-xs">
                                            <thead className="bg-green-950 text-slate-100 sticky top-0 z-10">
                                                <tr>
                                                    {/* Identidade — sempre visíveis */}
                                                    <Th title="Código do vendedor">
                                                        <button onClick={() => toggleSort("vendedor")} className="flex items-center gap-0.5">
                                                            Vend. <SortIcon col="vendedor" />
                                                        </button>
                                                    </Th>
                                                    <Th title="Marcar ocorrências para gerar texto automático na análise abaixo" center>Ações</Th>
                                                    {col("data") && <Th title="Data">Data</Th>}

                                                    {/* Horários */}
                                                    {col("inicio") && <Th title="Hora da primeira visita dentro do raio" center>Início</Th>}
                                                    {col("fim") && <Th title="Hora da última visita dentro do raio" center>Fim</Th>}
                                                    {col("almoco") && <Th title="Visitas na janela 12:15-13:45 (almoço)" center>Almoço</Th>}
                                                    {col("apos14h") && <Th title="Visitas com início após 14h" center>Após 14h</Th>}

                                                    {/* Cobertura */}
                                                    {col("visitas") && <Th title="Visitas únicas dentro do raio / carteira total" center>Visitas</Th>}
                                                    {col("pdv_sem_visita") && <Th title="PDVs na carteira sem visita no dia" center>PDV S/Visita</Th>}

                                                    {/* Relâmpago */}
                                                    {col("relampago") && (
                                                        <Th title="Visitas únicas dentro do raio com duração < 3min" center>
                                                            <button onClick={() => toggleSort("relampago_pct")} className="flex items-center gap-0.5 mx-auto">
                                                                Relâmpago <SortIcon col="relampago_pct" />
                                                            </button>
                                                        </Th>
                                                    )}

                                                    {/* Pedidos */}
                                                    {col("sfa") && <Th title="Pedidos realizados via sistema SFA" center>SFA</Th>}
                                                    {col("heishop") && <Th title="Pedidos realizados via Heishop" center>Heishop</Th>}
                                                    {col("heishop_verif") && <Th title="Pedidos Heishop verificados (Tipo Cobr. preenchida)" center>H. Verif.</Th>}

                                                    {/* Índices */}
                                                    {col("iv") && (
                                                        <Th title="IV = visitados dentro do raio / carteira total" center>
                                                            <button onClick={() => toggleSort("iv")} className="flex items-center gap-0.5 mx-auto">
                                                                IV <SortIcon col="iv" />
                                                            </button>
                                                        </Th>
                                                    )}
                                                    {col("iav") && <Th title="IAV = Heishop verificado / Heishop total" center>IAV</Th>}

                                                    {/* Atendimento */}
                                                    {col("atend_35") && <Th title="Visitas com duração > 35 minutos dentro do raio" center>Atend. &gt;35</Th>}
                                                    {col("soma_35") && <Th title="Soma do tempo de todos os atendimentos > 35 min" center>Σ &gt;35min</Th>}
                                                    {col("t_menor") && <Th title="Menor tempo de visita dentro do PDV" center>T. Menor</Th>}
                                                    {col("t_maior") && <Th title="Maior tempo de visita dentro do PDV" center>T. Maior</Th>}
                                                    {col("t_medio") && <Th title="Média do tempo de visita dentro do PDV" center>T. Médio</Th>}
                                                    {col("t_total") && <Th title="Soma de todos os tempos de visita dentro do PDV" center>T. Total</Th>}

                                                    {/* Percurso */}
                                                    {col("soma_percurso") && <Th title="Soma de todos os intervalos entre visitas consecutivas (≤ 60min)" center>Σ Percurso</Th>}
                                                    {col("percurso") && <Th title="Maior intervalo entre visitas consecutivas (≤ 60min)" center>Maior Percurso</Th>}
                                                    {col("ini_percurso") && <Th title="Início do maior intervalo entre visitas" center>Ini. Percurso</Th>}
                                                    {col("fim_percurso") && <Th title="Fim do maior intervalo entre visitas" center>Fim Percurso</Th>}
                                                    {col("pdvs_percurso") && <Th title="PDVs atendidos dentro do raio após o maior percurso" center>PDVs p/ Percurso</Th>}
                                                    {col("t_nao_atend") && (
                                                        <Th title="Tempo fora de atendimento (trava às 17:00). Jornada − tempo em visita" center>
                                                            <button onClick={() => toggleSort("tempo_nao_atend")} className="flex items-center gap-0.5 mx-auto">
                                                                T. Ñ Atend. <SortIcon col="tempo_nao_atend" />
                                                            </button>
                                                        </Th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupedData[rev].map((r, i) => {
                                                    const rowBg = i % 2 === 1 ? "bg-slate-50 dark:bg-slate-800/30" : "dark:bg-[var(--card)]";
                                                    const isRuim = r.ranking_critico <= 3;
                                                    return (
                                                        <tr key={`${r.vendedor}-${r.data}`} className={`hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors ${rowBg}`}>
                                                            {/* Identidade — sempre visíveis */}
                                                            <Td mono>
                                                                <button onClick={() => { sessionStorage.setItem(SCROLL_TO_REVENDA_KEY, r.revenda); setLocation(`/analises/vendedor/${encodeURIComponent(r.revenda)}/${r.vendedor}/${r.data}`); }} className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline inline-flex items-center gap-1 transition-all">
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
                                                                            onChange={() => toggleCheck(rev, r.vendedor, "deslocamento")}
                                                                        />
                                                                        <span className="text-[10px] text-amber-700 dark:text-amber-400">Desl.</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="accent-red-500 w-3 h-3 shrink-0"
                                                                            checked={!!(checkboxState[rev]?.[String(r.vendedor)]?.problema)}
                                                                            onChange={() => toggleCheck(rev, r.vendedor, "problema")}
                                                                        />
                                                                        <span className="text-[10px] text-red-700 dark:text-red-400">Prob.</span>
                                                                    </label>
                                                                </div>
                                                            </Td>
                                                            {col("data") && <Td mono className="text-slate-500 dark:text-slate-400">{r.data}</Td>}

                                                            {/* Horários */}
                                                            {col("inicio") && <Td center mono className={r.inicio && (r.inicio < "07:30" || r.inicio > "08:45") ? "text-amber-700 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-300"}>{r.inicio ?? "—"}</Td>}
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
                                                                        : <span className="text-slate-300 dark:text-slate-600">—</span>
                                                                    }
                                                                </Td>
                                                            )}

                                                            {/* Cobertura */}
                                                            {col("visitas") && (
                                                                <Td center>
                                                                    <span className={r.visitas_pct == 100 ? "text-green-600 font-extrabold" : r.visitas_pct >= 90 ? "text-amber-600 font-extrabold" : "text-red-500 font-extrabold"}>
                                                                        {pct(r.visitas_pct, 0)} <span className="text-slate-400 dark:text-slate-500 font-normal">({r.visitas}/{r.visitas_total})</span>
                                                                    </span>
                                                                </Td>
                                                            )}
                                                            {col("pdv_sem_visita") && (
                                                                <Td center>
                                                                    {r.pdvs_sem_visita > 0 ? <Badge color="red">{r.pdvs_sem_visita}</Badge> : <span className="text-slate-300 dark:text-slate-600">0</span>}
                                                                </Td>
                                                            )}

                                                            {/* Relâmpago */}
                                                            {col("relampago") && (
                                                                <Td center>
                                                                    <span className={r.relampago_pct >= 30 ? "text-red-600 font-bold" : r.relampago_pct >= 15 ? "text-amber-600 font-semibold" : "text-green-600"}>
                                                                        {pct(r.relampago_pct, 0)} <span className="text-slate-400 dark:text-slate-500 font-normal">({r.relampago}/{r.visitas_total_dentro_raio})</span>
                                                                    </span>
                                                                </Td>
                                                            )}

                                                            {/* Pedidos */}
                                                            {col("sfa") && <Td center mono>{r.pedido_sfa > 0 ? <span className="text-blue-600 dark:text-blue-400 font-semibold">{r.pedido_sfa}</span> : <span className="text-slate-300 dark:text-slate-600">0</span>}</Td>}
                                                            {col("heishop") && <Td center mono>{r.pedido_heishop > 0 ? <span className="text-amber-600 dark:text-amber-400 font-semibold">{r.pedido_heishop}</span> : <span className="text-slate-300 dark:text-slate-600">0</span>}</Td>}
                                                            {col("heishop_verif") && <Td center mono>{r.heishop_verif > 0 ? <Badge color="green">{r.heishop_verif}</Badge> : <span className="text-slate-300">0</span>}</Td>}

                                                            {/* Índices */}
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

                                                            {/* Atendimento */}
                                                            {col("atend_35") && <Td center>{r.atend_maior35 > 0 ? <Badge color="amber">{r.atend_maior35}</Badge> : <span className="text-slate-300 dark:text-slate-600">0</span>}</Td>}
                                                            {col("soma_35") && <Td center mono className="text-slate-600 dark:text-slate-300">{r.soma_maior35_fmt}</Td>}
                                                            {col("t_menor") && <Td center mono className={r.tempo_menor !== null && r.tempo_menor < 3 ? "text-red-700 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}>{r.tempo_menor_fmt}</Td>}
                                                            {col("t_maior") && <Td center mono className={r.tempo_maior !== null && r.tempo_maior > 35 ? "text-red-500" : "text-slate-600 dark:text-slate-300"}>{r.tempo_maior_fmt}</Td>}
                                                            {col("t_medio") && <Td center mono className="text-slate-600 dark:text-slate-300">{r.tempo_medio_fmt}</Td>}
                                                            {col("t_total") && <Td center mono className={`${r.tempo_total_fmt && r.tempo_total_fmt < "02:00:00" ? "text-red-500" : "text-indigo-600 dark:text-indigo-400 font-semibold"}`}>{r.tempo_total_fmt}</Td>}

                                                            {/* Percurso */}
                                                            {col("soma_percurso") && (
                                                                <Td center mono className="text-slate-600 dark:text-slate-300">
                                                                    {r.total_percurso !== null ? minToHM_display(r.total_percurso) : "—"}
                                                                </Td>
                                                            )}
                                                            {col("percurso") && (
                                                                <Td center mono className={r.maior_percurso !== null && r.maior_percurso > 30 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-600 dark:text-slate-300"}>
                                                                    {r.maior_percurso !== null ? minToHM_display(r.maior_percurso) : "—"}
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

                                    {/* ── Editor de análise por revenda ── */}
                                    <div className="px-5 py-4 border-t border-slate-100 dark:border-[var(--border)] bg-slate-50/40 dark:bg-[var(--background)]/40">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <PenLine className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                                <span className="text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                                                    Análise · {rev}
                                                </span>
                                                <span className="text-xs text-slate-400 dark:text-slate-500 ml-1" style={{ fontWeight: 400 }}>
                                                    — será incluída no PDF
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => downloadPDF(rev)}
                                                disabled={downloadingPDF !== null}
                                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
                                                style={{ fontWeight: 700 }}
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
                                            onChange={html => setAnalise(rev, html)}
                                            placeholder={`Registre aqui a análise da revenda ${rev} — destaques, pontos de atenção, planos de ação...`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal WhatsApp batch */}
            {waModalOpen && (
                <EnviarWAModal
                    revendasOrdenadas={revendasOrdenadas}
                    data={filtros.dataInicio || ""}
                    getAnalise={getAnalise}
                    getAnaliseGAs={getAnaliseGAs}
                    onClose={() => setWaModalOpen(false)}
                />
            )}
        </div>
    );
}

// Helper local para exibição de minutos como HH:MM sem segundos
function minToHM_display(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h === 0) return `${m}min`;
    return `${h}h${String(m).padStart(2, "0")}`;
}

function FilterSelect({ label, value, onChange, placeholder, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

function FilterDate({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
        </div>
    );
}