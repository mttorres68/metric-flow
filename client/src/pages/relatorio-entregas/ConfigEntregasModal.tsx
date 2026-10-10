/*
 * MetricFlow — Configuração do Relatório de Entregas (tabela entregas_config).
 * Abas: Limites (raio, desvio e trecho lento) e Contas (CheckNow/Infleet por revenda). Mesmo visual do ConfigMetricasModal.
 */
import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CONFIG_ENTREGAS_PADRAO, type ConfigEntregas } from "@shared/entregas";
import { ContasEntregas } from "./ContasEntregas";

type ChaveNum = Exclude<keyof ConfigEntregas, "saidaMinima">;
interface Campo { chave: ChaveNum; rotulo: string; un: string; min: number; max: number; step: number; inteiro: boolean; ajuda: string }

/** Limites iguais aos do zod em configRouter.saveEntregasConfig. */
const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  { titulo: "Cliente", campos: [
    { chave: "raioM", rotulo: "Raio do cliente", un: "m", min: 50, max: 2000, step: 10, inteiro: true,
      ajuda: "Parada do caminhão a até esta distância do cliente conta como entrega no raio." },
  ] },
  { titulo: "Desvio entre clientes", campos: [
    { chave: "desvioFator", rotulo: "Km pela estrada acima de", un: "× a reta", min: 1, max: 10, step: 0.1, inteiro: false,
      ajuda: "Trecho é desvio quando o caminhão rodou mais que este múltiplo da linha reta entre os dois clientes…" },
    { chave: "desvioMinKm", rotulo: "E pelo menos", un: "km a mais", min: 0, max: 100, step: 0.5, inteiro: false,
      ajuda: "…e a diferença passa deste valor (evita marcar trechos curtos dentro da cidade)." },
  ] },
  { titulo: "Trecho lento", campos: [
    { chave: "lentoMinMin", rotulo: "Mais de", un: "min", min: 1, max: 600, step: 1, inteiro: true,
      ajuda: "Trecho entre clientes é lento quando passa deste tempo…" },
    { chave: "lentoMaxKmh", rotulo: "Média abaixo de", un: "km/h", min: 1, max: 120, step: 1, inteiro: true,
      ajuda: "…com velocidade média abaixo deste valor." },
  ] },
];

const valido = (c: Campo, v: number) => Number.isFinite(v) && v >= c.min && v <= c.max && (!c.inteiro || Number.isInteger(v));

type Aba = "limites" | "contas";

export function ConfigEntregasModal({ open, onClose, onSalvo, abaInicial = "limites" }: { open: boolean; onClose: () => void; onSalvo: () => void; abaInicial?: Aba }) {
  const utils = trpc.useUtils();
  const { data: salvo, isLoading } = trpc.config.getEntregasConfig.useQuery(undefined, { enabled: open });
  const salvar = trpc.config.saveEntregasConfig.useMutation();
  const restaurar = trpc.config.resetEntregasConfig.useMutation();
  const [cfg, setCfg] = useState<ConfigEntregas>(CONFIG_ENTREGAS_PADRAO);
  const [aba, setAba] = useState<Aba>(abaInicial);

  useEffect(() => { if (open) setAba(abaInicial); }, [open, abaInicial]);

  useEffect(() => { if (salvo) setCfg(salvo); }, [salvo, open]);

  const horaOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(cfg.saidaMinima);
  const todosValidos = horaOk && GRUPOS.every(g => g.campos.every(c => valido(c, cfg[c.chave])));

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
      <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-slate-100 dark:border-[var(--border)]">
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

        <div className="px-6 pt-3">
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5">
            {([["limites", "Limites"], ["contas", "Contas"]] as const).map(([v, rotulo]) => (
              <button key={v} onClick={() => setAba(v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${aba === v ? "bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          {aba === "contas" ? <ContasEntregas onMudou={onSalvo} /> : isLoading ? (
            <div className="flex items-center justify-center py-6 text-slate-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração…
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {GRUPOS.map(g => (
                <section key={g.titulo} className="flex flex-col gap-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{g.titulo}</h3>
                  {g.campos.map(c => {
                    const v = cfg[c.chave];
                    const ok = valido(c, v);
                    return (
                      <label key={c.chave} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{c.rotulo}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min={c.min} max={c.max} step={c.step} value={Number.isNaN(v) ? "" : v}
                            onChange={e => setCfg({ ...cfg, [c.chave]: parseFloat(e.target.value) })}
                            className="w-28 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-[var(--background)] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{c.un}</span>
                        </div>
                        <span className={`text-[11px] leading-snug ${ok ? "text-slate-400 dark:text-slate-500" : "text-red-500"}`}>
                          {ok
                            ? `${c.ajuda} Padrão: ${CONFIG_ENTREGAS_PADRAO[c.chave]} ${c.un}.`
                            : `Informe ${c.inteiro ? "um número inteiro" : "um número"} entre ${c.min} e ${c.max}.`}
                        </span>
                      </label>
                    );
                  })}
                </section>
              ))}
              <section className="flex flex-col gap-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Jornada</h3>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Saída não antes de</span>
                  <input type="time" value={cfg.saidaMinima} onChange={e => setCfg({ ...cfg, saidaMinima: e.target.value })}
                    className="w-28 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-[var(--background)] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600" />
                  <span className={`text-[11px] leading-snug ${horaOk ? "text-slate-400 dark:text-slate-500" : "text-red-500"}`}>
                    {horaOk
                      ? `Movimento do caminhão que termina antes deste horário (madrugada fora da base) não conta como saída; quem sai antes e segue viagem sai neste horário. A saída pela cerca não muda. Padrão: ${CONFIG_ENTREGAS_PADRAO.saidaMinima}.`
                      : "Informe um horário (hh:mm)."}
                  </span>
                </label>
              </section>
            </div>
          )}
        </div>

        {aba === "limites" && <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-[var(--border)]">
          <button
            onClick={() => aplicar(() => restaurar.mutateAsync(), "Configuração restaurada para o padrão.")}
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
              onClick={() => aplicar(() => salvar.mutateAsync(cfg), "Configuração salva.")}
              disabled={ocupado || !todosValidos || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 font-semibold"
            >
              {salvar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>}
      </div>
    </div>
  );
}
