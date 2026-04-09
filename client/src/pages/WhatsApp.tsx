/*
 * MetricFlow — WhatsApp
 * Gerencia conexão Evolution API + destinatários com revendas associadas + chat por destinatário
 */

import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  Pencil,
  PhoneOff,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  Settings,
  Trash2,
  User,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Destinatario {
  id: string;
  nome: string;
  apelido: string;
  telefone: string;
  revendas: string[];
}

interface ChatMsg {
  tipo: "sent" | "error";
  texto: string;
  hora: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stateLabel(state: string) {
  switch (state) {
    case "open":        return "Conectado";
    case "connecting":  return "Conectando…";
    case "qr":          return "Aguardando QR Code";
    case "close":       return "Desconectado";
    case "not_created": return "Instância não criada";
    default:            return "Erro";
  }
}

function stateStyle(state: string) {
  if (state === "open")
    return { dot: "bg-green-500", badge: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800" };
  if (state === "connecting" || state === "qr")
    return { dot: "bg-amber-400 animate-pulse", badge: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" };
  return { dot: "bg-red-400", badge: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" };
}

function nowTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ─── DestForm ─────────────────────────────────────────────────────────────────

function DestForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<Destinatario>;
  onSave: (d: Omit<Destinatario, "id" | "revendas">) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [apelido, setApelido] = useState(initial?.apelido ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");

  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/40";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim() || !telefone.trim()) return;
        onSave({ nome: nome.trim(), apelido: apelido.trim(), telefone: telefone.trim() });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
          <input className={inputCls} placeholder="João Silva" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Apelido</label>
          <input className={inputCls} placeholder="João" value={apelido} onChange={(e) => setApelido(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Telefone <span className="text-muted-foreground/60">(55DDD9XXXXXXXX)</span>
        </label>
        <input
          className={inputCls}
          placeholder="5544999990000"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          required
        />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Salvar
        </button>
      </div>
    </form>
  );
}

// ─── RevendasEditor ───────────────────────────────────────────────────────────

function RevendasEditor({
  destId,
  revendas,
  allRevendas,
  onUpdate,
}: {
  destId: string;
  revendas: string[];
  allRevendas: string[];
  onUpdate: (revendas: string[]) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const disponiveis = allRevendas.filter((r) => !revendas.includes(r));

  // fecha dropdown ao clicar fora
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function remove(r: string) {
    onUpdate(revendas.filter((x) => x !== r));
  }

  function add(r: string) {
    onUpdate([...revendas, r]);
    setShowDropdown(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
      {/* Tags das revendas associadas */}
      {revendas.map((r) => (
        <span key={r}
          className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-medium">
          {r}
          <button
            onClick={() => remove(r)}
            className="ml-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-700 p-0.5 transition-colors"
            title={`Remover ${r}`}>
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      {/* Botão adicionar revenda */}
      {disponiveis.length > 0 && (
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setShowDropdown((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-xs text-muted-foreground hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            <Plus className="w-3 h-3" /> Revenda
          </button>
          {showDropdown && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
              {disponiveis.map((r) => (
                <button key={r} onClick={() => add(r)}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors first:rounded-t-xl last:rounded-b-xl">
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {revendas.length === 0 && disponiveis.length === 0 && (
        <span className="text-xs text-muted-foreground italic">Nenhuma revenda configurada no .env</span>
      )}
      {revendas.length === 0 && disponiveis.length > 0 && (
        <span className="text-xs text-muted-foreground italic">Sem revenda associada</span>
      )}
    </div>
  );
}

// ─── DestCard ────────────────────────────────────────────────────────────────

function DestCard({
  dest,
  allRevendas,
  connected,
  onEdit,
  onDelete,
  onRevendasChange,
}: {
  dest: Destinatario;
  allRevendas: string[];
  connected: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRevendasChange: (revendas: string[]) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const sendMutation = trpc.evolution.sendMessage.useMutation({
    onSuccess: (_, vars) => {
      setMsgs((m) => [...m, { tipo: "sent", texto: vars.texto, hora: nowTime() }]);
      setText("");
    },
    onError: (e) => {
      setMsgs((m) => [...m, { tipo: "error", texto: `Erro: ${e.message}`, hora: nowTime() }]);
      toast.error(`Falha ao enviar para ${dest.apelido || dest.nome}`);
    },
  });

  useEffect(() => {
    if (chatOpen) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, chatOpen]);

  function handleSend() {
    const t = text.trim();
    if (!t || !connected) return;
    sendMutation.mutate({ telefone: dest.telefone, texto: t });
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
      {/* ── Cabeçalho ── */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            {dest.nome}
            {dest.apelido && dest.apelido !== dest.nome && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">({dest.apelido})</span>
            )}
          </p>
          <p className="text-xs font-mono text-muted-foreground">{dest.telefone}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Editar">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
            title="Remover">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setChatOpen((v) => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ml-1"
            title={chatOpen ? "Fechar chat" : "Abrir chat"}>
            {chatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Revendas (sempre visível) ── */}
      <RevendasEditor
        destId={dest.id}
        revendas={dest.revendas}
        allRevendas={allRevendas}
        onUpdate={onRevendasChange}
      />

      {/* ── Chat (expansível) ── */}
      {chatOpen && (
        <div className="border-t border-border">
          {/* Histórico */}
          <div className="h-48 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50/50 dark:bg-background/30">
            {msgs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-12">
                Nenhuma mensagem enviada nesta sessão
              </p>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`flex ${m.tipo === "error" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.tipo === "error"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      : "bg-indigo-500 text-white"
                  }`}>
                    <p>{m.texto}</p>
                    <p className={`text-right mt-0.5 text-[10px] ${m.tipo === "error" ? "text-red-400" : "text-indigo-200"}`}>
                      {m.hora}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 flex gap-2 border-t border-border">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={connected ? "Digite uma mensagem… (Enter para enviar)" : "Conecte o WhatsApp para enviar"}
              disabled={!connected || sendMutation.isPending}
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/40 resize-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!connected || !text.trim() || sendMutation.isPending}
              className="p-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-40 shrink-0"
              title="Enviar">
              {sendMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function WhatsApp() {
  const { isCollapsed } = useSidebarCollapse();
  const utils = trpc.useUtils();

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleNavigate = (page: string) => {
    const rotas: Record<string, string> = {
      dashboard: "/", vendedores: "/vendedores", compliance: "/compliance",
      clientes: "/clientes", relatorio: "/relatorio", relatorio_semanal: "/relatorio-semanal",
      rota_coaching: "/rota-coaching", analises: "/analises",
      trello_atraso: "/trello-atraso", whatsapp: "/whatsapp",
    };
    if (rotas[page]) window.location.href = rotas[page];
  };

  // ── Queries ───────────────────────────────────────────────────────────────

  const statusQuery = trpc.evolution.getStatus.useQuery(undefined, {
    refetchInterval: polling ? 3000 : false,
  });
  const destQuery = trpc.evolution.listDestinatarios.useQuery();
  const revendasQuery = trpc.evolution.getRevendas.useQuery();
  const allRevendas = revendasQuery.data ?? [];
  const connected = statusQuery.data?.state === "open";

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidateDest = () => utils.evolution.listDestinatarios.invalidate();

  const connectMutation = trpc.evolution.connect.useMutation({
    onSuccess: (data) => {
      if (data.qrCode) { setQrCode(data.qrCode); setPolling(true); toast.info("Escaneie o QR Code"); }
      else setPolling(true);
    },
    onError: (e) => toast.error(`Erro ao conectar: ${e.message}`),
  });

  const createMutation = trpc.evolution.createInstance.useMutation({
    onSuccess: () => { toast.success("Instância criada!"); statusQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const disconnectMutation = trpc.evolution.disconnect.useMutation({
    onSuccess: () => { toast.success("Desconectado"); setQrCode(null); setPolling(false); statusQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const addMutation = trpc.evolution.addDestinatario.useMutation({
    onSuccess: () => { invalidateDest(); setShowAddForm(false); toast.success("Destinatário adicionado"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.evolution.updateDestinatario.useMutation({
    onSuccess: () => { invalidateDest(); setEditingId(null); toast.success("Destinatário atualizado"); },
    onError: (e) => toast.error(e.message),
  });

  const setRevendasMutation = trpc.evolution.setRevendasDestinatario.useMutation({
    onSuccess: () => invalidateDest(),
    onError: (e) => toast.error(`Erro ao salvar revendas: ${e.message}`),
  });

  const removeMutation = trpc.evolution.removeDestinatario.useMutation({
    onSuccess: () => { invalidateDest(); toast.success("Destinatário removido"); },
    onError: (e) => toast.error(e.message),
  });

  // ── Parar polling quando conectar ─────────────────────────────────────────

  useEffect(() => {
    if (statusQuery.data?.state === "open") { setPolling(false); setQrCode(null); }
  }, [statusQuery.data?.state]);

  // ── Render ────────────────────────────────────────────────────────────────

  const state = statusQuery.data?.state ?? "close";
  const style = stateStyle(state);
  const isBusy = connectMutation.isPending || createMutation.isPending || disconnectMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage="whatsapp" onNavigate={handleNavigate} />

      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>

        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}>
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">WhatsApp</h1>
            <p className="text-xs text-muted-foreground">Evolution API — conexão e destinatários</p>
          </div>
          <button onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching}
            className="ml-auto p-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors">
            <RefreshCw className={`w-4 h-4 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </header>

        <div className="flex-1 p-6 space-y-5 max-w-2xl mx-auto w-full">

          {/* ── Status ─────────────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {connected
                  ? <Wifi className="w-4 h-4 text-green-500" />
                  : <WifiOff className="w-4 h-4 text-muted-foreground" />}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${style.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  {stateLabel(state)}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{statusQuery.data?.instance}</span>
              </div>

              <div className="flex items-center gap-2">
                {state === "not_created" && (
                  <button onClick={() => createMutation.mutate()} disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors disabled:opacity-50">
                    {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Criar instância
                  </button>
                )}
                {(state === "close" || state === "error") && (
                  <button onClick={() => connectMutation.mutate()} disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors disabled:opacity-50">
                    {connectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                    Conectar
                  </button>
                )}
                {(state === "connecting" || state === "qr") && !qrCode && (
                  <button onClick={() => connectMutation.mutate()} disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors disabled:opacity-50">
                    {connectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                    Obter QR
                  </button>
                )}
                {state === "open" && (
                  <button onClick={() => disconnectMutation.mutate()} disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-medium transition-colors disabled:opacity-50">
                    {disconnectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneOff className="w-3.5 h-3.5" />}
                    Desconectar
                  </button>
                )}
              </div>
            </div>
            {statusQuery.data?.error && state === "error" && (
              <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />{statusQuery.data.error}
              </p>
            )}
          </div>

          {/* ── QR Code ─────────────────────────────────────────────────────── */}
          {qrCode && state !== "open" && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">QR Code</h2>
                  <span className="flex items-center gap-1 text-xs text-amber-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> aguardando leitura…
                  </span>
                </div>
                <button onClick={() => { setQrCode(null); setPolling(false); }}
                  className="p-1 rounded-lg text-muted-foreground hover:bg-accent transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-inner">
                  <img
                    src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp" className="w-52 h-52 object-contain"
                  />
                </div>
                <ol className="text-sm text-muted-foreground space-y-1 text-left">
                  <li><strong className="text-foreground">1.</strong> Abra o WhatsApp no celular</li>
                  <li><strong className="text-foreground">2.</strong> Configurações → Aparelhos conectados</li>
                  <li><strong className="text-foreground">3.</strong> Conectar um aparelho → escaneie</li>
                </ol>
                <button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-sm text-foreground transition-colors disabled:opacity-50">
                  <RefreshCw className="w-4 h-4" /> Renovar QR
                </button>
              </div>
            </div>
          )}

          {/* ── Destinatários ────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Destinatários</h2>
                {allRevendas.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Associe cada destinatário às revendas que ele deve receber relatórios
                  </p>
                )}
              </div>
              {!showAddForm && (
                <button onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-medium border border-indigo-200 dark:border-indigo-800 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              )}
            </div>

            {/* Formulário de adição */}
            {showAddForm && (
              <div className="bg-card border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 mb-3 shadow-sm">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-3">Novo destinatário</p>
                <DestForm
                  onSave={(d) => addMutation.mutate({ ...d, revendas: [] })}
                  onCancel={() => setShowAddForm(false)}
                  loading={addMutation.isPending}
                />
              </div>
            )}

            {/* Lista */}
            {destQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
              </div>
            ) : destQuery.data?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum destinatário cadastrado</p>
                <p className="text-xs mt-1">Clique em "Adicionar" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {destQuery.data?.map((dest) =>
                  editingId === dest.id ? (
                    <div key={dest.id} className="bg-card border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-3">Editar destinatário</p>
                      <DestForm
                        initial={dest}
                        onSave={(d) => updateMutation.mutate({ id: dest.id, ...d, revendas: dest.revendas })}
                        onCancel={() => setEditingId(null)}
                        loading={updateMutation.isPending}
                      />
                    </div>
                  ) : (
                    <DestCard
                      key={dest.id}
                      dest={dest}
                      allRevendas={allRevendas}
                      connected={connected}
                      onEdit={() => setEditingId(dest.id)}
                      onDelete={() => {
                        if (confirm(`Remover ${dest.nome}?`)) removeMutation.mutate({ id: dest.id });
                      }}
                      onRevendasChange={(revendas) =>
                        setRevendasMutation.mutate({ id: dest.id, revendas })
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* ── Aviso se TRELLO_BOARDS não configurado ─────────────────────── */}
          {!revendasQuery.isLoading && allRevendas.length === 0 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold">Revendas não detectadas</p>
                <p className="text-xs mt-0.5">
                  Configure <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">TRELLO_BOARDS</code> no{" "}
                  <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">.env</code> para habilitar a associação de revendas.
                </p>
              </div>
            </div>
          )}

          {/* ── Config (colapsável) ─────────────────────────────────────────── */}
          <ConfigCard />

        </div>
      </main>
    </div>
  );
}

// ─── ConfigCard ───────────────────────────────────────────────────────────────

function ConfigCard() {
  const [open, setOpen] = useState(false);
  const configQuery = trpc.evolution.getConfig.useQuery();
  const cfg = configQuery.data;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors">
        <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">Configuração</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && cfg && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
          <Row label="API URL" value={cfg.apiUrl} mono />
          <Row label="Instância" value={cfg.instance} mono />
          <div className="flex items-start gap-3">
            <span className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5">API Key</span>
            {cfg.apiKeySet
              ? <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle2 className="w-3 h-3" /> Configurada</span>
              : <span className="inline-flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" /> Defina EVOLUTION_API_KEY no .env</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
