import { trpc } from "@/lib/trpc";
import { AlertCircle, Loader2, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AtividadeParsed } from "../lib/parser";
import type { ResultadoRevenda } from "./ResultadoCriacao";
import { ResultadoCriacao } from "./ResultadoCriacao";
import { UploadCard } from "./UploadCard";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type StatusRevenda = "aguardando" | "carregando" | "carregado" | "erro";

interface RevendaState {
  atividades: AtividadeParsed[] | null;
  status: StatusRevenda;
  erro?: string;
}

// Papel atribuído aos cards no Trello — o GV é o responsável por conduzir todas as atividades
const ROLE_PRINCIPAL = "Gerente de Vendas";

export function TabNovoCiclo() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [criando, setCriando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoRevenda[] | null>(null);
  const [revendasState, setRevendasState] = useState<Record<string, RevendaState>>({});

  const { data: boards, isLoading: loadingBoards } = trpc.crm.getBoards.useQuery(undefined, { staleTime: 10 * 60 * 1000 });
  const { data: mapeamentoGlobal } = trpc.crm.getMapeamento.useQuery(undefined, { staleTime: 60_000 });
  const { data: agendaLists } = trpc.crm.getAgendaLists.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const criarMut = trpc.crm.criarCardsRevenda.useMutation();

  function getRevendaState(revenda: string): RevendaState {
    return revendasState[revenda] ?? { atividades: null, status: "aguardando", listaId: "" };
  }

  function setRevendaState(revenda: string, update: Partial<RevendaState>) {
    setRevendasState((prev) => ({
      ...prev,
      [revenda]: { ...getRevendaState(revenda), ...update },
    }));
  }

  function handleCarregado(revenda: string, atividades: AtividadeParsed[]) {
    setRevendaState(revenda, { atividades, status: "carregado" });
  }

  function handleLimpar(revenda: string) {
    setRevendaState(revenda, { atividades: null, status: "aguardando" });
  }

  const revendasComDados = boards?.filter((b) => getRevendaState(b.revenda).status === "carregado") ?? [];
  const podeCriar = revendasComDados.length > 0 && !criando;

  async function handleCriar() {
    if (!boards || revendasComDados.length === 0) return;
    setCriando(true);
    const resultList: ResultadoRevenda[] = [];

    for (const board of revendasComDados) {
      const state = getRevendaState(board.revenda);
      if (!state.atividades) continue;

      // Resolve lista "Agenda" via procedure pré-carregado
      const agendaEntry = agendaLists?.find((a) => a.boardId === board.boardId);
      const listaId = agendaEntry?.listaId || "";

      // Resolve memberId do papel principal para esta revenda
      const mapeamento = mapeamentoGlobal?.find(
        (m) => m.revenda === board.revenda && m.role === ROLE_PRINCIPAL,
      );
      const memberId = mapeamento?.trelloMemberId;

      const atividadesPayload = state.atividades.map((a) => ({
        codigo:    a.codigo,
        nome:      a.nome,
        due:       a.due,
        descricao: a.descricao || "",
        checklist: (a as any).checklist ?? [],
      }));

      try {
        const res = await criarMut.mutateAsync({
          revenda: board.revenda,
          boardId: board.boardId,
          listaId,
          memberId,
          atividades: atividadesPayload,
          mes,
          ano,
        });
        resultList.push({ revenda: board.revenda, boardId: board.boardId, criados: res.criados, erros: res.erros });
      } catch (e: any) {
        resultList.push({ revenda: board.revenda, boardId: board.boardId, criados: 0, erros: [{ nome: "—", erro: e.message }] });
      }
    }

    setCriando(false);
    setResultados(resultList);

    const totalCriados = resultList.reduce((s, r) => s + r.criados, 0);
    const totalErros = resultList.reduce((s, r) => s + r.erros.length, 0);
    if (totalErros === 0) {
      toast.success(`${totalCriados} cards criados com sucesso!`);
    } else {
      toast.warning(`${totalCriados} cards criados, ${totalErros} erros.`);
    }
  }

  if (loadingBoards) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Carregando revendas...</span>
      </div>
    );
  }

  if (!boards?.length) {
    return (
      <div className="flex items-center gap-3 py-10 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-5">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        Nenhum board configurado. Verifique a variável TRELLO_BOARDS no .env
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seletor de mês/ano */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Mês</label>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ano</label>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {revendasComDados.length > 0 && (
          <div className="ml-auto flex items-center gap-2 mt-5">
            <button
              onClick={() => setRevendasState({})}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
        Faça o upload da planilha preenchida de cada revenda.
        A lista "Agenda" do board será detectada automaticamente.
      </p>

      {/* Cards de upload por revenda */}
      <div className="grid grid-cols-1 gap-3">
        {boards.map((board) => {
          const state = getRevendaState(board.revenda);
          return (
            <UploadCard
              key={board.revenda}
              revenda={board.revenda}
              boardId={board.boardId}
              atividades={state.atividades}
              status={state.status}
              erro={state.erro}
              onCarregado={(ativs) => handleCarregado(board.revenda, ativs)}
              onLimpar={() => handleLimpar(board.revenda)}
            />
          );
        })}
      </div>

      {/* Resumo + Botão Criar */}
      {revendasComDados.length > 0 && (
        <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {revendasComDados.length} revenda(s) prontas
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {revendasComDados.reduce((s, b) => s + (getRevendaState(b.revenda).atividades?.length ?? 0), 0)} cards serão criados em {MESES[mes - 1]} {ano}
            </p>
          </div>
          <button
            onClick={handleCriar}
            disabled={!podeCriar}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {criando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Play className="w-4 h-4" />}
            {criando ? "Criando cards..." : "Criar todos os cards"}
          </button>
        </div>
      )}

      {resultados && (
        <ResultadoCriacao resultados={resultados} onClose={() => setResultados(null)} />
      )}
    </div>
  );
}
