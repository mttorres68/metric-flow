/*
 * MetricFlow — Relatório de Entregas, aba "Por rota" (RouteId):
 * resumo, sequência planejada × GPS, para onde foi o tempo, distância e devoluções com prova.
 */
import { useState } from "react";
import { AlertTriangle, ExternalLink, Route as RotaIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "@/pages/analise/components/Badge";
import { Td, Th } from "@/pages/analise/components/TablePrimitives";
import { LIMITES, diaBRT, horaBRT, minParaHM } from "@shared/entregas";

type Rota = inferRouterOutputs<AppRouter>["entregas"]["processar"]["rotas"][number];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const kg = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`;
const ddmm = (d: Date | string) => (typeof d === "string" ? d : diaBRT(d)).split("-").reverse().slice(0, 2).join("/");
const num = (v: number | null, casas = 0, suf = "") => (v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: casas })}${suf}`);
const nomeRota = (r: Rota) => `${r.placa} · ${r.motorista} · ${ddmm(r.inicio)} → ${r.fim ? ddmm(r.fim) : "aberta"}`;

// Paleta categórica padrão (dataviz), slots 1–3 em ordem fixa; validada nos dois temas.
const CORES = {
  light: { rodando: "#2a78d6", emCliente: "#eb6834", semCliente: "#1baf7a" },
  dark: { rodando: "#3987e5", emCliente: "#d95926", semCliente: "#199e70" },
};

