/*
 * MetricFlow — aba "Por dia new": produtividade em hL por caminhão no dia visto (spec produtividade §7).
 * Resumo do dia, cartões ordenados do menor hL/h para o maior (linha do dia em miniatura + etiquetas) e,
 * ao clicar, o detalhe: linha do dia grande, clientes (hL × min/hL), tempo fixo × por hL e min/hL por embalagem.
 */
import React, { useMemo, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { horaBRT } from "@shared/entregas";
import { MapaEntrega } from "./MapaEntrega";

type Linha = inferRouterOutputs<AppRouter>["entregas"]["processar"]["linhas"][number];
type Baixa = Linha["baixas"][number];
type Volume = Linha["volumes"][number];

const n = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : x.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || nome;
const TIPO: Record<string, string> = { retornavel: "retornável", descartavel: "descartável", barril: "barril", misto: "misto" };
const COR = {
  rodando: "fill-[#2a78d6] dark:fill-[#3987e5]",
  cliente: "fill-[#eb6834] dark:fill-[#d95926]",
  semCliente: "fill-[#1baf7a] dark:fill-[#199e70]",
  app: "fill-[#534AB7] dark:fill-[#AFA9EC]",
};

/** Ordem real de visita: chegada da parada mais próxima (GPS); sem parada, a hora da entrega no app. */
const ordemVisita = (b: Baixa) =>
  b.paradasNoRaio.length ? b.paradasNoRaio.reduce((m, p) => (p.distM < m.distM ? p : m)).inicio.getTime() : b.entrega.baixaEm?.getTime() ?? 0;
const minPorHl = (b: Baixa, v: Volume) => (v && v.hl > 0 && b.status === "no_raio" && b.permanenciaMin > 0 ? b.permanenciaMin / v.hl : null);

/** Linha do dia: rodando entre saída e retorno, paradas no cliente / sem cliente e, no tamanho grande, os registros no app. */
function Trilho({ l, grande }: { l: Linha; grande?: boolean }) {
  const dia = l.linha.data;
  const t0 = Math.min(new Date(`${dia}T05:00:00-03:00`).getTime(), l.saida?.getTime() ?? Infinity);
  const t1 = Math.max(new Date(`${dia}T20:00:00-03:00`).getTime(), l.retorno?.getTime() ?? 0);
  const x = (d: Date) => ((d.getTime() - t0) / (t1 - t0)) * 100;
  const h = grande ? 22 : 14, meio = grande ? 13 : 7;
  const horas = grande ? Array.from({ length: Math.floor((t1 - t0) / 3_600_000) + 1 }, (_, i) => new Date(t0 + i * 3_600_000)).filter(d => d.getUTCMinutes() === 0 && Number(horaBRT(d).slice(0, 2)) % 3 === 0) : [];
  return (
    <div>
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }} role="img"
      aria-label={`Linha do dia ${l.linha.placa}: saída ${l.saida ? horaBRT(l.saida) : "—"}, retorno ${l.retorno ? horaBRT(l.retorno) : "—"}`}>
      <rect x="0" y={meio - 1} width="100" height="2" className="fill-slate-100 dark:fill-slate-700" />
      {l.saida && (
        <rect x={x(l.saida)} y={meio - 3} width={Math.max(0.3, x(l.retorno ?? new Date(Math.min(Date.now(), t1))) - x(l.saida))} height="6" rx="1" className={COR.rodando}>
          <title>Rodando: {horaBRT(l.saida)} → {l.retorno ? horaBRT(l.retorno) : "em rota"}</title>
        </rect>
      )}
      {l.trilho.map((p, i) => (
        <rect key={i} x={x(p.inicio)} y={meio - 5} width={Math.max(0.4, x(p.fim) - x(p.inicio))} height="10" rx="1" className={p.noCliente ? COR.cliente : COR.semCliente}>
          <title>{p.noCliente ? "Parado no cliente" : "Parado fora de cliente"}: {horaBRT(p.inicio)}–{horaBRT(p.fim)}</title>
        </rect>
      ))}
      {grande && l.baixas.filter(b => b.entrega.baixaEm).map((b, i) => (
        <rect key={`a${i}`} x={x(b.entrega.baixaEm!) - 0.15} y={0} width="0.3" height="5" className={COR.app}>
          <title>Entrega no app {horaBRT(b.entrega.baixaEm!)} — {b.entrega.cliente}</title>
        </rect>
      ))}
    </svg>
    {!!horas.length && (
      <div className="relative h-4 text-[10px] text-slate-400">
        {horas.map(d => <span key={d.getTime()} className="absolute -translate-x-1/2" style={{ left: `${x(d)}%` }}>{horaBRT(d).slice(0, 2)}h</span>)}
      </div>
    )}
    </div>
  );
}

