/*
 * MetricFlow — aba "Produtividade" (spec rota-produtividade §7): ranking das rotas que começaram no período por hL/h de
 * jornada, quanto tempo cada rota levou para entregar tudo (rodando / em cliente / parado fora de cliente), entregas
 * realizadas por dia e o lado a lado de 2 a 4 rotas.
 */
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { diaBRT } from "@shared/entregas";

type Ranking = inferRouterOutputs<AppRouter>["produtividade"]["ranking"];
type Rota = Ranking["rotas"][number];
type DiaRota = inferRouterOutputs<AppRouter>["produtividade"]["rotas"][number]["dias"][number];

const DIA_MS = 86_400_000;
const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const hm = (min: number | null) => (min === null ? "—" : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`);
const n = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? "—" : x.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const primeiroNome = (s: string) => s.trim().split(/\s+/)[0] || s;
const nomeRota = (r: { placa: string; motorista: string }) => `${r.placa} · ${primeiroNome(r.motorista)}`;
/** Nos gráficos o mesmo caminhão e motorista aparecem em várias rotas: a data de início diferencia. */
const nomeGrafico = (r: { placa: string; motorista: string; inicio: Date }) => `${nomeRota(r)} (${ddmm(diaBRT(r.inicio))})`;
const TEMPO = { rodando: "#2a78d6", emCliente: "#16a34a", parado: "#BA7517" };
const SERIES = ["#2a78d6", "#E24B4A", "#7F77DD", "#0f766e"];
const MAX_SEL = 4;

const caixa = "bg-white dark:bg-[var(--card)] rounded-2xl border border-slate-100 dark:border-[var(--border)]";
const th = "px-3 py-2 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide";
const td = "px-3 py-2 text-xs text-slate-700 dark:text-slate-200";

function useEstiloGrafico() {
  const { theme } = useTheme();
  const escuro = theme === "dark";
  return {
    grade: escuro ? "#1e2a3a" : "#F1F5F9",
    eixo: { fontSize: 10, fill: escuro ? "#94a3b8" : "#64748b" },
    tooltip: { background: escuro ? "#1a2436" : "#ffffff", border: `1px solid ${escuro ? "#2d3f55" : "#E2E8F0"}`, borderRadius: 12, fontSize: 12, color: escuro ? "#e2e8f0" : "#334155" },
    texto: escuro ? "#e2e8f0" : "#334155",
  };
}

function etiquetas(r: Rota) {
  return [
    r.diasSemGps ? `${r.diasSemGps} dia(s) sem GPS` : null,
    r.incompleto ? "sem volume do ERP" : null,
    r.semJornada ? "sem jornada" : null,
  ].filter((x): x is string => !!x);
}

function TempoParaEntregar({ rotas }: { rotas: Rota[] }) {
  const g = useEstiloGrafico();
  const dados = rotas.filter(r => !r.semJornada).map(r => ({
    nome: nomeGrafico(r), rodando: r.rodandoMin / 60, emCliente: r.emClienteMin / 60, parado: r.paradoSemClienteMin / 60,
    rotulo: `${hm(r.jornadaMin)} · ${r.dias} dia${r.dias > 1 ? "s" : ""}`,
  }));
  if (!dados.length) return <p className="px-4 pb-4 text-xs text-slate-400">Nenhuma rota com jornada no período.</p>;
  return (
    <ResponsiveContainer width="100%" height={28 * dados.length + 60}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 110, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={g.grade} horizontal={false} />
        <XAxis type="number" tick={g.eixo} axisLine={false} tickLine={false} unit="h" />
        <YAxis type="category" dataKey="nome" tick={g.eixo} axisLine={false} tickLine={false} width={170} />
        <Tooltip contentStyle={g.tooltip} formatter={(v: number, nome: string) => [hm(v * 60), nome]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="rodando" name="Rodando" stackId="t" fill={TEMPO.rodando} />
        <Bar dataKey="emCliente" name="Em cliente" stackId="t" fill={TEMPO.emCliente} />
        <Bar dataKey="parado" name="Parado fora de cliente" stackId="t" fill={TEMPO.parado} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="rotulo" position="right" style={{ fontSize: 10, fill: g.texto }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EntregasPorDia({ revendaId, de, ate, selecionadas, nomes }: { revendaId: number; de: string; ate: string; selecionadas: string[]; nomes: Map<string, string> }) {
  const g = useEstiloGrafico();
  const q = trpc.produtividade.porDia.useQuery({ revendaId, de, ate, routeIds: selecionadas.length ? selecionadas : undefined });
  const dados = (q.data ?? []).map(d => ({ dia: ddmm(d.dia), total: d.total, ...d.porRota }));
  const media = dados.length ? dados.reduce((s, d) => s + d.total, 0) / dados.length : 0;
  if (q.isLoading) return <div className="h-40 flex items-center justify-center text-xs text-slate-400"><Loader2 size={14} className="animate-spin mr-1" /> Carregando…</div>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={g.grade} vertical={false} />
        <XAxis dataKey="dia" tick={g.eixo} axisLine={false} tickLine={false} />
        <YAxis tick={g.eixo} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={g.tooltip} />
        {selecionadas.length ? (
          <>
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {selecionadas.map((id, i) => <Bar key={id} dataKey={id} name={nomes.get(id) ?? id} fill={SERIES[i]} radius={[4, 4, 0, 0]} />)}
          </>
        ) : (
          <>
            <ReferenceLine y={media} stroke={g.texto} strokeDasharray="4 4" label={{ value: `média ${n(media, 0)}`, position: "insideTopRight", fontSize: 10, fill: g.texto }} />
            <Bar dataKey="total" name="Entregas" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

function LadoALado({ revendaId, rotas }: { revendaId: number; rotas: Rota[] }) {
  const g = useEstiloGrafico();
  const q = trpc.produtividade.rotas.useQuery({ revendaId, routeIds: rotas.map(r => r.routeId) });
  const diasDe = (id: string): DiaRota[] => q.data?.find(x => x.routeId === id)?.dias ?? [];
  // Melhor valor de cada linha em negrito: maior é melhor, salvo onde "menor" está marcado.
  const linhas: { rotulo: string; valor: (r: Rota) => number | null; texto: (r: Rota) => string; menor?: boolean }[] = [
    { rotulo: "hL/h", valor: r => r.hlPorHora, texto: r => n(r.hlPorHora, 2) },
    { rotulo: "Entregas/h", valor: r => r.entregasPorHora, texto: r => n(r.entregasPorHora, 2) },
    { rotulo: "Tempo para entregar tudo", valor: r => (r.semJornada ? null : r.jornadaMin), texto: r => (r.semJornada ? "—" : hm(r.jornadaMin)), menor: true },
    { rotulo: "Dias", valor: r => r.dias, texto: r => String(r.dias), menor: true },
    { rotulo: "% entregue", valor: r => r.entreguePct, texto: r => (r.entreguePct === null ? "—" : `${n(r.entreguePct)}%`) },
    { rotulo: "hL", valor: r => r.hl, texto: r => n(r.hl) },
    { rotulo: "km", valor: () => null, texto: r => (r.kmGps === null ? "—" : String(r.kmGps)) },
    { rotulo: "hL/km", valor: r => r.hlPorKm, texto: r => n(r.hlPorKm, 3) },
    { rotulo: "Ida média", valor: r => r.idaMedia, texto: r => hm(r.idaMedia), menor: true },
    { rotulo: "Volta média", valor: r => r.voltaMedia, texto: r => hm(r.voltaMedia), menor: true },
  ];
  const melhor = (l: (typeof linhas)[number]) => {
    const vs = rotas.map(l.valor).filter((v): v is number => v !== null);
    return vs.length > 1 ? (l.menor ? Math.min(...vs) : Math.max(...vs)) : null;
  };
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${rotas.length}, minmax(0, 1fr))` }}>
      {rotas.map((r, i) => {
        const dias = diasDe(r.routeId);
        return (
          <div key={r.routeId} className={`${caixa} p-3 flex flex-col gap-2 min-w-0`} style={{ borderTop: `3px solid ${SERIES[i]}` }}>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{nomeRota(r)}</div>
              <div className="text-[11px] text-slate-400">{ddmm(diaBRT(r.inicio))} → {r.fim ? ddmm(diaBRT(r.fim)) : "em andamento"}</div>
            </div>
            <table className="w-full"><tbody>
              {linhas.map(l => {
                const m = melhor(l), v = l.valor(r);
                return (
                  <tr key={l.rotulo} className="border-t border-slate-100 dark:border-[var(--border)]">
                    <td className="py-1 text-[11px] text-slate-500 dark:text-slate-400">{l.rotulo}</td>
                    <td className={`py-1 text-xs text-right text-slate-700 dark:text-slate-200 ${m !== null && v === m ? "font-bold" : ""}`}>{l.texto(r)}</td>
                  </tr>
                );
              })}
            </tbody></table>
            {q.isLoading ? <Loader2 size={14} className="animate-spin text-slate-400" /> : (
              <>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Entregas por dia</div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={dias.map(d => ({ dia: ddmm(d.dia), entregas: d.entregas }))} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="dia" tick={g.eixo} axisLine={false} tickLine={false} />
                    <YAxis tick={g.eixo} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={g.tooltip} />
                    <Bar dataKey="entregas" name="Entregas" fill={SERIES[i]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Tempo por dia</div>
                <ResponsiveContainer width="100%" height={24 * Math.max(dias.length, 1) + 30}>
                  <BarChart data={dias.map(d => ({ dia: ddmm(d.dia), rodando: (d.rodandoMin ?? 0) / 60, emCliente: (d.emClienteMin ?? 0) / 60, parado: (d.paradoSemClienteMin ?? 0) / 60 }))}
                    layout="vertical" margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                    <XAxis type="number" tick={g.eixo} axisLine={false} tickLine={false} unit="h" />
                    <YAxis type="category" dataKey="dia" tick={g.eixo} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={g.tooltip} formatter={(v: number, nome: string) => [hm(v * 60), nome]} />
                    <Bar dataKey="rodando" name="Rodando" stackId="t" fill={TEMPO.rodando} />
                    <Bar dataKey="emCliente" name="Em cliente" stackId="t" fill={TEMPO.emCliente} />
                    <Bar dataKey="parado" name="Parado fora de cliente" stackId="t" fill={TEMPO.parado} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TabelaRotas({ rotas, selecionadas, alternar, posicao }: { rotas: Rota[]; selecionadas?: string[]; alternar?: (id: string) => void; posicao: boolean }) {
  return (
    <table className="w-full">
      <thead><tr>
        {alternar && <th className={th} />}{posicao && <th className={th}>#</th>}
        <th className={th}>Rota</th><th className={th}>Datas</th><th className={`${th} text-right`}>hL/h</th><th className={`${th} text-right`}>Entregas/h</th>
        <th className={th}>Tempo para entregar tudo</th><th className={`${th} text-right`}>Clientes</th><th className={`${th} text-right`}>% entregue</th>
        <th className={`${th} text-right`}>hL</th><th className={`${th} text-right`}>hL/km</th><th className={th}>Observações</th>
      </tr></thead>
      <tbody>
        {rotas.map((r, i) => {
          const marcada = !!selecionadas?.includes(r.routeId);
          return (
            <tr key={r.routeId} className={`border-t border-slate-100 dark:border-[var(--border)] ${marcada ? "bg-indigo-50 dark:bg-indigo-900/20" : ""}`}>
              {alternar && <td className={td}>
                <input type="checkbox" aria-label={`Comparar ${nomeRota(r)}`} checked={marcada}
                  disabled={!marcada && (selecionadas?.length ?? 0) >= MAX_SEL} onChange={() => alternar(r.routeId)} />
              </td>}
              {posicao && <td className={`${td} text-slate-400`}>{i + 1}</td>}
              <td className={`${td} font-semibold whitespace-nowrap`}>{nomeRota(r)}</td>
              <td className={`${td} whitespace-nowrap`}>{ddmm(diaBRT(r.inicio))} → {r.fim ? ddmm(diaBRT(r.fim)) : "…"}</td>
              <td className={`${td} text-right font-bold`}>{n(r.hlPorHora, 2)}</td>
              <td className={`${td} text-right`}>{n(r.entregasPorHora, 2)}</td>
              <td className={`${td} whitespace-nowrap`}>{r.semJornada ? "—" : `${hm(r.jornadaMin)} · ${r.dias} dia${r.dias > 1 ? "s" : ""}`}</td>
              <td className={`${td} text-right`}>{r.clientes}</td>
              <td className={`${td} text-right`}>{r.entreguePct === null ? "—" : `${n(r.entreguePct)}%`}</td>
              <td className={`${td} text-right`}>{n(r.hl)}</td>
              <td className={`${td} text-right`}>{n(r.hlPorKm, 3)}</td>
              <td className={td}><div className="flex flex-wrap gap-1">
                {etiquetas(r).map(e => <span key={e} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-[10px]">{e}</span>)}
              </div></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PainelProdutividade({ revendaId }: { revendaId: number }) {
  const [dias, setDias] = useState(14);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const hoje = diaBRT(new Date());
  const de = somaDias(hoje, -(dias - 1));
  const q = trpc.produtividade.ranking.useQuery({ revendaId, de, ate: hoje });
  const nomes = useMemo(() => new Map([...(q.data?.rotas ?? []), ...(q.data?.emAndamento ?? [])].map(r => [r.routeId, nomeGrafico(r)])), [q.data]);
  const alternar = (id: string) => setSelecionadas(s => (s.includes(id) ? s.filter(x => x !== id) : s.length < MAX_SEL ? [...s, id] : s));

  if (q.isLoading) return <div className="flex items-center justify-center h-40 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin mr-2" /> Calculando o ranking…</div>;
  if (q.error) return <div className="m-6 text-sm text-red-600">{q.error.message}</div>;
  const rk = q.data!;
  const todas = [...rk.rotas, ...rk.emAndamento];
  const marcadas = selecionadas.map(id => todas.find(r => r.routeId === id)).filter((r): r is Rota => !!r);
  const cartao = (rotulo: string, valor: string) => (
    <div className={`${caixa} px-4 py-3`}>
      <div className="text-xs text-slate-400">{rotulo}</div>
      <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{valor}</div>
    </div>
  );

  return (
    <div className="px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-[var(--card)]">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => { setDias(d); setSelecionadas([]); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${dias === d ? "bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}>{d} dias</button>
          ))}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">Rotas que começaram de {ddmm(de)} a {ddmm(hoje)} · hL/h = hL entregue ÷ horas da saída ao retorno</span>
      </div>

      {!todas.length ? (
        <div className="flex items-center justify-center p-12 rounded-xl border-2 border-dashed border-slate-200 dark:border-[var(--border)] text-sm text-slate-500 dark:text-slate-400">
          Nenhuma rota processada no período. Reprocesse no ⚙ › Limites › Pernoite (últimas 4 semanas).
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cartao("Rotas no período", String(rk.resumo.rotas))}
            {cartao("hL/h da revenda", n(rk.resumo.hlPorHora, 2))}
            {cartao("Entregas/h", n(rk.resumo.entregasPorHora, 2))}
            {cartao("Tempo médio para entregar uma rota", hm(rk.resumo.tempoMedioMin))}
          </div>

          <div className={`${caixa} overflow-x-auto`}>
            <div className="flex items-center gap-3 px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
              <b>Ranking</b> · da menos produtiva para a mais produtiva
              <span className="ml-auto text-slate-400">{selecionadas.length ? `${selecionadas.length} de ${MAX_SEL} marcadas` : `marque de 2 a ${MAX_SEL} para comparar lado a lado`}</span>
              {!!selecionadas.length && <button onClick={() => setSelecionadas([])} className="text-indigo-600 font-semibold">limpar</button>}
            </div>
            {rk.rotas.length ? <TabelaRotas rotas={rk.rotas} selecionadas={selecionadas} alternar={alternar} posicao />
              : <p className="px-4 pb-4 text-xs text-slate-400">Nenhuma rota terminada no período.</p>}
            {!!rk.emAndamento.length && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Em andamento — fora do ranking</div>
                <TabelaRotas rotas={rk.emAndamento} posicao={false} />
              </>
            )}
          </div>

          {marcadas.length >= 2 && <LadoALado revendaId={revendaId} rotas={marcadas} />}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={caixa}>
              <div className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">Quanto tempo leva para entregar tudo</div>
              <TempoParaEntregar rotas={rk.rotas} />
            </div>
            <div className={caixa}>
              <div className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                Entregas realizadas por dia{selecionadas.length ? " · rotas marcadas" : " · todas as rotas"}
              </div>
              <EntregasPorDia revendaId={revendaId} de={de} ate={hoje} selecionadas={selecionadas} nomes={nomes} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
