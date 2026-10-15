/*
 * MetricFlow — card "Jornada" da aba Análise: calendário de 53 semanas (estilo contribuições do GitHub) com as horas de
 * jornada por dia (saída → retorno à Sede, rotas_dia). Um por vez (seletor) ou todos empilhados.
 */
import { useMemo, useState } from "react";
import { nivelJornada, semanasAte } from "@shared/jornada";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const COR = [
  "bg-slate-100 dark:bg-slate-800",
  "bg-emerald-200 dark:bg-emerald-900",
  "bg-emerald-400 dark:bg-emerald-700",
  "bg-emerald-600 dark:bg-emerald-500",
  "bg-emerald-800 dark:bg-emerald-300",
];
const horas = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

type PorDia = Map<string, number>;

function Mapa({ porDia, semanas, comMeses }: { porDia: PorDia; semanas: (string | null)[][]; comMeses: boolean }) {
  const colunas = { gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` };
  return (
    <div className="flex gap-1.5">
      <div className={`grid grid-rows-7 gap-[2px] text-[9px] leading-none text-slate-400 ${comMeses ? "pt-4" : ""}`}>
        {SEMANA.map((s, i) => <span key={s} className="flex items-center h-full">{i % 2 ? s : ""}</span>)}
      </div>
      <div className="flex-1 min-w-0">
        {comMeses && (
          <div className="grid gap-[2px] h-4 text-[9px] text-slate-400" style={colunas}>
            {semanas.map((w, i) => {
              const primeiro = w.find(d => d?.endsWith("-01")) ?? (i === 0 ? w[0] : null);
              return <span key={i} className="whitespace-nowrap overflow-visible">{primeiro ? MESES[Number(primeiro.slice(5, 7)) - 1] : ""}</span>;
            })}
          </div>
        )}
        <div className="grid grid-flow-col grid-rows-7 gap-[2px]" style={colunas}>
          {semanas.flat().map((d, i) => d
            ? <span key={i} className={`aspect-square rounded-[2px] ${COR[nivelJornada(porDia.get(d) ?? 0)]}`}
                title={`${SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${br(d)} · ${porDia.get(d) ? horas(porDia.get(d)!) : "sem jornada"}`} />
            : <span key={i} />)}
        </div>
      </div>
    </div>
  );
}

function Resumo({ porDia }: { porDia: PorDia }) {
  const mins = [...porDia.values()];
  const total = mins.reduce((s, m) => s + m, 0);
  return <span className="text-xs text-slate-500 dark:text-slate-400">{mins.length} dia(s){mins.length ? ` · média ${horas(Math.round(total / mins.length))}` : ""}</span>;
}

export function CardJornada({ titulo, rotulo, porChave, fim }: { titulo: string; rotulo: string; porChave: Map<string, PorDia>; fim: string }) {
  const semanas = useMemo(() => semanasAte(fim), [fim]);
  // Mais horas no período primeiro.
  const chaves = useMemo(() => [...porChave.entries()]
    .sort((a, b) => [...b[1].values()].reduce((s, m) => s + m, 0) - [...a[1].values()].reduce((s, m) => s + m, 0)).map(([k]) => k), [porChave]);
  const [modo, setModo] = useState<"um" | "todos">("um");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const atual = escolhida && porChave.has(escolhida) ? escolhida : chaves[0];

  return (
    <section className="bg-white dark:bg-[var(--card)] rounded-2xl border border-slate-100 dark:border-[var(--border)] p-4 flex flex-col gap-3 min-w-0">
      <header className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mr-auto">{titulo}</h3>
        {modo === "um" && chaves.length > 0 && (
          <select aria-label={rotulo} value={atual} onChange={e => setEscolhida(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-[var(--card)] text-slate-700 dark:text-slate-200">
            {chaves.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        )}
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-600 p-0.5">
          {([["um", "Um por vez"], ["todos", "Todos"]] as const).map(([v, r]) => (
            <button key={v} type="button" onClick={() => setModo(v)}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${modo === v ? "bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}>{r}</button>
          ))}
        </div>
      </header>

      {!chaves.length ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">Nenhuma jornada registrada nas últimas 53 semanas.</p>
      ) : modo === "um" ? (
        <div className="flex flex-col gap-1.5">
          <Mapa porDia={porChave.get(atual)!} semanas={semanas} comMeses />
          <Resumo porDia={porChave.get(atual)!} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {chaves.map((k, i) => (
            <div key={k} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2"><b className="text-xs text-slate-700 dark:text-slate-200">{k}</b><Resumo porDia={porChave.get(k)!} /></div>
              <Mapa porDia={porChave.get(k)!} semanas={semanas} comMeses={i === 0} />
            </div>
          ))}
        </div>
      )}

      <footer className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
        Menos{COR.map((c, i) => <span key={i} className={`w-2.5 h-2.5 rounded-[2px] ${c}`} />)}Mais · horas da saída ao retorno à Sede
      </footer>
    </section>
  );
}
