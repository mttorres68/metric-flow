import { EditorAnalise } from "@/components/EditorAnalise";
import { FileText, PenLine, Printer } from "lucide-react";

interface Props {
    revendasUnicas: string[];
    dateStart: string;
    getAnalise: (rev: string) => string;
    setAnalise: (rev: string, html: string) => void;
}

export function AnalisesGestor({ revendasUnicas, dateStart, getAnalise, setAnalise }: Props) {
    if (revendasUnicas.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid oklch(0.93 0.006 240)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-slate-800" style={{ fontWeight: 800 }}>
                    Análise do Gestor — GAs
                </span>
                <span className="text-xs text-slate-400 ml-1">
                    — será incluída no PDF · referência: {dateStart}
                </span>
            </div>
            <div className="divide-y divide-slate-100">
                {revendasUnicas.map(rev => (
                    <div key={rev} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <PenLine className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-xs text-emerald-700 uppercase tracking-widest" style={{ fontWeight: 700 }}>
                                    {rev}
                                </span>
                            </div>
                            <a
                                href={`/api/relatorio/gerar?revenda=${encodeURIComponent(rev)}&data=${dateStart}`}
                                download
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
                                style={{ fontWeight: 700 }}
                                title={`Baixar PDF completo — ${rev} (Vendedores + GAs)`}
                            >
                                <Printer className="w-3 h-3" />
                                Baixar PDF
                            </a>
                        </div>
                        <EditorAnalise
                            id={`editor-ga-${rev}`}
                            html={getAnalise(rev)}
                            onChange={html => setAnalise(rev, html)}
                            placeholder={`Análise da rota coaching da revenda ${rev} — destaques, pontos de atenção, planos de ação...`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
