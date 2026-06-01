import { trpc } from "@/lib/trpc";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Save, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TODOS_ROLES } from "../lib/templates";

interface MapeamentoRevenda {
  revenda: string;
  boardId: string;
}

export function MapeamentoMembros({ revendas }: { revendas: MapeamentoRevenda[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {revendas.map((r) => (
        <RevendaMapeamento
          key={r.revenda}
          revenda={r.revenda}
          boardId={r.boardId}
          isOpen={expandido === r.revenda}
          onToggle={() => setExpandido((prev) => (prev === r.revenda ? null : r.revenda))}
        />
      ))}
    </div>
  );
}

function RevendaMapeamento({
  revenda, boardId, isOpen, onToggle,
}: {
  revenda: string; boardId: string; isOpen: boolean; onToggle: () => void;
}) {
  const { data: membros, isLoading: loadingMembros } = trpc.crm.getBoardMembers.useQuery(
    { boardId },
    { enabled: isOpen, staleTime: 5 * 60 * 1000 },
  );
  const { data: mapeamentoGlobal, refetch } = trpc.crm.getMapeamento.useQuery(undefined, { staleTime: 60_000 });
  const salvarMut = trpc.crm.salvarMapeamento.useMutation();

  // Mapeamento local (draft)
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [salvo, setSalvo] = useState(false);

  // Inicializa draft com valores salvos para esta revenda
  useEffect(() => {
    if (mapeamentoGlobal) {
      const saved = mapeamentoGlobal.filter((m) => m.revenda === revenda);
      const inicial: Record<string, string> = {};
      saved.forEach((m) => { inicial[m.role] = m.trelloMemberId; });
      setDraft(inicial);
    }
  }, [mapeamentoGlobal, revenda]);

  async function handleSalvar() {
    if (!membros) return;
    const mapeamentos = Object.entries(draft)
      .filter(([, membId]) => membId)
      .map(([role, membId]) => {
        const memb = membros.find((m) => m.id === membId);
        return { role, trelloMemberId: membId, trelloMemberName: memb?.fullName ?? membId };
      });
    try {
      await salvarMut.mutateAsync({ revenda, mapeamentos });
      await refetch();
      setSalvo(true);
      toast.success(`Mapeamento de ${revenda} salvo!`);
      setTimeout(() => setSalvo(false), 3000);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    }
  }

  const mappedCount = mapeamentoGlobal?.filter((m) => m.revenda === revenda).length ?? 0;

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}
          >
            {revenda.charAt(0)}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{revenda}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {mappedCount > 0 ? `${mappedCount} papel(éis) mapeado(s)` : "Nenhum mapeamento configurado"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mappedCount > 0 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4 space-y-4">
          {loadingMembros ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando membros do board...
            </div>
          ) : !membros?.length ? (
            <p className="text-sm text-slate-400">Nenhum membro encontrado neste board.</p>
          ) : (
            <>
              <div className="space-y-2">
                {TODOS_ROLES.map((role) => (
                  <div key={role} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-52 flex-shrink-0">
                      <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{role}</span>
                    </div>
                    <select
                      value={draft[role] ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [role]: e.target.value }))}
                      className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">— Não mapeado —</option>
                      {membros.map((m) => (
                        <option key={m.id} value={m.id}>{m.fullName} (@{m.username})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSalvar}
                disabled={salvarMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {salvarMut.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : salvo
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <Save className="w-4 h-4" />}
                {salvo ? "Salvo!" : "Salvar mapeamento"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
