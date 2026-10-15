/*
 * MetricFlow — aba "Análise": placas únicas dos pedidos do ERP e do CheckNow no período e do cadastro do Infleet,
 * lado a lado na mesma linha — a placa que falta numa fonte aparece como lacuna.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { diaBRT } from "@shared/entregas";
import { SeletorIntervalo } from "@/components/SeletorDatas";

const DIA_MS = 86_400_000;
const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const caixa = "bg-white dark:bg-[var(--card)] rounded-2xl border border-slate-100 dark:border-[var(--border)]";
const th = "px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide";
const FONTES = [["pedidos", "Pedidos"], ["checknow", "CheckNow"], ["infleet", "Infleet"]] as const;

export function PainelAnalise({ revendaId }: { revendaId: number }) {
  const hoje = diaBRT(new Date());
  const [de, setDe] = useState(() => somaDias(hoje, -29));
  const [ate, setAte] = useState(hoje);
  const q = trpc.entregas.placas.useQuery({ revendaId, de, ate });
  const linhas = q.data ?? [];

  return (
    <div className="px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <SeletorIntervalo rotulo="Período dos pedidos e do CheckNow" de={de} ate={ate} maxDias={366} onChange={(d, a) => { setDe(d); setAte(a); }} />
        <span className="text-xs text-slate-500 dark:text-slate-400">Infleet: veículos cadastrados hoje</span>
      </div>
      {q.isLoading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Buscando placas…</div>
      ) : q.error ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">{q.error.message}</div>
      ) : (
        <div className={`${caixa} overflow-x-auto`}>
          <table className="w-full">
            <thead><tr className="bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
              {FONTES.map(([f, rotulo]) => (
                <th key={f} className={th}>{rotulo} <span className="ml-1 font-semibold text-slate-400">{linhas.filter(l => l[f]).length}</span></th>
              ))}
            </tr></thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.chave} className="border-t border-slate-100 dark:border-[var(--border)]">
                  {FONTES.map(([f]) => (
                    <td key={f} className="px-4 py-2">
                      {l[f]
                        ? <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-mono text-[11px] font-semibold">{l[f]}</span>
                        : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
