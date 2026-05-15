import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { PIRAMIDE_COR } from "../constants";
import type { Indicador } from "../types";
import { DetailBlock } from "./RichText";

export function FragmentRow({ item, aberto, corPiramide, onToggle }: {
    item: Indicador;
    aberto: boolean;
    corPiramide: string;
    onToggle: () => void;
}) {
    return (
        <>
            <tr className="hover:bg-slate-50/80 dark:hover:bg-[var(--accent)] cursor-pointer transition-colors" onClick={onToggle}>
                <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                        {item.idIndicador.split(" - ")[0]}
                    </span>
                </td>
                <td className="px-4 py-3">
                    <p className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 600 }}>{item.macroArea}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{item.microArea}</p>
                </td>
                <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs"
                        style={{ background: `${corPiramide}33`, color: corPiramide, fontWeight: 700 }}>
                        {item.piramide}
                    </span>
                </td>
                <td className="px-4 py-3 max-w-md">
                    <p className="text-slate-700 dark:text-slate-200 truncate" style={{ fontWeight: 500 }}>
                        {item.descricaoItem}
                    </p>
                </td>
                <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs ${item.tipoResposta === "Maturidade"
                        ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300"
                        : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300"
                        }`} style={{ fontWeight: 600 }}>
                        {item.tipoResposta}
                    </span>
                </td>
                <td className="px-4 py-3 text-center">
                    {(item.evidenciaObrigatoria || "").toUpperCase() === "SIM" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                </td>
                <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-slate-800 dark:text-slate-200" style={{ fontWeight: 700 }}>
                        {item.pontoPossivel}
                    </span>
                </td>
                <td className="px-4 py-3 text-right">
                    {aberto
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </td>
            </tr>
            {aberto && (
                <tr className="bg-slate-50/60 dark:bg-[var(--accent)]/40">
                    <td colSpan={8} className="px-6 py-4 space-y-3">
                        <DetailBlock titulo="Detalhamento do Item" texto={item.detalhamentoItem} />
                        <DetailBlock titulo="Informação do Item" texto={item.informacaoItem} />
                        <DetailBlock titulo="Detalhes da Evidência" texto={item.detalhesEvidencia} />
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2">
                            <span><span style={{ fontWeight: 700 }}>Operação:</span> {item.nomeOperacao} ({item.idOperacao})</span>
                            <span><span style={{ fontWeight: 700 }}>Período:</span> {item.mes}/{item.ano}</span>
                            <span><span style={{ fontWeight: 700 }}>Plano de Ação:</span> {item.planoAcao}</span>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
