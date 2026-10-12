import { trpc } from "@/lib/trpc";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, FileImage, FileText, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { exportarConclusaoImagem } from "../lib/conclusao";
import { conclusaoColor, formatDate, formatMesAno } from "../lib/helpers";
import { exportarConclusaoPDF } from "../lib/pdf";
import { FiltroListas } from "./FiltroListas";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function ConclusaoTab() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [listasFiltro, setListasFiltro] = useState<string[]>([]);
  const [exportando, setExportando] = useState<"img" | "pdf" | null>(null);
  const [ocultarSemDados, setOcultarSemDados] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, isFetching } =
    trpc.crm.getConclusaoMensal.useQuery({ mes, ano, listasPermitidas: listasFiltro });

  const todasListas = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.forEach((r) => r.todasListas?.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [data]);

  function toggleExpandida(revenda: string) {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(revenda)) next.delete(revenda);
      else next.add(revenda);
      return next;
    });
  }

  async function handleExportar(tipo: "img" | "pdf") {
    if (!data) return;
    const dadosExport = ocultarSemDados ? data.filter((r) => r.total > 0) : data;
    setExportando(tipo);
    try {
      if (tipo === "img") await exportarConclusaoImagem(dadosExport, mes, ano);
      else await exportarConclusaoPDF(dadosExport, mes, ano);
    } catch (e: any) {
      toast.error("Erro ao exportar: " + e.message);
    } finally {
      setExportando(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
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
        {todasListas.length > 0 && (
          <FiltroListas
            todasListas={todasListas}
            selecionadas={listasFiltro}
            onChange={setListasFiltro}
          />
        )}
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ocultarSemDados}
              onChange={(e) => setOcultarSemDados(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Ocultar sem dados na exportação
          </label>
          <button
            onClick={() => handleExportar("img")}
            disabled={!data || !!exportando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {exportando === "img" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
            Exportar imagem
          </button>
          <button
            onClick={() => handleExportar("pdf")}
            disabled={!data || !!exportando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {exportando === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Exportar PDF
          </button>
        </div>
      </div>

      {(isLoading || isFetching) && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Buscando dados no Trello...</span>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{(error as any)?.message ?? "Erro ao buscar conclusão"}</p>
        </div>
      )}

      {data && !isFetching && (
        <div className="max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="bg-indigo-100 dark:bg-indigo-900/40 text-center py-2 font-bold text-slate-800 dark:text-slate-100 text-sm">
            {formatMesAno(mes, ano)}
          </div>
          {data.map((r) => {
            const cor = conclusaoColor(r.concluidos, r.total);
            const aberta = expandidas.has(r.revenda);
            return (
              <div key={r.revenda} className="border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => toggleExpandida(r.revenda)}
                  className="grid grid-cols-[1fr_90px] w-full text-left text-sm"
                >
                  <span className="px-3 py-2 bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1">
                    {aberta ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                    {r.revenda}
                  </span>
                  <span className={`px-3 py-2 text-center font-bold ${cor.bg} ${cor.text}`}>
                    {r.erro ? "erro" : r.total === 0 ? "sem dados" : `${r.concluidos}/${r.total}`}
                  </span>
                </button>

                {aberta && (
                  <div className="bg-slate-50 dark:bg-slate-900/40 px-3 py-2 border-t border-slate-200 dark:border-slate-700">
                    {r.erro && <p className="text-xs text-red-500">{r.erro}</p>}
                    {!r.erro && r.cardsAtrasados.length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum card atrasado.</p>
                    )}
                    {!r.erro && r.cardsAtrasados.length > 0 && (
                      <ul className="space-y-1.5">
                        {r.cardsAtrasados.map((c) => (
                          <li key={c.id} className="flex items-start gap-1.5 text-xs">
                            <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-slate-700 dark:text-slate-200 truncate">{c.nome}</p>
                              <p className="text-slate-400 dark:text-slate-500">{formatDate(c.due)} · {c.lista}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
