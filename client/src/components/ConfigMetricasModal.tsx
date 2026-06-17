import { useEffect, useState } from "react";
import { X, RotateCcw, Save, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CONFIG_METRICAS_DEFAULT } from "@shared/const";

// Forma plana para o formulário (espelha a tabela metricas_config)
interface FormState {
    raioPDV: number;
    minutosCurta: number;
    janelaInicioVisitas: string;
    janelaFimVisitas: string;
    // Diária
    limiteInicioTardio: string;
    alertaCurtasPerc: number;
    alertaCoberturaPerc: number;
    alertaTardePerc: number;
    // Recorrência
    recLimiteInicioTardio: string;
    recAlertaCurtasPerc: number;
    recAlertaCoberturaPerc: number;
    recAlertaTardePerc: number;
    recorrenciaMinDias: number;
    recorrenciaMinPerc: number;
    ociosidadeMin: number;
    percursoMax: number;
    almocoMax: number;
    tempoAtendMin: number;
    fimCedo: string;
}

const DEFAULT_FORM: FormState = {
    raioPDV:                CONFIG_METRICAS_DEFAULT.diaria.raioPDV,
    minutosCurta:           CONFIG_METRICAS_DEFAULT.diaria.minutosCurta,
    janelaInicioVisitas:    CONFIG_METRICAS_DEFAULT.diaria.janelaInicioVisitas,
    janelaFimVisitas:       CONFIG_METRICAS_DEFAULT.diaria.janelaFimVisitas,
    limiteInicioTardio:     CONFIG_METRICAS_DEFAULT.diaria.limiteInicioTardio,
    alertaCurtasPerc:       CONFIG_METRICAS_DEFAULT.diaria.alertaCurtasPerc,
    alertaCoberturaPerc:    CONFIG_METRICAS_DEFAULT.diaria.alertaCoberturaPerc,
    alertaTardePerc:        CONFIG_METRICAS_DEFAULT.diaria.alertaTardePerc,
    recLimiteInicioTardio:  CONFIG_METRICAS_DEFAULT.recorrencia.limiteInicioTardio,
    recAlertaCurtasPerc:    CONFIG_METRICAS_DEFAULT.recorrencia.alertaCurtasPerc,
    recAlertaCoberturaPerc: CONFIG_METRICAS_DEFAULT.recorrencia.alertaCoberturaPerc,
    recAlertaTardePerc:     CONFIG_METRICAS_DEFAULT.recorrencia.alertaTardePerc,
    recorrenciaMinDias:     CONFIG_METRICAS_DEFAULT.recorrencia.recorrenciaMinDias,
    recorrenciaMinPerc:     CONFIG_METRICAS_DEFAULT.recorrencia.recorrenciaMinPerc,
    ociosidadeMin:          CONFIG_METRICAS_DEFAULT.recorrencia.ociosidadeMin,
    percursoMax:            CONFIG_METRICAS_DEFAULT.recorrencia.percursoMax,
    almocoMax:              CONFIG_METRICAS_DEFAULT.recorrencia.almocoMax,
    tempoAtendMin:          CONFIG_METRICAS_DEFAULT.recorrencia.tempoAtendMin,
    fimCedo:                CONFIG_METRICAS_DEFAULT.recorrencia.fimCedo,
};

type FieldType = "int" | "float" | "time";

interface FieldDef {
    key: keyof FormState;
    label: string;
    hint: string;
    type: FieldType;
    min?: number;
    max?: number;
    step?: number;
}

