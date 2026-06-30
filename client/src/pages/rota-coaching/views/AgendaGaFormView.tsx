import { useState, useMemo, useEffect, useRef } from "react";
import { X, Plus, Save, Trash2, CalendarDays, ChevronLeft, ChevronRight, Settings, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const ATIVIDADES = ["Outra Atividade", "Rota Coaching", "Rota GA", "Administrativo", "Treinamento"] as const;
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;

function mondayOf(iso: string) {
    const d = new Date(iso + "T12:00:00");
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}

function saturdayOf(monday: string) {
    const d = new Date(monday + "T12:00:00");
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

function fmtSemana(monday: string) {
    const sat = saturdayOf(monday);
    const fmt = (s: string) => s.slice(8) + "/" + s.slice(5, 7);
    return `${fmt(monday)} – ${fmt(sat)}`;
}

function shiftWeek(monday: string, delta: number) {
    return addDays(monday, delta * 7);
}

function gerarLinhasBrancas(revenda: string, semanaInicio: string, codes: string[]): LinhaForm[] {
    return codes.flatMap(code =>
        DIAS.map((dia, i) => ({
            revenda,
            semanaInicio,
            code,
            data: addDays(semanaInicio, i),
            diaSemana: dia,
            atividade: "Outra Atividade",
            vendedor: "",
            descricao: "",
        }))
    );
}

type LinhaForm = {
    id?: number;
    revenda: string;
    semanaInicio: string;
    code: string;
    data: string;
    diaSemana: string;
    atividade: string;
    vendedor: string;
    descricao: string;
};

export type AgendaEntryInit = {
    id: number;
    revenda: string;
    semanaInicio: string;
    code: string;
    data: string;
    diaSemana: string;
    atividade: string;
    vendedor: string | null;
    descricao: string | null;
};

type Props = {
    onClose: () => void;
    /** Quando fornecido, abre o form em modo edição pré-preenchido */
    initialEntries?: AgendaEntryInit[];
};

// ─── Painel de gerenciamento de codes ────────────────────────────────────────
function CodesManager({ onClose }: { onClose: () => void }) {
    const [novaRevenda, setNovaRevenda] = useState("");
    const [novoCode, setNovoCode]       = useState("");

    const { data: codes = [], refetch } = trpc.agendaGa.listCodes.useQuery({});
    const addMut    = trpc.agendaGa.upsertCode.useMutation({ onSuccess: () => { refetch(); setNovoCode(""); setNovaRevenda(""); } });
    const deleteMut = trpc.agendaGa.deleteCode.useMutation({ onSuccess: () => refetch() });

    const revendas = [...new Set(codes.map(c => c.revenda))].sort();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-[var(--border)]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[var(--border)]">
                    <span className="font-bold text-slate-700 dark:text-slate-100 text-sm">Gerenciar Codes</span>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    {revendas.map(rev => (
                        <div key={rev}>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{rev}</p>
                            <div className="flex flex-wrap gap-2">
                                {codes.filter(c => c.revenda === rev).map(c => (
                                    <span key={c.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 font-mono">
                                        {c.code}
                                        <button onClick={() => deleteMut.mutate({ id: c.id })} className="text-slate-400 hover:text-red-500">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                        <input value={novaRevenda} onChange={e => setNovaRevenda(e.target.value)} placeholder="Revenda"
                            className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" />
                        <input value={novoCode} onChange={e => setNovoCode(e.target.value.toUpperCase())} placeholder="Code"
                            className="w-28 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono" />
                        <button onClick={() => { if (novaRevenda && novoCode) addMut.mutate({ revenda: novaRevenda, code: novoCode }); }}
                            disabled={!novaRevenda || !novoCode}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Adicionar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Form principal ───────────────────────────────────────────────────────────
export function AgendaGaFormView({ onClose, initialEntries }: Props) {
    const isEditMode = !!initialEntries?.length;
    const today = new Date().toISOString().slice(0, 10);

    // Deriva estado inicial do modo (edição vs criação)
    const initMonday = isEditMode
        ? mondayOf(initialEntries[0].data)
        : mondayOf(today);
    const initRevenda = isEditMode ? initialEntries[0].revenda : "";
    const initCodes   = isEditMode
        ? [...new Set(initialEntries.map(e => e.code))].sort()
        : [];
    const initLinhas: LinhaForm[] = isEditMode
        ? initialEntries.map(e => ({
            id:           e.id,
            revenda:      e.revenda,
            semanaInicio: e.semanaInicio,
            code:         e.code,
            data:         e.data,
            diaSemana:    e.diaSemana,
            atividade:    e.atividade,
            vendedor:     e.vendedor ?? "",
            descricao:    e.descricao ?? "",
          }))
        : [];

    const [monday, setMonday]         = useState(initMonday);
    const [revenda, setRevenda]       = useState(initRevenda);
    const [codesAtivos, setCodesAtivos] = useState<string[]>(initCodes);
    const [linhas, setLinhas]         = useState<LinhaForm[]>(initLinhas);
    const [showManager, setShowManager] = useState(false);
    const [codeTab, setCodeTab]       = useState<string>(initCodes[0] ?? "");

    // Controla se o efeito "gerar linhas" pode rodar
    // — bloqueado no modo edição para não sobrescrever os dados carregados
    const editInitialized = useRef(isEditMode);

    const { data: allCodes = [] } = trpc.agendaGa.listCodes.useQuery({});
    const saveMut = trpc.agendaGa.saveSemana.useMutation({
        onSuccess: (r) => {
            toast.success(`${r.count} entradas ${isEditMode ? "atualizadas" : "salvas"} com sucesso`);
            onClose();
        },
        onError: (e) => toast.error(e.message),
    });

    const revendas        = useMemo(() => [...new Set(allCodes.map(c => c.revenda))].sort(), [allCodes]);
    const codesDaRevenda  = useMemo(() => allCodes.filter(c => c.revenda === revenda).map(c => c.code), [allCodes, revenda]);

    // Auto-seleciona primeiro code ao trocar revenda (só no modo criação)
    useEffect(() => {
        if (editInitialized.current) return;
        if (revenda && codesDaRevenda.length > 0 && codesAtivos.length === 0) {
            setCodesAtivos([codesDaRevenda[0]]);
            setCodeTab(codesDaRevenda[0]);
        }
    }, [revenda, codesDaRevenda]);

    // Gera linhas em branco quando revenda/semana/codes mudam (só no modo criação)
    useEffect(() => {
        if (editInitialized.current) return;
        if (codesAtivos.length === 0) return;
        setLinhas(gerarLinhasBrancas(revenda, monday, codesAtivos));
        setCodeTab(prev => codesAtivos.includes(prev) ? prev : codesAtivos[0]);
    }, [revenda, monday, codesAtivos]);

    // No modo edição, quando semana/revenda muda, regenera misturando existentes com brancos
    function aplicarMudancaEdicao(novoMonday: string, novaRevenda: string, novoCodes: string[]) {
        if (!isEditMode) return;
        const novasLinhas = gerarLinhasBrancas(novaRevenda, novoMonday, novoCodes).map(branca => {
            // Preserva entrada existente se data+code baterem
            const existente = linhas.find(l => l.code === branca.code && l.data === branca.data);
            return existente ?? branca;
        });
        setLinhas(novasLinhas);
    }

    function changeMonday(novoMonday: string) {
        setMonday(novoMonday);
        if (isEditMode) aplicarMudancaEdicao(novoMonday, revenda, codesAtivos);
    }

    function toggleCode(code: string) {
        const next = codesAtivos.includes(code)
            ? codesAtivos.filter(c => c !== code)
            : [...codesAtivos, code];
        setCodesAtivos(next);
        if (isEditMode) aplicarMudancaEdicao(monday, revenda, next);
        setCodeTab(prev => next.includes(prev) ? prev : next[0] ?? "");
    }

    function updateLinha(idx: number, field: keyof LinhaForm, value: string) {
        setLinhas(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    }

    const linhasDoTab = linhas.filter(l => l.code === codeTab);
    const idxOffset   = linhas.findIndex(l => l.code === codeTab);

    function salvar() {
        if (!revenda) return toast.error("Selecione uma revenda");
        if (codesAtivos.length === 0) return toast.error("Selecione pelo menos um code");
        saveMut.mutate({
            entries: linhas.map(l => ({
                ...l,
                diaSemana: l.diaSemana as "Seg" | "Ter" | "Qua" | "Qui" | "Sex" | "Sab",
                vendedor:  l.vendedor  || undefined,
                descricao: l.descricao || undefined,
            })),
        });
    }

    return (
        <>
            {showManager && <CodesManager onClose={() => setShowManager(false)} />}

            <div className="fixed inset-0 z-40 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
                <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-[var(--border)] mb-10">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[var(--border)]">
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isEditMode ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-violet-500 to-purple-600"}`}>
                                {isEditMode ? <Pencil className="w-4 h-4 text-white" /> : <CalendarDays className="w-4 h-4 text-white" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                    {isEditMode ? "Editar Agenda GA" : "Nova Agenda GA"}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {isEditMode
                                        ? `${initRevenda} · semana de ${fmtSemana(initMonday)}`
                                        : "Programação semanal por code"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowManager(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">
                                <Settings className="w-3.5 h-3.5" /> Codes
                            </button>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">

                        {/* Seleção de revenda e semana */}
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Revenda</label>
                                <select value={revenda}
                                    onChange={e => { if (!isEditMode) { setRevenda(e.target.value); setCodesAtivos([]); } }}
                                    disabled={isEditMode}
                                    className="text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 min-w-[160px] disabled:opacity-60 disabled:cursor-not-allowed">
                                    <option value="">Selecione...</option>
                                    {revendas.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Semana</label>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => changeMonday(shiftWeek(monday, -1))}
                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">
                                        {fmtSemana(monday)}
                                    </span>
                                    <button onClick={() => changeMonday(shiftWeek(monday, 1))}
                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Seleção de codes */}
                        {revenda && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Codes — Vendedores / Setores
                                </label>
                                {codesDaRevenda.length === 0 ? (
                                    <p className="text-xs text-slate-400">
                                        Nenhum code cadastrado para esta revenda.{" "}
                                        <button onClick={() => setShowManager(true)} className="text-violet-600 hover:underline font-semibold">Adicionar agora</button>
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {codesDaRevenda.map(code => {
                                            const ativo = codesAtivos.includes(code);
                                            return (
                                                <button key={code} onClick={() => toggleCode(code)}
                                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all font-mono ${ativo
                                                        ? "bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-200"
                                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-violet-300"}`}>
                                                    {code}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tabs por code + tabela */}
                        {linhas.length > 0 && (
                            <div>
                                {codesAtivos.length > 1 && (
                                    <div className="flex gap-1 mb-3 border-b border-slate-100 dark:border-slate-700">
                                        {codesAtivos.map(code => (
                                            <button key={code} onClick={() => setCodeTab(code)}
                                                className={`px-4 py-2 text-xs font-bold font-mono border-b-2 -mb-px transition-colors ${codeTab === code
                                                    ? "border-violet-600 text-violet-700 dark:text-violet-400"
                                                    : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                                                {code}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="rounded-xl border border-slate-200 dark:border-[var(--border)] overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-[var(--border)]">
                                                <th className="px-3 py-2.5 text-left text-slate-500 font-bold uppercase tracking-wide w-8">#</th>
                                                <th className="px-3 py-2.5 text-left text-slate-500 font-bold uppercase tracking-wide w-20">Code</th>
                                                <th className="px-3 py-2.5 text-left text-slate-500 font-bold uppercase tracking-wide w-24">Data</th>
                                                <th className="px-3 py-2.5 text-left text-slate-500 font-bold uppercase tracking-wide w-40">Atividade</th>
                                                <th className="px-3 py-2.5 text-left text-slate-500 font-bold uppercase tracking-wide w-16">Dia</th>
                                                <th className="px-3 py-2.5 text-left text-slate-500 font-bold uppercase tracking-wide w-28">Vendedor</th>
                                                <th className="px-3 py-2.5 text-left text-slate-500 font-bold uppercase tracking-wide">Descrição</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-[var(--border)]">
                                            {linhasDoTab.map((linha, i) => {
                                                const realIdx = idxOffset + i;
                                                const isExistente = !!linha.id;
                                                return (
                                                    <tr key={i} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 ${isExistente && isEditMode ? "bg-amber-50/30 dark:bg-amber-900/5" : ""}`}>
                                                        <td className="px-3 py-2 text-slate-400 font-mono">
                                                            {isEditMode && (
                                                                <span title={isExistente ? "Entrada existente" : "Nova entrada"}
                                                                    className={`inline-block w-1.5 h-1.5 rounded-full ${isExistente ? "bg-amber-400" : "bg-slate-300"}`} />
                                                            )}
                                                            {!isEditMode && <span className="text-slate-400">{i + 1}</span>}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono font-bold text-violet-700 dark:text-violet-400">{linha.code}</td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">
                                                            {linha.data.slice(8)}/{linha.data.slice(5, 7)}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <select value={linha.atividade}
                                                                onChange={e => updateLinha(realIdx, "atividade", e.target.value)}
                                                                className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                                                {ATIVIDADES.map(a => <option key={a} value={a}>{a}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-medium">{linha.diaSemana}</td>
                                                        <td className="px-3 py-2">
                                                            <input value={linha.vendedor}
                                                                onChange={e => updateLinha(realIdx, "vendedor", e.target.value)}
                                                                placeholder="—"
                                                                className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input value={linha.descricao}
                                                                onChange={e => updateLinha(realIdx, "descricao", e.target.value)}
                                                                placeholder="Observação..."
                                                                className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {isEditMode && (
                                    <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" /> entrada existente
                                        <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-slate-300" /> nova entrada
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Vazio */}
                        {!revenda && (
                            <div className="text-center py-10 text-slate-300 dark:text-slate-600">
                                <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Selecione uma revenda e uma semana para começar</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-[var(--border)] flex justify-between items-center">
                        <span className="text-xs text-slate-400">
                            {linhas.length > 0
                                ? isEditMode
                                    ? `${linhas.filter(l => l.id).length} existentes · ${linhas.filter(l => !l.id).length} novas · ${codesAtivos.length} code(s)`
                                    : `${linhas.length} entradas · ${codesAtivos.length} code(s)`
                                : ""}
                        </span>
                        <div className="flex gap-2">
                            <button onClick={onClose}
                                className="px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">
                                Cancelar
                            </button>
                            <button onClick={salvar} disabled={saveMut.isPending || linhas.length === 0}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 shadow-sm ${isEditMode
                                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"
                                    : "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200"}`}>
                                <Save className="w-3.5 h-3.5" />
                                {saveMut.isPending ? "Salvando..." : isEditMode ? "Salvar Alterações" : "Salvar Agenda"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
