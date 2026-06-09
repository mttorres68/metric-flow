import React, { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ALL_COLS } from "../lib/constants";
import type { ColId } from "../lib/types";

interface ColumnsSelectorProps {
    col: (id: ColId) => boolean;
    toggle: (id: ColId) => void;
    toggleAll: () => void;
    allOn: boolean;
    hiddenCount: number;
}

export function ColumnsSelector({ col, toggle, toggleAll, allOn, hiddenCount }: ColumnsSelectorProps) {
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