const SECOES: { title: string; color: string; fields: FieldDef[] }[] = [
    {
        title: "Parâmetros base",
        color: "slate",
        fields: [
            { key: "raioPDV",      label: "Raio PDV (m)",       hint: "Distância máxima para considerar visita dentro do PDV", type: "int", min: 1, max: 1000 },
            { key: "minutosCurta", label: "Relâmpago (min)",     hint: "Visita com duração abaixo deste valor = relâmpago",    type: "int", min: 1, max: 30   },
        ],
    },
    {
        title: "Janela de Visitas",
        color: "sky",
        fields: [
            { key: "janelaInicioVisitas", label: "Início da janela", hint: "Visitas que iniciam antes deste horário são ignoradas em todas as métricas", type: "time" },
            { key: "janelaFimVisitas",    label: "Fim da janela",    hint: "Visitas que iniciam após este horário são ignoradas em todas as métricas",   type: "time" },
        ],
    },
    {
        title: "Análise Diária",
        color: "indigo",
        fields: [
            { key: "limiteInicioTardio",  label: "Início tardio",          hint: "Alerta de destaque na tabela diária ao ultrapassar este horário", type: "time" },
            { key: "alertaCurtasPerc",    label: "Alerta relâmpago (%)",   hint: "% de relâmpagos acima deste valor = célula em alerta",            type: "int", min: 0, max: 100 },
            { key: "alertaCoberturaPerc", label: "Alerta cobertura / IV (%)", hint: "IV abaixo deste valor = célula em alerta",                    type: "int", min: 0, max: 200 },
            { key: "alertaTardePerc",     label: "Alerta após-14h (%)",    hint: "% visitas após 14h abaixo deste valor = célula em alerta",        type: "int", min: 0, max: 100 },
        ],
    },
    {
        title: "Recorrência Semanal",
        color: "violet",
        fields: [
            { key: "recLimiteInicioTardio",  label: "Início tardio",           hint: "Threshold para flag inicioTardio (mais tolerante que o diário)", type: "time" },
            { key: "recAlertaCurtasPerc",    label: "Relâmpago alto (%)",      hint: "Threshold para flag relampagoAlto",                              type: "int", min: 0, max: 100 },
            { key: "recAlertaCoberturaPerc", label: "Cobertura / IV baixa (%)",hint: "Threshold para flag coberturaBaixa",                             type: "int", min: 0, max: 200 },
            { key: "recAlertaTardePerc",     label: "Pós-14h insuficiente (%)",hint: "Threshold para flag tardeInsuficiente",                          type: "int", min: 0, max: 100 },
            { key: "recorrenciaMinDias",     label: "Mín. dias recorrente",    hint: "Problema em X ou mais dias = comportamento recorrente",          type: "int", min: 1, max: 7 },
            { key: "recorrenciaMinPerc",     label: "Mín. % dias recorrente",  hint: "OU problema em X% dos dias ativos (valor entre 0 e 1)",          type: "float", min: 0, max: 1, step: 0.05 },
            { key: "ociosidadeMin",          label: "Ociosidade máx (min)",    hint: "Tempo não-atendimento acima deste valor = ociosidadeAlta",        type: "int", min: 0, max: 480 },
            { key: "percursoMax",            label: "Percurso máx (min)",      hint: "Maior gap entre visitas acima deste valor = ociosidadeAlta",      type: "int", min: 0, max: 120 },
            { key: "almocoMax",              label: "Almoço máx (visitas)",    hint: "Visitas 12:15–13:45 acima deste valor = almocoExcesso",           type: "int", min: 0, max: 20  },
            { key: "tempoAtendMin",          label: "Σ atendimento mín (min)", hint: "Soma de atendimento abaixo deste valor = tempoAtendBaixo",        type: "int", min: 0, max: 480 },
            { key: "fimCedo",                label: "Fim cedo",                hint: "Encerrar antes deste horário = flag fimCedo",                    type: "time" },
        ],
    },
];

const SECTION_COLORS: Record<string, string> = {
    slate:  "bg-slate-50  dark:bg-slate-800/30 border-slate-200  dark:border-slate-700",
    sky:    "bg-sky-50    dark:bg-sky-900/20    border-sky-200    dark:border-sky-800/50",
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/50",
    violet: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/50",
};
const SECTION_TITLE_COLORS: Record<string, string> = {
    slate:  "text-slate-500  dark:text-slate-400",
    sky:    "text-sky-600    dark:text-sky-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
    violet: "text-violet-600 dark:text-violet-400",
};

interface Props { open: boolean; onClose: () => void; }

