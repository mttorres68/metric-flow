/*
 * MetricFlow — ConfigPanel
 * Drawer de configuração das regras de negócio.
 *
 * Correções v2:
 *  1. Slider arrastável — input[type=range] estilizado diretamente via CSS injetado,
 *     sem camada opacity-0 que impedia o drag.
 *  2. Estado rascunho separado — mudanças só chegam ao dashboard ao clicar "Aplicar".
 *     "Cancelar" descarta o rascunho sem afetar os dados exibidos.
 */

import { useEffect, useRef, useState } from "react";
import { Settings2, X, RotateCcw, ChevronRight, Check } from "lucide-react";
import { CONFIG_PADRAO_METRICAS } from "@shared/const";

// ---------------------------------------------------------
// CSS do slider — injetado uma vez no <head>
// Necessário para estilizar ::-webkit-slider-thumb sem Tailwind
// ---------------------------------------------------------
const SLIDER_CSS = `
.mf-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 9999px;
  outline: none;
  cursor: pointer;
  background: transparent;
}
.mf-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 2.5px solid currentColor;
  box-shadow: 0 1px 4px rgba(0,0,0,0.18);
  cursor: grab;
  transition: box-shadow 0.15s, transform 0.15s;
}
.mf-slider:active::-webkit-slider-thumb {
  cursor: grabbing;
  transform: scale(1.2);
  box-shadow: 0 2px 8px rgba(0,0,0,0.22);
}
.mf-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 2.5px solid currentColor;
  box-shadow: 0 1px 4px rgba(0,0,0,0.18);
  cursor: grab;
}
`;

function injectSliderCSS() {
    if (typeof document === "undefined") return;
    if (document.getElementById("mf-slider-css")) return;
    const style = document.createElement("style");
    style.id = "mf-slider-css";
    style.textContent = SLIDER_CSS;
    document.head.appendChild(style);
}

// ---------------------------------------------------------
// Tipos
// ---------------------------------------------------------
export interface ConfigMetricas {
    raioPDV: number;
    minutosCurta: number;
    limiteInicioTardio: string;
    alertaCurtasPerc: number;
    alertaCoberturaPerc: number;
    alertaTardePerc: number;
}

const CONFIG_STORAGE_KEY = "metricflow:config";

// Fonte única de verdade vinda de shared/const.ts
export const CONFIG_PADRAO: ConfigMetricas = { ...CONFIG_PADRAO_METRICAS };

// ---------------------------------------------------------
// Hook público — gerencia config aplicada + localStorage
// O draft fica dentro do ConfigPanel; só o "aplicado" sai daqui.
// ---------------------------------------------------------
export function useConfigMetricas() {
    const [config, setConfig] = useState<ConfigMetricas>(() => {
        try {
            const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
            return saved ? { ...CONFIG_PADRAO, ...JSON.parse(saved) } : CONFIG_PADRAO;
        } catch {
            return CONFIG_PADRAO;
        }
    });

    const apply = (next: ConfigMetricas) => {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
        setConfig(next);
    };

    const reset = () => {
        localStorage.removeItem(CONFIG_STORAGE_KEY);
        setConfig(CONFIG_PADRAO);
    };

    const isDirty = JSON.stringify(config) !== JSON.stringify(CONFIG_PADRAO);

    return { config, apply, reset, isDirty };
}

// ---------------------------------------------------------
// SliderRow
// ---------------------------------------------------------
interface SliderRowProps {
    label: string;
    hint?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit: string;
    accent: string;
    onChange: (v: number) => void;
    formatValue?: (v: number) => string;
}

