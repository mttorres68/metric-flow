/*
 * MetricFlow — Trello: Cards em Atraso
 * Exibe os cards com prazo vencido por revenda e permite exportar PDF.
 */

import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMOJI_MAP: Record<string, string> = {
  white_check_mark: "✅", heavy_check_mark: "✔️", x: "❌", warning: "⚠️",
  red_circle: "🔴", large_blue_circle: "🔵", green_circle: "🟢", yellow_circle: "🟡",
  orange_circle: "🟠", purple_circle: "🟣", brown_circle: "🟤", black_circle: "⚫",
  white_circle: "⚪", fire: "🔥", tada: "🎉", rocket: "🚀", star: "⭐",
  thumbsup: "👍", thumbsdown: "👎", eyes: "👀", raised_hands: "🙌",
  clap: "👏", pray: "🙏", muscle: "💪", wave: "👋", point_right: "👉",
  point_left: "👈", point_up: "👆", point_down: "👇", ok_hand: "👌",
  heavy_exclamation_mark: "❗", question: "❓", exclamation: "❗",
  clock1: "🕐", hourglass: "⏳", calendar: "📅", memo: "📝", pencil: "✏️",
  mag: "🔍", link: "🔗", paperclip: "📎", chart_with_upwards_trend: "📈",
  chart_with_downwards_trend: "📉", bar_chart: "📊", bulb: "💡", hammer: "🔨",
  wrench: "🔧", lock: "🔒", unlock: "🔓", bell: "🔔", no_bell: "🔕",
  email: "📧", phone: "📞", computer: "💻", iphone: "📱", gear: "⚙️",
  recycle: "♻️", white_large_square: "⬜", black_large_square: "⬛",
  arrow_right: "➡️", arrow_left: "⬅️", arrow_up: "⬆️", arrow_down: "⬇️",
};

function parseEmojis(text: string): string {
  return text.replace(/:([a-zA-Z0-9_+\-]+):/g, (match, code) => EMOJI_MAP[code] ?? match);
}