export function ConfigMetricasModal({ open, onClose }: Props) {
    const { data: saved, isLoading } = trpc.config.getMetricasConfig.useQuery(undefined, { enabled: open });
    const saveMutation  = trpc.config.saveMetricasConfig.useMutation();
    const resetMutation = trpc.config.resetMetricasConfig.useMutation();
    const utils = trpc.useUtils();

    const [form, setForm] = useState<FormState>(DEFAULT_FORM);

    useEffect(() => {
        if (!saved) return;
        setForm({
            raioPDV:                saved.diaria.raioPDV,
            minutosCurta:           saved.diaria.minutosCurta,
            janelaInicioVisitas:    saved.diaria.janelaInicioVisitas,
            janelaFimVisitas:       saved.diaria.janelaFimVisitas,
            limiteInicioTardio:     saved.diaria.limiteInicioTardio,
            alertaCurtasPerc:       saved.diaria.alertaCurtasPerc,
            alertaCoberturaPerc:    saved.diaria.alertaCoberturaPerc,
            alertaTardePerc:        saved.diaria.alertaTardePerc,
            recLimiteInicioTardio:  saved.recorrencia.limiteInicioTardio,
            recAlertaCurtasPerc:    saved.recorrencia.alertaCurtasPerc,
            recAlertaCoberturaPerc: saved.recorrencia.alertaCoberturaPerc,
            recAlertaTardePerc:     saved.recorrencia.alertaTardePerc,
            recorrenciaMinDias:     saved.recorrencia.recorrenciaMinDias,
            recorrenciaMinPerc:     saved.recorrencia.recorrenciaMinPerc,
            ociosidadeMin:          saved.recorrencia.ociosidadeMin,
            percursoMax:            saved.recorrencia.percursoMax,
            almocoMax:              saved.recorrencia.almocoMax,
            tempoAtendMin:          saved.recorrencia.tempoAtendMin,
            fimCedo:                saved.recorrencia.fimCedo,
        });
    }, [saved]);

    function setValue(key: keyof FormState, raw: string, type: FieldType) {
        setForm(prev => ({
            ...prev,
            [key]: type === "float"
                ? parseFloat(raw) || 0
                : type === "int"
                ? parseInt(raw, 10) || 0
                : raw.substring(0, 5),
        }));
    }

    async function handleSave() {
        try {
            await saveMutation.mutateAsync(form);
            await utils.config.getMetricasConfig.invalidate();
            toast.success("Configuração salva com sucesso.");
            onClose();
        } catch (e: any) {
            toast.error(e.message ?? "Erro ao salvar configuração.");
        }
    }

    async function handleReset() {
        try {
            await resetMutation.mutateAsync();
            setForm(DEFAULT_FORM);
            await utils.config.getMetricasConfig.invalidate();
            toast.success("Configuração restaurada para os valores padrão.");
        } catch (e: any) {
            toast.error(e.message ?? "Erro ao restaurar padrões.");
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-100 dark:border-[var(--border)]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        <div>
                            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Configuração de Métricas</h2>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Análise diária e recorrência usam thresholds independentes</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração…
                        </div>
                    ) : (
                        SECOES.map(secao => (
                            <section key={secao.title} className={`rounded-xl border p-4 ${SECTION_COLORS[secao.color]}`}>
                                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${SECTION_TITLE_COLORS[secao.color]}`}>
                                    {secao.title}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {secao.fields.map(f => (
                                        <div key={f.key} className="flex flex-col gap-1">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {f.label}
                                            </label>
                                            <input
                                                type={f.type === "time" ? "time" : "number"}
                                                value={String(form[f.key])}
                                                min={f.min}
                                                max={f.max}
                                                step={f.step ?? (f.type === "float" ? 0.05 : 1)}
                                                onChange={e => setValue(f.key, e.target.value, f.type)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-[var(--background)] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600"
                                            />
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug">{f.hint}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-[var(--border)] flex-shrink-0">
                    <button
                        onClick={handleReset}
                        disabled={saveMutation.isPending || resetMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 transition-colors font-semibold"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrões
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saveMutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 transition-colors font-semibold"
                        >
                            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {saveMutation.isPending ? "Salvando…" : "Salvar"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
