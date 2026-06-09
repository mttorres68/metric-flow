import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { EditorAnalise } from "@/components/EditorAnalise";
import { toast } from "sonner";
import {
    RefreshCw, AlertTriangle, Printer, MessageCircle, Loader2, Sparkles, Save, X, PenLine,
} from "lucide-react";
import { revendasMatch } from "../lib/revenda";
import { blobToBase64 } from "../lib/pdf";
import { sanitizeInsightHtml } from "../lib/formatters";
import { FLAG_SHORT } from "../lib/constants";

interface RecorrenciaSemanalProps {
    dataInicio: string;
    dataFim: string;
    revendaFiltro?: string;
    setAnalise: (rev: string, html: string) => void;
}

async function fetchSemanalBase64(
    rev: string,
    dataInicio: string,
    dataFim: string,
    porRevenda: Record<string, any[]>,
    insights: Record<string, string>
) {
    const resp = await fetch("/api/relatorio/gerar-semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            revenda: rev,
            semanaInicio: dataInicio,
            semanaFim: dataFim,
            mapaJson: JSON.stringify(porRevenda[rev] ?? []),
            insightHtml: insights[rev] ?? "",
        }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao gerar PDF semanal");
    }
    const blob = await resp.blob();
    const filename =
        resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `${rev}_recorrencia_${dataInicio}.pdf`;
    const base64 = await blobToBase64(blob);
    return { base64, filename, blob };
}

async function fetchUnificadoBase64(
    revendas: string[],
    dataInicio: string,
    dataFim: string,
    porRevenda: Record<string, any[]>,
    insights: Record<string, string>
) {
    const payload = revendas.map(rev => ({
        revenda: rev,
        mapaJson: JSON.stringify(porRevenda[rev] ?? []),
        insightHtml: insights[rev] ?? "",
    }));
    const resp = await fetch("/api/relatorio/gerar-semanal-unificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semanaInicio: dataInicio, semanaFim: dataFim, revendas: payload }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao gerar PDF unificado");
    }
    const blob = await resp.blob();
    const filename =
        resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `recorrencia_semanal_${dataInicio}.pdf`;
    const base64 = await blobToBase64(blob);
    return { base64, filename, blob };
}

