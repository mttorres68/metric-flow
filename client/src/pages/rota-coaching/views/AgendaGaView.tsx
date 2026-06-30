import { useState, useMemo } from "react";
import { Plus, CalendarDays, Users, Filter, X, ChevronLeft, ChevronRight, Pencil, Check, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AgendaGaFormView, type AgendaEntryInit } from "./AgendaGaFormView";

function todayIso() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Fortaleza",
        year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
}

function shiftDay(iso: string, delta: number) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
}

function fmtData(iso: string) {
    if (!iso) return iso;
    try {
        return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
        });
    } catch { return iso; }
}

const ATIVIDADES = ["Outra Atividade", "Rota Coaching", "Rota GA", "Administrativo", "Treinamento"] as const;

const BADGE: Record<string, string> = {
    "Rota Coaching": "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    "Rota GA":       "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    "Administrativo":"bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    "Treinamento":   "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    "Outra Atividade":"bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

function AtividadeBadge({ atividade }: { atividade: string }) {
    const cls = BADGE[atividade] ?? BADGE["Outra Atividade"];
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${cls}`}>{atividade}</span>
    );
}

type EditingRow = { id: number; atividade: string; vendedor: string; descricao: string };

export function AgendaGaView() {
    const today = todayIso();
    const [dateStart, setDateStart] = useState(today);
    const [dateEnd, setDateEnd]     = useState(today);
    const [filtroRevenda, setFiltroRevenda] = useState("");
    const [filtroCode, setFiltroCode]       = useState("");
    const [busca, setBusca]                 = useState("");
    const [showForm, setShowForm]           = useState(false);
    const [editEntries, setEditEntries]     = useState<AgendaEntryInit[] | null>(null);
    const [editingId, setEditingId]         = useState<number | null>(null);
    const [editRow, setEditRow]             = useState<EditingRow | null>(null);

    const utils = trpc.useUtils();

    const { data: rows = [], isLoading, error, refetch } = trpc.agendaGa.getAgenda.useQuery(
        { dateStart, dateEnd, revenda: filtroRevenda || undefined },
        { staleTime: 2 * 60 * 1000 },
    );

    const updateMut = trpc.agendaGa.updateEntry.useMutation({
        onSuccess: () => { refetch(); setEditingId(null); setEditRow(null); toast.success("Entrada atualizada"); },
        onError: e => toast.error(e.message),
    });

    const deleteMut = trpc.agendaGa.deleteEntry.useMutation({
        onSuccess: () => { refetch(); toast.success("Entrada removida"); },
        onError: e => toast.error(e.message),
    });

    function abrirEdicaoSemana(itens: typeof rows) {
        const entries: AgendaEntryInit[] = itens.map(r => ({
            id:           r.id,
            revenda:      r.revenda,
            semanaInicio: r.semanaInicio,
            code:         r.code,
            data:         r.data,
            diaSemana:    r.diaSemana,
            atividade:    r.atividade,
            vendedor:     r.vendedor ?? null,
            descricao:    r.descricao ?? null,
        }));
        setEditEntries(entries);
    }

    function startEdit(row: typeof rows[0]) {
        setEditingId(row.id);
        setEditRow({ id: row.id, atividade: row.atividade, vendedor: row.vendedor ?? "", descricao: row.descricao ?? "" });
    }

    function saveEdit() {
        if (!editRow) return;
        updateMut.mutate({ id: editRow.id, atividade: editRow.atividade, vendedor: editRow.vendedor || null, descricao: editRow.descricao || null });
    }

    const revendasUnicas = useMemo(() => [...new Set(rows.map(r => r.revenda))].sort(), [rows]);
    const codesUnicos    = useMemo(() => [...new Set(rows.map(r => r.code))].sort(), [rows]);

    const dadosFiltrados = useMemo(() => {
        let d = rows;
        if (filtroCode) d = d.filter(r => r.code === filtroCode);
        if (busca.trim()) {
            const q = busca.toLowerCase();
            d = d.filter(r =>
                r.code.toLowerCase().includes(q) ||
                (r.vendedor ?? "").toLowerCase().includes(q) ||
                r.atividade.toLowerCase().includes(q) ||
                (r.descricao ?? "").toLowerCase().includes(q)
            );
        }
        return d;
    }, [rows, filtroCode, busca]);

    const gruposPorData = useMemo(() => {
        const m: Record<string, typeof dadosFiltrados> = {};
        dadosFiltrados.forEach(r => {
            if (!m[r.data]) m[r.data] = [];
            m[r.data].push(r);
        });
        return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
    }, [dadosFiltrados]);

    function navegarDia(delta: number) {
        setDateStart(s => shiftDay(s, delta));
        setDateEnd(e => shiftDay(e, delta));
    }

    const temFiltro = !!(filtroRevenda || filtroCode || busca);

    return (
        <>
            {showForm && <AgendaGaFormView onClose={() => { setShowForm(false); refetch(); }} />}
            {editEntries && (
                <AgendaGaFormView
                    initialEntries={editEntries}
                    onClose={() => { setEditEntries(null); refetch(); }}
                />
            )}

            <div className="space-y-4">
                {/* Barra de datas */}
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl border border-slate-200 dark:border-[var(--border)] p-4 flex flex-wrap items-center gap-3"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                    <button onClick={() => navegarDia(-1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-xs">
                        <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs" />
                        <span className="text-slate-400">até</span>
                        <input type="date" value={dateEnd} min={dateStart} onChange={e => setDateEnd(e.target.value)}
                            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs" />
                    </div>
                    <button onClick={() => navegarDia(1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    {dateStart !== today && (
                        <button onClick={() => { setDateStart(today); setDateEnd(today); }}
                            className="text-xs text-indigo-500 font-semibold hover:underline">Hoje</button>
                    )}
                    <span className="ml-auto text-xs text-slate-400">
                        {rows.length} registro{rows.length !== 1 ? "s" : ""} encontrado{rows.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* Filtros + botão nova agenda */}
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-4 border border-slate-200 dark:border-[var(--border)] flex flex-wrap items-center gap-3">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />

                    {revendasUnicas.length > 0 && (
                        <select value={filtroRevenda} onChange={e => setFiltroRevenda(e.target.value)}
                            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            <option value="">Todas as revendas</option>
                            {revendasUnicas.map(rv => <option key={rv} value={rv}>{rv}</option>)}
                        </select>
                    )}

                    {codesUnicos.length > 0 && (
                        <select value={filtroCode} onChange={e => setFiltroCode(e.target.value)}
                            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            <option value="">Todos os codes</option>
                            {codesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}

                    <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
                        className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-44" />

                    {temFiltro && (
                        <button onClick={() => { setFiltroRevenda(""); setFiltroCode(""); setBusca(""); }}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 font-semibold">
                            <X className="w-3.5 h-3.5" /> Limpar
                        </button>
                    )}

                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {dadosFiltrados.length} registros
                    </span>

                    <button onClick={() => setShowForm(true)}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm shadow-violet-200">
                        <Plus className="w-3.5 h-3.5" /> Nova Agenda
                    </button>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-9 h-9 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-violet-500 animate-spin" />
                    </div>
                )}

                {/* Erro */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-5 text-center">
                        <p className="text-red-600 dark:text-red-400 text-sm font-semibold">⚠️ {error.message}</p>
                    </div>
                )}

                {/* Sem dados */}
                {!isLoading && !error && gruposPorData.length === 0 && (
                    <div className="text-center py-16 text-slate-400 text-sm">
                        <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p>Nenhuma agenda para este período.</p>
                        <button onClick={() => setShowForm(true)}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold">
                            <Plus className="w-3.5 h-3.5" /> Criar agenda
                        </button>
                    </div>
                )}

                {/* Cards agrupados por data */}
                {gruposPorData.map(([data, itens]) => (
                    <div key={data} className="bg-white dark:bg-[var(--card)] rounded-2xl border border-slate-200 dark:border-[var(--border)] overflow-hidden"
                        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                        <div className="px-5 py-3 border-b border-slate-100 dark:border-[var(--border)] flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60">
                            <CalendarDays className="w-4 h-4 text-violet-500" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{fmtData(data)}</span>
                            <span className="text-xs text-slate-400 font-medium">{itens.length} {itens.length === 1 ? "entrada" : "entradas"}</span>
                            <button
                                onClick={() => {
                                    // Busca todas as entradas da semana inteira (não só do dia filtrado)
                                    const semana = itens[0]?.semanaInicio;
                                    const entradasSemana = semana
                                        ? rows.filter(r => r.semanaInicio === semana && (filtroRevenda ? r.revenda === filtroRevenda : true))
                                        : itens;
                                    abrirEdicaoSemana(entradasSemana);
                                }}
                                className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
                                <Pencil className="w-3 h-3" /> Editar semana
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-[var(--border)]">
                                        <th className="px-4 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wide w-8">id</th>
                                        <th className="px-4 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wide w-20">Code</th>
                                        <th className="px-4 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wide w-16">Dia</th>
                                        <th className="px-4 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wide">Atividade</th>
                                        <th className="px-4 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wide w-28">Vendedor</th>
                                        <th className="px-4 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wide">Descrição</th>
                                        <th className="px-4 py-2.5 w-16" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-[var(--border)]">
                                    {itens.map(row => {
                                        const isEditing = editingId === row.id;
                                        return (
                                            <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                                <td className="px-4 py-2.5 text-slate-400 font-mono">{row.id}</td>
                                                <td className="px-4 py-2.5 font-mono font-bold text-violet-700 dark:text-violet-400">{row.code}</td>
                                                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-medium">{row.diaSemana}</td>
                                                <td className="px-4 py-2.5">
                                                    {isEditing ? (
                                                        <select value={editRow!.atividade} onChange={e => setEditRow(r => r && { ...r, atividade: e.target.value })}
                                                            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                                            {ATIVIDADES.map(a => <option key={a} value={a}>{a}</option>)}
                                                        </select>
                                                    ) : (
                                                        <AtividadeBadge atividade={row.atividade} />
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                                                    {isEditing ? (
                                                        <input value={editRow!.vendedor} onChange={e => setEditRow(r => r && { ...r, vendedor: e.target.value })}
                                                            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" />
                                                    ) : (
                                                        row.vendedor || <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                                                    {isEditing ? (
                                                        <input value={editRow!.descricao} onChange={e => setEditRow(r => r && { ...r, descricao: e.target.value })}
                                                            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" />
                                                    ) : (
                                                        row.descricao || <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        {isEditing ? (
                                                            <>
                                                                <button onClick={saveEdit} disabled={updateMut.isPending}
                                                                    className="p-1 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                                                                    <Check className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => { setEditingId(null); setEditRow(null); }}
                                                                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => startEdit(row)}
                                                                    className="p-1 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => deleteMut.mutate({ id: row.id })}
                                                                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
