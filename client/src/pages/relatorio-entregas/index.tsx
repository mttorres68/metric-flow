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
import { trpc } from "@/lib/trpc";
import { LIMITES, horaBRT, minParaHM } from "@shared/entregas";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, FileUp, Loader2,
  MapPin, PenLine, Printer, RefreshCw, Timer, Truck, Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

type Resultado = inferRouterOutputs<AppRouter>["entregas"]["processar"][number];
type Baixa = Resultado["baixas"][number];

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(0)}%`;
const fmtDia = (iso: string) => iso.split("-").reverse().join("/");
const hora = (d: Date | null) => (d ? horaBRT(d) : "—");
const chave = (r: Resultado) => `${r.linha.routeId}|${r.linha.data}`;
const vermelho = "text-red-500 font-bold";
const neutro = "text-slate-600 dark:text-slate-300";
const vazio = <span className="text-slate-300 dark:text-slate-600">—</span>;

const STATUS: Record<Baixa["status"], { label: string; cor: string }> = {
  no_raio: { label: "No raio", cor: "green" },
  relampago: { label: "Relâmpago", cor: "amber" },
  sem_parada: { label: "Baixa sem parada", cor: "red" },
  sem_coordenada: { label: "Sem coordenada", cor: "slate" },
};

/** Tabela de baixas — usada no detalhe da linha e na lista de exceções do dia. */
function TabelaBaixas({ itens, comPlaca }: { itens: { r: Resultado; b: Baixa }[]; comPlaca?: boolean }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-100 dark:bg-slate-800/60">
        <tr className="text-left text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {comPlaca && <th className="px-2 py-1.5">Placa · Motorista</th>}
          <th className="px-2 py-1.5">Cliente</th>
          <th className="px-2 py-1.5">Código</th>
          <th className="px-2 py-1.5 text-center">Baixa</th>
          <th className="px-2 py-1.5 text-center">Status</th>
          <th className="px-2 py-1.5 text-center">Parada mais próxima</th>
          <th className="px-2 py-1.5 text-center">Permanência no raio</th>
        </tr>
      </thead>
      <tbody>
        {[...itens].sort((x, y) => (x.b.entrega.baixaEm?.getTime() ?? 0) - (y.b.entrega.baixaEm?.getTime() ?? 0)).map(({ r, b }, i) => (
          <tr key={i} className="border-b border-slate-100 dark:border-slate-700/40">
            {comPlaca && <Td>{r.linha.placa} · {r.linha.motorista}</Td>}
            <Td>{b.entrega.cliente}</Td>
            <Td mono className="text-slate-500 dark:text-slate-400">{b.entrega.codCliente}</Td>
            <Td center mono>{hora(b.entrega.baixaEm)}</Td>
            <Td center><Badge color={STATUS[b.status].cor}>{STATUS[b.status].label}</Badge></Td>
            <Td center mono>{b.distMaisProximaM === null ? vazio : `${Math.round(b.distMaisProximaM)} m`}</Td>
            <Td center mono>{b.status === "sem_coordenada" ? vazio : minParaHM(b.permanenciaMin)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
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
  const [cercaSel, setCercaSel] = useState<string | null>(null); // null = padrão (cerca "Sede", se existir)
  const cercas = trpc.infleet.listarCercas.useQuery(undefined, { staleTime: Infinity }).data ?? [];
  const cercaId = cercaSel ?? cercas.find(c => /sede/i.test(c.name))?.id ?? "";

  const processar = trpc.entregas.processar.useMutation({
    onSuccess: rs => {
      if (!rs.length) toast.warning("Nenhuma rota iniciada na planilha.");
      setDia(rs.length ? rs[rs.length - 1].linha.data : null);
      setAbertas(new Set());
    },
    onError: e => toast.error(e.message),
  });
  const resultados = processar.data ?? [];

  async function carregar(file: File | undefined) {
    if (!file) return;
    const base64 = await blobToBase64(file);
    setArquivo({ nome: file.name, base64 });
    processar.mutate({ xlsxBase64: base64, cercaId: cercaId || undefined });
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
              Baixas do CheckNow × paradas do GPS (Infleet), por placa · motorista · dia
            </p>
          </div>
          {arquivo && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>

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

          {arquivo && !processar.isPending && dia && (
            <>
              {/* ── Filtro de dia + KPIs ── */}
              <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-3 flex items-center gap-4 mx-6 mt-4 border border-slate-100 dark:border-[var(--border)]">
                <span className="text-xs text-slate-500 dark:text-slate-400">Planilha: <b className="text-slate-700 dark:text-slate-200">{arquivo.nome}</b></span>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" title="Quando o caminhão sai da cerca escolhida, esse evento vira o horário de saída; sem saída da cerca, vale o GPS">
                  Saída pela cerca
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
                  { label: "Baixas no raio", value: fmtPct(k.noRaioPct), color: k.noRaioPct < 100 ? "text-red-600" : "text-green-600", icon: <MapPin size={16} className="text-indigo-400" /> },
                  { label: "Baixas sem parada", value: String(k.semParada), color: k.semParada > 0 ? "text-red-600" : "text-green-600", icon: <AlertTriangle size={16} className="text-red-400" /> },
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
                        ? <TabelaBaixas itens={excecoesDia} comPlaca />
                        : <p className="text-xs text-slate-500">Todas as baixas do dia foram confirmadas pelo GPS.</p>}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-green-950 text-slate-100">
                        <tr>
                          <Th title="Clique na linha para ver as baixas">Placa · Motorista</Th>
                          <Th center title={`Saída da cerca escolhida ou, sem ela, início do 1º trecho em movimento de 3 min ou mais (vermelho se > ${LIMITES.saidaAte})`}>Saída</Th>
                          <Th center title="Fim do último trecho em movimento de 3 min ou mais">Retorno</Th>
                          <Th center title="Entregues no dia / total de clientes da rota">Entregas</Th>
                          <Th center title={`% das entregas com baixa após as 14h (vermelho se < ${LIMITES.apos14hMinPct}%)`}>Após 14h</Th>
                          <Th center title={`Baixas com parada de ${LIMITES.relampagoMin} min ou mais a até ${LIMITES.raioM} m do cliente`}>No raio</Th>
                          <Th center title="Baixas sem nenhuma parada do GPS no raio">Sem parada</Th>
                          <Th center title={`Paradas no raio com menos de ${LIMITES.relampagoMin} min (vermelho se > ${LIMITES.relampagoMaxPct}%)`}>Relâmpago</Th>
                          <Th center title={`Paradas de ${LIMITES.paradaSemClienteMin} min ou mais longe de todo cliente, entre a saída e o retorno`}>Paradas s/ cliente</Th>
                          <Th center title="Km rodado pelo GPS no dia">Km GPS</Th>
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
                                </Td>
                                <Td center mono className={saidaAlerta ? vermelho : neutro}>
                                  {gps ? (
                                    <span title={r.saidaOrigem === "cerca" ? "Saída registrada pela cerca (evento Saiu da cerca)" : "Saída pelo GPS (1º trecho em movimento)"}>
                                      {hora(r.saida)}{r.saidaOrigem === "cerca" && <MapPin size={10} className="inline ml-0.5 -mt-0.5 text-indigo-400" />}
                                    </span>
                                  ) : vazio}
                                </Td>
                                <Td center mono className={neutro}>{gps ? hora(r.retorno) : vazio}</Td>
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
                                    ? <span className="inline-flex items-center gap-1"><Timer size={11} /> {r.paradasSemCliente.qtd} · {minParaHM(r.paradasSemCliente.min)}</span>
                                    : "0") : vazio}
                                </Td>
                                <Td center mono className={neutro}>{gps && r.kmGps !== null ? r.kmGps.toFixed(0) : vazio}</Td>
                                <Td center mono>
                                  {r.pendentes === null ? vazio : (
                                    <span className={r.pendentes > 0 ? vermelho : neutro}>{r.pendentes} · {r.kmInformado ?? "—"} km</span>
                                  )}
                                </Td>
                              </tr>
                              {aberta && (
                                <tr>
                                  <td colSpan={11} className="bg-slate-50/60 dark:bg-slate-800/30 px-6 py-3 border-b border-slate-100 dark:border-slate-700/40">
                                    {gps
                                      ? (r.baixas.length
                                        ? <TabelaBaixas itens={r.baixas.map(b => ({ r, b }))} />
                                        : <p className="text-xs text-slate-500">Nenhuma baixa neste dia.</p>)
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
