/*
 * MetricFlow — Relatório Gerencial de Entregas
 * Upload da planilha do CheckNow → painel por dia (placa · motorista) com o cruzamento
 * das baixas com o GPS (Infleet), no mesmo padrão visual da Análise. Sem banco: a planilha
 * fica na memória da página e é reenviada para baixar os PDFs.
 */
import Sidebar from "@/components/Sidebar";
import { EditorAnalise } from "@/components/EditorAnalise";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { Th, Td } from "@/pages/analise/components/TablePrimitives";
import { Badge } from "@/pages/analise/components/Badge";
import { blobToBase64 } from "@/pages/analise/lib/pdf";
import { ConfigEntregasModal } from "./ConfigEntregasModal";
import { PainelRota } from "./PainelRota";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { LIMITES, horaBRT } from "@shared/entregas";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, FileUp, Loader2,
  MapPin, PenLine, Printer, RefreshCw, Settings2, Timer, Truck, Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

type Saida = inferRouterOutputs<AppRouter>["entregas"]["processar"];
type Resultado = Saida["linhas"][number];
type Baixa = Resultado["baixas"][number];

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(0)}%`;
const fmtDia = (iso: string) => iso.split("-").reverse().join("/");
const hora = (d: Date | null) => (d ? horaBRT(d) : "—");
const num1 = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const chave = (r: Resultado) => `${r.linha.routeId}|${r.linha.data}`;
const vermelho = "text-red-500 font-bold";
const neutro = "text-slate-600 dark:text-slate-300";
const vazio = <span className="text-slate-300 dark:text-slate-600">—</span>;

const STATUS: Record<Baixa["status"], { label: string; cor: string; dica: string }> = {
  no_raio: { label: "No raio", cor: "green", dica: "O caminhão ficou parado perto do cliente (3 min ou mais)" },
  relampago: { label: "Relâmpago", cor: "amber", dica: "O caminhão parou perto do cliente, mas por menos de 3 min" },
  sem_parada: { label: "Entrega sem parada", cor: "red", dica: "Entrega registrada no app sem o caminhão ter parado perto do cliente" },
  sem_coordenada: { label: "Sem coordenada", cor: "slate", dica: "Cliente sem latitude/longitude no cadastro: não dá para conferir" },
};

const faixa = (p: { inicio: Date; fim: Date }) => `${horaBRT(p.inicio)}–${horaBRT(p.fim)}`;
/** Duração sempre com unidade, para não confundir com horário: "9 min", "1h 50min", "2h". */
const dur = (min: number) => {
  const t = Math.round(min);
  if (t < 60) return `${t} min`;
  const h = Math.floor(t / 60), m = t % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
};
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || nome;
/** Distância com unidade: "35 m", "1,2 km". */
const distancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${num1(Math.round(m / 100) / 10)} km`);

/** Hora da entrega no app × passagem do caminhão pelo cliente. */
function MomentoEntrega({ m }: { m: Baixa["momentoBaixa"] }) {
  if (!m) return vazio;
  if (m.tipo === "na_parada") return <span title="Entrega registrada no app enquanto o caminhão estava no cliente"><Badge color="green">Na hora</Badge></span>;
  if (m.tipo === "depois") return <span title="Entrega registrada no app depois que o caminhão já tinha saído do cliente (registro em lote)"><Badge color="amber">{dur(m.min)} depois</Badge></span>;
  return <span title="Entrega registrada no app antes de o caminhão chegar ao cliente"><Badge color="red">{dur(m.min)} antes</Badge></span>;
}

