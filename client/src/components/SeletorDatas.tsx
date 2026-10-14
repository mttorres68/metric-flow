/*
 * MetricFlow — calendário do Relatório de Entregas: data única (um mês, Cancelar/Aplicar) e intervalo
 * (atalhos à esquerda, dois meses, resumo e Cancelar/Aplicar). Datas em "aaaa-mm-dd" (BRT).
 */
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import type { DateRange, Matcher } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { diaBRT } from "@shared/entregas";
import { atalhos, diasEntre } from "@shared/intervalos";

const paraData = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const paraIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const DIA_MS = 86_400_000;

// Meio do intervalo em índigo claro (o --accent do tema é cinza).
const TOM = "[--accent:oklch(0.94_0.04_265)] dark:[--accent:oklch(0.32_0.07_265)] [--accent-foreground:oklch(0.35_0.12_265)] dark:[--accent-foreground:oklch(0.92_0.03_265)]";
const gatilho = "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-[var(--card)] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300 disabled:opacity-50";
const botao = "px-4 py-1.5 rounded-lg text-xs font-semibold";

function Rodape({ texto, onCancelar, onAplicar, podeAplicar }: { texto: React.ReactNode; onCancelar: () => void; onAplicar: () => void; podeAplicar: boolean }) {
  return (
    <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 px-4 py-3">
      <span className="text-xs text-slate-500 dark:text-slate-400 mr-auto">{texto}</span>
      <button type="button" onClick={onCancelar} className={`${botao} border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50`}>Cancelar</button>
      <button type="button" onClick={onAplicar} disabled={!podeAplicar} className={`${botao} bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50`}>Aplicar</button>
    </div>
  );
}

/** Data única: um mês, hoje marcado, Cancelar/Aplicar. */
export function SeletorDia({ valor, onChange, max, min, disabled, rotulo = "Dia" }: {
  valor: string; onChange: (dia: string) => void; max?: string; min?: string; disabled?: boolean; rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Date | undefined>(paraData(valor));
  const [mes, setMes] = useState(paraData(valor));
  const bloqueados: Matcher[] = [...(max ? [{ after: paraData(max) }] : []), ...(min ? [{ before: paraData(min) }] : [])];
  const abrir = (a: boolean) => { if (a) { setRascunho(paraData(valor)); setMes(paraData(valor)); } setAberto(a); };
  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={rotulo} className={gatilho}><CalendarDays size={14} className="text-indigo-500" />{br(valor)}</button>
      </PopoverTrigger>
      <PopoverContent align="end" className={`w-auto p-0 ${TOM}`}>
        <Calendar mode="single" locale={ptBR} selected={rascunho} onSelect={setRascunho} month={mes} onMonthChange={setMes} disabled={bloqueados} />
        <Rodape texto={rascunho ? br(paraIso(rascunho)) : "Escolha um dia"} podeAplicar={!!rascunho}
          onCancelar={() => setAberto(false)} onAplicar={() => { if (rascunho) onChange(paraIso(rascunho)); setAberto(false); }} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Intervalo: atalhos à esquerda (terminando em `ultimoDia`), dois meses, resumo e Cancelar/Aplicar.
 * O 1º clique começa um intervalo novo e o 2º fecha; com `maxDias`, os dias além do limite ficam bloqueados.
 */
export function SeletorIntervalo({ de, ate, onChange, maxDias, ultimoDia, disabled, rotulo = "Período" }: {
  de: string; ate: string; onChange: (de: string, ate: string) => void; maxDias?: number; ultimoDia?: string; disabled?: boolean; rotulo?: string;
}) {
  const hoje = diaBRT(new Date());
  const fim = ultimoDia ?? hoje;
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<DateRange | undefined>({ from: paraData(de), to: paraData(ate) });
  const mesAntes = (iso: string) => { const d = paraData(iso); return new Date(d.getFullYear(), d.getMonth() - 1, 1); };
  const [mes, setMes] = useState(mesAntes(ate));
  const abrir = (a: boolean) => { if (a) { setRascunho({ from: paraData(de), to: paraData(ate) }); setMes(mesAntes(ate)); } setAberto(a); };

  const lista = atalhos(hoje, fim, maxDias);
  const deR = rascunho?.from ? paraIso(rascunho.from) : null, ateR = rascunho?.to ? paraIso(rascunho.to) : null;
  const bloqueados: Matcher[] = [{ after: paraData(fim) }];
  if (maxDias && rascunho?.from && !rascunho.to) {
    const ini = rascunho.from.getTime(), lim = (maxDias - 1) * DIA_MS;
    bloqueados.push((d: Date) => Math.abs(d.getTime() - ini) > lim + DIA_MS / 2);
  }
  const clicar = (_: DateRange | undefined, dia: Date) => setRascunho(r =>
    !r?.from || r.to ? { from: dia, to: undefined } : dia < r.from ? { from: dia, to: r.from } : { from: r.from, to: dia });
  const resumo = deR && ateR ? <><b className="text-slate-700 dark:text-slate-200">{br(deR)} – {br(ateR)}</b> · {diasEntre(deR, ateR)} dia(s)</>
    : deR ? <>Início {br(deR)} · escolha o dia final{maxDias ? ` (até ${maxDias} dias)` : ""}</> : "Escolha o dia inicial";
  const aplicar = () => { if (deR) onChange(deR, ateR ?? deR); setAberto(false); };

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={rotulo} className={gatilho}>
          <CalendarDays size={14} className="text-indigo-500" />{de === ate ? br(de) : `${br(de)} – ${br(ate)}`}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`w-auto max-w-[calc(100vw-2rem)] p-0 ${TOM}`}>
        <div className="flex flex-col sm:flex-row">
          <div className="flex sm:flex-col gap-1 p-3 sm:w-40 overflow-x-auto border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-700">
            {lista.map(a => {
              const ativo = deR === a.de && ateR === a.ate;
              return (
                <button key={a.rotulo} type="button" aria-pressed={ativo}
                  onClick={() => { setRascunho({ from: paraData(a.de), to: paraData(a.ate) }); setMes(mesAntes(a.ate)); }}
                  className={`text-left whitespace-nowrap px-3 py-2 rounded-lg text-xs ${ativo ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/40 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
                  {a.rotulo}
                </button>
              );
            })}
            <span className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs ${lista.some(a => deR === a.de && ateR === a.ate) ? "text-slate-400" : "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/40 dark:text-indigo-300"}`}>
              Personalizado
            </span>
          </div>
          <Calendar mode="range" locale={ptBR} numberOfMonths={2} selected={rascunho} onSelect={clicar}
            month={mes} onMonthChange={setMes} disabled={bloqueados} />
        </div>
        <Rodape texto={resumo} podeAplicar={!!deR} onCancelar={() => setAberto(false)} onAplicar={aplicar} />
      </PopoverContent>
    </Popover>
  );
}
