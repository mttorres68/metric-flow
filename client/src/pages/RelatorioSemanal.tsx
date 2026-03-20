/*
 * MetricFlow — Relatório Semanal de Agendas dos GAs
 * Responde à pergunta: "Consegue me passar um relatório resumo
 * sobre a realização das agendas dos GAs da semana?"
 *
 * Visão: por semana → por GA → dias realizados, status, conformidade
 * Exporta PDF direto do navegador (window.print)
 */

import Sidebar from "@/components/Sidebar";
import {
    ChevronDown, ChevronUp,
    Download, MessageSquare, PenLine,
} from "lucide-react";
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface RotaRow {
    data: string;   // "YYYY-MM-DD"
    rev: string;
    gaId: string;
    vendId: string;
    agendado: boolean;
    status: "ok" | "partial" | "nok" | "na";
    pctGA: number;
    pdvsProg: number;
    pdvsVis: number;
    gaVis: number;
    atividade?: string;
    fonte?: string;
}

// Por GA, por dia
interface DiaGA {
    data: string;
    diaSem: string;
    status: "ok" | "partial" | "nok" | "na" | "ausente";
    pctGA: number;
    pdvsProg: number;
    gaVis: number;
    vendedor: string;
    rev: string;
}

interface ResumoGA {
    gaId: string;
    revendas: string[];
    dias: DiaGA[];
    totalAgendado: number;
    totalOk: number;
    totalPartial: number;
    totalNok: number;
    totalAusente: number;
    mediaPctGA: number;
    taxaConf: number; // % dias com status ok ou partial sobre agendados
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de data
// ─────────────────────────────────────────────────────────────────────────────

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function isoParaDate(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function dateParaIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diaSemana(iso: string): string {
    return DIAS_PT[isoParaDate(iso).getDay()];
}

function fmtDataCurta(iso: string): string {
    const d = isoParaDate(iso);
    return `${DIAS_PT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtDataLonga(iso: string): string {
    const d = isoParaDate(iso);
    return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

// Início de semana (segunda-feira)
function inicioSemana(d: Date): Date {
    const dia = d.getDay(); // 0=dom
    const diff = dia === 0 ? -6 : 1 - dia;
    const seg = new Date(d);
    seg.setDate(d.getDate() + diff);
    return seg;
}

function diasDaSemana(seg: Date): string[] {
    return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(seg);
        d.setDate(seg.getDate() + i);
        return dateParaIso(d);
    }); // Seg → Sáb (6 dias úteis+sáb)
}

function semanaLabel(seg: Date): string {
    const fim = new Date(seg); fim.setDate(seg.getDate() + 5);
    return `${seg.getDate()}/${seg.getMonth() + 1} – ${fim.getDate()}/${fim.getMonth() + 1}/${fim.getFullYear()}`;
}

// Semanas disponíveis no JSON
function semanasDisponiveis(datas: string[]): Date[] {
    const sets = new Set<string>();
    const result: Date[] = [];
    for (const iso of datas) {
        const seg = inicioSemana(isoParaDate(iso));
        const key = dateParaIso(seg);
        if (!sets.has(key)) { sets.add(key); result.push(seg); }
    }
    return result.sort((a, b) => b.getTime() - a.getTime()); // mais recente primeiro
}

// ─────────────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META = {
    ok: { label: "Completo", cor: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icone: "✅" },
    partial: { label: "Parcial", cor: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icone: "⚠️" },
    nok: { label: "Não Realizado", cor: "#ef4444", bg: "#fef2f2", border: "#fecaca", icone: "❌" },
    na: { label: "Sem Agenda", cor: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", icone: "➖" },
    ausente: { label: "Sem dados", cor: "#cbd5e1", bg: "#f8fafc", border: "#e2e8f0", icone: "·" },
};

function PilulhaStatus({ status }: { status: keyof typeof STATUS_META }) {
    const m = STATUS_META[status];
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
            style={{ color: m.cor, background: m.bg, borderColor: m.border, fontWeight: 700 }}>
            {m.icone} {m.label}
        </span>
    );
}

function CelulaDia({ dia }: { dia: DiaGA | undefined; }) {
    if (!dia) return <td className="px-3 py-2 text-center text-xs text-slate-300">·</td>;
    const m = STATUS_META[dia.status];
    return (
        <td className="px-3 py-2 text-center">
            <div className="flex flex-col items-center gap-0.5">
                <span className="text-base leading-none">{m.icone}</span>
                {dia.status !== "ausente" && dia.status !== "na" && (
                    <span className="text-xs tabular-nums" style={{ color: m.cor, fontWeight: 700 }}>
                        {dia.pctGA}%
                    </span>
                )}
            </div>
        </td>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — persistência de análises por GA+semana no localStorage
// ─────────────────────────────────────────────────────────────────────────────

const ANALISES_KEY = "metricflow:analises-semanal";

function carregarAnalises(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(ANALISES_KEY) || "{}"); } catch { return {}; }
}

function useAnalisesSemanais() {
    const [analises, setAnalises] = useState<Record<string, string>>(carregarAnalises);

    const pkAnalise = (gaId: string, semana: string) => `${gaId}__${semana}`;

    const getAnalise = useCallback((gaId: string, semana: string): string =>
        analises[pkAnalise(gaId, semana)] || "",
        [analises]);

    const setAnalise = useCallback((gaId: string, semana: string, html: string) => {
        setAnalises(prev => {
            const next = { ...prev, [pkAnalise(gaId, semana)]: html };
            localStorage.setItem(ANALISES_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    return { getAnalise, setAnalise };
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor de análise inline — barra de formatação + contentEditable
// ─────────────────────────────────────────────────────────────────────────────

const TOOLBAR_BTNS = [
    { cmd: "bold", arg: null, label: "N", title: "Negrito", style: { fontWeight: 900 } },
    { cmd: "italic", arg: null, label: "I", title: "Itálico", style: { fontStyle: "italic" } },
    { cmd: "underline", arg: null, label: "S", title: "Sublinhado", style: { textDecoration: "underline" } },
    { cmd: "hiliteColor", arg: "#fde047", label: "▌", title: "Destacar", style: { color: "#ca8a04" } },
    { cmd: "formatBlock", arg: "H2", label: "H", title: "Título", style: { fontWeight: 800, fontSize: 13 } },
    { cmd: "insertUnorderedList", arg: null, label: "•", title: "Lista", style: {} },
    { cmd: "insertOrderedList", arg: null, label: "1.", title: "Lista numerada", style: {} },
    { cmd: "removeFormat", arg: null, label: "✕", title: "Limpar formatação", style: { color: "#94a3b8" } },
];

interface EditorAnaliseProps {
    gaId: string;
    semana: string;
    html: string;
    onChange: (html: string) => void;
}

function EditorAnalise({ gaId, semana, html, onChange }: EditorAnaliseProps) {
    const ref = useRef<HTMLDivElement>(null);
    const debRef = useRef<any>(null);
    const mountedRef = useRef(false);
    const [focado, setFocado] = useState(false);

    // Popula conteúdo inicial sem mexer no cursor
    useEffect(() => {
        if (ref.current && !mountedRef.current) {
            ref.current.innerHTML = html || "";
            mountedRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const salvar = useCallback(() => {
        clearTimeout(debRef.current);
        debRef.current = setTimeout(() => onChange(ref.current?.innerHTML || ""), 350);
    }, [onChange]);

    const cmd = useCallback((command: string, arg?: string | null) => {
        document.execCommand(command, false, arg ?? undefined);
        ref.current?.focus();
        salvar();
    }, [salvar]);

    useEffect(() => () => clearTimeout(debRef.current), []);

    return (
        <div className={`rounded-xl overflow-hidden border transition-all ${focado ? "border-green-400 shadow-sm shadow-green-100" : "border-slate-200"}`}
            style={{ background: "#fff" }}>

            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex-wrap">
                {TOOLBAR_BTNS.map((b, i) => (
                    <React.Fragment key={b.cmd + i}>
                        {(i === 3 || i === 4 || i === 5 || i === 7) && (
                            <div className="w-px h-4 bg-slate-200 mx-1" />
                        )}
                        <button
                            title={b.title}
                            onMouseDown={e => { e.preventDefault(); cmd(b.cmd, b.arg); }}
                            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-white hover:text-slate-800 transition-all"
                            style={b.style}>
                            {b.label}
                        </button>
                    </React.Fragment>
                ))}
                <span className="ml-auto text-xs text-slate-400 italic" style={{ fontSize: 9 }}>💾 auto</span>
            </div>

            {/* Editor */}
            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                onInput={salvar}
                onFocus={() => setFocado(true)}
                onBlur={() => setFocado(false)}
                data-placeholder={`Registre aqui a análise de ${gaId} nesta semana — o que aconteceu, pontos de atenção, planos de ação...`}
                className="outline-none px-4 py-3 text-sm text-slate-700 min-h-[80px]"
                style={{ lineHeight: 1.7, caretColor: "#16a34a", wordBreak: "break-word" }}
            />

            {/* CSS do editor via style tag */}
            <style>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #cbd5e1;
          font-style: italic;
          pointer-events: none;
        }
        [contenteditable] h2 { font-size: 14px; font-weight: 700; color: #166534; margin: 6px 0 3px; }
        [contenteditable] ul { padding-left: 18px; margin: 3px 0; list-style: disc; }
        [contenteditable] ol { padding-left: 18px; margin: 3px 0; list-style: decimal; }
        [contenteditable] li { margin: 2px 0; }
        [contenteditable] strong, [contenteditable] b { color: #1e293b; }
        [contenteditable] mark { background: #fde047; padding: 0 2px; border-radius: 2px; }
        [contenteditable] u { text-decoration-color: #16a34a; }
      `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RelatorioSemanal() {
    const [activePage, setActivePage] = useState("relatorio_semanal");
    const [allData, setAllData] = useState<RotaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [semanaIdx, setSemanaIdx] = useState(0);  // 0 = semana mais recente
    const [expandedGA, setExpandedGA] = useState<Set<string>>(new Set());
    const [filtroRevenda, setFiltroRevenda] = useState("");
    const { getAnalise, setAnalise } = useAnalisesSemanais();

    // ── Carrega JSON ────────────────────────────────────────────────────────────
    useEffect(() => {
        fetch(`/rota_coaching_all.json?t=${Date.now()}`)
            .then(r => { if (!r.ok) throw new Error("rota_coaching_all.json não encontrado na pasta public."); return r.json(); })
            .then((d: RotaRow[]) => { setAllData(d); setLoading(false); })
            .catch(e => { setErro(e.message); setLoading(false); });
    }, []);

    // ── Semanas disponíveis ─────────────────────────────────────────────────────
    const semanas = useMemo(() =>
        semanasDisponiveis(allData.map(r => r.data)),
        [allData]);

    const semanaAtual = semanas[semanaIdx] ?? null;
    const diasSemana = semanaAtual ? diasDaSemana(semanaAtual) : [];

    // ── Dados da semana selecionada ─────────────────────────────────────────────
    const dadosSemana = useMemo(() =>
        allData.filter(r => diasSemana.includes(r.data)),
        [allData, diasSemana]);

    // ── Revendas disponíveis na semana ──────────────────────────────────────────
    const revendasSemana = useMemo(() =>
        [...new Set(dadosSemana.map(r => r.rev).filter(Boolean))].sort(),
        [dadosSemana]);

    // ── Dados filtrados por revenda ─────────────────────────────────────────────
    const dadosFiltrados = useMemo(() =>
        filtroRevenda ? dadosSemana.filter(r => r.rev === filtroRevenda) : dadosSemana,
        [dadosSemana, filtroRevenda]);

    // ── Resumo por GA ────────────────────────────────────────────────────────────
    const resumosPorGA = useMemo((): ResumoGA[] => {
        const gasUnicos = [...new Set(dadosFiltrados.map(r => r.gaId))].sort();

        return gasUnicos.map(gaId => {
            const linhasGA = dadosFiltrados.filter(r => r.gaId === gaId);
            const revendas = [...new Set(linhasGA.map(r => r.rev).filter(Boolean))];

            // Monta um registro por dia da semana
            const dias: DiaGA[] = diasSemana.map(iso => {
                const linhasDia = linhasGA.filter(r => r.data === iso && r.agendado);
                if (linhasDia.length === 0) {
                    // Verifica se há algum registro não agendado (outra atividade)
                    const outra = linhasGA.find(r => r.data === iso && !r.agendado);
                    if (outra) return {
                        data: iso, diaSem: diaSemana(iso), status: "na",
                        pctGA: 0, pdvsProg: 0, gaVis: 0,
                        vendedor: outra.vendId, rev: outra.rev,
                    };
                    return {
                        data: iso, diaSem: diaSemana(iso), status: "ausente",
                        pctGA: 0, pdvsProg: 0, gaVis: 0, vendedor: "", rev: "",
                    };
                }
                // Pega o melhor status do dia (pode ter manhã e tarde)
                const statusOrdem = ["ok", "partial", "nok", "na"];
                const melhor = linhasDia.reduce((acc, r) =>
                    statusOrdem.indexOf(r.status) < statusOrdem.indexOf(acc.status) ? r : acc
                );
                return {
                    data: iso,
                    diaSem: diaSemana(iso),
                    status: melhor.status as DiaGA["status"],
                    pctGA: Math.round(linhasDia.reduce((s, r) => s + r.pctGA, 0) / linhasDia.length),
                    pdvsProg: linhasDia.reduce((s, r) => s + r.pdvsProg, 0),
                    gaVis: linhasDia.reduce((s, r) => s + r.gaVis, 0),
                    vendedor: linhasDia.map(r => r.vendId).join(", "),
                    rev: melhor.rev,
                };
            });

            const agendados = linhasGA.filter(r => r.agendado);
            const ok = agendados.filter(r => r.status === "ok").length;
            const partial = agendados.filter(r => r.status === "partial").length;
            const nok = agendados.filter(r => r.status === "nok").length;
            const ausente = diasSemana.filter(iso => !linhasGA.some(r => r.data === iso)).length;
            const mediaPct = agendados.length > 0
                ? Math.round(agendados.reduce((s, r) => s + r.pctGA, 0) / agendados.length)
                : 0;
            const taxaConf = agendados.length > 0
                ? Math.round(((ok + partial * 0.5) / agendados.length) * 100)
                : 0;

            return {
                gaId, revendas, dias,
                totalAgendado: agendados.length,
                totalOk: ok, totalPartial: partial, totalNok: nok, totalAusente: ausente,
                mediaPctGA: mediaPct, taxaConf,
            };
        });
    }, [dadosFiltrados, diasSemana]);

    // ── KPIs gerais da semana ───────────────────────────────────────────────────
    const kpisSemana = useMemo(() => {
        const agendados = dadosFiltrados.filter(r => r.agendado);
        const ok = agendados.filter(r => r.status === "ok").length;
        const par = agendados.filter(r => r.status === "partial").length;
        return {
            totalGAs: resumosPorGA.length,
            revendas: revendasSemana.length,
            agendados: agendados.length,
            ok, par,
            nok: agendados.filter(r => r.status === "nok").length,
            taxa: agendados.length > 0
                ? Math.round(((ok + par * 0.5) / agendados.length) * 100) + "%"
                : "—",
        };
    }, [dadosFiltrados, resumosPorGA, revendasSemana]);

    const toggleGA = (gaId: string) => {
        const s = new Set(expandedGA);
        s.has(gaId) ? s.delete(gaId) : s.add(gaId);
        setExpandedGA(s);
    };

    // ── Exportar PDF ────────────────────────────────────────────────────────────
    const exportarPDF = useCallback(() => {
        if (!semanaAtual) return;
        const chave = dateParaIso(semanaAtual);
        const diasLabel = diasSemana.map(fmtDataCurta);

        const linhasGA = resumosPorGA.map(ga => {
            const celulas = diasSemana.map(iso => {
                const d = ga.dias.find(d => d.data === iso);
                if (!d || d.status === "ausente") return `<td class="dc">·</td>`;
                const m = STATUS_META[d.status];
                return `<td class="dc" style="color:${m.cor}">${m.icone}<br/><small>${d.status !== "na" ? d.pctGA + "%" : ""}</small></td>`;
            }).join("");

            const taxaCor = ga.taxaConf >= 80 ? "#166534" : ga.taxaConf >= 50 ? "#b45309" : "#dc2626";
            const analise = getAnalise(ga.gaId, chave).trim();
            const blocoAn = analise
                ? `<tr class="analise-row"><td colspan="${diasSemana.length + 6}" class="analise-cell"><div class="analise-label">📝 Análise — ${ga.gaId}</div><div class="analise-content">${analise}</div></td></tr>`
                : "";

            return `<tr>
        <td class="ga">${ga.gaId}</td>
        <td>${ga.revendas.join(", ")}</td>
        ${celulas}
        <td class="dc" style="color:#166534;font-weight:700">${ga.totalOk || "—"}</td>
        <td class="dc" style="color:#b45309;font-weight:700">${ga.totalPartial || "—"}</td>
        <td class="dc" style="color:#dc2626;font-weight:700">${ga.totalNok || "—"}</td>
        <td class="dc" style="color:${taxaCor};font-weight:800">${ga.taxaConf}%</td>
      </tr>${blocoAn}`;
        }).join("");

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Relatório Semanal GAs</title>
    <style>
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:Arial,sans-serif; font-size:11px; color:#1a2540; background:#fff; padding:24px; }
      .header { background:#166534; color:white; padding:16px 20px; border-radius:8px; margin-bottom:20px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .header h1 { font-size:16px; letter-spacing:.5px; }
      .header p  { font-size:11px; opacity:.8; margin-top:4px; }
      .kpis { display:flex; gap:12px; margin-bottom:20px; }
      .kpi { flex:1; border:1px solid #e2e8f0; border-radius:6px; padding:10px; text-align:center; }
      .kpi .val { font-size:22px; font-weight:800; color:#166534; }
      .kpi .lbl { font-size:9px; text-transform:uppercase; color:#64748b; margin-top:2px; }
      table { width:100%; border-collapse:collapse; font-size:10px; }
      th { background:#166534; color:white; padding:7px 8px; text-align:left; font-size:9px; text-transform:uppercase; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      td { padding:7px 8px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
      tr:nth-child(even) td { background:#f8fafc; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .ga { font-weight:700; color:#1e40af; font-size:11px; }
      .dc { text-align:center; }
      .analise-row td { background:#f0fdf4 !important; padding:0; border-bottom:2px solid #bbf7d0; }
      .analise-cell { padding:10px 14px 12px !important; }
      .analise-label { font-size:9px; font-weight:700; text-transform:uppercase; color:#166534; letter-spacing:.08em; margin-bottom:6px; }
      .analise-content { font-size:11px; color:#1a2540 !important; line-height:1.7; }
      .analise-content * { color:#1a2540 !important; background-color:transparent !important; }
      .analise-content mark { background:#fde047 !important; padding:0 2px; border-radius:2px; color:#1a1a1a !important; }
      .analise-content em,.analise-content i { color:#475569 !important; font-style:italic; }
      .analise-content h2 { font-size:12px; font-weight:700; color:#166534 !important; margin:5px 0 3px; }
      .analise-content ul { padding-left:16px; margin:3px 0; list-style:disc; }
      .analise-content ol { padding-left:16px; margin:3px 0; list-style:decimal; }
      .analise-content li { margin:2px 0; }
      .footer { margin-top:16px; font-size:9px; color:#94a3b8; text-align:right; }
      @media print { @page { size:A4 landscape; margin:1cm; } body { padding:0; } }
    </style></head><body>
    <div class="header">
      <h1>RELATÓRIO SEMANAL — REALIZAÇÃO DE AGENDAS DOS GAs</h1>
      <p>Semana: ${semanaLabel(semanaAtual)}${filtroRevenda ? " · Revenda: " + filtroRevenda : ""} · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="val">${kpisSemana.totalGAs}</div><div class="lbl">GAs</div></div>
      <div class="kpi"><div class="val">${kpisSemana.revendas}</div><div class="lbl">Revendas</div></div>
      <div class="kpi"><div class="val" style="color:#166534">${kpisSemana.ok}</div><div class="lbl">Completos</div></div>
      <div class="kpi"><div class="val" style="color:#b45309">${kpisSemana.par}</div><div class="lbl">Parciais</div></div>
      <div class="kpi"><div class="val" style="color:#dc2626">${kpisSemana.nok}</div><div class="lbl">Não Realizados</div></div>
      <div class="kpi"><div class="val">${kpisSemana.taxa}</div><div class="lbl">Taxa Geral</div></div>
    </div>
    <table>
      <thead><tr>
        <th>GA</th><th>Revenda(s)</th>
        ${diasLabel.map(d => `<th class="dc">${d}</th>`).join("")}
        <th class="dc">✅</th><th class="dc">⚠️</th><th class="dc">❌</th><th class="dc">Taxa</th>
      </tr></thead>
      <tbody>${linhasGA}</tbody>
    </table>
    <p style="margin-top:10px;font-size:9px;color:#64748b">✅ Completo = 100% · ⚠️ Parcial = realizou incompleto · ❌ Não Realizado · · = sem dado</p>
    <div class="footer">MetricFlow · Relatório Semanal</div>
    </body></html>`;

        const w = window.open("", "_blank");
        if (!w) { toast.error("Pop-up bloqueado. Libere pop-ups para este site."); return; }
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 600);
    }, [semanaAtual, diasSemana, resumosPorGA, kpisSemana, filtroRevenda, getAnalise]);


    const handleNavigate = (page: string) => {
        const rotas: Record<string, string> = {
            dashboard: "/", vendedores: "/vendedores", compliance: "/compliance",
            clientes: "/clientes", relatorio: "/relatorio",relatorio_semanal: "/relatorio-semanal", rota_coaching: "/rota-coaching",
        };
        if (rotas[page]) { window.location.href = rotas[page]; return; }
        if (page !== "relatorio_semanal") toast.info(`Módulo "${page}" em breve`);
        else setActivePage(page);
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar activePage={activePage} onNavigate={handleNavigate} />

            <main className="flex-1 ml-60 min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm px-8 py-4 border-b border-slate-100 flex items-center justify-between"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div>
                        <h1 className="text-xl text-slate-800" style={{ fontWeight: 900 }}>Realização de Agendas — GAs</h1>
                        <p className="text-xs text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                            Resumo semanal para gestão · {semanaAtual ? semanaLabel(semanaAtual) : "carregando..."}
                        </p>
                    </div>
                    <button onClick={exportarPDF}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs text-white bg-green-700 hover:bg-green-800 transition-colors"
                        style={{ fontWeight: 700 }}>
                        <Download className="w-4 h-4" /> Exportar PDF
                    </button>
                </header>

                <div className="px-8 py-6 space-y-6">

                    {/* ── Controles ────────────────────────────────────────────────────── */}
                    <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
                        style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                        {/* Seletor de semana */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>Semana</label>
                            <select value={semanaIdx} onChange={e => setSemanaIdx(Number(e.target.value))}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-200">
                                {semanas.map((seg, i) => (
                                    <option key={i} value={i}>{semanaLabel(seg)}{i === 0 ? " (atual)" : ""}</option>
                                ))}
                            </select>
                        </div>

                        {/* Seletor de revenda */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 600 }}>Revenda</label>
                            <select value={filtroRevenda} onChange={e => setFiltroRevenda(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-200">
                                <option value="">Todas</option>
                                {revendasSemana.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        {/* Legenda rápida */}
                        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
                            {(["ok", "partial", "nok"] as const).map(s => (
                                <span key={s} className="flex items-center gap-1">
                                    <span>{STATUS_META[s].icone}</span> {STATUS_META[s].label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-green-600 animate-spin" />
                        </div>
                    )}

                    {erro && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                            <p className="text-red-600 text-sm" style={{ fontWeight: 600 }}>⚠️ {erro}</p>
                        </div>
                    )}

                    {!loading && !erro && semanaAtual && (
                        <>
                            {/* ── KPI Cards ────────────────────────────────────────────────── */}
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                                {[
                                    { label: "GAs monitorados", value: kpisSemana.totalGAs, color: "text-slate-700", bg: "from-slate-50 to-slate-100/50" },
                                    { label: "Revendas", value: kpisSemana.revendas, color: "text-indigo-600", bg: "from-indigo-50 to-blue-50" },
                                    { label: "Agendamentos", value: kpisSemana.agendados, color: "text-slate-700", bg: "from-slate-50 to-slate-100/50" },
                                    { label: "Completos ✅", value: kpisSemana.ok, color: "text-green-700", bg: "from-green-50 to-emerald-50" },
                                    { label: "Parciais ⚠️", value: kpisSemana.par, color: "text-amber-700", bg: "from-amber-50 to-yellow-50" },
                                    { label: "Taxa de realização", value: kpisSemana.taxa, color: "text-green-700", bg: "from-green-50 to-emerald-50" },
                                ].map(k => (
                                    <div key={k.label} className={`bg-gradient-to-br ${k.bg} rounded-2xl p-4 border border-white`}
                                        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                                        <p className="text-xs text-slate-400 leading-tight" style={{ fontWeight: 600 }}>{k.label}</p>
                                        <p className={`text-2xl mt-1 ${k.color}`} style={{ fontWeight: 900 }}>{k.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* ── Tabela principal ─────────────────────────────────────────── */}
                            <div className="bg-white rounded-2xl overflow-hidden"
                                style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-slate-800 text-base" style={{ fontWeight: 800 }}>
                                            Realização por GA — {semanaLabel(semanaAtual)}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Clique no GA para ver o detalhe por dia</p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-green-700">
                                                <th className="px-4 py-3 text-xs text-white text-left uppercase tracking-widest" style={{ fontWeight: 700 }}>GA</th>
                                                <th className="px-4 py-3 text-xs text-white text-left uppercase tracking-widest" style={{ fontWeight: 700 }}>Revenda(s)</th>
                                                {diasSemana.map(iso => (
                                                    <th key={iso} className="px-3 py-3 text-xs text-white text-center uppercase tracking-widest" style={{ fontWeight: 700, minWidth: 72 }}>
                                                        {fmtDataCurta(iso)}
                                                    </th>
                                                ))}
                                                <th className="px-3 py-3 text-xs text-white text-center" style={{ fontWeight: 700 }}>✅</th>
                                                <th className="px-3 py-3 text-xs text-white text-center" style={{ fontWeight: 700 }}>⚠️</th>
                                                <th className="px-3 py-3 text-xs text-white text-center" style={{ fontWeight: 700 }}>❌</th>
                                                <th className="px-3 py-3 text-xs text-white text-center" style={{ fontWeight: 700 }}>Taxa</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resumosPorGA.length === 0 && (
                                                <tr><td colSpan={diasSemana.length + 6} className="px-4 py-10 text-center text-sm text-slate-400">
                                                    Nenhum dado para esta semana.
                                                </td></tr>
                                            )}

                                            {resumosPorGA.map((ga, idx) => {
                                                const isExp = expandedGA.has(ga.gaId);
                                                const taxaCor = ga.taxaConf >= 80 ? "text-green-600" : ga.taxaConf >= 50 ? "text-amber-600" : "text-red-500";

                                                return (
                                                    <React.Fragment key={ga.gaId}>
                                                        {/* Linha resumo do GA */}
                                                        <tr
                                                            className={`border-b border-slate-100 cursor-pointer transition-colors ${isExp ? "bg-green-50/40" : idx % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/40 hover:bg-slate-100/60"}`}
                                                            onClick={() => toggleGA(ga.gaId)}>

                                                            <td className="px-4 py-3 text-sm" style={{ fontWeight: 700 }}>
                                                                <div className="flex items-center gap-2">
                                                                    {isExp
                                                                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                                                                        : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                                    <span className="text-indigo-700">{ga.gaId}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs text-slate-600">{ga.revendas.join(", ")}</td>

                                                            {diasSemana.map(iso => (
                                                                <CelulaDia key={iso} dia={ga.dias.find(d => d.data === iso)} />
                                                            ))}

                                                            <td className="px-3 py-3 text-center text-sm text-green-600 tabular-nums" style={{ fontWeight: 700 }}>{ga.totalOk || "—"}</td>
                                                            <td className="px-3 py-3 text-center text-sm text-amber-600 tabular-nums" style={{ fontWeight: 700 }}>{ga.totalPartial || "—"}</td>
                                                            <td className="px-3 py-3 text-center text-sm text-red-500 tabular-nums" style={{ fontWeight: 700 }}>{ga.totalNok || "—"}</td>
                                                            <td className="px-3 py-3 text-center">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className={`text-sm tabular-nums ${taxaCor}`} style={{ fontWeight: 800 }}>
                                                                        {ga.taxaConf}%
                                                                    </span>
                                                                    {semanaAtual && getAnalise(ga.gaId, dateParaIso(semanaAtual)) && (
                                                                        <span className="text-xs text-green-600 flex items-center gap-0.5" title="Análise registrada">
                                                                            <MessageSquare className="w-3 h-3" />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Detalhe por dia (expandido) */}
                                                        {isExp && (
                                                            <tr className="border-b border-slate-100">
                                                                <td colSpan={diasSemana.length + 6} className="bg-slate-50/60 px-6 py-4">
                                                                    <div className="grid grid-cols-1 gap-3">
                                                                        {ga.dias.filter(d => d.status !== "ausente").map(dia => (
                                                                            <div key={dia.data} className="flex items-center gap-4 bg-white rounded-xl px-4 py-3 border border-slate-100">
                                                                                <div className="w-24 text-xs text-slate-500" style={{ fontWeight: 700 }}>
                                                                                    {fmtDataCurta(dia.data)}
                                                                                </div>
                                                                                <PilulhaStatus status={dia.status} />
                                                                                {dia.vendedor && dia.vendedor !== "-" && (
                                                                                    <span className="text-xs text-slate-500">
                                                                                        Vendedor: <span className="font-mono text-slate-700">{dia.vendedor}</span>
                                                                                    </span>
                                                                                )}
                                                                                {dia.rev && (
                                                                                    <span className="text-xs text-slate-500">
                                                                                        {dia.rev}
                                                                                    </span>
                                                                                )}
                                                                                {dia.status !== "na" && dia.pdvsProg > 0 && (
                                                                                    <div className="ml-auto flex items-center gap-3">
                                                                                        <span className="text-xs text-slate-400">GA visitou</span>
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                                                <div className="h-full rounded-full transition-all"
                                                                                                    style={{
                                                                                                        width: `${Math.min(100, (dia.gaVis / dia.pdvsProg) * 100)}%`,
                                                                                                        background: dia.status === "ok" ? "#22c55e" : dia.status === "partial" ? "#f59e0b" : "#ef4444",
                                                                                                    }} />
                                                                                            </div>
                                                                                            <span className="text-xs tabular-nums text-slate-600" style={{ fontWeight: 600 }}>
                                                                                                {dia.gaVis}/{dia.pdvsProg}
                                                                                            </span>
                                                                                            <span className="text-xs tabular-nums" style={{ fontWeight: 700, color: dia.status === "ok" ? "#16a34a" : dia.status === "partial" ? "#d97706" : "#dc2626" }}>
                                                                                                {dia.pctGA}%
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                        {ga.totalAusente > 0 && (
                                                                            <p className="text-xs text-slate-400 px-2">
                                                                                {ga.totalAusente} dia(s) sem registro na semana.
                                                                            </p>
                                                                        )}

                                                                        {/* ── Editor de análise / storytelling ── */}
                                                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                <PenLine className="w-3.5 h-3.5 text-green-600" />
                                                                                <span className="text-xs text-green-700 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                                                                                    Análise · {ga.gaId}
                                                                                </span>
                                                                                <span className="text-xs text-slate-400 ml-1" style={{ fontWeight: 400 }}>
                                                                                    — será incluída no PDF
                                                                                </span>
                                                                            </div>
                                                                            <EditorAnalise
                                                                                gaId={ga.gaId}
                                                                                semana={semanaAtual ? dateParaIso(semanaAtual) : ""}
                                                                                html={semanaAtual ? getAnalise(ga.gaId, dateParaIso(semanaAtual)) : ""}
                                                                                onChange={html => semanaAtual && setAnalise(ga.gaId, dateParaIso(semanaAtual), html)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* ── Nota de rodapé ────────────────────────────────────────────── */}
                            <div className="bg-slate-50 rounded-2xl px-5 py-4 border border-slate-200">
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    <strong>Legenda:</strong> ✅ Completo = 100% das visitas programadas realizadas pelo GA ·
                                    ⚠️ Parcial = GA realizou mas não completou todos os PDVs ·
                                    ❌ Não Realizado = GA não enviou registros no app ·
                                    · = sem agenda ou sem dados para o dia.
                                    A <strong>Taxa de realização</strong> considera Completo como 100% e Parcial como 50% do peso.
                                </p>
                            </div>
                        </>
                    )}

                    <div className="text-center py-4">
                        <p className="text-xs text-slate-300" style={{ fontWeight: 500 }}>
                            MetricFlow · Relatório Semanal · {new Date().toLocaleDateString("pt-BR")}
                    </p>
                    </div>
                </div>
            </main>
        </div>
    );
}