/** Converte emojis e markdown básico (**bold**, *italic*) em elementos React. */
function renderMarkdown(text: string): React.ReactNode[] {
  const withEmoji = parseEmojis(text);
  // Tokeniza por **bold** e *italic*
  const parts = withEmoji.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function urgencyColor(dias: number) {
  if (dias >= 14) return { bg: "bg-red-100 dark:bg-red-900/30", badge: "bg-red-500", text: "text-red-700 dark:text-red-300" };
  if (dias >= 7) return { bg: "bg-orange-100 dark:bg-orange-900/30", badge: "bg-orange-500", text: "text-orange-700 dark:text-orange-300" };
  return { bg: "bg-yellow-50 dark:bg-yellow-900/20", badge: "bg-yellow-400", text: "text-yellow-700 dark:text-yellow-300" };
}

const LABEL_COLORS: Record<string, string> = {
  red: "bg-red-400",
  orange: "bg-orange-400",
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  pink: "bg-pink-400",
  sky: "bg-sky-400",
  lime: "bg-lime-400",
  black: "bg-gray-700",
  null: "bg-gray-300",
};

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportarPDF(data: any[], dataAtual: string) {
  // Usa @react-pdf/renderer via import dinâmico para não aumentar o bundle inicial
  const { pdf, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");

  const styles = StyleSheet.create({
    page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
    header: { marginBottom: 16, borderBottom: "1 solid #e2e8f0", paddingBottom: 10 },
    title: { fontSize: 18, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
    subtitle: { fontSize: 10, color: "#64748b" },
    revendaBlock: { marginBottom: 16 },
    revendaHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      backgroundColor: "#f1f5f9", padding: "6 8", borderRadius: 4, marginBottom: 6,
    },
    revendaTitle: { fontSize: 11, fontWeight: "bold", color: "#334155" },
    revendaBadge: { fontSize: 9, color: "#ef4444", fontWeight: "bold" },
    card: {
      border: "1 solid #e2e8f0", borderRadius: 4, padding: "6 8",
      marginBottom: 6, backgroundColor: "#fff",
    },
    cardTitle: { fontSize: 9, fontWeight: "bold", color: "#1e293b", marginBottom: 3 },
    cardMeta: { flexDirection: "row", gap: 12, marginBottom: 2 },
    metaLabel: { fontSize: 8, color: "#64748b" },
    metaValue: { fontSize: 8, color: "#334155" },
    alertRed: { color: "#ef4444", fontWeight: "bold" },
    // Comentários
    comentariosHeader: { fontSize: 7.5, color: "#6366f1", fontWeight: "bold", marginTop: 5, marginBottom: 3 },
    comentarioBox: {
      backgroundColor: "#f8fafc", border: "1 solid #e2e8f0",
      borderRadius: 3, padding: "4 6", marginBottom: 3,
    },
    comentarioAutor: { fontSize: 7.5, fontWeight: "bold", color: "#334155" },
    comentarioData: { fontSize: 7, color: "#94a3b8" },
    comentarioTexto: { fontSize: 7.5, color: "#475569", marginTop: 2, lineHeight: 1.4 },
    footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTop: "1 solid #e2e8f0", paddingTop: 6 },
    footerText: { fontSize: 7, color: "#94a3b8", textAlign: "center" },
    noCards: { fontSize: 8, color: "#22c55e", fontStyle: "italic", padding: "4 0" },
    erroBlock: { fontSize: 8, color: "#ef4444", fontStyle: "italic", padding: "4 0" },
  });

  const totalAtraso = data.reduce((s, r) => s + r.totalAtraso, 0);

  const doc = (
    <Document title={`Relatório Trello — Cards em Atraso — ${dataAtual}`}>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>Relatório — Cards em Atraso no Trello</Text>
          <Text style={styles.subtitle}>
            Data de geração: {dataAtual}   |   Total de cards em atraso: {totalAtraso}
          </Text>
        </View>

        {/* Revendas */}
        {data.map((revenda) => (
          <View key={revenda.revenda} style={styles.revendaBlock} wrap={false}>
            <View style={styles.revendaHeader}>
              <Text style={styles.revendaTitle}>{revenda.revenda}</Text>
              <Text style={styles.revendaBadge}>
                {revenda.erro
                  ? "⚠ Erro ao carregar"
                  : revenda.totalAtraso === 0
                    ? "✓ Em dia"
                    : `${revenda.totalAtraso} em atraso`}
              </Text>
            </View>

            {revenda.erro && <Text style={styles.erroBlock}>{revenda.erro}</Text>}
            {!revenda.erro && revenda.cards.length === 0 && (
              <Text style={styles.noCards}>Nenhum card em atraso. Revenda em dia!</Text>
            )}
            {!revenda.erro &&
              revenda.cards.map((card: any) => (
                <View key={card.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{card.nome}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={styles.metaLabel}>Prazo: <Text style={styles.metaValue}>{formatDate(card.due)}</Text></Text>
                    <Text style={styles.metaLabel}>
                      Atraso: <Text style={[styles.metaValue, card.diasAtraso >= 7 ? styles.alertRed : {}]}>{card.diasAtraso} dia(s)</Text>
                    </Text>
                    <Text style={styles.metaLabel}>Lista: <Text style={styles.metaValue}>{card.lista}</Text></Text>
                  </View>
                  {card.membros.length > 0 && (
                    <Text style={styles.metaLabel}>Responsáveis: <Text style={styles.metaValue}>{card.membros.join(", ")}</Text></Text>
                  )}
                  {card.etiquetas.length > 0 && (
                    <Text style={styles.metaLabel}>Etiquetas: <Text style={styles.metaValue}>{card.etiquetas.map((e: any) => e.nome || e.cor).join(", ")}</Text></Text>
                  )}
                  {/* Comentários */}
                  {card.comentarios?.length > 0 && (
                    <View>
                      <Text style={styles.comentariosHeader}>
                        Comentários ({card.comentarios.length})
                      </Text>
                      {card.comentarios.map((c: any) => (
                        <View key={c.id} style={styles.comentarioBox}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={styles.comentarioAutor}>{c.autor}</Text>
                            <Text style={styles.comentarioData}>
                              {new Date(c.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                          <Text style={styles.comentarioTexto}>{parseEmojis(c.texto)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
          </View>
        ))}

        {/* Rodapé 
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            MetricFlow — Gerado automaticamente em {dataAtual} — Dados via Trello API
          </Text>
        </View>
        */}
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-trello-atraso-${dataAtual.replace(/\//g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente de Card Individual ───────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function CardItem({ card }: { card: any }) {
  const [expanded, setExpanded] = useState(false);
  const urg = urgencyColor(card.diasAtraso);
  const temComentarios = card.comentarios?.length > 0;

  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-700 ${urg.bg} mb-2 overflow-hidden`}>
      {/* Cabeçalho do card */}
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${urg.badge}`} />
          <span className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{card.nome}</span>
          {temComentarios && (
            <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
              <MessageSquare className="w-3 h-3" />
              {card.comentarios.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/20 ${urg.text}`}>
            {card.diasAtraso}d atraso
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(card.due)}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200/60 dark:border-slate-700/60 pt-3 space-y-3">

          {/* Meta: lista + responsáveis */}
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

          {/* Etiquetas */}
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

          {/* Descrição */}
          {card.descricao && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 bg-white/50 dark:bg-black/10 rounded p-2">
              {renderMarkdown(card.descricao)}
            </p>
          )}

          {/* Comentários */}
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

          {/* Link Trello */}
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

// ─── Componente de Revenda ────────────────────────────────────────────────────

function RevendaSection({ revenda }: { revenda: any }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasError = !!revenda.erro;
  const hasCards = revenda.cards.length > 0;

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header da revenda */}
      <button
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}>
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

      {/* Cards */}
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

// ─── Página Principal ─────────────────────────────────────────────────────────

// ─── Seletor de Listas ────────────────────────────────────────────────────────

function FiltroListas({
  todasListas,
  selecionadas,
  onChange,
}: {
  todasListas: string[];
  selecionadas: string[];
  onChange: (listas: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const todas = selecionadas.length === 0;

  function toggle(lista: string) {
    if (selecionadas.includes(lista)) {
      const novo = selecionadas.filter((l) => l !== lista);
      onChange(novo);
    } else {
      onChange([...selecionadas, lista]);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <Filter className="w-4 h-4" />
        {todas ? "Todas as listas" : `${selecionadas.length} lista(s)`}
        {!todas && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="ml-1 text-slate-400 hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-10 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 min-w-[220px]">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider px-1">
            Filtrar por lista
          </p>
          <button
            onClick={() => onChange([])}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-colors ${todas
              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
          >
            Todas as listas
          </button>
          <div className="border-t border-slate-100 dark:border-slate-700 my-1.5" />
          {todasListas.map((lista) => {
            const ativa = selecionadas.includes(lista);
            return (
              <button
                key={lista}
                onClick={() => toggle(lista)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${ativa
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ativa ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                {lista}
              </button>
            );
          })}
          <div className="border-t border-slate-100 dark:border-slate-700 mt-1.5 pt-1.5">
            <button
              onClick={() => setAberto(false)}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function TrelloAtraso() {
  const { isCollapsed } = useSidebarCollapse();
  const [activePage] = useState("trello_atraso");
  const [exportando, setExportando] = useState(false);
  const [listasFiltro, setListasFiltro] = useState<string[]>([]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    trpc.trello.getCardsAtraso.useQuery(
      { listasPermitidas: listasFiltro.length > 0 ? listasFiltro : undefined },
      { staleTime: 5 * 60 * 1000 }
    );

  // Coleta todas as listas únicas de todos os boards (sem filtro aplicado)
  const { data: dataCompleta } = trpc.trello.getCardsAtraso.useQuery(
    undefined,
    { staleTime: 10 * 60 * 1000 }
  );
  const todasListas = useMemo(() => {
    if (!dataCompleta) return [];
    const set = new Set<string>();
    dataCompleta.forEach((r) => r.todasListas?.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [dataCompleta]);

  const totalAtraso = data?.reduce((s, r) => s + r.totalAtraso, 0) ?? 0;
  const revendasComAtraso = data?.filter((r) => r.totalAtraso > 0).length ?? 0;
  const dataAtual = new Date().toLocaleDateString("pt-BR");

  async function handleExportarPDF() {
    if (!data) return;
    setExportando(true);
    try {
      await exportarPDF(data, dataAtual);
      toast.success("PDF exportado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao exportar PDF: " + e.message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[var(--background)]">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          const routes: Record<string, string> = {
            dashboard: "/",
            vendedores: "/vendedores",
            compliance: "/compliance",
            clientes: "/clientes",
            relatorio: "/relatorio",
            relatorio_semanal: "/relatorio-semanal",
            rota_coaching: "/rota-coaching",
            analises: "/analises",
            trello_atraso: "/trello-atraso",
            whatsapp: "/whatsapp",
          };
          if (routes[page]) window.location.href = routes[page];
        }}
      />

      <main
        className={`flex-1 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"} p-6`}
        style={{ minWidth: 0 }}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Cards em Atraso — Trello
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Acompanhamento de tarefas vencidas por revenda
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {todasListas.length > 0 && (
              <FiltroListas
                todasListas={todasListas}
                selecionadas={listasFiltro}
                onChange={setListasFiltro}
              />
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              onClick={handleExportarPDF}
              disabled={!data || exportando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {exportando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Exportar PDF
            </button>
          </div>
        </div>

        {/* KPIs */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total em Atraso</p>
              <p className={`text-2xl font-bold ${totalAtraso > 0 ? "text-red-500" : "text-green-500"}`}>{totalAtraso}</p>
            </div>
            <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Revendas Afetadas</p>
              <p className={`text-2xl font-bold ${revendasComAtraso > 0 ? "text-orange-500" : "text-green-500"}`}>
                {revendasComAtraso} / {data.length}
              </p>
            </div>
            <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Maior Atraso</p>
              <p className="text-2xl font-bold text-red-600">
                {Math.max(0, ...data.flatMap((r) => r.cards.map((c) => c.diasAtraso)))}d
              </p>
            </div>
            <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Atualizado em</p>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{dataAtual}</p>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Buscando cards no Trello...</p>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-300">Erro ao carregar dados do Trello</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {(error as any)?.message ?? "Verifique as variáveis TRELLO_API_KEY, TRELLO_TOKEN e TRELLO_BOARDS no arquivo .env"}
              </p>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {data.map((revenda) => (
              <RevendaSection key={revenda.revenda} revenda={revenda} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
