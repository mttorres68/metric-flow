/*
 * MetricFlow — aba "Análise", em cards: Placas (únicas de pedidos do ERP, CheckNow e Infleet, lado a lado — a que falta
 * numa fonte aparece como lacuna), Jornada do motorista e Jornada do caminhão (calendário de 53 semanas).
 */
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { diaBRT } from "@shared/entregas";
import { semanasAte } from "@shared/jornada";
import { SeletorIntervalo } from "@/components/SeletorDatas";
import { CardJornada } from "./CardJornada";

const DIA_MS = 86_400_000;
const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const card = "bg-white dark:bg-[var(--card)] rounded-2xl border border-slate-100 dark:border-[var(--border)] p-4 flex flex-col gap-3 min-w-0";
const th = "px-3 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide";
const FONTES = [["pedidos", "Pedidos"], ["checknow", "CheckNow"], ["infleet", "Infleet"]] as const;

function CardPlacas({ revendaId, hoje }: { revendaId: number; hoje: string }) {
  const [de, setDe] = useState(() => somaDias(hoje, -29));
  const [ate, setAte] = useState(hoje);
  const q = trpc.entregas.placas.useQuery({ revendaId, de, ate });
  const linhas = q.data ?? [];
  return (
    <section className={card}>
      <header className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mr-auto">Placas</h3>
        <SeletorIntervalo rotulo="Período dos pedidos e do CheckNow" de={de} ate={ate} maxDias={366} onChange={(d, a) => { setDe(d); setAte(a); }} />
      </header>
      {q.isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Buscando placas…</div>
      ) : q.error ? (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">{q.error.message}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-[var(--border)]">
          <table className="w-full">
            <thead><tr className="bg-slate-100/80 dark:bg-slate-800/60">
              {FONTES.map(([f, rotulo]) => (
                <th key={f} className={th}>{rotulo} <span className="ml-1 font-semibold text-slate-400">{linhas.filter(l => l[f]).length}</span></th>
              ))}
            </tr></thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.chave} className="border-t border-slate-100 dark:border-[var(--border)]">
                  {FONTES.map(([f]) => (
                    <td key={f} className="px-3 py-1.5">
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
      <p className="text-[11px] text-slate-400">Infleet: veículos cadastrados hoje</p>
    </section>
  );
}

/** Soma a jornada por chave (motorista ou placa) e dia. */
function agrupar<T extends { dia: string; jornadaMin: number }>(rows: T[], chave: (r: T) => string) {
  const m = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const porDia = m.get(chave(r)) ?? new Map<string, number>();
    porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + r.jornadaMin);
    m.set(chave(r), porDia);
  }
  return m;
}

export function PainelAnalise({ revendaId }: { revendaId: number }) {
  const hoje = diaBRT(new Date());
  const inicio = semanasAte(hoje)[0][0]!;
  const q = trpc.produtividade.jornadas.useQuery({ revendaId, de: inicio, ate: hoje });
  const porMotorista = useMemo(() => agrupar(q.data ?? [], r => r.motorista), [q.data]);
  const porPlaca = useMemo(() => agrupar(q.data ?? [], r => r.placa), [q.data]);

  return (
    <div className="px-6 py-4 grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <CardPlacas revendaId={revendaId} hoje={hoje} />
      <CardJornada titulo="Jornada do motorista" rotulo="Motorista" porChave={porMotorista} fim={hoje} />
      <CardJornada titulo="Jornada do caminhão" rotulo="Caminhão" porChave={porPlaca} fim={hoje} />
    </div>
  );
}