/** Pontos (hL × minutos de descarga) com a reta tempo = fixo + por hL × hL. */
function Dispersao({ pontos, reta }: { pontos: { hl: number; min: number }[]; reta: Linha["produtividade"]["reta"] }) {
  const W = 260, H = 140, P = 26;
  const maxX = Math.max(1, ...pontos.map(p => p.hl)) * 1.1, maxY = Math.max(10, ...pontos.map(p => p.min)) * 1.1;
  const sx = (v: number) => P + (v / maxX) * (W - P - 8), sy = (v: number) => H - P - (v / maxY) * (H - P - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[320px]" role="img" aria-label="Minutos de descarga por hL entregue, com a reta ajustada">
      <line x1={P} y1={H - P} x2={W - 4} y2={H - P} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.5" />
      <line x1={P} y1={6} x2={P} y2={H - P} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.5" />
      {reta && <line x1={sx(0)} y1={sy(reta.fixoMin)} x2={sx(maxX)} y2={sy(reta.fixoMin + reta.minPorHl * maxX)} className="stroke-[#2a78d6] dark:stroke-[#3987e5]" strokeWidth="2" />}
      {pontos.map((p, i) => <circle key={i} cx={sx(p.hl)} cy={sy(p.min)} r="3.5" className="fill-[#eb6834] dark:fill-[#d95926]"><title>{n(p.hl, 2)} hL · {Math.round(p.min)} min</title></circle>)}
      <text x={W - 4} y={H - 8} textAnchor="end" className="fill-slate-400" style={{ fontSize: 10 }}>hL entregue</text>
      <text x={P + 4} y={14} className="fill-slate-400" style={{ fontSize: 10 }}>min</text>
    </svg>
  );
}