export function RecorrenciaSemanal({ dataInicio, dataFim, revendaFiltro, setAnalise }: RecorrenciaSemanalProps) {
    const habilitado = !!dataInicio && !!dataFim;

    const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
    const [sendingWA, setSendingWA] = useState<string | null>(null);
    const [downloadingUnificado, setDownloadingUnificado] = useState(false);
    const [sendingWAUnificado, setSendingWAUnificado] = useState(false);

    const destQuery = trpc.evolution.listDestinatarios.useQuery();
    const waStatusQuery = trpc.evolution.getStatus.useQuery(undefined, { refetchInterval: 30_000, retry: false });
    const sendPDFMutation = trpc.evolution.sendPDF.useMutation();

    const waConectado = waStatusQuery.data?.state === "open";

    const { data, isLoading, error } = trpc.analise.getRecorrenciaSemanal.useQuery(
        { dataInicio, dataFim, revenda: revendaFiltro || undefined },
        { enabled: habilitado, staleTime: 5 * 60 * 1000 }
    );

    const { data: salvos } = trpc.analise.listarRecorrenciaPorSemana.useQuery(
        { semanaInicio: dataInicio },
        { enabled: habilitado }
    );

    const gerar = trpc.analise.gerarInsightRecorrencia.useMutation();
    const salvar = trpc.analise.salvarRecorrencia.useMutation();

    const [insights, setInsights] = useState<Record<string, string>>({});
    const [insightVersions, setInsightVersions] = useState<Record<string, number>>({});
    const [gerando, setGerando] = useState<string | null>(null);
    const [salvando, setSalvando] = useState<string | null>(null);

    useEffect(() => {
        if (!salvos?.length) return;
        setInsights(prev => {
            const next = { ...prev };
            salvos.forEach((s: { revenda: string; insightHtml: string }) => {
                if (s.insightHtml) next[s.revenda] = sanitizeInsightHtml(s.insightHtml);
            });
            return next;
        });
        setInsightVersions(prev => {
            const next = { ...prev };
            salvos.forEach((s: { revenda: string; insightHtml: string }) => {
                if (s.insightHtml) next[s.revenda] = (prev[s.revenda] ?? 0) + 1;
            });
            return next;
        });
    }, [salvos]);

    // ociosidadeAlta oculta temporariamente (cálculo não desconta almoço)
    const flags = (data?.flags ?? []).filter(f => f.id !== "ociosidadeAlta");
    const porRevenda = data?.porRevenda ?? {};
    const revendas = Object.keys(porRevenda).sort();

    async function handleGerar(rev: string) {
        setGerando(rev);
        try {
            const res = await gerar.mutateAsync({ revenda: rev, dataInicio, dataFim });
            setInsights(prev => ({ ...prev, [rev]: sanitizeInsightHtml(res.html) }));
            setInsightVersions(prev => ({ ...prev, [rev]: (prev[rev] ?? 0) + 1 }));
            toast.success(`Análise gerada para ${rev}`);
        } catch (e: any) {
            toast.error(e.message ?? "Falha ao gerar análise inteligente.");
        } finally {
            setGerando(null);
        }
    }

    async function handleSalvar(rev: string) {
        setSalvando(rev);
        try {
            await salvar.mutateAsync({
                revenda: rev,
                semanaInicio: dataInicio,
                semanaFim: dataFim,
                mapaJson: JSON.stringify(porRevenda[rev] ?? []),
                insightHtml: insights[rev] ?? "",
            });
            toast.success(`Recorrência de ${rev} salva.`);
        } catch (e: any) {
            toast.error(e.message ?? "Falha ao salvar.");
        } finally {
            setSalvando(null);
        }
    }

    async function handleDownloadPDF(rev: string) {
        setDownloadingPDF(rev);
        try {
            const { blob, filename } = await fetchSemanalBase64(rev, dataInicio, dataFim, porRevenda, insights);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF semanal baixado!");
        } catch (e: any) {
            toast.error(e.message ?? "Erro ao baixar PDF.");
        } finally {
            setDownloadingPDF(null);
        }
    }

    async function handleDownloadUnificado() {
        setDownloadingUnificado(true);
        try {
            const { blob, filename } = await fetchUnificadoBase64(revendas, dataInicio, dataFim, porRevenda, insights);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF semanal unificado baixado!");
        } catch (e: any) {
            toast.error(e.message ?? "Erro ao baixar PDF.");
        } finally {
            setDownloadingUnificado(false);
        }
    }

    async function handleEnviarWA(rev: string) {
        if (!waConectado) { toast.error("WhatsApp desconectado."); return; }
        const allDests = destQuery.data ?? [];
        const destsRev = allDests.filter(d => d.revendas.some((r: string) => revendasMatch(r, rev)));
        if (!destsRev.length) { toast.error(`Sem destinatários para ${rev}`); return; }
        setSendingWA(rev);
        try {
            const { base64, filename } = await fetchSemanalBase64(rev, dataInicio, dataFim, porRevenda, insights);
            const caption = `Recorrência semanal ${rev} — ${dataInicio} a ${dataFim}`;
            const erros: string[] = [];
            for (const dest of destsRev) {
                try {
                    await sendPDFMutation.mutateAsync({ telefone: dest.telefone, base64, filename, caption });
                } catch (e: any) {
                    erros.push(`${dest.apelido || dest.nome}: ${e.message}`);
                }
            }
            if (erros.length === 0) toast.success(`PDF enviado para ${destsRev.length} destinatário(s)!`);
            else toast.error(`${erros.length} falha(s): ${erros[0]}`);
        } catch (e: any) {
            toast.error(e.message ?? "Erro ao enviar WhatsApp.");
        } finally {
            setSendingWA(null);
        }
    }

    async function handleWAUnificado() {
        if (!waConectado) { toast.error("WhatsApp desconectado."); return; }
        const allDests = destQuery.data ?? [];
        if (!allDests.length) { toast.error("Sem destinatários cadastrados."); return; }
        setSendingWAUnificado(true);
        try {
            const { base64, filename } = await fetchUnificadoBase64(revendas, dataInicio, dataFim, porRevenda, insights);
            const caption = `Recorrência semanal — ${dataInicio} a ${dataFim}`;
            const erros: string[] = [];
            for (const dest of allDests) {
                try {
                    await sendPDFMutation.mutateAsync({ telefone: dest.telefone, base64, filename, caption });
                } catch (e: any) {
                    erros.push(`${dest.apelido || dest.nome}: ${e.message}`);
                }
            }
            if (erros.length === 0) toast.success(`PDF enviado para ${allDests.length} destinatário(s)!`);
            else toast.error(`${erros.length} falha(s): ${erros[0]}`);
        } catch (e: any) {
            toast.error(e.message ?? "Erro ao enviar WhatsApp.");
        } finally {
            setSendingWAUnificado(false);
        }
    }

    if (!habilitado)
        return <div className="px-6 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">Selecione Data Início e Data Fim para ver a recorrência da semana.</div>;
    if (isLoading)
        return <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500 text-sm"><RefreshCw size={16} className="animate-spin mr-2" /> Carregando recorrência…</div>;
    if (error)
        return <div className="flex items-center justify-center py-20 text-red-500 text-sm gap-2"><AlertTriangle size={16} /> {error.message}</div>;
    if (revendas.length === 0)
        return <div className="px-6 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">Nenhum dado para o período selecionado.</div>;

    return (
        <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
            {revendas.length > 0 && (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={handleDownloadUnificado}
                        disabled={downloadingUnificado || sendingWAUnificado}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 font-semibold"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        {downloadingUnificado ? "Gerando…" : "PDF unificado"}
                    </button>
                    <button
                        onClick={handleWAUnificado}
                        disabled={downloadingUnificado || sendingWAUnificado || !waConectado}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-50 font-semibold"
                        style={{ background: waConectado && !sendingWAUnificado ? "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" : "#94a3b8" }}
                        title={waConectado ? "Enviar PDF unificado a todos os destinatários" : "WhatsApp desconectado"}
                    >
                        {sendingWAUnificado
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
                            : <><MessageCircle className="w-3.5 h-3.5" /> Enviar todos (WA)</>}
                    </button>
                </div>
            )}

            {revendas.map(rev => {
                const lista = (porRevenda[rev] ?? []).filter((v: any) => v.scoreCritico > 0);
                return (
                    <div key={rev} className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] overflow-hidden">
                        <div className="px-5 py-3 border-b border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase">
                                Revenda: <span className="text-indigo-600 dark:text-indigo-400">{rev}</span>
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {lista.length} vendedor(es) · {dataInicio} a {dataFim}
                                </span>
                                <button
                                    onClick={() => handleDownloadPDF(rev)}
                                    disabled={downloadingPDF === rev}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50 font-semibold"
                                    title="Baixar PDF semanal desta revenda"
                                >
                                    <Printer className="w-3 h-3" />
                                    {downloadingPDF === rev ? "Gerando…" : "PDF"}
                                </button>
                                <button
                                    onClick={() => handleEnviarWA(rev)}
                                    disabled={sendingWA === rev || !waConectado}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-white transition-colors disabled:opacity-50 font-semibold"
                                    style={{ background: sendingWA === rev || !waConectado ? "#94a3b8" : "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
                                    title={waConectado ? `Enviar PDF semanal de ${rev} pelo WhatsApp` : "WhatsApp desconectado"}
                                >
                                    {sendingWA === rev
                                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando…</>
                                        : <><MessageCircle className="w-3 h-3" /> WA</>}
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-green-950 text-slate-100">
                                        <th className="px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide align-bottom">Vend.</th>
                                        <th className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide whitespace-nowrap align-bottom" title="Dias com operação (visitas dentro do raio)">Dias ativos</th>
                                        {flags.map(f => (
                                            <th key={f.id} title={f.label} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-tight leading-tight align-bottom">
                                                {FLAG_SHORT[f.id] ?? f.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((v: any, i: number) => (
                                        <tr key={v.vendedor} className={`hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 ${i % 2 ? "bg-slate-50 dark:bg-slate-800/30" : ""}`}>
                                            <td className="px-1.5 py-2 font-mono font-bold text-indigo-600 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-700/40">{v.vendedor}</td>
                                            <td className="px-1 py-2 text-center text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/40">{v.diasAtivos}</td>
                                            {flags.map(f => {
                                                const m = v.metricas[f.id];
                                                return (
                                                    <td key={f.id} className="px-1 py-2 text-center border-b border-slate-100 dark:border-slate-700/40">
                                                        {m.dias === 0 ? (
                                                            <span className="text-slate-300 dark:text-slate-600">—</span>
                                                        ) : m.recorrente ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border text-[11px] font-bold bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50" title={`${f.label}: ${m.datas.join(", ")}`}>
                                                                {m.dias}/{v.diasAtivos}
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-600 dark:text-amber-400 text-[11px]" title={`${f.label}: ${m.datas.join(", ")}`}>{m.dias}/{v.diasAtivos}</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-5 py-4 border-t border-slate-100 dark:border-[var(--border)] bg-slate-50/40 dark:bg-[var(--background)]/40 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-widest font-bold mr-2">Análise inteligente · {rev}</span>
                                <button
                                    onClick={() => handleGerar(rev)}
                                    disabled={gerando === rev}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
                                >
                                    {gerando === rev ? <><Loader2 className="w-3 h-3 animate-spin" /> Gerando…</> : <><Sparkles className="w-3 h-3" /> Gerar</>}
                                </button>
                                <button
                                    onClick={() => handleSalvar(rev)}
                                    disabled={salvando === rev}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
                                >
                                    {salvando === rev ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                                </button>
                                {insights[rev] && (
                                    <>
                                        <button
                                            onClick={() => { setAnalise(rev, insights[rev]); toast.success("Enviado para o editor da revenda (visão diária)."); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                        >
                                            <PenLine className="w-3 h-3" /> Enviar p/ diária
                                        </button>
                                        <button
                                            onClick={() => {
                                                setInsights(prev => ({ ...prev, [rev]: "" }));
                                                setInsightVersions(prev => ({ ...prev, [rev]: (prev[rev] ?? 0) + 1 }));
                                                toast.success("Análise apagada. Salve para persistir.");
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Apagar análise inteligente"
                                        >
                                            <X className="w-3 h-3" /> Apagar
                                        </button>
                                    </>
                                )}
                            </div>
                            <EditorAnalise
                                key={`semanal-${rev}-${insightVersions[rev] ?? 0}`}
                                id={`editor-semanal-${rev}`}
                                html={insights[rev] ?? ""}
                                onChange={html => setInsights(prev => ({ ...prev, [rev]: html }))}
                                placeholder={`Nenhuma análise para ${rev}. Use "Gerar" para criar automaticamente ou escreva aqui.`}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
