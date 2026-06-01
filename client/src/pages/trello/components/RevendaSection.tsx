import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { CardItem } from "./CardItem";

export function RevendaSection({ revenda }: { revenda: any }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasError = !!revenda.erro;
  const hasCards = revenda.cards.length > 0;

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <button
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}
          >
            {revenda.revenda.charAt(0)}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{revenda.revenda}</h3>
            <a
              href={revenda.boardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-blue-500 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" /> Ver board
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasError ? (
            <span className="flex items-center gap-1.5 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
              <AlertCircle className="w-4 h-4" /> Erro
            </span>
          ) : hasCards ? (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
              <AlertTriangle className="w-4 h-4" />
              {revenda.totalAtraso} em atraso
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" /> Em dia
            </span>
          )}
          {collapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3">
          {hasError && (
            <p className="text-sm text-red-500 flex items-center gap-2 py-2">
              <AlertCircle className="w-4 h-4" /> {revenda.erro}
            </p>
          )}
          {!hasError && !hasCards && (
            <p className="text-sm text-green-600 dark:text-green-400 py-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Nenhum card em atraso nesta revenda.
            </p>
          )}
          {!hasError && revenda.cards.map((card: any) => (
            <CardItem key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
