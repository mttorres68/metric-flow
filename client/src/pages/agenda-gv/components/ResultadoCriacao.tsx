import { AlertCircle, CheckCircle2, ExternalLink, X } from "lucide-react";

export interface ResultadoRevenda {
  revenda: string;
  boardId: string;
  criados: number;
  erros: { nome: string; erro: string }[];
}

export function ResultadoCriacao({
  resultados,
  onClose,
}: {
  resultados: ResultadoRevenda[];
  onClose: () => void;
}) {
  const totalCriados = resultados.reduce((s, r) => s + r.criados, 0);
  const totalErros = resultados.reduce((s, r) => s + r.erros.length, 0);
  const tudo_ok = totalErros === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {tudo_ok
              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
              : <AlertCircle className="w-5 h-5 text-amber-500" />}
            Resultado da criação
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalCriados}</p>
              <p className="text-xs text-green-700 dark:text-green-300">cards criados</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${totalErros > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-slate-900/20"}`}>
              <p className={`text-2xl font-bold ${totalErros > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"}`}>{totalErros}</p>
              <p className={`text-xs ${totalErros > 0 ? "text-red-700 dark:text-red-300" : "text-slate-400"}`}>erros</p>
            </div>
          </div>

          {/* Por revenda */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {resultados.map((r) => (
              <div key={r.revenda} className={`rounded-lg p-3 border ${
                r.erros.length === 0
                  ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                  : r.criados === 0
                    ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                    : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {r.erros.length === 0
                      ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.revenda}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{r.criados} criados</span>
                    {r.erros.length > 0 && <span className="text-red-500">{r.erros.length} erros</span>}
                    <a
                      href={`https://trello.com/b/${r.boardId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver board
                    </a>
                  </div>
                </div>
                {r.erros.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {r.erros.map((e, i) => (
                      <p key={i} className="text-[11px] text-red-600 dark:text-red-400 truncate">
                        ✗ {e.nome}: {e.erro}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
