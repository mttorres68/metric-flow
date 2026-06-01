import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { LabelConfig } from "./LabelConfig";
import { MapeamentoMembros } from "./MapeamentoMembros";

export function TabConfiguracoes() {
  const { data: boards, isLoading } = trpc.crm.getBoards.useQuery(undefined, { staleTime: 10 * 60 * 1000 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Carregando boards...</span>
      </div>
    );
  }

  if (!boards?.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        Nenhum board configurado. Verifique a variável TRELLO_BOARDS no .env
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Etiqueta */}
      <LabelConfig />

      {/* Mapeamento de membros */}
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Configure qual membro do Trello corresponde a cada papel em cada revenda.
        </p>
        <MapeamentoMembros revendas={boards} />
      </div>
    </div>
  );
}
