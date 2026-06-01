import {
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  MessageSquare,
  Tag,
  Users,
} from "lucide-react";
import { useState } from "react";
import { LABEL_COLORS, renderMarkdown, formatDateTime } from "../lib/helpers";

export function AtividadeCardItem({ card }: { card: any }) {
  const [expanded, setExpanded] = useState(false);
  const temComentarios = card.comentarios?.length > 0;
  const hora = new Date(card.due).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 mb-2 overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-blue-400" />
          <span className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{card.nome}</span>
          {temComentarios && (
            <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
              <MessageSquare className="w-3 h-3" />
              {card.comentarios.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {hora}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200/60 dark:border-slate-700/60 pt-3 space-y-3">
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Lista:</span> {card.lista}
            </span>
            {card.membros.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-slate-400" />
                {card.membros.join(", ")}
              </span>
            )}
          </div>
          {card.etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {card.etiquetas.map((e: any, i: number) => (
                <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs ${LABEL_COLORS[e.cor] ?? "bg-gray-400"}`}>
                  <Tag className="w-3 h-3" />
                  {e.nome || e.cor}
                </span>
              ))}
            </div>
          )}
          {card.descricao && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 bg-white/50 dark:bg-black/10 rounded p-2">
              {renderMarkdown(card.descricao)}
            </p>
          )}
          {temComentarios && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <MessageSquare className="w-3.5 h-3.5" />
                Comentários ({card.comentarios.length})
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {card.comentarios.map((c: any) => (
                  <div key={c.id} className="bg-white dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200/80 dark:border-slate-700/50">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {c.autor.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{c.autor}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{formatDateTime(c.data)}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{renderMarkdown(c.texto)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" /> Abrir no Trello
          </a>
        </div>
      )}
    </div>
  );
}