function Detalhe({ l, raioM }: { l: Linha; raioM: number }) {
  const [mapa, setMapa] = useState<number | null>(null);
  const p = l.produtividade;
  const itens = l.baixas.map((b, i) => ({ b, v: l.volumes[i], mph: minPorHl(b, l.volumes[i]) })).sort((x, y) => ordemVisita(x.b) - ordemVisita(y.b));
  const valores = itens.flatMap(i => (i.mph === null ? [] : [i.mph])).sort((a, b) => a - b);
  const mediana = valores.length ? valores[Math.floor(valores.length / 2)] : null;
  const maxHl = Math.max(0.01, ...itens.map(i => i.v?.hl ?? 0));
  const cor = (m: number | null) => (m === null || mediana === null ? "bg-slate-300 dark:bg-slate-600" : m <= mediana ? "bg-green-500" : m <= 2 * mediana ? "bg-amber-500" : "bg-red-500");
  const pontos = itens.flatMap(i => (i.mph === null ? [] : [{ hl: i.v!.hl, min: i.b.permanenciaMin }]));

  return (
    <div className="col-span-full bg-white dark:bg-[var(--card)] rounded-2xl border border-indigo-200 dark:border-indigo-800 p-4 flex flex-col gap-4">
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Linha do dia — traços em cima: entrega registrada no app</div>
        <Trilho l={l} grande />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Clientes na ordem da visita — barra = hL entregue · cor = min/hL (verde até a mediana do dia, âmbar até 2×, vermelho acima)</div>
          <div className="flex flex-col gap-1">
            {itens.map(({ b, v, mph }, i) => (
              <React.Fragment key={i}>
                <div className="grid grid-cols-[150px_minmax(0,1fr)_150px] items-center gap-2 text-xs">
                  <button onClick={() => setMapa(m => (m === i ? null : i))} title={`${b.entrega.cliente} — clique para ver no mapa`}
                    className="flex items-center gap-1 text-left text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                    {mapa === i ? <ChevronDown size={12} /> : <MapPin size={12} />} {primeiroNome(b.entrega.cliente)}
                  </button>
                  <div className="h-2.5 rounded bg-slate-100 dark:bg-slate-800">
                    <div className={`h-2.5 rounded ${cor(mph)}`} style={{ width: `${((v?.hl ?? 0) / maxHl) * 100}%` }} />
                  </div>
                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                    {!v?.casou ? "sem pedido no ERP" : `${n(v.hl, 2)} hL${mph !== null ? ` · ${n(mph)} min/hL` : ""}${v.dev ? ` · dev ${n(v.dev, 2)}` : ""}`}
                  </span>
                </div>
                {mapa === i && <MapaEntrega b={b} raioM={raioM} />}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tempo fixo × tempo por hL</div>
            <Dispersao pontos={pontos} reta={p.reta} />
            <div className="text-xs text-slate-700 dark:text-slate-200">
              {p.reta ? <>Fixo <b>{n(p.reta.fixoMin)} min</b> por parada · <b>{n(p.reta.minPorHl)} min</b> por hL</> : "Poucas entregas para calcular (precisa de 6 com volumes diferentes)."}
            </div>
            <div className="text-[11px] text-slate-400">
              {p.reta4s ? `4 semanas (${p.reta4s.dias} dia${p.reta4s.dias > 1 ? "s" : ""} já abertos): fixo ${n(p.reta4s.fixoMin)} min · ${n(p.reta4s.minPorHl)} min por hL` : "4 semanas: ainda sem dias suficientes abertos."}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">min/hL por embalagem</div>
            <div className="flex flex-wrap gap-2">
              {p.porTipo.length ? p.porTipo.map(t => (
                <span key={t.tipo} className="text-xs px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {TIPO[t.tipo] ?? t.tipo} <b className="text-slate-800 dark:text-slate-100">{n(t.minPorHl)}</b> <span className="text-slate-400">({n(t.hl, 1)} hL)</span>
                </span>
              )) : <span className="text-xs text-slate-400">Sem entregas com descarga e volume.</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cartao({ l, aberto, onClick }: { l: Linha; aberto: boolean; onClick: () => void }) {
  const p = l.produtividade;
  return (
    <button onClick={onClick} aria-expanded={aberto}
      className={`text-left bg-white dark:bg-[var(--card)] rounded-2xl border p-4 flex flex-col gap-2 transition-shadow hover:shadow-md ${aberto ? "border-indigo-400 ring-2 ring-indigo-300 dark:ring-indigo-700" : "border-slate-100 dark:border-[var(--border)]"}`}>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{l.linha.placa} · {l.linha.motorista}</div>
          <div className="text-xs text-slate-400 truncate">{l.cidades.join(" · ") || "—"}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none">{n(p.hlPorHora)}</div>
          <div className="text-[11px] text-slate-400" title={p.incompleto ? `${p.semVolume} entrega(s) sem pedido no ERP: o hL/h fica abaixo do real` : undefined}>
            hL/h{p.parcial ? " · parcial" : ""}{p.incompleto ? " · incompleto" : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span><b className="text-slate-800 dark:text-slate-100">{p.hl || p.hlPorHora !== null ? n(p.hl) : "—"}</b> hL</span>
        <span><b className={p.dev ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}>{n(p.dev)}</b> hL dev.</span>
        <span><b className="text-slate-800 dark:text-slate-100">{n(p.hlPorKm, 2)}</b> hL/km</span>
        <span><b className="text-slate-800 dark:text-slate-100">{n(p.hlPorParada, 2)}</b> hL/parada</span>
        <span title="Entregues no dia / clientes que ainda faltavam no início do dia">{l.entregasDia}/{l.aEntregar} entregas</span>
      </div>
      <Trilho l={l} />
      {!!p.etiquetas.length && (
        <div className="flex flex-wrap gap-1.5">
          {p.etiquetas.map((e, i) => (
            <span key={i} className={`text-[11px] px-2 py-0.5 rounded-lg ${e.nivel === "alerta" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"}`}>{e.texto}</span>
          ))}
        </div>
      )}
    </button>
  );
}

export function PainelDiaNew({ linhas, raioM }: { linhas: Linha[]; raioM: number }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const chave = (l: Linha) => `${l.linha.routeId}|${l.linha.data}`;
  // Do menor hL/h para o maior; incompletos (entregas sem pedido no ERP) e sem hL/h vão para o fim.
  const ordenadas = useMemo(() => [...linhas].sort((a, b) =>
    Number(a.produtividade.incompleto) - Number(b.produtividade.incompleto)
    || (a.produtividade.hlPorHora ?? Infinity) - (b.produtividade.hlPorHora ?? Infinity)), [linhas]);

  const resumo = useMemo(() => {
    const ps = linhas.map(l => l.produtividade);
    const hl = ps.reduce((s, p) => s + p.hl, 0), dev = ps.reduce((s, p) => s + p.dev, 0);
    const comHora = ps.filter(p => p.hlPorHora);
    const horas = comHora.reduce((s, p) => s + p.hl / p.hlPorHora!, 0);
    const paradas = ps.filter(p => p.hlPorParada).reduce((s, p) => s + p.hl / p.hlPorParada!, 0);
    return {
      hl, hlPorHora: horas ? comHora.reduce((s, p) => s + p.hl, 0) / horas : null,
      devPct: hl + dev ? (dev / (hl + dev)) * 100 : null, hlPorParada: paradas ? hl / paradas : null,
    };
  }, [linhas]);

  const cartaoResumo = (rotulo: string, valor: string, destaque?: boolean) => (
    <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] px-4 py-3">
      <div className="text-xs text-slate-400">{rotulo}</div>
      <div className={`text-2xl font-bold ${destaque ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>{valor}</div>
    </div>
  );
  const legenda = (cls: string, texto: string) => (
    <span className="flex items-center gap-1"><svg width="10" height="10"><rect width="10" height="10" rx="2" className={cls} /></svg>{texto}</span>
  );

  return (
    <div className="px-6 py-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cartaoResumo("hL entregues", n(resumo.hl))}
        {cartaoResumo("hL/h (jornada)", n(resumo.hlPorHora))}
        {cartaoResumo("devolução", resumo.devPct === null ? "—" : `${n(resumo.devPct)}%`, (resumo.devPct ?? 0) > 10)}
        {cartaoResumo("hL por parada", n(resumo.hlPorParada, 2))}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        {legenda(COR.rodando, "rodando")}{legenda(COR.cliente, "parado no cliente")}{legenda(COR.semCliente, "parado fora de cliente")}{legenda(COR.app, "entrega no app")}
        <span className="ml-auto">Do menor hL/h para o maior · clique no cartão para o detalhe</span>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {ordenadas.map(l => (
          <React.Fragment key={chave(l)}>
            <Cartao l={l} aberto={aberto === chave(l)} onClick={() => setAberto(a => (a === chave(l) ? null : chave(l)))} />
            {aberto === chave(l) && <Detalhe l={l} raioM={raioM} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
