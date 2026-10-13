/*
 * MetricFlow — aba "Pernoite" (spec pernoite §8): onde cada caminhão dormiu, se o pernoite era evitável
 * ("na malícia": fora da Sede, perto, dava para chegar e voltou de manhã) e os sinais de "cozinhando o galo".
 * Resumo por motorista, mapa das noites fora da Sede, lista das noites e o detalhe com cada sinal explicado.
 */
import React, { useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
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

const CLASSE: Record<string, { texto: string; cor: string; letra: string; chip: string }> = {
  na_malicia: { texto: "na malícia", cor: "#E24B4A", letra: "M", chip: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  evitavel: { texto: "evitável", cor: "#BA7517", letra: "E", chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  normal: { texto: "normal", cor: "#888780", letra: "N", chip: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300" },
  na_base: { texto: "na Sede", cor: "#888780", letra: "S", chip: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300" },
  sem_parada: { texto: "rodando às 02h", cor: "#888780", letra: "?", chip: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300" },
  sem_sinal: { texto: "sem sinal GPS", cor: "#7F77DD", letra: "!", chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
};
const PESO: Record<string, number> = { na_malicia: 3, evitavel: 2, normal: 1 };
const GALO: { chave: keyof Sinais; texto: string }[] = [
  { chave: "finalLento", texto: "final lento" }, { chave: "parouCedo", texto: "parou cedo" },
  { chave: "ociosidade", texto: "ocioso no fim" }, { chave: "paraTras", texto: "cliente para trás" },
];
const DIA_MS = 86_400_000;
const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const fmtDia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const hora = (d: Date | null) => (d ? horaBRT(d) : "—");
const km = (x: number | null) => (x === null ? "—" : `${x.toFixed(0)} km`);
const duracao = (min: number) => (min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`);
const fora = (n: Noite) => n.classificacao !== "na_base" && n.classificacao !== "sem_parada" && n.lat !== null && n.lon !== null;
const sinaisDe = (n: Noite) => n.sinais as Sinais;

/** Uma frase por sinal, com os números que levaram a ele. */
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40">
      <div className="flex flex-col gap-2">
        {(n.classificacao === "sem_sinal"
          ? [{ ok: true, galo: false, texto: "O rastreador não mandou nenhuma posição do dia até as 12:00 do dia seguinte, com rota no CheckNow: não dá para saber onde o caminhão rodou nem onde dormiu. Confira se o rastreador foi desligado ou desconectado." }]
          : n.classificacao === "na_base" || n.classificacao === "sem_parada"
          ? [{ ok: false, galo: false, texto: `Sinais não se aplicam: ${sinaisDe(n).perto.motivo ?? CLASSE[n.classificacao].texto}.` }]
          : frases(n)).map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
            {f.ok
              ? <Check size={14} className={`mt-0.5 shrink-0 ${f.galo ? "text-amber-600" : "text-red-600"}`} />
              : <X size={14} className="mt-0.5 shrink-0 text-slate-300 dark:text-slate-600" />}
            <span className={f.ok ? "" : "text-slate-400 dark:text-slate-500"}>{f.galo && <b className="font-semibold">Galo · </b>}{f.texto}</span>
          </div>
        ))}
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
          Descanso de {n.descansoMin === null ? "—" : duracao(n.descansoMin)}
          {n.chaveLigadaMin !== null && ` · chave desligada ${duracao(n.chaveLigadaMin)} depois de parar`}
          {n.madrugadaEventos > 0 && ` · ${n.madrugadaEventos} movimento(s)/ignição de madrugada`}
          {n.endereco && ` · ${n.endereco}`}
        </div>
        <button onClick={onRecalcular} disabled={recalculando}
          className="self-start mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/50 disabled:opacity-50 font-semibold">
          {recalculando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Recalcular esta noite
        </button>
      </div>
      {pontos.length ? <MapaLeaflet pontos={pontos} linhas={linhas} altura={300} /> : <p className="text-xs text-slate-400">Sem coordenadas para o mapa.</p>}
    </div>
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
  const filtradas = useMemo(() => (noitesQ.data ?? []).filter(n => (!motorista || n.motorista === motorista)
    && (!soEvitaveis || n.classificacao === "na_malicia" || n.classificacao === "evitavel") && (!soGalo || n.galo >= 2)
    && (!soSemSinal || n.classificacao === "sem_sinal")),
  [noitesQ.data, motorista, soEvitaveis, soGalo, soSemSinal]);
  const sede = sedeQ.data?.centro ?? null;
  const circulo = useMemo(() => (sede ? { lat: sede.lat, lon: sede.lon, raioM: (cfg.pernoiteMaxKm / cfg.pernoiteFatorEstrada) * 1000, cor: "#4f46e5" } : undefined),
    [sede, cfg.pernoiteMaxKm, cfg.pernoiteFatorEstrada]);

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
  const td = "px-3 py-2 text-xs text-slate-700 dark:text-slate-200";

  if (noitesQ.isLoading) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin mr-2" /> Carregando as noites…</div>;
  }

  return (
    <div className="px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-[var(--card)]">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDias(d)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${dias === d ? "bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}>
              {d} dias
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{fmtDia(periodo.de)} a {fmtDia(periodo.ate)} · "na malícia" = fora da Sede, até {cfg.pernoiteMaxKm} km, dava para chegar até {cfg.pernoiteChegarAte} e voltou de manhã</span>
        {!sedeQ.isLoading && !sedeQ.data && <span className="text-xs text-red-600">Cerca "Sede" não encontrada no Infleet desta revenda.</span>}
      </div>

      {!noites.length ? (
        <div className="flex items-center justify-center p-12 rounded-xl border-2 border-dashed border-slate-200 dark:border-[var(--border)] text-sm text-slate-500 dark:text-slate-400">
          Nenhuma noite analisada no período. Reprocesse no ⚙ › Limites › Pernoite.
        </div>
      ) : (
        <>
          <div className={`${caixa} overflow-x-auto`}>
            <table className="w-full">
              <thead><tr>
                <th className={th}>Motorista</th><th className={th}>Noites fora</th><th className={th}>Na malícia</th>
                <th className={th}>Evitável</th><th className={th} title="Noites com 2 ou mais sinais de cozinhando o galo">Galo (2+ sinais)</th>
                <th className={th} title="Dias com rota no CheckNow e o rastreador sem nenhuma posição">Sem sinal GPS</th><th className={th}>Onde mais dorme</th>
              </tr></thead>
              <tbody>
                {(resumoQ.data ?? []).map(r => (
                  <tr key={r.motorista} onClick={() => setMotorista(m => (m === r.motorista ? null : r.motorista))}
                    className={`cursor-pointer border-t border-slate-100 dark:border-[var(--border)] ${motorista === r.motorista ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                    <td className={`${td} font-semibold`}>{r.motorista}</td>
                    <td className={td}>{r.noitesFora}</td>
                    <td className={`${td} ${r.naMalicia ? "text-red-600 font-bold" : ""}`}>{r.naMalicia}</td>
                    <td className={`${td} ${r.evitavel ? "text-amber-700 font-semibold" : ""}`}>{r.evitavel}</td>
                    <td className={td}>{r.comGalo}</td>
                    <td className={`${td} ${r.semSinal ? "text-violet-700 dark:text-violet-300 font-semibold" : ""}`}>{r.semSinal}</td>
                    <td className={td}>{r.lugares.map(l => `${l.cidade} (${l.noites})`).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pontosMapa.length > (sede ? 1 : 0) && (
            <div className={`${caixa} overflow-hidden`}>
              <MapaLeaflet pontos={pontosMapa} altura={360} circulo={circulo} />
              <div className="flex flex-wrap gap-4 px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                {(["na_malicia", "evitavel", "normal"] as const).map(k => (
                  <span key={k} className="flex items-center gap-1"><span style={{ background: CLASSE[k].cor }} className="w-3 h-3 rounded-full inline-block" />{CLASSE[k].letra} = {CLASSE[k].texto}</span>
                ))}
                <span>número = noites no mesmo lugar · círculo = {cfg.pernoiteMaxKm} km de estrada em volta da Sede</span>
              </div>
            </div>
          )}

          <div className={`${caixa} overflow-x-auto`}>
            <div className="flex items-center gap-4 px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
              {motorista && <button onClick={() => setMotorista(null)} className="font-semibold text-indigo-600">{motorista} ✕</button>}
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={soEvitaveis} onChange={e => setSoEvitaveis(e.target.checked)} /> só na malícia / evitável</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={soGalo} onChange={e => setSoGalo(e.target.checked)} /> só com galo (2+ sinais)</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={soSemSinal} onChange={e => setSoSemSinal(e.target.checked)} /> só sem sinal GPS</label>
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
                  return (
                    <React.Fragment key={n.id}>
                      <tr onClick={() => setAberta(a => (a === n.id ? null : n.id))}
                        className="cursor-pointer border-t border-slate-100 dark:border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className={td}>{fmtDia(n.dia)}</td>
                        <td className={`${td} font-mono`}>{n.placa}</td>
                        <td className={td}>{n.motorista}</td>
                        <td className={td}>{n.cidade ?? "—"}</td>
                        <td className={td}>{n.distSedeKm === null || n.classificacao === "na_base" ? "—" : km(n.distSedeKm)}</td>
                        <td className={`${td} font-mono`}>{hora(n.ultimoClienteSaida)} → {hora(n.chegada)} → {hora(n.saidaManha)}</td>
                        <td className={td}><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.chip}`}>{c.texto}</span></td>
                        <td className={td}>
                          <div className="flex flex-wrap gap-1">
                            {s.rotaConcluida?.ok && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-semibold">rota concluída</span>}
                            {s.voltou?.ok && n.classificacao !== "na_base" && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-[10px]">voltou de manhã</span>}
                            {GALO.filter(g => s[g.chave]?.ok).map(g => <span key={g.chave} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">{g.texto}</span>)}
                          </div>
                        </td>
                      </tr>
                      {aberta === n.id && (
                        <tr><td colSpan={8}>
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
