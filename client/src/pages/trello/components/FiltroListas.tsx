import { Filter, X } from "lucide-react";
import { useState } from "react";

export function FiltroListas({
  todasListas,
  selecionadas,
  onChange,
}: {
  todasListas: string[];
  selecionadas: string[];
  onChange: (listas: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const todas = selecionadas.length === 0;

  function toggle(lista: string) {
    if (selecionadas.includes(lista)) {
      onChange(selecionadas.filter((l) => l !== lista));
    } else {
      onChange([...selecionadas, lista]);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <Filter className="w-4 h-4" />
        {todas ? "Todas as listas" : `${selecionadas.length} lista(s)`}
        {!todas && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="ml-1 text-slate-400 hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-10 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 min-w-[220px]">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider px-1">
            Filtrar por lista
          </p>
          <button
            onClick={() => onChange([])}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-colors ${todas
              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            Todas as listas
          </button>
          <div className="border-t border-slate-100 dark:border-slate-700 my-1.5" />
          {todasListas.map((lista) => {
            const ativa = selecionadas.includes(lista);
            return (
              <button
                key={lista}
                onClick={() => toggle(lista)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${ativa
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ativa ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                {lista}
              </button>
            );
          })}
          <div className="border-t border-slate-100 dark:border-slate-700 mt-1.5 pt-1.5">
            <button
              onClick={() => setAberto(false)}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