/** Passagens do caminhão pelo cliente: 1 = horário; várias = selo com a quantidade que abre a lista ao clicar. */
function ParadasNoCliente({ b }: { b: Baixa }) {
  const ps = b.paradasNoRaio;
  if (ps.length === 1) return <span className="font-semibold text-slate-700 dark:text-slate-200" title="Chegada e saída do caminhão pelo GPS">{faixa(ps[0])}</span>;
  if (ps.length > 1) {
    const maisPerto = ps.reduce((m, p) => (p.distM < m.distM ? p : m));
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" title={`${ps.length} paradas no cliente — mostrando a mais próxima (${Math.round(maisPerto.distM)} m). Clique para ver todas`}
            className="inline-flex items-center gap-1 cursor-pointer font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400">
            {faixa(maisPerto)}
            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold leading-none">
              {ps.length}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Paradas no cliente (GPS)
          </p>
          <table className="text-xs font-mono">
            <tbody>
              {ps.map((p, i) => (
                <tr key={i} className={p === maisPerto ? "text-indigo-600 dark:text-indigo-400" : ""} title={p === maisPerto ? "A mais próxima do cliente (exibida na tabela)" : undefined}>
                  <td className="pr-3 py-0.5 font-semibold">{faixa(p)}</td>
                  <td className="pr-3 py-0.5 text-slate-500">{dur((p.fim.getTime() - p.inicio.getTime()) / 60000)}</td>
                  <td className="py-0.5 text-slate-400">a {Math.round(p.distM)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PopoverContent>
      </Popover>
    );
  }
  return b.maisProxima
    ? <span className="text-slate-400" title="Nenhuma parada perto do cliente; horário da parada mais próxima">não parou (mais próxima {faixa(b.maisProxima)})</span>
    : vazio;
}

/** Ordem real de visita: chegada da parada mais próxima (GPS); sem parada, a hora da entrega no app. */
const ordemVisita = (b: Baixa) =>
  b.paradasNoRaio.length
    ? b.paradasNoRaio.reduce((m, p) => (p.distM < m.distM ? p : m)).inicio.getTime()
    : b.entrega.baixaEm?.getTime() ?? 0;

/** Faixa entre duas linhas: deslocamento do caminhão até o próximo cliente (km pela estrada · tempo). */
function LinhaTrecho({ t, colunas }: { t: NonNullable<Baixa["trecho"]>; colunas: number }) {
  const mesmaParada = t.min === 0 && (t.km ?? 0) < 0.1;
  const dica = [
    t.deCodCliente ? `Do cliente ${t.deCodCliente} até o próximo` : "Da saída até o 1º cliente",
    "distância pela estrada (GPS) · tempo de deslocamento",
    t.retaKm !== null ? `linha reta: ${num1(Math.round(t.retaKm * 10) / 10)} km` : null,
    t.desvio ? "DESVIO: caminho bem maior que a linha reta" : null,
    t.lento ? "LENTO: demorou e andou devagar (parou no caminho?)" : null,
  ].filter(Boolean).join(" · ");
  const cor = t.desvio ? "text-red-600 dark:text-red-400" : t.lento ? "text-amber-600 dark:text-amber-400" : "text-indigo-500 dark:text-indigo-400";
  return (
    <tr>
      <td colSpan={colunas} className="py-0.5">
        <div title={dica} className={`flex items-center justify-center gap-2 text-[11px] font-mono cursor-help ${cor}`}>
          <span>{t.deCodCliente === null ? "saída →" : "↓"}</span>
          {mesmaParada
            ? <span className="text-slate-400">mesma parada (cliente vizinho)</span>
            : <span className="font-semibold">{num1(t.km)} km · {dur(t.min)}</span>}
          {t.retaKm !== null && !mesmaParada && <span className="text-slate-400">(linha reta {num1(Math.round(t.retaKm * 10) / 10)} km)</span>}
          {t.desvio && <Badge color="red">🚩 desvio</Badge>}
          {t.lento && <Badge color="amber">🐢 lento</Badge>}
        </div>
      </td>
    </tr>
  );
}

/** Tabela de entregas — no detalhe da linha (com os trechos entre as linhas) e na lista de exceções do dia. */
function TabelaBaixas({ itens, comPlaca, raioM }: { itens: { r: Resultado; b: Baixa }[]; comPlaca?: boolean; raioM: number }) {
  const colunas = comPlaca ? 10 : 9;
  const ordenados = [...itens].sort((x, y) => ordemVisita(x.b) - ordemVisita(y.b));
  return (
    <>
      {!comPlaca && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          Na ordem em que o caminhão passou. Entre as linhas: <b className="text-indigo-500">↓ distância pela estrada · tempo de deslocamento</b>
          {" "}· 🚩 desvio (caminho bem maior que a linha reta) · 🐢 lento (parou no caminho). Passe o mouse para ver detalhes.
        </p>
      )}
      {/* No detalhe, largura do conteúdo: a tabela principal é larga e esticaria as faixas de trecho para a direita. */}
      <table className={`${comPlaca ? "w-full" : "w-auto"} text-xs`}>
        <thead className="bg-slate-100 dark:bg-slate-800/60">
          <tr className="text-left text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {comPlaca && <th className="px-2 py-1.5">Placa · Motorista</th>}
            <th className="px-2 py-1.5" title="Primeiro nome; passe o mouse para ver o nome completo">Cliente</th>
            <th className="px-2 py-1.5">Código</th>
            <th className="px-2 py-1.5">Cidade</th>
            <th className="px-2 py-1.5 text-center" title="Hora em que o motorista registrou a entrega no app do CheckNow">Entrega no app (hora)</th>
            <th className="px-2 py-1.5 text-center" title={`Chegada e saída do caminhão a até ${raioM} m do cliente, pelo GPS`}>Caminhão no cliente (hora)</th>
            <th className="px-2 py-1.5 text-center" title="Distância entre a parada mais próxima do caminhão e o cliente, pelo GPS">Parou a (distância)</th>
            <th className="px-2 py-1.5 text-center" title={`Hora do registro no app × passagem do caminhão (tolerância de ${LIMITES.momentoTolMin} min)`}>Momento do registro</th>
            <th className="px-2 py-1.5 text-center">Situação</th>
            <th className="px-2 py-1.5 text-center" title="Tempo total do caminhão parado perto do cliente, pelo GPS">Tempo no cliente</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map(({ r, b }, i) => (
            <React.Fragment key={i}>
              {!comPlaca && b.trecho && <LinhaTrecho t={b.trecho} colunas={colunas} />}
              <tr className="border-b border-slate-100 dark:border-slate-700/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10">
                {comPlaca && <Td>{r.linha.placa} · {r.linha.motorista}</Td>}
                <Td><span title={b.entrega.cliente} className="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">{primeiroNome(b.entrega.cliente)}</span></Td>
                <Td mono className="text-slate-500 dark:text-slate-400">{b.entrega.codCliente}</Td>
                <Td className="text-slate-500 dark:text-slate-400">{b.entrega.cidade || "—"}</Td>
                <Td center mono>{hora(b.entrega.baixaEm)}</Td>
                <Td center mono><ParadasNoCliente b={b} /></Td>
                <Td center mono>{b.distMaisProximaM === null ? vazio : <span className={b.distMaisProximaM > raioM ? "text-red-500 font-bold" : ""} title={b.distMaisProximaM > raioM ? `Fora do raio de ${raioM} m` : `Dentro do raio de ${raioM} m`}>{distancia(b.distMaisProximaM)}</span>}</Td>
                <Td center><MomentoEntrega m={b.momentoBaixa} /></Td>
                <Td center>
                  <span title={`${STATUS[b.status].dica}${b.distMaisProximaM !== null ? ` · parada mais próxima a ${Math.round(b.distMaisProximaM)} m` : ""}`}>
                    <Badge color={STATUS[b.status].cor}>{STATUS[b.status].label}</Badge>
                  </span>
                </Td>
                <Td center mono>{b.status === "sem_coordenada" ? vazio : dur(b.permanenciaMin)}</Td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function RelatorioEntregas() {
  const { isCollapsed } = useSidebarCollapse();
  const [arquivo, setArquivo] = useState<{ nome: string; base64: string } | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [verExcecoes, setVerExcecoes] = useState(false);
  const [analise, setAnalise] = useState("");
  const [baixando, setBaixando] = useState<"dia" | "zip" | null>(null);
  const [configAberto, setConfigAberto] = useState(false);
  const raioM = trpc.config.getEntregasConfig.useQuery().data?.raioM ?? LIMITES.raioM;
  const [cercaSel, setCercaSel] = useState<string | null>(null); // null = padrão (cerca "Sede", se existir)
  const cercasQ = trpc.infleet.listarCercas.useQuery(undefined, { staleTime: Infinity });
  const cercas = cercasQ.data ?? [];
  const cercaPadrao = (lista: { id: string; name: string }[]) => cercaSel ?? lista.find(c => /sede/i.test(c.name))?.id ?? "";
  const cercaId = cercaPadrao(cercas);

  const processar = trpc.entregas.processar.useMutation({
    onSuccess: ({ linhas: rs }) => {
      if (!rs.length) toast.warning("Nenhuma rota iniciada na planilha.");
      // Recalcular (GPS, cerca, raio) mantém o dia aberto; planilha nova abre no último dia.
      setDia(d => (d && rs.some(r => r.linha.data === d) ? d : rs.length ? rs[rs.length - 1].linha.data : null));
      setAbertas(new Set());
    },
    onError: e => toast.error(e.message),
  });
  const resultados = processar.data?.linhas ?? [];
  const rotas = processar.data?.rotas ?? [];
  const [aba, setAba] = useState<"dia" | "rota">("dia");

  async function carregar(file: File | undefined) {
    if (!file) return;
    const base64 = await blobToBase64(file);
    setArquivo({ nome: file.name, base64 });
    setDia(null); // planilha nova: abre no último dia
    // Espera a lista de cercas: sem ela, a cerca padrão (Sede) ficaria de fora do 1º cálculo.
    const lista = cercasQ.data ?? (await cercasQ.refetch()).data ?? [];
    processar.mutate({ xlsxBase64: base64, cercaId: cercaPadrao(lista) || undefined });
  }

  const dias = useMemo(() => [...new Set(resultados.map(r => r.linha.data))], [resultados]);
  const linhas = useMemo(() => resultados.filter(r => r.linha.data === dia), [resultados, dia]);
  const excecoesDia = useMemo(
    () => linhas.flatMap(r => r.baixas.filter(b => b.status !== "no_raio").map(b => ({ r, b }))),
    [linhas],
  );
  const k = useMemo(() => {
    const gps = linhas.filter(r => !r.semGps);
    const soma = (rs: Resultado[], f: (r: Resultado) => number) => rs.reduce((a, r) => a + f(r), 0);
    const noRaio = soma(gps, r => r.noRaio), relamp = soma(gps, r => r.relampago);
    return {
      linhas: linhas.length,
      entregas: soma(linhas, r => r.entregasDia),
      noRaioPct: pct(noRaio, soma(gps, r => r.baixasComCoord)),
      semParada: soma(gps, r => r.semParada),
      relampPct: pct(relamp, noRaio + relamp),
    };
  }, [linhas]);

  const idxDia = dia ? dias.indexOf(dia) : -1;
  const toggle = (c: string) => setAbertas(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });

  async function baixar(tipo: "dia" | "zip") {
    if (!arquivo) return;
    setBaixando(tipo);
    try {
      const resp = await fetch("/api/relatorio-entregas/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xlsxBase64: arquivo.base64, analise, cercaId: cercaId || undefined, ...(tipo === "dia" ? { data: dia } : {}) }),
      });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error ?? "Erro ao gerar o PDF");
      const nome = resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "entregas.pdf";
      const url = URL.createObjectURL(await resp.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBaixando(null);
    }
  }

  const botao = "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border disabled:opacity-50";

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[var(--background)] overflow-hidden">
      <Sidebar activePage="relatorio_entregas" onNavigate={() => {}} />

      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
        {/* ── Header ── */}
        <div className="bg-white dark:bg-[var(--card)] border-b border-slate-100 dark:border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Truck size={20} className="text-indigo-500 dark:text-indigo-400" /> Relatório de Entregas
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Entregas registradas no CheckNow × paradas do caminhão no GPS (Infleet), por placa · motorista · dia
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfigAberto(true)} title={`Configurar o relatório (raio atual: ${raioM} m)`}
              className={`${botao} border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50`}>
              <Settings2 size={12} /> Configurar
            </button>
          {arquivo && (
            <>
              <label className={`${botao} border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer`}>
                <FileUp size={12} /> Trocar planilha
                <input type="file" accept=".xlsx" className="hidden" onChange={e => { carregar(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <button onClick={() => processar.mutate({ xlsxBase64: arquivo.base64, cercaId: cercaId || undefined })} disabled={processar.isPending}
                className={`${botao} bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700`}>
                <RefreshCw size={12} className={processar.isPending ? "animate-spin" : ""} /> Atualizar GPS
              </button>
              <button onClick={() => baixar("zip")} disabled={!dias.length || baixando !== null}
                className={`${botao} border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20`}>
                <Printer size={12} /> {baixando === "zip" ? "Gerando..." : "Baixar todos (ZIP)"}
              </button>
            </>
          )}
          </div>
        </div>

        <ConfigEntregasModal
          open={configAberto}
          onClose={() => setConfigAberto(false)}
          onSalvo={() => { if (arquivo) processar.mutate({ xlsxBase64: arquivo.base64, cercaId: cercaId || undefined }); }}
        />

        <div className="flex-1 min-h-0 overflow-auto">
          {/* ── Upload ── */}
          {!arquivo && (
            <label className="m-6 flex flex-col items-center justify-center gap-2 p-12 rounded-xl border-2 border-dashed border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--card)] cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <FileUp size={28} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Selecione a planilha do CheckNow (Geracao_Dado_BI.xlsx)</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">O cruzamento com o GPS leva alguns segundos</span>
              <input type="file" accept=".xlsx" className="hidden" onChange={e => carregar(e.target.files?.[0])} />
            </label>
          )}

          {arquivo && processar.isPending && (
            <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Cruzando {arquivo.nome} com o GPS...
            </div>
          )}

          {/* ── Abas: por dia × por rota ── */}
          {arquivo && !processar.isPending && dia && (
            <div className="mx-6 mt-4 inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-[var(--card)]">
              {([["dia", "Por dia"], ["rota", "Por rota"]] as const).map(([v, rotulo]) => (
                <button key={v} onClick={() => setAba(v)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${aba === v ? "bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
                  {rotulo}
                </button>
              ))}
            </div>
          )}

          {arquivo && !processar.isPending && dia && aba === "rota" && <PainelRota rotas={rotas} />}

          {arquivo && !processar.isPending && dia && aba === "dia" && (
            <>
              {/* ── Filtro de dia + KPIs ── */}
              <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-3 flex items-center gap-4 mx-6 mt-4 border border-slate-100 dark:border-[var(--border)]">
                <span className="text-xs text-slate-500 dark:text-slate-400">Planilha: <b className="text-slate-700 dark:text-slate-200">{arquivo.nome}</b></span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Raio: <b className="text-slate-700 dark:text-slate-200">{raioM} m</b></span>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" title="Saiu da cerca escolhida = horário de saída; entrou nela depois da saída = horário de retorno. Sem esses eventos no dia, vale o GPS">
                  Saída / retorno pela cerca
                  <select value={cercaId} disabled={processar.isPending}
                    onChange={e => { setCercaSel(e.target.value); processar.mutate({ xlsxBase64: arquivo.base64, cercaId: e.target.value || undefined }); }}
                    className="text-xs font-semibold bg-transparent border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200">
                    <option value="">Nenhuma (só GPS)</option>
                    {cercas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <div className="flex items-center gap-1 ml-auto">
                  <button aria-label="Dia anterior" disabled={idxDia <= 0} onClick={() => setDia(dias[idxDia - 1])}
                    className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:opacity-30"><ChevronLeft size={16} /></button>
                  <select value={dia} onChange={e => setDia(e.target.value)}
                    className="text-xs font-semibold bg-transparent border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200">
                    {dias.map(d => <option key={d} value={d}>{fmtDia(d)}</option>)}
                  </select>
                  <button aria-label="Próximo dia" disabled={idxDia >= dias.length - 1} onClick={() => setDia(dias[idxDia + 1])}
                    className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
              </div>

              <div className="px-6 pt-4 pb-2 grid grid-cols-5 gap-3">
                {[
                  { label: "Placas · motoristas", value: String(k.linhas), color: "text-slate-700 dark:text-slate-200", icon: <Truck size={16} className="text-indigo-400" /> },
                  { label: "Entregas no dia", value: String(k.entregas), color: "text-slate-700 dark:text-slate-200", icon: <MapPin size={16} className="text-green-400" /> },
                  { label: "Entregas no raio", value: fmtPct(k.noRaioPct), color: k.noRaioPct < 100 ? "text-red-600" : "text-green-600", icon: <MapPin size={16} className="text-indigo-400" /> },
                  { label: "Entregas sem parada", value: String(k.semParada), color: k.semParada > 0 ? "text-red-600" : "text-green-600", icon: <AlertTriangle size={16} className="text-red-400" /> },
                  { label: "Relâmpago", value: fmtPct(k.relampPct), color: k.relampPct > LIMITES.relampagoMaxPct ? "text-red-600" : "text-green-600", icon: <Zap size={16} className="text-amber-400" /> },
                ].map(c => (
                  <div key={c.label} className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] px-4 py-3 flex items-center gap-3">
                    {c.icon}
                    <div>
                      <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{c.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Tabela do dia ── */}
              <div className="px-6 pb-6 pt-2">
                <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] overflow-hidden">
                  <div className="px-5 py-3 border-b border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase">
                      Entregas: <span className="text-indigo-600 dark:text-indigo-400">{fmtDia(dia)}</span>
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{linhas.length} placa(s) · motorista(s)</span>
                      <button onClick={() => setVerExcecoes(v => !v)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 font-semibold">
                        <AlertTriangle size={12} /> Exceções ({excecoesDia.length})
                      </button>
                    </div>
                  </div>

                  {verExcecoes && (
                    <div className="border-b border-amber-100 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/5 px-5 py-3">
                      {excecoesDia.length
                        ? <TabelaBaixas itens={excecoesDia} comPlaca raioM={raioM} />
                        : <p className="text-xs text-slate-500">Todas as baixas do dia foram confirmadas pelo GPS.</p>}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-green-950 text-slate-100">
                        <tr>
                          <Th title="Clique na linha para ver as baixas">Placa · Motorista</Th>
                          <Th center title={`Saída da cerca escolhida ou, sem ela, início do 1º trecho em movimento de 3 min ou mais (vermelho se > ${LIMITES.saidaAte})`}>Saída (hora)</Th>
                          <Th center title="Entrada na cerca escolhida depois da saída ou, sem ela, fim do último trecho em movimento de 3 min ou mais">Retorno (hora)</Th>
                          <Th center title="1ª e última entrega no app do CheckNow × chegada ao 1º cliente e saída do último pelo GPS">1º → último cliente (hora)</Th>
                          <Th center title="Tempo em cliente: soma de (saída − chegada) no app × paradas no raio pelo GPS">Em cliente (tempo)</Th>
                          <Th center title="Da saída (revenda 📍 quando pela cerca, ou pernoite) até chegar ao 1º cliente: tempo · km pela estrada">Saída → 1º PDV (tempo · km)</Th>
                          <Th center title="Do último cliente até o retorno (revenda 📍 quando pela cerca): tempo · km pela estrada">Último PDV → retorno (tempo · km)</Th>
                          <Th center title="Entregues no dia / total de clientes da rota">Entregas</Th>
                          <Th center title={`% das entregas registradas após as 14h (vermelho se < ${LIMITES.apos14hMinPct}%)`}>Após 14h</Th>
                          <Th center title={`Entregas com o caminhão parado de ${LIMITES.relampagoMin} min ou mais a até ${raioM} m do cliente`}>No raio</Th>
                          <Th center title="Entregas sem nenhuma parada do caminhão perto do cliente">Sem parada</Th>
                          <Th center title={`Paradas no raio com menos de ${LIMITES.relampagoMin} min (vermelho se > ${LIMITES.relampagoMaxPct}%)`}>Relâmpago</Th>
                          <Th center title={`Paradas de ${LIMITES.paradaSemClienteMin} min ou mais longe de todo cliente, entre a saída e o retorno`}>Paradas s/ cliente (qtd · tempo)</Th>
                          <Th center title={`Trechos entre clientes com desvio (km pela estrada > ${LIMITES.desvioFator}× a linha reta e +${LIMITES.desvioMinKm} km) e lentos (> ${LIMITES.lentoMinMin} min a < ${LIMITES.lentoMaxKmh} km/h)`}>Desvios · lentos</Th>
                          <Th center title="Km rodado pelo GPS no dia · distância real informada no CheckNow (total da rota)">Km GPS · informado</Th>
                          <Th center title="Só no dia em que a rota fecha">Pendentes · Km inf.</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.map(r => {
                          const gps = !r.semGps;
                          const aberta = abertas.has(chave(r));
                          const pTarde = pct(r.apos14h, r.entregasDia);
                          const pRaio = pct(r.noRaio, r.baixasComCoord);
                          const relBase = r.noRaio + r.relampago;
                          const pRel = pct(r.relampago, relBase);
                          const saidaAlerta = !!r.saida && horaBRT(r.saida) > LIMITES.saidaAte;
                          return (
                            <React.Fragment key={chave(r)}>
                              <tr onClick={() => toggle(chave(r))} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/20">
                                <Td>
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 whitespace-nowrap">
                                    {aberta ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    {r.linha.placa} · {r.linha.motorista}
                                  </span>
                                  {!gps && <span className="ml-2"><Badge color="slate">sem GPS: {r.semGps}</Badge></span>}
                                  {r.cidades.length > 0 && <div className="text-[10px] text-slate-400 pl-4 mt-0.5">{r.cidades.join(" · ")}</div>}
                                </Td>
                                <Td center mono className={saidaAlerta ? vermelho : neutro}>
                                  {gps ? (
                                    <span title={r.saidaOrigem === "cerca" ? "Saída registrada pela cerca (evento Saiu da cerca)" : "Saída pelo GPS (1º trecho em movimento)"}>
                                      {hora(r.saida)}{r.saidaOrigem === "cerca" && <MapPin size={10} className="inline ml-0.5 -mt-0.5 text-indigo-400" />}
                                    </span>
                                  ) : vazio}
                                </Td>
                                <Td center mono className={neutro}>
                                  {gps ? (
                                    <span title={r.retornoOrigem === "cerca" ? "Retorno registrado pela cerca (evento Entrou na cerca)" : "Retorno pelo GPS (fim do último trecho em movimento)"}>
                                      {hora(r.retorno)}{r.retornoOrigem === "cerca" && <MapPin size={10} className="inline ml-0.5 -mt-0.5 text-indigo-400" />}
                                    </span>
                                  ) : vazio}
                                </Td>
                                <Td center mono className={neutro}>
                                  <div title="1ª e última entrega registrada no app">app {hora(r.app.primeira)}–{hora(r.app.ultima)}</div>
                                  <div className="text-slate-400" title="Chegada ao 1º cliente e saída do último pelo GPS">
                                    GPS {gps && r.gpsClientes.primeiraChegada ? `${hora(r.gpsClientes.primeiraChegada)}–${hora(r.gpsClientes.ultimaSaida)}` : "—"}
                                  </div>
                                </Td>
                                <Td center mono className={neutro}>
                                  <div title="Soma de (saída − chegada) no app">app {dur(r.app.emClienteMin)}</div>
                                  <div className="text-slate-400" title="Paradas a até o raio de algum cliente, pelo GPS">GPS {r.tempo ? dur(r.tempo.emClienteMin) : "—"}</div>
                                </Td>
                                <Td center mono className={neutro}>
                                  {r.ida ? (
                                    <span title={r.saidaOrigem === "cerca" ? "Desde a saída da revenda (cerca)" : "Desde a saída (GPS) — revenda ou pernoite"}>
                                      {dur(r.ida.min)} · {num1(r.ida.km)} km{r.saidaOrigem === "cerca" && <MapPin size={10} className="inline ml-0.5 -mt-0.5 text-indigo-400" />}
                                    </span>
                                  ) : vazio}
                                </Td>
                                <Td center mono className={neutro}>
                                  {r.volta ? (
                                    <span title={r.retornoOrigem === "cerca" ? "Até entrar na revenda (cerca)" : "Até o retorno (GPS)"}>
                                      {dur(r.volta.min)} · {num1(r.volta.km)} km{r.retornoOrigem === "cerca" && <MapPin size={10} className="inline ml-0.5 -mt-0.5 text-indigo-400" />}
                                    </span>
                                  ) : vazio}
                                </Td>
                                <Td center mono className={neutro}>{r.entregasDia}/{r.totalRota}</Td>
                                <Td center mono>
                                  {r.entregasDia > 0 ? (
                                    <span className={pTarde < LIMITES.apos14hMinPct ? vermelho : `${neutro} font-bold`}>
                                      {fmtPct(pTarde)} <span className="text-slate-400 font-normal">({r.apos14h}/{r.entregasDia})</span>
                                    </span>
                                  ) : vazio}
                                </Td>
                                <Td center mono>
                                  {gps && r.baixasComCoord > 0 ? (
                                    <span className={r.baixasComCoord > 0 && pRaio < 100 ? vermelho : "text-green-600 dark:text-green-400 font-bold"}>
                                      {fmtPct(pRaio)} <span className="text-slate-400 font-normal">({r.noRaio}/{r.baixasComCoord})</span>
                                    </span>
                                  ) : vazio}
                                </Td>
                                <Td center>{gps ? (r.semParada > 0 ? <Badge color="red">{r.semParada}</Badge> : <span className="text-slate-300 dark:text-slate-600">0</span>) : vazio}</Td>
                                <Td center mono>
                                  {gps && relBase > 0 ? (
                                    <span className={pRel > LIMITES.relampagoMaxPct ? vermelho : "text-green-600 dark:text-green-400"}>
                                      {fmtPct(pRel)} <span className="text-slate-400">({r.relampago}/{relBase})</span>
                                    </span>
                                  ) : vazio}
                                </Td>
                                <Td center mono className={neutro}>
                                  {gps ? (r.paradasSemCliente.qtd > 0
                                    ? <span className="inline-flex items-center gap-1"><Timer size={11} /> {r.paradasSemCliente.qtd} · {dur(r.paradasSemCliente.min)}</span>
                                    : "0") : vazio}
                                </Td>
                                <Td center>
                                  {gps ? (r.desvios || r.trechosLentos ? (
                                    <span className="inline-flex gap-1">
                                      {r.desvios > 0 && <Badge color="red">🚩 {r.desvios}</Badge>}
                                      {r.trechosLentos > 0 && <Badge color="amber">🐢 {r.trechosLentos}</Badge>}
                                    </span>
                                  ) : <span className="text-slate-300 dark:text-slate-600">0</span>) : vazio}
                                </Td>
                                <Td center mono className={neutro}>
                                  {gps && r.kmGps !== null ? r.kmGps.toFixed(0) : vazio}
                                  {r.kmInformado !== null && <div className="text-slate-400" title="Distância real informada no CheckNow (odômetro, total da rota)">inf. {r.kmInformado} (rota)</div>}
                                </Td>
                                <Td center mono>
                                  {r.pendentes === null ? vazio : (
                                    <span className={r.pendentes > 0 ? vermelho : neutro}>{r.pendentes} · {r.kmInformado ?? "—"} km</span>
                                  )}
                                </Td>
                              </tr>
                              {aberta && (
                                <tr>
                                  <td colSpan={16} className="bg-slate-50/60 dark:bg-slate-800/30 px-6 py-3 border-b border-slate-100 dark:border-slate-700/40">
                                    {gps
                                      ? (r.baixas.length
                                        ? <TabelaBaixas itens={r.baixas.map(b => ({ r, b }))} raioM={raioM} />
                                        : <p className="text-xs text-slate-500">Nenhuma entrega registrada neste dia.</p>)
                                      : <p className="text-xs text-slate-500">Sem GPS ({r.semGps}): não é possível conferir as baixas.</p>}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Análise + PDF do dia ── */}
                  <div className="px-5 py-4 border-t border-slate-100 dark:border-[var(--border)] bg-slate-50/40 dark:bg-[var(--background)]/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PenLine className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span className="text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-widest font-bold">Análise · Entregas</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">— será incluída no PDF</span>
                      </div>
                      <button onClick={() => baixar("dia")} disabled={baixando !== null}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-bold">
                        <Printer className="w-3 h-3" /> {baixando === "dia" ? "Gerando..." : `Baixar PDF ${fmtDia(dia)}`}
                      </button>
                    </div>
                    <EditorAnalise id="editor-entregas" html={analise} onChange={setAnalise}
                      placeholder="Registre aqui a análise das entregas — destaques, pontos de atenção, planos de ação..." />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
