import { X } from "lucide-react";

interface Cerca {
    id: string;
    name: string;
}

interface Props {
    aba: "coaching" | "frota";
    dateStart: string;
    dateEnd: string;
    revenda: string;
    ga: string;
    status: string;
    geocercaId: string | undefined;
    revendasUnicas: string[];
    gasUnicos: string[];
    cercasInfleet: Cerca[];
    setFiltro: (k: string, v: any) => void;
    resetFiltros: () => void;
    hasFiltrosAtivos: boolean;
}

function FiltroInput({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800" />
        </div>
    );
}

function FiltroSelect({ label, value, onChange, options, placeholder }: {
    label: string; value: string; onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>; placeholder: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800">
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

export function RotaFiltros({
    aba, dateStart, dateEnd, revenda, ga, status, geocercaId,
    revendasUnicas, gasUnicos, cercasInfleet,
    setFiltro, resetFiltros, hasFiltrosAtivos,
}: Props) {
    return (
        <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4 border border-slate-200 dark:border-[var(--border)]"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

            <div className="flex gap-4">
                <FiltroInput label="De" type="date" value={dateStart} onChange={v => setFiltro("dateStart", v)} />
                <FiltroInput label="Até" type="date" value={dateEnd} onChange={v => setFiltro("dateEnd", v)} />
            </div>

            <FiltroSelect label="Revenda" value={revenda} onChange={v => setFiltro("revenda", v || undefined)}
                options={revendasUnicas.map(r => ({ value: r, label: r }))} placeholder="Todas" />

            {aba === "coaching" && <>
                <FiltroSelect label="GA" value={ga} onChange={v => setFiltro("ga", v || undefined)}
                    options={gasUnicos.map(g => ({ value: g, label: g }))} placeholder="Todos" />

                <FiltroSelect label="Status" value={status} onChange={v => setFiltro("status", v || undefined)}
                    options={[
                        { value: "ok", label: "✅ Completo" },
                        { value: "partial", label: "⚠️ Parcial" },
                        { value: "nok", label: "❌ Não Realizado" },
                        { value: "na", label: "➖ Sem Agenda" },
                    ]} placeholder="Todos os status" />
            </>}

            {aba === "frota" && (
                <FiltroSelect
                    label="Cerca (Referência de Sede)"
                    value={geocercaId || ""}
                    onChange={v => setFiltro("geocercaId", v || undefined)}
                    options={cercasInfleet.map(c => ({ value: c.id, label: c.name }))}
                    placeholder="Nenhuma (Ignorar)"
                />
            )}

            {hasFiltrosAtivos && (
                <button onClick={resetFiltros}
                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    style={{ fontWeight: 600 }}>
                    <X className="w-3.5 h-3.5" /> Limpar
                </button>
            )}
        </div>
    );
}
