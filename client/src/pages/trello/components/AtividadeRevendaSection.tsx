import { type WaTemplate } from "@/hooks/useWaTemplate";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Send,
} from "lucide-react";
import { useState } from "react";
import { gerarMensagemWhatsApp } from "../lib/whatsapp";
import { AtividadeCardItem } from "./AtividadeCardItem";
import { WhatsAppModal } from "./WhatsAppModal";

export function AtividadeRevendaSection({ revenda, template }: { revenda: any; template: WaTemplate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const hasError = !!revenda.erro;
  const totalHoje = revenda.hoje.length;
  const totalAmanha = revenda.amanha.length;
  const total = totalHoje + totalAmanha;

  const mensagem = gerarMensagemWhatsApp(revenda.revenda, revenda.hoje, revenda.amanha, template);

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <button
          className="flex items-center gap-3 flex-1 text-left min-w-0"
          onClick={() => setCollapsed((v) => !v)}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}
          >
            {revenda.revenda.charAt(0)}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{revenda.revenda}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {totalHoje > 0 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full font-medium">
                  {totalHoje} hoje
                </span>
              )}
              {totalAmanha > 0 && (
                <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full font-medium">
                  {totalAmanha} amanhã
                </span>
              )}
              {total === 0 && !hasError && (
                <span className="text-xs text-green-600 dark:text-green-400">Sem atividades</span>
              )}
              {hasError && (
                <span className="text-xs text-red-500">Erro ao carregar</span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!hasError && (
            <button
              onClick={() => setShowWaModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-500 hover:bg-green-600 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              WhatsApp
            </button>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-4">
          {hasError && (
            <p className="text-sm text-red-500 flex items-center gap-2 py-2">
              <AlertCircle className="w-4 h-4" /> {revenda.erro}
            </p>
          )}
          {!hasError && total === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-2 italic flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Nenhuma atividade programada para hoje ou amanhã.
            </p>
          )}

          {!hasError && totalHoje > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                Hoje
              </p>
              {revenda.hoje.map((card: any) => (
                <AtividadeCardItem key={card.id} card={card} />
              ))}
            </div>
          )}

          {!hasError && totalAmanha > 0 && (
            <div>
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                Amanhã
              </p>
              {revenda.amanha.map((card: any) => (
                <AtividadeCardItem key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>
      )}

      {showWaModal && (
        <WhatsAppModal
          revenda={revenda.revenda}
          mensagem={mensagem}
          onClose={() => setShowWaModal(false)}
        />
      )}
    </div>
  );
}
