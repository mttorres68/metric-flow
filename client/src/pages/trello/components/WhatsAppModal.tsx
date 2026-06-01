import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const WA_TRELLO_SEL_KEY = "metricflow:trello-wa-selecoes";

function loadSaved(revenda: string): string[] | null {
  try {
    const map = JSON.parse(localStorage.getItem(WA_TRELLO_SEL_KEY) || "{}");
    return map[revenda] ?? null;
  } catch { return null; }
}

function saveSelecionados(revenda: string, ids: string[]) {
  try {
    const map = JSON.parse(localStorage.getItem(WA_TRELLO_SEL_KEY) || "{}");
    map[revenda] = ids;
    localStorage.setItem(WA_TRELLO_SEL_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function WhatsAppModal({
  revenda,
  mensagem,
  onClose,
}: {
  revenda: string;
  mensagem: string;
  onClose: () => void;
}) {
  const { data: destinatarios, isLoading } = trpc.evolution.getDestinatariosPorRevenda.useQuery({ revenda });
  const sendMessage = trpc.evolution.sendMessage.useMutation();
  const [enviando, setEnviando] = useState(false);
  const [enviados, setEnviados] = useState<string[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const destinatariosIds = destinatarios?.map((d) => d.id) ?? [];

  useEffect(() => {
    if (destinatarios && destinatarios.length > 0) {
      const allIds = destinatarios.map((d) => d.id);
      const saved = loadSaved(revenda);
      setSelecionados(saved ? saved.filter((id) => allIds.includes(id)) : allIds);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinatarios]);

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      saveSelecionados(revenda, next);
      return next;
    });
  }

  function toggleTodos() {
    const next = selecionados.length === destinatariosIds.length ? [] : destinatariosIds;
    saveSelecionados(revenda, next);
    setSelecionados(next);
  }

  const destinatariosSelecionados = destinatarios?.filter((d) => selecionados.includes(d.id)) ?? [];

  async function handleEnviar() {
    if (!destinatariosSelecionados.length) return;
    setEnviando(true);
    let erros = 0;
    for (const dest of destinatariosSelecionados) {
      try {
        await sendMessage.mutateAsync({ telefone: dest.telefone, texto: mensagem });
        setEnviados((prev) => [...prev, dest.id]);
      } catch {
        erros++;
      }
    }
    setEnviando(false);
    if (erros === 0) {
      toast.success(`Mensagem enviada para ${destinatariosSelecionados.length} destinatário(s)!`);
      onClose();
    } else {
      toast.error(`${erros} envio(s) falharam. Verifique a conexão com o WhatsApp.`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-green-500" />
            Enviar via WhatsApp — {revenda}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Preview da mensagem
            </p>
            <pre className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans max-h-52 overflow-y-auto leading-relaxed">
              {mensagem}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Destinatários
              </p>
              {destinatarios && destinatarios.length > 1 && (
                <button
                  onClick={toggleTodos}
                  className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  {selecionados.length === destinatariosIds.length ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              )}
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando...
              </div>
            ) : !destinatarios?.length ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Nenhum destinatário configurado para esta revenda.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Configure os destinatários na página WhatsApp.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {destinatarios.map((dest) => {
                  const isSelecionado = selecionados.includes(dest.id);
                  const foiEnviado = enviados.includes(dest.id);
                  return (
                    <label
                      key={dest.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelecionado
                          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                          : "border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelecionado}
                        onChange={() => toggleSelecionado(dest.id)}
                        className="w-4 h-4 rounded accent-green-500 flex-shrink-0"
                      />
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {dest.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{dest.nome}</span>
                        {dest.apelido && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 ml-1.5">({dest.apelido})</span>
                        )}
                        <p className="text-xs text-slate-400 dark:text-slate-500">{dest.telefone}</p>
                      </div>
                      {foiEnviado && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleEnviar}
            disabled={enviando || selecionados.length === 0 || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {enviando
              ? "Enviando..."
              : `Enviar para ${selecionados.length} destinatário(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
