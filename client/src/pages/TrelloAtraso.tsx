/*
 * MetricFlow — Trello: Cards em Atraso + Atividades do Dia
 * Exibe os cards com prazo vencido e atividades do dia/amanhã por revenda.
 */

import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { DEFAULT_TEMPLATE, useWaTemplate, type WaTemplate } from "@/hooks/useWaTemplate";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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

// ─── Gerador de mensagem WhatsApp (com template configurável) ────────────────

function aplicarVars(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function gerarMensagemWhatsApp(revenda: string, hoje: any[], amanha: any[], template: WaTemplate): string {
  const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dataAmanha = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  })();

  let msg = aplicarVars(template.cabecalho, { revenda, data: dataHoje }) + "\n";

  if (hoje.length > 0) {
    msg += "\n" + aplicarVars(template.tituloHoje, { data: dataHoje, data_hoje: dataHoje }) + "\n";
    for (const card of hoje) {
      const hora = new Date(card.due).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const membros = card.membros.length > 0 ? ` | ${card.membros.join(", ")}` : "";
      msg += aplicarVars(template.linhaCard, { nome: card.nome, lista: card.lista, hora, membros }) + "\n";
    }
  }

  if (amanha.length > 0) {
    msg += "\n" + aplicarVars(template.tituloAmanha, { data: dataAmanha, data_amanha: dataAmanha }) + "\n";
    for (const card of amanha) {
      const hora = new Date(card.due).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const membros = card.membros.length > 0 ? ` | ${card.membros.join(", ")}` : "";
      msg += aplicarVars(template.linhaCard, { nome: card.nome, lista: card.lista, hora, membros }) + "\n";
    }
  }

  if (hoje.length === 0 && amanha.length === 0) {
    msg += "\nNenhuma atividade programada para hoje ou amanhã.";
  }

  msg += "\n" + template.rodape;
  return msg;
}

// ─── Modal de Configuração do Template ───────────────────────────────────────

const VARIAVEIS: Record<keyof WaTemplate, { label: string; vars: string[] }> = {
  cabecalho:    { label: "Cabeçalho",       vars: ["{revenda}", "{data}"] },
  tituloHoje:   { label: "Título Hoje",     vars: ["{data}", "{data_hoje}"] },
  tituloAmanha: { label: "Título Amanhã",   vars: ["{data}", "{data_amanha}"] },
  linhaCard:    { label: "Linha de card",   vars: ["{nome}", "{lista}", "{hora}", "{membros}"] },
  rodape:       { label: "Rodapé",          vars: [] },
};

const SAMPLE = {
  revenda: "Duttra FL",
  hoje: [
    { nome: "Reunião de alinhamento", due: new Date().toISOString(), lista: "Em andamento", membros: ["João", "Maria"], etiquetas: [] },
  ],
  amanha: [
    { nome: "Visita ao cliente", due: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString(); })(), lista: "Planejado", membros: ["Carlos"], etiquetas: [] },
  ],
};

