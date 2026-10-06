/*
 * MetricFlow — Configuração do Relatório de Entregas (tabela entregas_config).
 * Por enquanto só o raio do cliente. Mesmo visual do ConfigMetricasModal.
 */
import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { LIMITES } from "@shared/entregas";

const MIN = 50, MAX = 2000;

export function ConfigEntregasModal({ open, onClose, onSalvo }: { open: boolean; onClose: () => void; onSalvo: () => void }) {
  const utils = trpc.useUtils();
  const { data: salvo, isLoading } = trpc.config.getEntregasConfig.useQuery(undefined, { enabled: open });
  const salvar = trpc.config.saveEntregasConfig.useMutation();
  const restaurar = trpc.config.resetEntregasConfig.useMutation();
  const [raio, setRaio] = useState<number>(LIMITES.raioM);

  useEffect(() => { if (salvo) setRaio(salvo.raioM); }, [salvo, open]);

  const valido = Number.isInteger(raio) && raio >= MIN && raio <= MAX;

  async function aplicar(acao: () => Promise<unknown>, msg: string) {
    try {
      await acao();
      await utils.config.getEntregasConfig.invalidate();
      toast.success(msg);
      onSalvo();
      onClose();
    } catch (e) {
      toast.error((e as Error).message ?? "Erro ao salvar a configuração.");
    }
  }

  if (!open) return null;
  const ocupado = salvar.isPending || restaurar.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md flex flex-col border border-slate-100 dark:border-[var(--border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Configuração de Entregas</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Vale para todos, na tela e no PDF</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-slate-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração…
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Raio do cliente (m)</span>
              <input
                type="number" min={MIN} max={MAX} step={10} value={Number.isNaN(raio) ? "" : raio}
                onChange={e => setRaio(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-[var(--background)] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600"
              />
              <span className={`text-[11px] leading-snug ${valido ? "text-slate-400 dark:text-slate-500" : "text-red-500"}`}>
                {valido
                  ? `Parada do caminhão a até esta distância do cliente conta como entrega no raio. Padrão: ${LIMITES.raioM} m.`
                  : `Informe um número inteiro entre ${MIN} e ${MAX}.`}
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-[var(--border)]">
          <button
            onClick={() => aplicar(() => restaurar.mutateAsync(), `Raio restaurado para ${LIMITES.raioM} m.`)}
            disabled={ocupado}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-semibold">
              Cancelar
            </button>
            <button
              onClick={() => aplicar(() => salvar.mutateAsync({ raioM: raio }), `Raio salvo: ${raio} m.`)}
              disabled={ocupado || !valido || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 font-semibold"
            >
              {salvar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