function SliderRow({ label, hint, value, min, max, step = 1, unit, accent, onChange, formatValue }: SliderRowProps) {
    const pct = ((value - min) / (max - min)) * 100;
    const display = formatValue ? formatValue(value) : `${value}${unit}`;
    const trackBg = `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;

    return (
        <div>
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</span>
                    {hint && <span className="text-xs text-slate-400 italic">{hint}</span>}
                </div>
                <span
                    className="text-sm tabular-nums px-2 py-0.5 rounded-lg"
                    style={{ fontWeight: 800, background: accent + "18", color: accent }}
                >
                    {display}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mf-slider"
                style={{ background: trackBg, color: accent }}
            />
            <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-300">{formatValue ? formatValue(min) : `${min}${unit}`}</span>
                <span className="text-xs text-slate-300">{formatValue ? formatValue(max) : `${max}${unit}`}</span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// TimeInput
// ---------------------------------------------------------
function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</span>
            <input
                type="time"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                style={{ fontWeight: 700 }}
            />
        </div>
    );
}

// ---------------------------------------------------------
// SectionTitle
// ---------------------------------------------------------
function SectionTitle({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: color }} />
            <h3 className="text-xs text-slate-500 uppercase tracking-widest" style={{ fontWeight: 800 }}>
                {label}
            </h3>
        </div>
    );
}

// ---------------------------------------------------------
// ConfigPanel principal
// ---------------------------------------------------------
interface ConfigPanelProps {
    config: ConfigMetricas;
    onApply: (next: ConfigMetricas) => void;
    onReset: () => void;
    isDirty: boolean;
}

export function ConfigPanel({ config, onApply, onReset, isDirty }: ConfigPanelProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<ConfigMetricas>(config);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => { injectSliderCSS(); }, []);

    // Sincroniza draft quando config externa muda (ex: reset externo)
    useEffect(() => { setDraft(config); }, [config]);

    const handleOpen = () => {
        setDraft(config); // começa com os valores atualmente aplicados
        setOpen(true);
    };

    const handleApply = () => {
        onApply(draft);
        setOpen(false);
    };

    const handleCancel = () => {
        setDraft(config); // descarta rascunho
        setOpen(false);
    };

    const handleReset = () => {
        setDraft(CONFIG_PADRAO);
        onReset();
    };

    const set = (partial: Partial<ConfigMetricas>) =>
        setDraft((prev) => ({ ...prev, ...partial }));

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) handleCancel();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleCancel(); };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, config]);

    const hasPendingChanges = JSON.stringify(draft) !== JSON.stringify(config);

    return (
        <>
            {/* Botão */}
            <button
                onClick={handleOpen}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border transition-all ${isDirty
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                style={{ fontWeight: 600 }}
            >
                <Settings2 className="w-3.5 h-3.5" />
                Config
                {isDirty && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500" />}
            </button>

            {/* Overlay */}
            <div className={`fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} />

            {/* Drawer */}
            <div
                ref={panelRef}
                className={`fixed top-0 right-0 h-full bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
                style={{ width: 340, borderLeft: "1px solid oklch(0.93 0.006 240)" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-base text-slate-800" style={{ fontWeight: 800 }}>Configurações</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Regras de negócio das métricas</p>
                    </div>
                    <button onClick={handleCancel} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Banner mudanças pendentes */}
                {hasPendingChanges && (
                    <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        <p className="text-xs text-amber-700" style={{ fontWeight: 600 }}>
                            Mudanças pendentes — clique em Aplicar
                        </p>
                    </div>
                )}

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

                    <section>
                        <SectionTitle color="#6366f1" label="Filtro de Raio" />
                        <div className="space-y-5 mt-4">
                            <SliderRow
                                label="Raio do PDV"
                                hint="— Dist. PV máxima"
                                value={draft.raioPDV}
                                min={50} max={2000} step={50} unit="m"
                                accent="#6366f1"
                                onChange={(v) => set({ raioPDV: v })}
                                formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}km` : `${v}m`}
                            />
                        </div>
                    </section>

                    <section>
                        <SectionTitle color="#f59e0b" label="Qualidade de Visitas" />
                        <div className="space-y-5 mt-4">
                            <SliderRow
                                label="Limite relâmpago"
                                hint="— abaixo = curta"
                                value={draft.minutosCurta}
                                min={1} max={15} step={1} unit="min"
                                accent="#f59e0b"
                                onChange={(v) => set({ minutosCurta: v })}
                            />
                            <TimeInput
                                label="Início tardio após"
                                value={draft.limiteInicioTardio}
                                onChange={(v) => set({ limiteInicioTardio: v })}
                            />
                        </div>
                    </section>

                    <section>
                        <SectionTitle color="#ef4444" label="Limiares de Alerta" />
                        <p className="text-xs text-slate-400 mt-2 mb-4 leading-relaxed">
                            KPIs em alerta quando ultrapassam (relâmpago) ou ficam abaixo (cobertura, tarde) do valor configurado.
                        </p>
                        <div className="space-y-5">
                            <SliderRow
                                label="Relâmpago acima de"
                                value={draft.alertaCurtasPerc}
                                min={0} max={50} step={1} unit="%"
                                accent="#ef4444"
                                onChange={(v) => set({ alertaCurtasPerc: v })}
                            />
                            <SliderRow
                                label="Cobertura abaixo de"
                                value={draft.alertaCoberturaPerc}
                                min={50} max={100} step={1} unit="%"
                                accent="#ef4444"
                                onChange={(v) => set({ alertaCoberturaPerc: v })}
                            />
                            <SliderRow
                                label="Após 14h abaixo de"
                                value={draft.alertaTardePerc}
                                min={0} max={60} step={1} unit="%"
                                accent="#ef4444"
                                onChange={(v) => set({ alertaTardePerc: v })}
                            />
                        </div>
                    </section>

                    {/* Preview */}
                    <section>
                        <SectionTitle color="#94a3b8" label="Valores Ativos" />
                        <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100 font-mono text-xs text-slate-500 space-y-1.5">
                            {(Object.entries(draft) as [keyof ConfigMetricas, any][]).map(([k, v]) => {
                                const changed = draft[k] !== config[k];
                                return (
                                    <div key={k} className="flex justify-between">
                                        <span className={changed ? "text-amber-600" : ""}>{k}</span>
                                        <span style={{ fontWeight: 700 }} className={changed ? "text-amber-700" : "text-slate-700"}>
                                            {String(v)}{changed ? " *" : ""}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
                    <button
                        onClick={handleReset}
                        disabled={!isDirty && !hasPendingChanges}
                        className={`flex items-center gap-1.5 text-xs transition-all ${isDirty || hasPendingChanges
                                ? "text-slate-500 hover:text-slate-700 cursor-pointer"
                                : "text-slate-300 cursor-not-allowed"
                            }`}
                        style={{ fontWeight: 600 }}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Padrões
                    </button>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={handleCancel}
                            className="px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all"
                            style={{ fontWeight: 600 }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={!hasPendingChanges}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs text-white transition-all shadow-sm ${hasPendingChanges
                                    ? "bg-indigo-500 hover:bg-indigo-600"
                                    : "bg-slate-300 cursor-not-allowed"
                                }`}
                            style={{ fontWeight: 700 }}
                        >
                            <Check className="w-3.5 h-3.5" />
                            Aplicar
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}