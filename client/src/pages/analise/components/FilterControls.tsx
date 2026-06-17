import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function FilterSelect({ label, value, onChange, placeholder, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
                <option value="">{placeholder}</option>
                {options.map((o, i) => <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

// Mantido para uso avulso se necessário
export function FilterDate({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">{label}</label>
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
        </div>
    );
}

function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function fmt(dateStr: string): string {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
}

export function DateNavFilter({ dataInicio, dataFim, onChange }: {
    dataInicio: string;
    dataFim: string;
    onChange: (inicio: string, fim: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draftInicio, setDraftInicio] = useState(dataInicio);
    const [draftFim, setDraftFim] = useState(dataFim);
    const ref = useRef<HTMLDivElement>(null);

    // Sync drafts when external value changes
    useEffect(() => {
        setDraftInicio(dataInicio);
        setDraftFim(dataFim);
    }, [dataInicio, dataFim]);

    // Fecha ao clicar fora
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const isRange = dataInicio && dataFim && dataInicio !== dataFim;

    const displayText = dataInicio
        ? isRange
            ? `${fmt(dataInicio)} – ${fmt(dataFim)}`
            : fmt(dataInicio)
        : "Selecionar data";

    function handlePrev() {
        if (!dataInicio) return;
        if (isRange) {
            onChange(addDays(dataInicio, -1), addDays(dataFim, -1));
        } else {
            const d = addDays(dataInicio, -1);
            onChange(d, d);
        }
    }

    function handleNext() {
        if (!dataInicio) return;
        if (isRange) {
            onChange(addDays(dataInicio, 1), addDays(dataFim, 1));
        } else {
            const d = addDays(dataInicio, 1);
            onChange(d, d);
        }
    }

    function handleApply() {
        const fim = draftFim && draftFim >= draftInicio ? draftFim : draftInicio;
        onChange(draftInicio, fim);
        setOpen(false);
    }

    function handleDraftInicioChange(v: string) {
        setDraftInicio(v);
        // Se fim ficou antes do início, iguala
        if (draftFim && draftFim < v) setDraftFim(v);
    }

    const btnBase = "flex items-center justify-center w-6 h-6 rounded-md border border-slate-200 dark:border-[var(--border)] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40";

    return (
        <div ref={ref} className="relative flex items-center gap-1">
            <button onClick={handlePrev} disabled={!dataInicio} className={btnBase} title="Dia anterior">
                <ChevronLeft size={13} />
            </button>

            <button
                onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-[var(--border)] bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors min-w-[120px] justify-center"
            >
                <CalendarDays size={12} className="text-indigo-400 flex-shrink-0" />
                {displayText || <span className="text-slate-400">Selecionar</span>}
            </button>

            <button onClick={handleNext} disabled={!dataInicio} className={btnBase} title="Próximo dia">
                <ChevronRight size={13} />
            </button>

            {open && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 bg-white dark:bg-[var(--card)] border border-slate-200 dark:border-[var(--border)] rounded-xl shadow-xl p-4 w-64">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Selecionar período</span>
                        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={13} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Início</label>
                            <input
                                type="date"
                                value={draftInicio}
                                onChange={e => handleDraftInicioChange(e.target.value)}
                                className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fim</label>
                            <input
                                type="date"
                                value={draftFim}
                                min={draftInicio}
                                onChange={e => setDraftFim(e.target.value)}
                                className="text-xs bg-slate-50 dark:bg-[var(--input)] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[var(--border)] rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => {
                                    const today = new Date().toISOString().slice(0, 10);
                                    setDraftInicio(today);
                                    setDraftFim(today);
                                }}
                                className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 dark:border-[var(--border)] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Hoje
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={!draftInicio}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