function TemplateConfigModal({
  template,
  onSaveLocal,
  onSaveServer,
  isSaving,
  serverSynced,
  onClose,
}: {
  template: WaTemplate;
  onSaveLocal: (t: WaTemplate) => void;
  onSaveServer: (t: WaTemplate) => Promise<void>;
  isSaving: boolean;
  serverSynced: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<WaTemplate>(template);
  const preview = gerarMensagemWhatsApp(SAMPLE.revenda, SAMPLE.hoje, SAMPLE.amanha, draft);

  function set(field: keyof WaTemplate, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function insertVar(field: keyof WaTemplate, variable: string) {
    setDraft((prev) => ({ ...prev, [field]: prev[field] + variable }));
  }

  async function handleSaveServer() {
    await onSaveServer(draft);
    toast.success("Template salvo no servidor!");
    onClose();
  }

  function handleSaveLocal() {
    onSaveLocal(draft);
    toast.success("Template salvo localmente!");
    onClose();
  }

  function handleReset() {
    setDraft(DEFAULT_TEMPLATE);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-500" />
            Configurar modelo de mensagem
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden divide-x divide-slate-200 dark:divide-slate-700">
          {/* Campos do template */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {(Object.keys(VARIAVEIS) as (keyof WaTemplate)[]).map((field) => {
              const { label, vars } = VARIAVEIS[field];
              return (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <textarea
                    value={draft[field]}
                    onChange={(e) => set(field, e.target.value)}
                    rows={field === "linhaCard" ? 2 : field === "cabecalho" ? 3 : 2}
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {vars.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {vars.map((v) => (
                        <button
                          key={v}
                          onClick={() => insertVar(field, v)}
                          className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-mono transition-colors"
                          title={`Inserir ${v}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview */}
          <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 pt-4 pb-2 flex-shrink-0">
              Preview
            </p>
            <pre className="flex-1 overflow-y-auto mx-4 mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {preview}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar padrão
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSaveLocal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Salvar local
          </button>
          <button
            onClick={handleSaveServer}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {serverSynced ? "Atualizar no servidor" : "Salvar no servidor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportarPDF(data: any[], dataAtual: string) {
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
        <View style={styles.header}>
          <Text style={styles.title}>Relatório — Cards em Atraso no Trello</Text>
          <Text style={styles.subtitle}>
            Data de geração: {dataAtual}   |   Total de cards em atraso: {totalAtraso}
          </Text>
        </View>

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

// ─── Componente de Card (Atraso) ──────────────────────────────────────────────

function CardItem({ card }: { card: any }) {
  const [expanded, setExpanded] = useState(false);
  const urg = urgencyColor(card.diasAtraso);
  const temComentarios = card.comentarios?.length > 0;

  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-700 ${urg.bg} mb-2 overflow-hidden`}>
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

// ─── Componente de Card (Atividade) ───────────────────────────────────────────

function AtividadeCardItem({ card }: { card: any }) {
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

// ─── Modal de Envio WhatsApp ──────────────────────────────────────────────────

function WhatsAppModal({
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

  // Inicializa todos selecionados quando os destinatários carregam
  useEffect(() => {
    if (destinatarios && destinatarios.length > 0) {
      setSelecionados(destinatarios.map((d) => d.id));
    }
  }, [destinatarios]);

  function toggleSelecionado(id: string) {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function toggleTodos() {
    if (selecionados.length === destinatariosIds.length) {
      setSelecionados([]);
    } else {
      setSelecionados(destinatariosIds);
    }
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
        {/* Header */}
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
          {/* Preview da mensagem */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Preview da mensagem
            </p>
            <pre className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans max-h-52 overflow-y-auto leading-relaxed">
              {mensagem}
            </pre>
          </div>

          {/* Destinatários */}
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

        {/* Footer */}
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

// ─── Seção de Revenda (Atrasos) ───────────────────────────────────────────────

function RevendaSection({ revenda }: { revenda: any }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasError = !!revenda.erro;
  const hasCards = revenda.cards.length > 0;

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
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

// ─── Seção de Revenda (Atividades) ────────────────────────────────────────────

function AtividadeRevendaSection({ revenda, template }: { revenda: any; template: WaTemplate }) {
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
        {/* Lado esquerdo: clicável para colapsar */}
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

        {/* Lado direito: botões */}
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

          {/* Hoje */}
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

          {/* Amanhã */}
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
      onChange(selecionadas.filter((l) => l !== lista));
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
  const [activeTab, setActiveTab] = useState<"atrasos" | "atividades">("atrasos");
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const { template, saveLocal, saveToServer, isSaving, serverSynced } = useWaTemplate();

  // ── Queries: Cards em Atraso ────────────────────────────────────────────────
  const { data, isLoading, isError, error, refetch, isFetching } =
    trpc.trello.getCardsAtraso.useQuery(
      { listasPermitidas: listasFiltro.length > 0 ? listasFiltro : undefined },
      { staleTime: 5 * 60 * 1000 }
    );

  // Query sem filtro para coletar todas as listas únicas
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

  // ── Queries: Atividades do Dia ──────────────────────────────────────────────
  const {
    data: atividadesData,
    isLoading: atividadesLoading,
    isError: atividadesError,
    error: atividadesErrorMsg,
    refetch: atividadesRefetch,
    isFetching: atividadesFetching,
  } = trpc.trello.getAtividadesDia.useQuery(
    { listasPermitidas: listasFiltro.length > 0 ? listasFiltro : undefined },
    { staleTime: 5 * 60 * 1000 }
  );

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalAtraso = data?.reduce((s, r) => s + r.totalAtraso, 0) ?? 0;
  const revendasComAtraso = data?.filter((r) => r.totalAtraso > 0).length ?? 0;

  const totalHoje = atividadesData?.reduce((s, r) => s + r.hoje.length, 0) ?? 0;
  const totalAmanha = atividadesData?.reduce((s, r) => s + r.amanha.length, 0) ?? 0;
  const revendasComAtividade = atividadesData?.filter((r) => r.hoje.length + r.amanha.length > 0).length ?? 0;

  const dataAtual = new Date().toLocaleDateString("pt-BR");

  const isCurrentFetching = activeTab === "atrasos" ? isFetching : atividadesFetching;

  function handleRefetch() {
    if (activeTab === "atrasos") refetch();
    else atividadesRefetch();
  }

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
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Trello
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Acompanhamento de tarefas por revenda
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
              onClick={handleRefetch}
              disabled={isCurrentFetching}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isCurrentFetching ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            {activeTab === "atrasos" && (
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
            )}
            {activeTab === "atividades" && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                Modelo de mensagem
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit shadow-sm">
          <button
            onClick={() => setActiveTab("atrasos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "atrasos"
                ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Cards em Atraso
            {totalAtraso > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {totalAtraso}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("atividades")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "atividades"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Atividades do Dia
            {(totalHoje + totalAmanha) > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {totalHoje + totalAmanha}
              </span>
            )}
          </button>
        </div>

        {/* ── Aba: Cards em Atraso ── */}
        {activeTab === "atrasos" && (
          <>
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
          </>
        )}

        {/* ── Aba: Atividades do Dia ── */}
        {activeTab === "atividades" && (
          <>
            {atividadesData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Atividades Hoje</p>
                  <p className={`text-2xl font-bold ${totalHoje > 0 ? "text-blue-500" : "text-slate-400"}`}>{totalHoje}</p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Atividades Amanhã</p>
                  <p className={`text-2xl font-bold ${totalAmanha > 0 ? "text-purple-500" : "text-slate-400"}`}>{totalAmanha}</p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Revendas Ativas</p>
                  <p className={`text-2xl font-bold ${revendasComAtividade > 0 ? "text-indigo-500" : "text-slate-400"}`}>
                    {revendasComAtividade} / {atividadesData.length}
                  </p>
                </div>
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Atualizado em</p>
                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{dataAtual}</p>
                </div>
              </div>
            )}

            {atividadesLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Buscando atividades no Trello...</p>
              </div>
            )}

            {atividadesError && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-300">Erro ao carregar atividades do Trello</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {(atividadesErrorMsg as any)?.message ?? "Verifique as configurações do Trello no arquivo .env"}
                  </p>
                </div>
              </div>
            )}

            {atividadesData && (
              <div className="space-y-4">
                {atividadesData.map((revenda) => (
                  <AtividadeRevendaSection key={revenda.revenda} revenda={revenda} template={template} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showTemplateModal && (
        <TemplateConfigModal
          template={template}
          onSaveLocal={saveLocal}
          onSaveServer={saveToServer}
          isSaving={isSaving}
          serverSynced={serverSynced}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </div>
  );
}
