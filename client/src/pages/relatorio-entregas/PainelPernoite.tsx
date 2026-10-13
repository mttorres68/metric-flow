/*
 * MetricFlow — aba "Pernoite" (spec pernoite §8): onde cada caminhão dormiu, se o pernoite era evitável
 * ("na malícia": fora da Sede, perto, dava para chegar e voltou de manhã) e os sinais de "cozinhando o galo".
 * Cartões do período, resumo por motorista, mapa das noites fora da Sede, lista das noites (faixa colorida pela
 * classificação) e o detalhe com os sinais em dois blocos. A cor carrega o significado; zero e "não aconteceu" recuam.
 */
import React, { useMemo, useState } from "react";
import { BedDouble, Check, Flag, Loader2, RefreshCw, Truck, X } from "lucide-react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { CONFIG_ENTREGAS_PADRAO, diaBRT, horaBRT } from "@shared/entregas";
import { MapaLeaflet, type LinhaMapa, type PontoMapa } from "@/components/MapaLeaflet";
import { distM } from "./MapaEntrega";

type Noite = inferRouterOutputs<AppRouter>["pernoite"]["listar"][number];
type Sinal = { ok: boolean; motivo?: string; [k: string]: unknown };
// rotaConcluida é opcional: noites gravadas antes desse sinal não o têm até serem recalculadas.
type Sinais = Record<"foraDaSede" | "perto" | "davaParaChegar" | "voltou" | "finalLento" | "parouCedo" | "ociosidade" | "paraTras", Sinal> & { rotaConcluida?: Sinal };