function Bloco({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] overflow-hidden">
      <div className="px-5 py-3 border-b border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase">{titulo}</h2>
        {extra}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Cartao({ rotulo, valor, sub, alerta }: { rotulo: string; valor: React.ReactNode; sub?: React.ReactNode; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-[var(--border)] px-4 py-3">
      <div className={`text-lg font-bold ${alerta ? "text-red-600" : "text-slate-700 dark:text-slate-200"}`}>{valor}</div>
      <div className="text-xs text-slate-400 dark:text-slate-500">{rotulo}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const LOCAL = {
  cerca: { cor: "green", rotulo: "Cerca" },
  cidade: { cor: "blue", rotulo: "Cidade" },
  rodovia: { cor: "amber", rotulo: "Rodovia" },
  desconhecido: { cor: "slate", rotulo: "?" },
} as const;
const diaSeguinte = (dia: string) => diaBRT(new Date(new Date(`${dia}T12:00:00-03:00`).getTime() + 86400000));

const GPS_DEVOLUCAO = {
  esteve: { cor: "green", texto: (m: number) => `Esteve ${minParaHM(m)}` },
  nao_parou: { cor: "red", texto: () => "Não parou no cliente" },
  sem_coordenada: { cor: "slate", texto: () => "Cliente sem coordenada" },
  sem_gps: { cor: "slate", texto: () => "Sem GPS" },
} as const;

export function PainelRota({ rotas }: { rotas: Rota[] }) {
  const { theme } = useTheme();
  const [id, setId] = useState<string | null>(null);
  const r = rotas.find(x => x.routeId === id) ?? rotas[0];
  if (!r) return <p className="m-6 text-sm text-slate-500">Nenhuma rota na planilha.</p>;

  const cores = CORES[theme === "dark" ? "dark" : "light"];
  const dadosTempo = r.tempoPorDia.map(t => ({
    dia: ddmm(t.data), rodando: t.rodandoMin, emCliente: t.emClienteMin, semCliente: t.paradoSemClienteMin,
  }));
  const chaveTotal = r.tempoPorDia.reduce((a, t) => a + (t.chaveLigadaMin ?? 0), 0);
  const marchasLentas = r.tempoPorDia.reduce((a, t) => a + t.marchasLentas, 0);
  const pulos = r.sequencia.itens.filter(i => i.foraSequencia).length;
  const suspeitas = r.devolucoes.itens.filter(d => d.gps === "nao_parou").length;
  const d = r.distancia;

  return (
    <div className="px-6 py-4 space-y-4">
      {/* ── Seletor de rota ── */}
      <div className="bg-white dark:bg-[var(--card)] rounded-2xl px-5 py-3 flex items-center gap-3 border border-slate-100 dark:border-[var(--border)]">
        <RotaIcon size={16} className="text-indigo-400" />
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          Rota
          <select value={r.routeId} onChange={e => setId(e.target.value)}
            className="text-xs font-semibold bg-transparent border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200">
            {rotas.map(x => <option key={x.routeId} value={x.routeId}>{nomeRota(x)}</option>)}
          </select>
        </label>
        <span className="text-xs text-slate-400 ml-auto font-mono">RouteId {r.routeId}</span>
      </div>

      {/* ── 1. Resumo ── */}
      <Bloco titulo="Resumo da rota">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Cartao rotulo="Período" valor={`${ddmm(r.inicio)} → ${r.fim ? ddmm(r.fim) : "aberta"}`} sub={`${r.dias.length} dia(s)`} />
          <Cartao rotulo="Clientes · notas" valor={`${r.clientes} · ${r.notas}`} />
          <Cartao rotulo="Entregue" valor={brl(r.entregue.valor)} sub={`${r.entregue.qtd} cliente(s)`} />
          <Cartao rotulo="Devolvido (problema)" valor={brl(r.devolvido.valor)} sub={`${r.devolvido.qtd} cliente(s)`} alerta={r.devolvido.qtd > 0} />
          <Cartao rotulo="Pendente" valor={brl(r.pendente.valor)} sub={`${r.pendente.qtd} cliente(s)`} />
          <Cartao rotulo="Ocupação do caminhão"
            valor={r.ocupacaoPct === null ? "—" : `${num(r.ocupacaoPct, 0, "%")}`}
            sub={`${kg(r.pesoKg)}${r.capacidadeKg ? ` de ${kg(r.capacidadeKg)}` : ""}`}
            alerta={(r.ocupacaoPct ?? 0) > 100} />
        </div>
        {(r.ocupacaoPct ?? 0) > 100 && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} /> Peso acima da capacidade cadastrada no CheckNow: excesso de carga, capacidade errada ou recarga no meio da rota.
          </p>
        )}
      </Bloco>

      {/* ── Pernoites ── */}
      <Bloco titulo="Pernoites"
        extra={r.pernoites.some(p => p.descansoCurto || p.foraDeHora.length)
          ? <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><AlertTriangle size={12} /> há noites com alerta</span>
          : undefined}>
        {r.pernoites.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-green-950 text-slate-100">
                <tr>
                  <Th>Noite</Th>
                  <Th title="Endereço do Infleet no horário em que o caminhão parou">Onde dormiu</Th>
                  <Th center>Parou</Th>
                  <Th center>Saiu</Th>
                  <Th center title={`Lei 13.103/2015: ${LIMITES.descansoMinH} h de descanso entre jornadas`}>Descanso</Th>
                  <Th center title="Do horário em que parou até desligar a chave">Chave ligada após parar</Th>
                  <Th title={`Chave ligada ou caminhão andando entre ${LIMITES.noturnoDe} e ${LIMITES.noturnoAte}`}>Fora de hora</Th>
                  <Th title="Distância em linha reta do pernoite até o 1º cliente atendido no dia seguinte">1º cliente do dia seguinte</Th>
                </tr>
              </thead>
              <tbody>
                {r.pernoites.map(p => (
                  <tr key={p.data} className="align-top">
                    <Td mono>{ddmm(p.data)} → {ddmm(diaSeguinte(p.data))}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge color={LOCAL[p.local].cor}>{p.cerca ?? LOCAL[p.local].rotulo}</Badge>
                        <span className="text-slate-700 dark:text-slate-200">{p.endereco ?? (p.cidade ? `perto de ${p.cidade}` : "—")}</span>
                        <a href={`https://www.google.com/maps?q=${p.lat},${p.lon}`} target="_blank" rel="noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">
                          mapa <ExternalLink size={10} />
                        </a>
                      </div>
                    </Td>
                    <Td center mono>{p.parou ? horaBRT(p.parou) : "—"}</Td>
                    <Td center mono>{p.saiu ? horaBRT(p.saiu) : "—"}</Td>
                    <Td center>
                      {p.descansoMin === null ? "—" : p.descansoCurto
                        ? <Badge color="red">{minParaHM(p.descansoMin)} — abaixo de {LIMITES.descansoMinH} h</Badge>
                        : <span className="font-mono">{minParaHM(p.descansoMin)}</span>}
                    </Td>
                    <Td center mono>
                      {p.chaveLigadaMin === null ? "—" : p.chaveLigadaMin > 30
                        ? <span className="text-amber-600 dark:text-amber-400 font-bold">{minParaHM(p.chaveLigadaMin)}</span>
                        : minParaHM(p.chaveLigadaMin)}
                    </Td>
                    <Td>
                      {p.foraDeHora.length
                        ? p.foraDeHora.map((e, i) => (
                          <div key={i} className="text-red-600 font-semibold" title={e.endereco ?? undefined}>
                            {horaBRT(e.em)} {e.tipo === "ignitionOn" ? "ligou a chave" : "andou"}
                          </div>))
                        : <span className="text-slate-400">—</span>}
                    </Td>
                    <Td>
                      {p.primeiroCliente
                        ? <>{p.primeiroCliente.cliente} <span className="text-slate-400">· {num(p.primeiroCliente.distKm, 1, " km")}</span></>
                        : <span className="text-slate-400">—</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-slate-400">Sem pernoite fora (rota de um dia ou sem GPS).</p>}
      </Bloco>

      {/* ── 2. Sequência ── */}
      <Bloco titulo="Sequência: planejada × real (GPS)"
        extra={<span className="text-xs text-slate-500 dark:text-slate-400">
          <b className={r.sequencia.naSequenciaPct !== null && r.sequencia.naSequenciaPct < 100 ? "text-amber-600" : "text-green-600"}>
            {num(r.sequencia.naSequenciaPct, 0, "%")} na sequência
          </b> · {pulos} pulo(s) · {r.sequencia.semParada} sem parada no GPS (fora do cálculo)
        </span>}>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Ordem real = ordem em que o caminhão <b>parou</b> em cada cliente (não a ordem das baixas). "Na sequência" = o maior trecho de visitas que respeitou a ordem planejada.
        </p>
        {r.sequencia.itens.length ? (
          <div className="overflow-auto max-h-[360px]">
            <table className="w-full text-xs">
              <thead className="bg-green-950 text-slate-100 sticky top-0">
                <tr>
                  <Th center>Ordem real</Th><Th center>Ordem planejada</Th><Th>Cliente</Th><Th center>Chegada (GPS)</Th><Th center>Sequência</Th>
                </tr>
              </thead>
              <tbody>
                {r.sequencia.itens.map(i => (
                  <tr key={i.codCliente} className={i.foraSequencia ? "bg-amber-50/60 dark:bg-amber-900/10" : ""}>
                    <Td center mono>{i.ordemReal}</Td>
                    <Td center mono>{i.ordemPlanejada}</Td>
                    <Td>{i.cliente} <span className="text-slate-400 font-mono">{i.codCliente}</span></Td>
                    <Td center mono>{ddmm(i.chegada)} {horaBRT(i.chegada)}</Td>
                    <Td center>{i.foraSequencia ? <Badge color="amber">Fora da sequência</Badge> : <Badge color="green">Na sequência</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-slate-400">Sem paradas no GPS para comparar.</p>}
      </Bloco>

      {/* ── 3. Tempo ── */}
      <Bloco titulo="Para onde foi o tempo (jornada: saída → retorno)">
        {dadosTempo.length ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Cartao rotulo="Parado com chave ligada" valor={minParaHM(chaveTotal)} sub={`${marchasLentas} "marcha lenta excessiva" na jornada — chave na ignição, não necessariamente motor`} />
              <Cartao rotulo="Tempo médio por entrega" valor={r.tempoMedioEntregaMin === null ? "—" : minParaHM(r.tempoMedioEntregaMin)} sub="parado em cliente ÷ entregas" />
              <Cartao rotulo="Entregas por hora de jornada" valor={num(r.entregasPorHora, 1)} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosTempo} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.15} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => minParaHM(Number(v))} tick={{ fontSize: 11 }} width={48} />
                  <Tooltip formatter={(v: number, nome: string) => [minParaHM(v), nome]} cursor={{ fillOpacity: 0.08 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="rodando" name="Rodando" stackId="t" fill={cores.rodando} stroke="var(--card)" strokeWidth={2} />
                  <Bar dataKey="emCliente" name="Parado em cliente" stackId="t" fill={cores.emCliente} stroke="var(--card)" strokeWidth={2} />
                  <Bar dataKey="semCliente" name="Parado sem cliente" stackId="t" fill={cores.semCliente} stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Tabela com os números (acessibilidade e leitura exata) */}
            <table className="w-full text-xs mt-3">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="text-left"><th className="py-1">Dia</th><th>Jornada</th><th>Rodando</th><th>Parado em cliente</th><th>Parado sem cliente</th><th>Chave ligada parado</th></tr>
              </thead>
              <tbody className="font-mono text-slate-700 dark:text-slate-200">
                {r.tempoPorDia.map(t => (
                  <tr key={t.data} className="border-t border-slate-100 dark:border-slate-700/40">
                    <td className="py-1">{ddmm(t.data)}</td><td>{minParaHM(t.jornadaMin)}</td><td>{minParaHM(t.rodandoMin)}</td>
                    <td>{minParaHM(t.emClienteMin)}</td><td>{minParaHM(t.paradoSemClienteMin)}</td><td>{t.chaveLigadaMin === null ? "—" : minParaHM(t.chaveLigadaMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <p className="text-xs text-slate-400">Sem GPS para medir a jornada.</p>}
      </Bloco>

      {/* ── 4. Distância ── */}
      <Bloco titulo="Distância">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Cartao rotulo="Km pelo GPS" valor={num(d.kmGps, 0, " km")} />
          <Cartao rotulo="Km informado (odômetro)" valor={num(d.kmInformado, 0, " km")} sub={d.kmInformado === null ? "rota aberta ou sem odômetro" : undefined} />
          <Cartao rotulo="Diferença GPS − informado" valor={num(d.diferencaKm, 0, " km")} sub={d.diferencaPct === null ? undefined : num(d.diferencaPct, 1, "%")}
            alerta={d.diferencaPct !== null && Math.abs(d.diferencaPct) > 10} />
          <Cartao rotulo="Km por entrega" valor={num(d.kmPorEntrega, 1, " km")} />
          <Cartao rotulo="R$ entregue por km" valor={d.reaisPorKm === null ? "—" : brl(d.reaisPorKm)} />
        </div>
      </Bloco>

      {/* ── 5. Devoluções ── */}
      <Bloco titulo="Devoluções com prova"
        extra={suspeitas > 0
          ? <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><AlertTriangle size={12} /> {suspeitas} sem o caminhão ter parado no cliente</span>
          : undefined}>
        {r.devolucoes.itens.length ? (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {r.devolucoes.porMotivo.map(m => (
                <span key={m.motivo} className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                  <b>{m.motivo}</b> · {m.qtd} · {brl(m.valor)}
                </span>
              ))}
            </div>
            <table className="w-full text-xs">
              <thead className="bg-green-950 text-slate-100">
                <tr><Th>Cliente</Th><Th>Motivo</Th><Th center>Valor</Th><Th center>Peso</Th><Th center>Baixa</Th><Th center>Caminhão no cliente?</Th></tr>
              </thead>
              <tbody>
                {r.devolucoes.itens.map(x => (
                  <tr key={x.codCliente}>
                    <Td>{x.cliente} <span className="text-slate-400 font-mono">{x.codCliente}</span></Td>
                    <Td>{x.motivo}</Td>
                    <Td center mono>{brl(x.valor)}</Td>
                    <Td center mono>{kg(x.pesoKg)}</Td>
                    <Td center mono>{x.baixaEm ? `${ddmm(x.baixaEm)} ${horaBRT(x.baixaEm)}` : "—"}</Td>
                    <Td center><Badge color={GPS_DEVOLUCAO[x.gps].cor}>{GPS_DEVOLUCAO[x.gps].texto(x.permanenciaMin)}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <p className="text-xs text-slate-400">Nenhuma devolução nesta rota.</p>}
      </Bloco>
    </div>
  );
}
