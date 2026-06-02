import { trpc } from "@/lib/trpc";
import { type WaTemplate } from "@/hooks/useWaTemplate";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { gerarMensagemWhatsApp } from "../lib/whatsapp";

const WA_BULK_SEL_KEY = "metricflow:trello-wa-bulk-selecoes";

function loadBulkSaved(): string[] | null {
  try {
    const val = localStorage.getItem(WA_BULK_SEL_KEY);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

function saveBulkSelecionadas(revendas: string[]) {
  try {
    localStorage.setItem(WA_BULK_SEL_KEY, JSON.stringify(revendas));
  } catch { /* ignore */ }
}

type ProgressoRevenda = "aguardando" | "enviando" | "ok" | "erro";

interface Props {
  atividadesData: {
    revenda: string;
    hoje: any[];
    amanha: any[];
    erro?: string;
  }[];
  template: WaTemplate;
  onClose: () => void;
}

export function WhatsAppBulkModal({ atividadesData, template, onClose }: Props) {
  const { data: todosDestinatarios, isLoading: loadingDest } =
    trpc.evolution.listDestinatarios.useQuery(undefined, { staleTime: 60_000 });
  const sendMessage = trpc.evolution.sendMessage.useMutation();

  // Agrupa destinatários por revenda
  const destPorRevenda = useMemo(() => {
    const map: Record<string, { id: string; nome: string; telefone: string; apelido?: string }[]> = {};
    if (!todosDestinatarios) return map;
    for (const d of todosDestinatarios) {
      for (const rev of (d as any).revendas ?? []) {
        if (!map[rev]) map[rev] = [];
        map[rev].push({ id: d.id, nome: d.nome, telefone: d.telefone, apelido: d.apelido });
      }
    }
    return map;
  }, [todosDestinatarios]);

  // Inicializa seleção: usa localStorage ou seleciona revendas com atividades
  const [selecionadas, setSelecionadas] = useState<string[]>(() => {
    const saved = loadBulkSaved();
    if (saved) return saved;
    return atividadesData
      .filter((r) => !r.erro && (r.hoje.length + r.amanha.length) > 0)
      .map((r) => r.revenda);
  });

  const [progresso, setProgresso] = useState<Record<string, ProgressoRevenda>>({});
  const [enviando, setEnviando] = useState(false);

  const todasRevendas = atividadesData.map((r) => r.revenda);
  const todasSelecionadas = selecionadas.length === todasRevendas.length;

  function toggle(revenda: string) {
    setSelecionadas((prev) => {
      const next = prev.includes(revenda)
        ? prev.filter((r) => r !== revenda)
        : [...prev, revenda];
      saveBulkSelecionadas(next);
      return next;
    });
  }

  function toggleTodas() {
    const next = todasSelecionadas ? [] : todasRevendas;
    saveBulkSelecionadas(next);
    setSelecionadas(next);
  }

  async function handleEnviar() {
    if (!selecionadas.length) return;
    setEnviando(true);

    const inicial: Record<string, ProgressoRevenda> = {};
    selecionadas.forEach((r) => { inicial[r] = "aguardando"; });
    setProgresso(inicial);

    let erros = 0;
    let totalEnviados = 0;

    for (const revendaNome of selecionadas) {
      const dadosRevenda = atividadesData.find((r) => r.revenda === revendaNome);
      if (!dadosRevenda) continue;

      const destinatarios = destPorRevenda[revendaNome] ?? [];
      if (!destinatarios.length) {
        setProgresso((p) => ({ ...p, [revendaNome]: "erro" }));
        erros++;
        continue;
      }

      setProgresso((p) => ({ ...p, [revendaNome]: "enviando" }));

      const mensagem = gerarMensagemWhatsApp(
        revendaNome,
        dadosRevenda.hoje,
        dadosRevenda.amanha,
        template,
      );

      let revendaOk = true;
      for (const dest of destinatarios) {
        try {
          await sendMessage.mutateAsync({ telefone: dest.telefone, texto: mensagem });
          totalEnviados++;
        } catch {
          revendaOk = false;
          erros++;
        }
      }

      setProgresso((p) => ({ ...p, [revendaNome]: revendaOk ? "ok" : "erro" }));
    }

    setEnviando(false);

    if (erros === 0) {
      toast.success(`Mensagens enviadas para ${selecionadas.length} revenda(s)!`);
      onClose();
    } else {
      toast.warning(`${totalEnviados} mensagens enviadas. ${erros} falharam.`);
    }
  }

  const jaEnviando = Object.keys(progresso).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-green-500" />
            Enviar Atividades do Dia — WhatsApp
          </h3>
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de revendas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {/* Selecionar todas */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Revendas
            </p>
            <button
              onClick={toggleTodas}
              disabled={enviando}
              className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 transition-colors disabled:opacity-50"
            >
              {todasSelecionadas ? "Desmarcar todas" : "Selecionar todas"}
            </button>
          </div>

          {loadingDest ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando destinatários...
            </div>
          ) : (
            atividadesData.map((revenda) => {
              const isSelecionada = selecionadas.includes(revenda.revenda);
              const totalAtiv = revenda.hoje.length + revenda.amanha.length;
              const dests = destPorRevenda[revenda.revenda] ?? [];
              const prog = progresso[revenda.revenda];

              return (
                <label
                  key={revenda.revenda}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
                    isSelecionada
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  } ${enviando ? "pointer-events-none" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelecionada}
                    onChange={() => toggle(revenda.revenda)}
                    disabled={enviando}
                    className="w-4 h-4 rounded accent-green-500 flex-shrink-0"
                  />

                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}
                  >
                    {revenda.revenda.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {revenda.revenda}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {totalAtiv > 0 ? (
                        <>
                          {revenda.hoje.length > 0 && (
                            <span className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">
                              {revenda.hoje.length} hoje
                            </span>
                          )}
                          {revenda.amanha.length > 0 && (
                            <span className="text-[11px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-full">
                              {revenda.amanha.length} amanhã
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">Sem atividades</span>
                      )}
                      {dests.length > 0 && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3 flex-shrink-0" />
                          {dests.map((d) => d.apelido || d.nome).join(", ")}
                        </span>
                      )}
                      {dests.length === 0 && (
                        <span className="text-[11px] text-amber-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          Sem destinatários configurados
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progresso */}
                  {prog === "enviando" && <Loader2 className="w-4 h-4 animate-spin text-green-500 flex-shrink-0" />}
                  {prog === "ok"      && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {prog === "erro"    && <AlertCircle  className="w-4 h-4 text-red-500 flex-shrink-0" />}
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={enviando}
            className="flex-1 px-4 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {jaEnviando && !enviando ? "Fechar" : "Cancelar"}
          </button>
          <button
            onClick={handleEnviar}
            disabled={enviando || selecionadas.length === 0 || loadingDest}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            {enviando
              ? "Enviando..."
              : `Enviar para ${selecionadas.length} revenda(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
