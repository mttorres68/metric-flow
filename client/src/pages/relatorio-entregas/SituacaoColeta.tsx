/*
 * Situação da coleta do CheckNow da revenda: última coleta, falha e atraso (> 3 h sem sucesso entre 06h e 22h).
 * Clique abre as últimas 10 coletas.
 */
import { useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { diaBRT, horaBRT } from "@shared/entregas";

const ORIGEM: Record<string, string> = { auto: "automática", botao: "botão", upload: "planilha" };
const RESULTADO: Record<string, string> = { ok: "ok", sem_dados: "sem dados", rodando: "rodando…" };
const diaBR = (iso: string) => iso.split("-").reverse().join("/");
const quando = (d: Date) => `${diaBRT(d) === diaBRT(new Date()) ? "hoje" : diaBR(diaBRT(d)).slice(0, 5)} ${horaBRT(d)}`;

export function SituacaoColeta({ revendaId }: { revendaId: number }) {
  const [aberto, setAberto] = useState(false);
  const { data: coletas = [] } = trpc.entregas.coletas.useQuery({ revendaId }, { refetchInterval: 60_000 });
  const ultima = coletas.find(c => c.status !== "rodando");
  const ultimoOk = coletas.find(c => c.status === "ok" || c.status === "sem_dados");
  const hora = Number(horaBRT(new Date()).slice(0, 2));
  const atrasada = hora >= 6 && hora <= 22 && (!ultimoOk || Date.now() - new Date(ultimoOk.iniciadoEm).getTime() > 3 * 3600_000);
  const falhou = ultima?.status === "erro";
  const ruim = falhou || atrasada;
  const texto = !ultima ? "Nenhuma coleta ainda"
    : falhou ? `Falhou ${quando(new Date(ultima.iniciadoEm))}: ${ultima.erro}`
    : `Última coleta: ${quando(new Date(ultima.iniciadoEm))}${atrasada ? " (mais de 3 h sem sucesso)" : ""}`;

  return (
    <div className="relative inline-block">
      <button onClick={() => setAberto(a => !a)} aria-expanded={aberto}
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${ruim ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}>
        {ruim ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} className="text-green-600 dark:text-green-400" />} {texto}
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1 w-[34rem] max-w-[90vw] bg-white dark:bg-[var(--card)] border border-slate-200 dark:border-[var(--border)] rounded-xl shadow-lg p-3">
          {!coletas.length ? <p className="text-xs text-slate-400">Nenhuma coleta registrada.</p> : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left"><th className="py-1">Quando</th><th>Origem</th><th>Período</th><th>Resultado</th><th className="text-right">Entregas</th></tr>
              </thead>
              <tbody>
                {coletas.map(c => (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-[var(--border)] text-slate-600 dark:text-slate-300">
                    <td className="py-1">{quando(new Date(c.iniciadoEm))}</td>
                    <td>{ORIGEM[c.origem] ?? c.origem}</td>
                    <td>{diaBR(c.periodoDe)}{c.periodoAte !== c.periodoDe ? ` – ${diaBR(c.periodoAte)}` : ""}</td>
                    <td className={c.status === "erro" ? "text-red-600 dark:text-red-400" : ""} title={c.erro ?? undefined}>
                      {c.status === "erro" ? `erro: ${c.erro}` : RESULTADO[c.status] ?? c.status}
                    </td>
                    <td className="text-right">{c.linhas ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