/** Cor por classificação: faixa da linha, selo (sólido nos casos graves, discreto nos demais) e ponto do mapa. */
const CLASSE: Record<string, { texto: string; cor: string; letra: string; chip: string; faixa: string }> = {
  na_malicia: { texto: "na malícia", cor: "#E24B4A", letra: "M", faixa: "border-l-red-500", chip: "bg-red-600 text-white" },
  evitavel: { texto: "evitável", cor: "#BA7517", letra: "E", faixa: "border-l-amber-500", chip: "bg-amber-500 text-white" },
  sem_sinal: { texto: "sem sinal GPS", cor: "#7F77DD", letra: "!", faixa: "border-l-violet-500", chip: "bg-violet-600 text-white" },
  na_base: { texto: "na Sede", cor: "#888780", letra: "S", faixa: "border-l-emerald-400", chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800" },
  normal: { texto: "normal", cor: "#888780", letra: "N", faixa: "border-l-slate-200 dark:border-l-slate-700", chip: "bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400" },
  sem_parada: { texto: "rodando às 02h", cor: "#888780", letra: "?", faixa: "border-l-slate-300 dark:border-l-slate-600", chip: "bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400" },
};
const PESO: Record<string, number> = { na_malicia: 3, evitavel: 2, normal: 1 };
const GALO: { chave: keyof Sinais; texto: string }[] = [
  { chave: "finalLento", texto: "final lento" }, { chave: "parouCedo", texto: "parou cedo" },
  { chave: "ociosidade", texto: "ocioso no fim" }, { chave: "paraTras", texto: "cliente para trás" },
];
/** Tons dos números que pedem atenção (texto e selo); zero fica apagado. */
const TOM = {
  red: { num: "text-red-600 dark:text-red-400", selo: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", barra: "bg-red-500" },
  amber: { num: "text-amber-600 dark:text-amber-400", selo: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", barra: "bg-amber-500" },
  violet: { num: "text-violet-600 dark:text-violet-400", selo: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", barra: "bg-violet-500" },
  orange: { num: "text-orange-600 dark:text-orange-400", selo: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", barra: "bg-orange-500" },
  indigo: { num: "text-indigo-600 dark:text-indigo-400", selo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", barra: "bg-indigo-500" },
} as const;
type Tom = keyof typeof TOM;
const APAGADO = "text-slate-300 dark:text-slate-600";

const DIA_MS = 86_400_000;
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const fmtDia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const diaSemana = (d: string) => SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()];
const hora = (d: Date | null) => (d ? horaBRT(d) : "—");
const km = (x: number | null) => (x === null ? "—" : `${x.toFixed(0)} km`);
const duracao = (min: number) => (min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`);
const fora = (n: Noite) => n.classificacao !== "na_base" && n.classificacao !== "sem_parada" && n.lat !== null && n.lon !== null;
const sinaisDe = (n: Noite) => n.sinais as Sinais;

/** Números em negrito ("~21:35", "134 km", "2h38") para o olho achar o que mede o sinal. */
function destacar(texto: string): React.ReactNode {
  return texto.split(/(~?\d+(?:[:,.h]\d+)*(?:\s?(?:km|min))?)/g).map((p, i) => (i % 2 ? <b key={i} className="font-bold">{p}</b> : p));
}

/** Uma frase por sinal, com os números que levaram a ele; `galo` separa os dois blocos do detalhe. */
function frases(n: Noite): { ok: boolean; texto: string; galo?: boolean }[] {
  const s = sinaisDe(n);
  const v = (x: Sinal, k: string) => x[k] as string;
  const dc = s.davaParaChegar, pt = s.paraTras;
  return [
    { ok: s.perto.ok, texto: `Dormiu a ${km(n.distSedeKm)} da Sede pela estrada (estimado; limite ${v(s.perto, "limiteKm")} km)` },
    { ok: dc.ok, texto: dc.estimada
      ? `Saiu do último cliente às ${v(dc, "saiuDoUltimo")}; chegaria na Sede ~${v(dc, "estimada")} (${dc.ok ? "antes" : "depois"} das ${v(dc, "limite")})`
      : `Dava para chegar: ${dc.motivo ?? "sem dado"}` },
    { ok: s.voltou.ok, texto: s.voltou.ok ? `De manhã ${v(s.voltou, "como")} às ${v(s.voltou, "as")}` : "De manhã não voltou para a Sede (seguiu viagem)" },
    ...(s.rotaConcluida && s.rotaConcluida.pendentes !== undefined ? [{ ok: s.rotaConcluida.ok, texto: s.rotaConcluida.ok
      ? "Rota concluída: todas as entregas já estavam feitas quando parou — só faltava voltar"
      : `Rota não concluída: ${v(s.rotaConcluida, "pendentes")} cliente(s) ainda pendente(s) ao parar` }] : []),
    { galo: true, ok: s.finalLento.ok, texto: s.finalLento.finalMin !== undefined
      ? `Ritmo das 3 últimas entregas: ${v(s.finalLento, "finalMin")} min contra ${v(s.finalLento, "diaMin")} típico no dia`
      : `Final lento: ${s.finalLento.motivo}` },
    { galo: true, ok: s.parouCedo.ok, texto: `Parou de vez às ${v(s.parouCedo, "chegada")} (${s.parouCedo.ok ? "antes" : "depois"} das ${v(s.parouCedo, "limite")})` },
    { galo: true, ok: s.ociosidade.ok, texto: `${v(s.ociosidade, "min")} min parado fora de cliente nas 2 h antes de parar (sinal a partir de 30)` },
    { galo: true, ok: pt.ok, texto: pt.clientes !== undefined
      ? `${pt.clientes} cliente(s) pendente(s) a até 20 km do último, com ${duracao(Math.max(0, Number(pt.folgaMin)))} de folga até ${dc.limite ?? "o limite"}`
      : `Cliente para trás: ${pt.motivo}` },
  ];
}

function BlocoSinais({ titulo, tom, itens }: { titulo: string; tom: Tom; itens: { ok: boolean; texto: string }[] }) {
  const aconteceram = itens.filter(f => f.ok).length;
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{titulo}</h4>
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${aconteceram ? TOM[tom].selo : "bg-slate-100 text-slate-400 dark:bg-slate-700/50 dark:text-slate-500"}`}>
          {aconteceram} de {itens.length}
        </span>
      </div>
      {/* O que aconteceu primeiro e em destaque; o que não aconteceu recua. */}
      {[...itens].sort((a, b) => Number(b.ok) - Number(a.ok)).map((f, i) => f.ok ? (
        <div key={i} className="flex items-start gap-2 text-[13px] leading-snug text-slate-800 dark:text-slate-100">
          <Check size={15} strokeWidth={3} className={`mt-0.5 shrink-0 ${TOM[tom].num}`} /><span>{destacar(f.texto)}</span>
        </div>
      ) : (
        <div key={i} className="flex items-start gap-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
          <X size={12} className="mt-0.5 shrink-0 text-slate-300 dark:text-slate-600" /><span>{f.texto}</span>
        </div>
      ))}
    </section>
  );
}

function Detalhe({ n, sede, onRecalcular, recalculando }: {
  n: Noite; sede: { lat: number; lon: number } | null; onRecalcular: () => void; recalculando: boolean;
}) {
  const ultimo = sinaisDe(n).davaParaChegar.ultimo as { lat: number; lon: number } | null | undefined;
  const { pontos, linhas } = useMemo(() => {
    const pontos: PontoMapa[] = [];
    const linhas: LinhaMapa[] = [];
    if (ultimo) pontos.push({ lat: ultimo.lat, lon: ultimo.lon, cor: "#475569", letra: "C", titulo: "Último cliente", info: `Saiu às ${hora(n.ultimoClienteSaida)}` });
    if (n.lat !== null && n.lon !== null) {
      const c = CLASSE[n.classificacao];
      pontos.push({ lat: n.lat, lon: n.lon, cor: c.cor, letra: c.letra, titulo: "Onde dormiu", info: `${hora(n.chegada)} → ${hora(n.saidaManha)}${n.cidade ? ` · ${n.cidade}` : ""}` });
      if (sede) linhas.push({ de: [n.lat, n.lon], ate: [sede.lat, sede.lon], cor: c.cor, rotulo: km(n.distSedeKm) });
    }
    if (sede) pontos.push({ lat: sede.lat, lon: sede.lon, cor: "#4f46e5", letra: "S", titulo: "Sede" });
    return { pontos, linhas };
  }, [n, sede, ultimo]);
  const fs = frases(n);
  const especial = n.classificacao === "sem_sinal"
    ? "O rastreador não mandou nenhuma posição do dia até as 12:00 do dia seguinte, com rota no CheckNow: não dá para saber onde o caminhão rodou nem onde dormiu. Confira se o rastreador foi desligado ou desconectado."
    : n.classificacao === "na_base" || n.classificacao === "sem_parada"
    ? `Sinais não se aplicam: ${sinaisDe(n).perto.motivo ?? CLASSE[n.classificacao].texto}.` : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5 bg-slate-50 dark:bg-slate-800/40">
      <div className="flex flex-col gap-4">
        {especial ? (
          <p className={`text-[13px] leading-snug ${n.classificacao === "sem_sinal" ? "text-violet-700 dark:text-violet-300 font-medium" : "text-slate-500 dark:text-slate-400"}`}>{especial}</p>
        ) : (
          <>
            <BlocoSinais titulo="Pernoite evitável?" tom="red" itens={fs.filter(f => !f.galo)} />
            <BlocoSinais titulo="Cozinhando o galo" tom="orange" itens={fs.filter(f => f.galo)} />
          </>
        )}
        <div className="text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-2">
          Descanso de {n.descansoMin === null ? "—" : duracao(n.descansoMin)}
          {n.chaveLigadaMin !== null && ` · chave desligada ${duracao(n.chaveLigadaMin)} depois de parar`}
          {n.madrugadaEventos > 0 && ` · ${n.madrugadaEventos} movimento(s)/ignição de madrugada`}
          {n.endereco && ` · ${n.endereco}`}
        </div>
        <button type="button" onClick={onRecalcular} disabled={recalculando}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700/50 disabled:opacity-50">
          {recalculando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Recalcular esta noite
        </button>
      </div>
      {pontos.length ? <MapaLeaflet pontos={pontos} linhas={linhas} altura={300} /> : <p className="text-xs text-slate-400">Sem coordenadas para o mapa.</p>}
    </div>
  );
}

/** Número que só ganha cor quando é maior que zero. */
function Contagem({ valor, tom }: { valor: number; tom: Tom }) {
  return valor
    ? <span className={`inline-flex min-w-[1.75rem] justify-center px-2 py-0.5 rounded-full text-xs font-bold ${TOM[tom].selo}`}>{valor}</span>
    : <span className={`text-xs ${APAGADO}`}>0</span>;
}

function Cartao({ rotulo, valor, tom, ajuda }: { rotulo: string; valor: number; tom: Tom; ajuda?: string }) {
  return (
    <div title={ajuda} className="relative overflow-hidden bg-white dark:bg-[var(--card)] rounded-xl border border-slate-100 dark:border-[var(--border)] px-4 py-3">
      {valor > 0 && <span className={`absolute inset-x-0 top-0 h-1 ${TOM[tom].barra}`} />}
      <div className="text-xs text-slate-500 dark:text-slate-400">{rotulo}</div>
      <div className={`text-3xl font-bold tabular-nums ${valor ? TOM[tom].num : APAGADO}`}>{valor}</div>
    </div>
  );
}

function Filtro({ ativo, onClick, tom, children }: { ativo: boolean; onClick: () => void; tom: Tom; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${ativo ? TOM[tom].selo : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}>
      {children}
    </button>
  );
}

export function PainelPernoite({ revendaId }: { revendaId: number }) {
  const [dias, setDias] = useState(30);
  const ontem = somaDias(diaBRT(new Date()), -1);
  const periodo = { revendaId, de: somaDias(ontem, -(dias - 1)), ate: ontem };
  const utils = trpc.useUtils();
  const noitesQ = trpc.pernoite.listar.useQuery(periodo);
  const resumoQ = trpc.pernoite.resumo.useQuery(periodo);
  const sedeQ = trpc.pernoite.sede.useQuery({ revendaId }, { staleTime: Infinity });
  const cfg = trpc.config.getEntregasConfig.useQuery().data ?? CONFIG_ENTREGAS_PADRAO;
  const recalcular = trpc.pernoite.recalcular.useMutation({
    onSuccess: () => { utils.pernoite.listar.invalidate(); utils.pernoite.resumo.invalidate(); toast.success("Noite recalculada."); },
    onError: e => toast.error(e.message),
  });
  const [motorista, setMotorista] = useState<string | null>(null);
  const [soEvitaveis, setSoEvitaveis] = useState(false);
  const [soGalo, setSoGalo] = useState(false);
  const [soSemSinal, setSoSemSinal] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);

  const noites = noitesQ.data ?? [];
  const resumo = resumoQ.data ?? [];
  const filtradas = useMemo(() => (noitesQ.data ?? []).filter(n => (!motorista || n.motorista === motorista)
    && (!soEvitaveis || n.classificacao === "na_malicia" || n.classificacao === "evitavel") && (!soGalo || n.galo >= 2)
    && (!soSemSinal || n.classificacao === "sem_sinal")),
  [noitesQ.data, motorista, soEvitaveis, soGalo, soSemSinal]);
  const sede = sedeQ.data?.centro ?? null;
  const circulo = useMemo(() => (sede ? { lat: sede.lat, lon: sede.lon, raioM: (cfg.pernoiteMaxKm / cfg.pernoiteFatorEstrada) * 1000, cor: "#4f46e5" } : undefined),
    [sede, cfg.pernoiteMaxKm, cfg.pernoiteFatorEstrada]);
  const total = (k: "noitesFora" | "naMalicia" | "evitavel" | "semSinal" | "comGalo") => resumo.reduce((s, r) => s + r[k], 0);
  const maxFora = Math.max(1, ...resumo.map(r => r.noitesFora));

  // Noites fora da Sede no mesmo lugar (< 300 m) viram um ponto só, com o número de noites e a cor da pior.
  const pontosMapa = useMemo(() => {
    const grupos: { lat: number; lon: number; ns: Noite[] }[] = [];
    for (const n of filtradas.filter(fora)) {
      const g = grupos.find(x => distM(x.lat, x.lon, n.lat!, n.lon!) < 300);
      if (g) g.ns.push(n); else grupos.push({ lat: n.lat!, lon: n.lon!, ns: [n] });
    }
    const pontos: PontoMapa[] = grupos.map(g => {
      const pior = g.ns.reduce((a, b) => ((PESO[b.classificacao] ?? 0) > (PESO[a.classificacao] ?? 0) ? b : a));
      const c = CLASSE[pior.classificacao];
      return {
        lat: g.lat, lon: g.lon, cor: c.cor, letra: g.ns.length > 1 ? String(g.ns.length) : c.letra,
        titulo: `${pior.cidade ?? "?"} · ${km(pior.distSedeKm)} da Sede`,
        info: g.ns.map(n => `${fmtDia(n.dia)} ${n.placa} · ${n.motorista} (${CLASSE[n.classificacao].texto})`).join("\n"),
      };
    });
    if (sede) pontos.push({ lat: sede.lat, lon: sede.lon, cor: "#4f46e5", letra: "S", titulo: "Sede" });
    return pontos;
  }, [filtradas, sede]);

  const caixa = "bg-white dark:bg-[var(--card)] rounded-2xl border border-slate-100 dark:border-[var(--border)]";
  const th = "px-3 py-2 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide";
  const td = "px-3 py-2.5 text-xs";

  if (noitesQ.isLoading) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin mr-2" /> Carregando as noites…</div>;
  }

  return (
    <div className="px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-[var(--card)]">
          {[7, 14, 30].map(d => (
            <button key={d} type="button" aria-pressed={dias === d} onClick={() => setDias(d)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${dias === d ? "bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}>
              {d} dias
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {fmtDia(periodo.de)} a {fmtDia(periodo.ate)} · <b className="text-slate-700 dark:text-slate-200">"na malícia"</b> = fora da Sede, até {cfg.pernoiteMaxKm} km, dava para chegar até {cfg.pernoiteChegarAte} e voltou de manhã
        </span>
        {!sedeQ.isLoading && !sedeQ.data && <span className="text-xs font-semibold text-red-600">Cerca "Sede" não encontrada no Infleet desta revenda.</span>}
      </div>

      {!noites.length ? (
        <div className="flex items-center justify-center p-12 rounded-xl border-2 border-dashed border-slate-200 dark:border-[var(--border)] text-sm text-slate-500 dark:text-slate-400">
          Nenhuma noite analisada no período. Reprocesse no ⚙ › Limites › Pernoite.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Cartao rotulo="Noites fora da Sede" valor={total("noitesFora")} tom="indigo" />
            <Cartao rotulo="Na malícia" valor={total("naMalicia")} tom="red" ajuda="Fora da Sede, perto, dava para chegar e voltou de manhã" />
            <Cartao rotulo="Evitáveis" valor={total("evitavel")} tom="amber" ajuda="Perto e dava para chegar, mas não voltou de manhã" />
            <Cartao rotulo="Sem sinal GPS" valor={total("semSinal")} tom="violet" ajuda="Rota no CheckNow e o rastreador sem nenhuma posição" />
            <Cartao rotulo="Galo (2+ sinais)" valor={total("comGalo")} tom="orange" ajuda="Noites com 2 ou mais sinais de cozinhando o galo" />
          </div>

          <div className={`${caixa} overflow-x-auto`}>
            <table className="w-full">
              <thead><tr>
                <th className={th}>Motorista</th><th className={th}>Noites fora</th><th className={th}>Na malícia</th>
                <th className={th}>Evitável</th><th className={th} title="Noites com 2 ou mais sinais de cozinhando o galo">Galo (2+ sinais)</th>
                <th className={th} title="Dias com rota no CheckNow e o rastreador sem nenhuma posição">Sem sinal GPS</th><th className={th}>Onde mais dorme</th>
              </tr></thead>
              <tbody>
                {resumo.map(r => (
                  <tr key={r.motorista} onClick={() => setMotorista(m => (m === r.motorista ? null : r.motorista))}
                    className={`cursor-pointer border-t border-slate-100 dark:border-[var(--border)] ${motorista === r.motorista ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                    <td className={`${td} font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap`}>{r.motorista}</td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <span className={`w-5 text-right font-semibold tabular-nums ${r.noitesFora ? "text-slate-800 dark:text-slate-100" : APAGADO}`}>{r.noitesFora}</span>
                        <span className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                          <span className="block h-full rounded-full bg-indigo-400" style={{ width: `${(r.noitesFora / maxFora) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className={td}><Contagem valor={r.naMalicia} tom="red" /></td>
                    <td className={td}><Contagem valor={r.evitavel} tom="amber" /></td>
                    <td className={td}><Contagem valor={r.comGalo} tom="orange" /></td>
                    <td className={td}><Contagem valor={r.semSinal} tom="violet" /></td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {r.lugares.map(l => (
                          <span key={l.cidade} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-[11px] text-slate-600 dark:text-slate-300">
                            {l.cidade} <b className="text-slate-800 dark:text-slate-100">{l.noites}</b>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pontosMapa.length > (sede ? 1 : 0) && (
            <div className={`${caixa} overflow-hidden`}>
              <MapaLeaflet pontos={pontosMapa} altura={360} circulo={circulo} />
              <div className="flex flex-wrap items-center gap-4 px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                {(["na_malicia", "evitavel", "normal"] as const).map(k => (
                  <span key={k} className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                    <span style={{ background: CLASSE[k].cor }} className="w-3 h-3 rounded-full inline-block" />{CLASSE[k].letra} = {CLASSE[k].texto}
                  </span>
                ))}
                <span>número = noites no mesmo lugar · círculo = {cfg.pernoiteMaxKm} km de estrada em volta da Sede</span>
              </div>
            </div>
          )}

          <div className={`${caixa} overflow-x-auto`}>
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
              {motorista && (
                <button type="button" onClick={() => setMotorista(null)} className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-semibold">
                  {motorista} ✕
                </button>
              )}
              <Filtro ativo={soEvitaveis} onClick={() => setSoEvitaveis(x => !x)} tom="red">na malícia / evitável</Filtro>
              <Filtro ativo={soGalo} onClick={() => setSoGalo(x => !x)} tom="orange">com galo (2+ sinais)</Filtro>
              <Filtro ativo={soSemSinal} onClick={() => setSoSemSinal(x => !x)} tom="violet">sem sinal GPS</Filtro>
              <span className="ml-auto text-slate-400">{filtradas.length} noites · clique para o detalhe</span>
            </div>
            <table className="w-full">
              <thead><tr>
                <th className={th}>Data</th><th className={th}>Caminhão</th><th className={th}>Motorista</th><th className={th}>Onde dormiu</th>
                <th className={th}>Da Sede</th><th className={th} title="Saída do último cliente → parou para dormir → saiu de manhã">Último cliente → parou → saiu</th>
                <th className={th}>Pernoite</th><th className={th}>Sinais</th>
              </tr></thead>
              <tbody>
                {filtradas.map(n => {
                  const c = CLASSE[n.classificacao];
                  const s = sinaisDe(n);
                  const perto = n.classificacao !== "na_base" && n.distSedeKm !== null && n.distSedeKm <= cfg.pernoiteMaxKm;
                  return (
                    <React.Fragment key={n.id}>
                      <tr onClick={() => setAberta(a => (a === n.id ? null : n.id))}
                        className={`cursor-pointer border-t border-slate-100 dark:border-[var(--border)] ${aberta === n.id ? "bg-slate-50 dark:bg-slate-800/40" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                        <td className={`${td} border-l-4 ${c.faixa} whitespace-nowrap`}>
                          <span className="text-[10px] uppercase text-slate-400 mr-1.5">{diaSemana(n.dia)}</span>
                          <b className="text-slate-800 dark:text-slate-100">{fmtDia(n.dia)}</b>
                        </td>
                        <td className={td}>
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-mono text-[11px] font-semibold">{n.placa}</span>
                        </td>
                        <td className={`${td} font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap`}>{n.motorista}</td>
                        <td className={`${td} text-slate-500 dark:text-slate-400`}>{n.cidade ?? "—"}</td>
                        <td className={`${td} whitespace-nowrap tabular-nums ${perto ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-300"}`}>
                          {n.distSedeKm === null || n.classificacao === "na_base" ? "—" : km(n.distSedeKm)}
                        </td>
                        <td className={`${td} whitespace-nowrap font-mono text-slate-600 dark:text-slate-300`}>
                          <span className="inline-flex items-center gap-1" title="Saída do último cliente"><Flag size={11} className="text-slate-400" />{hora(n.ultimoClienteSaida)}</span>
                          <span className="mx-1.5 text-slate-300">→</span>
                          <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-100" title="Parou para dormir"><BedDouble size={12} className="text-indigo-500" />{hora(n.chegada)}</span>
                          <span className="mx-1.5 text-slate-300">→</span>
                          <span className="inline-flex items-center gap-1" title="Saiu de manhã"><Truck size={11} className="text-slate-400" />{hora(n.saidaManha)}</span>
                        </td>
                        <td className={td}><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${c.chip}`}>{c.texto}</span></td>
                        <td className={td}>
                          <div className="flex flex-wrap gap-1">
                            {s.rotaConcluida?.ok && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-bold">rota concluída</span>}
                            {s.voltou?.ok && n.classificacao !== "na_base" && <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] font-semibold">voltou de manhã</span>}
                            {GALO.filter(g => s[g.chave]?.ok).map(g => <span key={g.chave} className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-[10px] font-semibold">{g.texto}</span>)}
                          </div>
                        </td>
                      </tr>
                      {aberta === n.id && (
                        <tr><td colSpan={8} className={`border-l-4 ${c.faixa}`}>
                          <Detalhe n={n} sede={sede} recalculando={recalcular.isPending}
                            onRecalcular={() => recalcular.mutate({ revendaId, dia: n.dia })} />
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
