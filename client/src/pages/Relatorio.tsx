/*
 * MetricFlow — Gerenciador de Relatórios
 *
 * Central de análise e exportação, subdividida por revenda.
 * Para cada revenda encontrada na data selecionada:
 *   • EditorAnalise — Vendedores  (salvo em localStorage)
 *   • EditorAnalise — GAs         (salvo em localStorage)
 *   • Botão "Exportar PDF"        (2 páginas: Vendedores + GAs)
 *
 * "Exportar Todos" gera um único documento com todas as revendas.
 */

import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { trpc } from "@/lib/trpc";
import { EditorAnalise } from "@/components/EditorAnalise";
import {
  exportarRelatorioRevenda,
  exportarTodosRelatorios,
  type VendedorRow,
  type CoachingRow,
} from "@/lib/relatorioExport";
import {
  BarChart3,
  Download,
  FileText,
  Loader2,
  PenLine,
  Printer,
  Route,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Persistência das análises (localStorage)
// Chave:  metricflow:gerenciador
// PKs:    "${revenda}__${data}__vendedores"  e  "${revenda}__${data}__gas"
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = "metricflow:gerenciador";

function lsRead(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
function lsWrite(data: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function pk(revenda: string, data: string, tipo: "vendedores" | "gas") {
  return `${revenda}__${data}__${tipo}`;
}

function useAnalisesGerenciador(data: string) {
  const [store, setStore] = useState<Record<string, string>>(lsRead);

  const get = useCallback((revenda: string, tipo: "vendedores" | "gas") =>
    store[pk(revenda, data, tipo)] ?? "",
    [store, data]);

  const set = useCallback((revenda: string, tipo: "vendedores" | "gas", html: string) => {
    setStore(prev => {
      const next = { ...prev, [pk(revenda, data, tipo)]: html };
      lsWrite(next);
      return next;
    });
  }, [data]);

  // Devolve todas as análises de uma data como { revenda: html }
  const porRevenda = useCallback((tipo: "vendedores" | "gas") => {
    const suffix = `__${data}__${tipo}`;
    const res: Record<string, string> = {};
    Object.entries(store).forEach(([key, html]) => {
      if (key.endsWith(suffix) && html.trim()) {
        res[key.replace(suffix, "")] = html;
      }
    });
    return res;
  }, [store, data]);

  return { get, set, porRevenda };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function Relatorio() {
  const { isCollapsed } = useSidebarCollapse();
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [exportandoTodos, setExportandoTodos] = useState(false);

  // ── Navegação ──────────────────────────────────────────────────────────────
  const handleNavigate = (page: string) => {
    const rotas: Record<string, string> = {
      dashboard: "/", vendedores: "/vendedores",
      compliance: "/compliance", clientes: "/clientes",
      relatorio: "/relatorio", relatorio_semanal: "/relatorio-semanal",
      rota_coaching: "/rota-coaching", analises: "/analises",
      trello_atraso: "/trello-atraso",
            whatsapp: "/whatsapp", assessment: "/assessment",
    };
    if (rotas[page]) window.location.href = rotas[page];
  };

  // ── Análises (localStorage) ─────────────────────────────────────────────────
  const { get, set, porRevenda } = useAnalisesGerenciador(data);

  // ── Dados Vendedores (trpc.analise.getDados) ────────────────────────────────
  const { data: analiseResult, isLoading: loadingVend } = trpc.analise.getDados.useQuery(
    { dataInicio: data, dataFim: data },
    { staleTime: 5 * 60 * 1000 }
  );

  // ── Dados Coaching (trpc.rotaCoaching.getAll) ───────────────────────────────
  const { data: allCoaching = [], isLoading: loadingCoach } = trpc.rotaCoaching.getAll.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  const coachDodia = useMemo(() =>
    allCoaching.filter((r: any) => r.data === data),
    [allCoaching, data]);

  // ── Agrupamentos por revenda ────────────────────────────────────────────────
  const vendGrouped = useMemo(() => {
    const g: Record<string, VendedorRow[]> = {};
    (analiseResult?.dados ?? []).forEach((v: any) => {
      if (!g[v.revenda]) g[v.revenda] = [];
      g[v.revenda].push(v as VendedorRow);
    });
    return g;
  }, [analiseResult]);

  const coachGrouped = useMemo(() => {
    const g: Record<string, CoachingRow[]> = {};
    coachDodia.forEach((r: any) => {
      const rev = r.rev || "Sem Revenda";
      if (!g[rev]) g[rev] = [];
      g[rev].push(r as CoachingRow);
    });

    // Quando um GA acompanhou múltiplos vendedores no dia,
    // mantém apenas a entrada com mais visitas do vendedor.
    for (const rev of Object.keys(g)) {
      const byGa: Record<string, CoachingRow[]> = {};
      g[rev].forEach(r => {
        const key = r.gaId || "";
        if (!byGa[key]) byGa[key] = [];
        byGa[key].push(r);
      });
      g[rev] = Object.values(byGa).map(entries =>
        entries.length === 1
          ? entries[0]
          : entries.reduce((best, cur) =>
              (cur.pdvsVis ?? 0) >= (best.pdvsVis ?? 0) ? cur : best
            )
      );
    }

    return g;
  }, [coachDodia]);

  const revendas = useMemo(() => {
    const all = new Set([...Object.keys(vendGrouped), ...Object.keys(coachGrouped)]);
    return [...all].sort();
  }, [vendGrouped, coachGrouped]);

  // ── Exportar uma revenda ────────────────────────────────────────────────────
  const exportarRevenda = (revenda: string) => {
    exportarRelatorioRevenda({
      revenda,
      data,
      vendedoresData: vendGrouped[revenda] ?? [],
      coachingData: coachGrouped[revenda] ?? [],
      analiseVendedores: get(revenda, "vendedores"),
      analiseGAs: get(revenda, "gas"),
    });
  };

  // ── Exportar todas as revendas ──────────────────────────────────────────────
  const exportarTodos = () => {
    if (!revendas.length) {
      toast.warning("Nenhuma revenda encontrada para a data selecionada.");
      return;
    }
    setExportandoTodos(true);
    try {
      exportarTodosRelatorios({
        data,
        revendas,
        vendedoresGrouped: vendGrouped,
        coachingGrouped: coachGrouped,
        analisesVendedores: porRevenda("vendedores"),
        analisesGAs: porRevenda("gas"),
      });
    } finally {
      setExportandoTodos(false);
    }
  };

  const isLoading = loadingVend || loadingCoach;
  const dataFmt = data.split("-").reverse().join("/");

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage="relatorio" onNavigate={handleNavigate} />

      <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-20 bg-white/90 dark:bg-background/90 backdrop-blur-sm px-8 py-4 border-b border-border flex items-center justify-between"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div>
            <h1 className="text-xl text-foreground" style={{ fontWeight: 900 }}>
              Gerenciador de Relatórios
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5" style={{ fontWeight: 500 }}>
              Análise e exportação por revenda · Vendedores + GAs
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de data */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap" style={{ fontWeight: 600 }}>
                Data
              </label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="text-xs bg-muted border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-foreground"
              />
            </div>

            {/* Exportar todos */}
            <button
              onClick={exportarTodos}
              disabled={isLoading || exportandoTodos || !revendas.length}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ fontWeight: 700 }}
            >
              {exportandoTodos
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />
              }
              Exportar Todos — {dataFmt}
            </button>
          </div>
        </header>

        {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
        <div className="px-8 py-6 space-y-6">

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 rounded-full border-4 border-muted border-t-indigo-500 animate-spin" />
            </div>
          )}

          {/* Sem dados */}
          {!isLoading && revendas.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-14 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-25" />
              <p className="text-muted-foreground text-sm" style={{ fontWeight: 600 }}>
                Nenhum dado para {dataFmt}
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Selecione uma data com visitas ou dados de Rota Coaching.
              </p>
            </div>
          )}

          {/* Cards por revenda */}
          {!isLoading && revendas.map(rev => (
            <RevendaCard
              key={rev}
              revenda={rev}
              data={data}
              temVend={!!vendGrouped[rev]?.length}
              temCoach={!!coachGrouped[rev]?.length}
              htmlVend={get(rev, "vendedores")}
              htmlGA={get(rev, "gas")}
              onChangeVend={html => set(rev, "vendedores", html)}
              onChangeGA={html => set(rev, "gas", html)}
              onExportar={() => exportarRevenda(rev)}
            />
          ))}

          {!isLoading && revendas.length > 0 && (
            <p className="text-center text-xs text-muted-foreground/50 pb-4">
              MetricFlow · Gerenciador de Relatórios · {dataFmt} · {revendas.length} revendas
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RevendaCard
// ─────────────────────────────────────────────────────────────────────────────

function RevendaCard({
  revenda, data,
  temVend, temCoach,
  htmlVend, htmlGA,
  onChangeVend, onChangeGA,
  onExportar,
}: {
  revenda: string;
  data: string;
  temVend: boolean;
  temCoach: boolean;
  htmlVend: string;
  htmlGA: string;
  onChangeVend: (html: string) => void;
  onChangeGA: (html: string) => void;
  onExportar: () => void;
}) {
  // Aguarda query carregar antes de montar os editores (para inicializar com o HTML correto)
  const [editorReady, setEditorReady] = useState(false);
  useEffect(() => { setEditorReady(true); }, []);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>

      {/* Cabeçalho da revenda */}
      <div className="px-5 py-3 bg-emerald-700 flex items-center justify-between">
        <div>
          <h2 className="text-white text-sm" style={{ fontWeight: 800 }}>{revenda}</h2>
          <div className="flex items-center gap-3 mt-0.5">
            {temVend && (
              <span className="text-emerald-200 text-xs flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Vendedores
              </span>
            )}
            {temCoach && (
              <span className="text-emerald-200 text-xs flex items-center gap-1">
                <Route className="w-3 h-3" /> GAs
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onExportar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white bg-white/15 hover:bg-white/25 transition-colors"
          style={{ fontWeight: 700 }}
          title={`Exportar PDF — ${revenda}`}
        >
          <Printer className="w-3.5 h-3.5" />
          Exportar PDF
        </button>
      </div>

      {/* Editores lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* Análise dos Vendedores */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
              Vendedores
            </span>
            {!temVend && (
              <span className="ml-1 text-xs text-muted-foreground/50">— sem dados para esta data</span>
            )}
          </div>

          {editorReady ? (
            <EditorAnalise
              id={`gerenciador-vend-${revenda}`}
              html={htmlVend}
              onChange={onChangeVend}
              placeholder="Análise dos vendedores: pontos de atenção, destaques, plano de ação..."
            />
          ) : (
            <div className="h-24 rounded-xl border border-border bg-muted/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Análise dos GAs */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Route className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest" style={{ fontWeight: 700 }}>
              GAs — Rota Coaching
            </span>
            {!temCoach && (
              <span className="ml-1 text-xs text-muted-foreground/50">— sem dados para esta data</span>
            )}
          </div>

          {editorReady ? (
            <EditorAnalise
              id={`gerenciador-ga-${revenda}`}
              html={htmlGA}
              onChange={onChangeGA}
              placeholder="Análise dos GAs: conformidade, pontos de atenção, plano de ação..."
            />
          ) : (
            <div className="h-24 rounded-xl border border-border bg-muted/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Dica de exportação */}
      <div className="px-5 py-2.5 bg-muted/30 border-t border-border flex items-center gap-2">
        <PenLine className="w-3 h-3 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Escreva a análise acima e clique em <strong>Exportar PDF</strong> para gerar o relatório com 2 páginas (Vendedores + GAs). O texto é salvo automaticamente.
        </p>
      </div>
    </div>
  );
}
