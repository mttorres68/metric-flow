import { DEFAULT_TEMPLATE, type WaTemplate } from "@/hooks/useWaTemplate";
import { Loader2, RotateCcw, Send, Settings2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { gerarMensagemWhatsApp, VARIAVEIS, SAMPLE } from "../lib/whatsapp";

export function TemplateConfigModal({
  template,
  onSaveLocal,
  onSaveServer,
  isSaving,
  serverSynced,
  onClose,
}: {
  template: WaTemplate;
  onSaveLocal: (t: WaTemplate) => void;
  onSaveServer: (t: WaTemplate) => Promise<void>;
  isSaving: boolean;
  serverSynced: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<WaTemplate>(template);
  const preview = gerarMensagemWhatsApp(SAMPLE.revenda, SAMPLE.hoje, SAMPLE.amanha, draft);

  function set(field: keyof WaTemplate, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function insertVar(field: keyof WaTemplate, variable: string) {
    setDraft((prev) => ({ ...prev, [field]: prev[field] + variable }));
  }

  async function handleSaveServer() {
    await onSaveServer(draft);
    toast.success("Template salvo no servidor!");
    onClose();
  }

  function handleSaveLocal() {
    onSaveLocal(draft);
    toast.success("Template salvo localmente!");
    onClose();
  }

  function handleReset() {
    setDraft(DEFAULT_TEMPLATE);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-500" />
            Configurar modelo de mensagem
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden divide-x divide-slate-200 dark:divide-slate-700">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {(Object.keys(VARIAVEIS) as (keyof WaTemplate)[]).map((field) => {
              const { label, vars } = VARIAVEIS[field];
              return (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <textarea
                    value={draft[field]}
                    onChange={(e) => set(field, e.target.value)}
                    rows={field === "linhaCard" ? 2 : field === "cabecalho" ? 3 : 2}
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {vars.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {vars.map((v) => (
                        <button
                          key={v}
                          onClick={() => insertVar(field, v)}
                          className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-mono transition-colors"
                          title={`Inserir ${v}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 pt-4 pb-2 flex-shrink-0">
              Preview
            </p>
            <pre className="flex-1 overflow-y-auto mx-4 mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {preview}
            </pre>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar padrão
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSaveLocal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Salvar local
          </button>
          <button
            onClick={handleSaveServer}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {serverSynced ? "Atualizar no servidor" : "Salvar no servidor"}
          </button>
        </div>
      </div>
    </div>
  );
}
