import React from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
    MessageCircle, X, AlertCircle, Loader2, CheckCircle2, User, Send,
} from "lucide-react";
import { revendasMatch } from "../lib/revenda";
import { fetchPDFBase64, fetchThumbnail, fetchUnifiedPDFBase64 } from "../lib/pdf";
import { WA_SEL_KEY } from "../lib/constants";
import type { RevState, RevStatus } from "../lib/types";

interface EnviarWAModalProps {
    revendasOrdenadas: string[];
    data: string;
    getAnalise: (rev: string) => string;
    getAnaliseGAs: (rev: string) => string;
    onClose: () => void;
}

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

function loadSavedSelecoes(): Record<string, { checked: boolean; selectedDestIds: string[] }> {
    try { return JSON.parse(localStorage.getItem(WA_SEL_KEY) || "{}"); }
    catch { return {}; }
}

function saveSelecoes(rows: RevState[]) {
    const map: Record<string, { checked: boolean; selectedDestIds: string[] }> = {};
    rows.forEach(r => { map[r.rev] = { checked: r.checked, selectedDestIds: [...r.selectedDestIds] }; });
    localStorage.setItem(WA_SEL_KEY, JSON.stringify(map));
}

export function EnviarWAModal({ revendasOrdenadas, data, getAnalise, getAnaliseGAs, onClose }: EnviarWAModalProps) {
    const destQuery = trpc.evolution.listDestinatarios.useQuery();
    const statusQuery = trpc.evolution.getStatus.useQuery();
    const sendPDF = trpc.evolution.sendPDF.useMutation();
    const sendMessage = trpc.evolution.sendMessage.useMutation();

    const [preMsg, setPreMsg] = React.useState("");
    const [rows, setRows] = React.useState<RevState[]>([]);
    const [sending, setSending] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [mode, setMode] = React.useState<"byRevenda" | "unified">("byRevenda");
    const [unifiedSelected, setUnifiedSelected] = React.useState<Set<string>>(new Set());
    const [unifiedStatus, setUnifiedStatus] = React.useState<{ status: RevStatus; detail: string }>({ status: "idle", detail: "" });

    const connected = statusQuery.data?.state === "open";
    const allDests = destQuery.data ?? [];

    const dateLabel = data
        ? new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";

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

    React.useEffect(() => {
        if (!destQuery.isLoading) {
            setRows(buildRows());
            setUnifiedSelected(new Set(allDests.map(d => d.id)));
        }
    }, [buildRows, destQuery.isLoading]);

    function setRowStatus(rev: string, status: RevStatus, detail = "") {
        setRows(prev => prev.map(r => r.rev === rev ? { ...r, status, detail } : r));
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

    async function handleSend() {
        const targets = rows.filter(r => r.checked);
        if (!targets.length || !connected) return;
        setSending(true);
        setRows(prev => prev.map(r => r.checked ? { ...r, status: "idle", detail: "" } : r));

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

            const thumbnail = await fetchThumbnail(base64);
            setRowStatus(rev, "sending", `Enviando para ${destObjs.length} destinatário(s)…`);
            const caption = `Relatório ${rev} — ${dateLabel}`;
            const erros: string[] = [];

            for (const dest of destObjs) {
                try {
                    if (preMsg.trim()) await sendMessage.mutateAsync({ telefone: dest.telefone, texto: preMsg.trim() });
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

    const checkedCount = rows.filter(r => r.checked).length;
    const hasAnyDests = rows.some(r => r.dests.length > 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 dark:border-[var(--border)] overflow-hidden flex flex-col max-h-[90vh]">

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

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
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
