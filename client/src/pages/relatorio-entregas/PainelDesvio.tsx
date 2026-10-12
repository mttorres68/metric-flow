/*
 * MetricFlow — aba "Desvio" (spec desvio §9): fila de pedidos com sinais de desvio de carga (nota de sinais + estranheza
 * do modelo), detalhe com o porquê e revisão, romaneios abertos, resumo por motorista e "Para olhar".
 * Sinais para conferir — a nota não é prova.
 */
import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { diaBRT } from "@shared/entregas";
import { MapaEntrega } from "./MapaEntrega";

type CasoTela = inferRouterOutputs<AppRouter>["desvio"]["fila"][number];
type Situacao = "ok" | "suspeito" | "investigando";

const DIA_MS = 86_400_000;
const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const ddmm = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ETIQUETA: Record<string, string> = {
  avistaAtipico: "à vista atípico", avistaSemHistorico: "à vista s/ histórico", valorAlto: "valor alto", valorMuitoAlto: "valor muito alto",
  motoristaAbertos: "motorista c/ abertos", romaneioAberto: "romaneio aberto", parouPerto: "parou perto", semParada: "sem parada", appLonge: "app longe",
};
const FAIXA: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  media: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  baixa: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300",
};
const REVISAO: Record<Situacao, { texto: string; chip: string }> = {
  ok: { texto: "OK (explicado)", chip: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  suspeito: { texto: "Suspeito", chip: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  investigando: { texto: "Investigando", chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
};
const caixa = "bg-white dark:bg-[var(--card)] rounded-2xl border border-slate-100 dark:border-[var(--border)]";
const th = "px-3 py-2 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide";
const td = "px-3 py-2 text-xs text-slate-700 dark:text-slate-200";
const titulo = "text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500";

function Detalhe({ revendaId, pedido, raioM }: { revendaId: number; pedido: string; raioM: number }) {
  const utils = trpc.useUtils();
  const q = trpc.desvio.detalhe.useQuery({ revendaId, pedido });
  const [obs, setObs] = useState<string | null>(null);
  const revisar = trpc.desvio.revisar.useMutation({
    onSuccess: () => { utils.desvio.invalidate(); toast.success("Revisão registrada."); },
    onError: e => toast.error(e.message),
  });
  if (q.isLoading) return <div className="p-4 text-xs text-slate-400"><Loader2 size={12} className="inline animate-spin mr-1" /> Carregando…</div>;
  if (!q.data) return <div className="p-4 text-xs text-slate-400">Pedido não encontrado.</div>;
  const { caso: c, anteriores, romaneio } = q.data;
  const ev = c.evidencia;
  const observacao = obs ?? c.revisao?.observacao ?? "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40">
      <div className="flex flex-col gap-3">
        <section className="flex flex-col gap-1.5">
          <h4 className={titulo}>Sinais (nota {c.nota})</h4>
          {c.sinais.length ? c.sinais.map(s => (
            <div key={s.chave} className="flex gap-2 text-xs text-slate-700 dark:text-slate-200">
              <span className="shrink-0 w-8 text-right font-mono text-slate-400">+{s.peso}</span><span>{s.texto}</span>
            </div>
          )) : <p className="text-xs text-slate-400">Nenhum sinal.</p>}
          {c.semGps && <p className="text-[11px] text-slate-400">Sem GPS: pedido fora do CheckNow ou antes de 01/10 — só os sinais do ERP.</p>}
        </section>
        {c.estranheza && (
          <section className="flex flex-col gap-1">
            <h4 className={titulo}>Estranheza do modelo: {c.estranheza.nota}</h4>
            {c.estranheza.motivos.length
              ? c.estranheza.motivos.map((m, i) => <p key={i} className="text-xs text-slate-700 dark:text-slate-200">· {m}</p>)
              : <p className="text-xs text-slate-400">Nenhuma característica entre as 5% mais altas.</p>}
          </section>
        )}
        <section className="flex flex-col gap-1">
          <h4 className={titulo}>Cliente {c.pedido.cliente}</h4>
          <p className="text-xs text-slate-700 dark:text-slate-200">
            {c.perfil.pedidos} pedidos nos 12 meses anteriores · {c.perfil.avistaPct}% à vista · valor típico {c.perfil.valorMediana === null ? "—" : reais(c.perfil.valorMediana)}
            {c.perfil.intervaloDias !== null && ` · compra a cada ${c.perfil.intervaloDias} dias`}
          </p>
          {!!anteriores.length && (
            <table className="w-full"><tbody>
              {anteriores.map(p => (
                <tr key={p.pedido} className="border-t border-slate-100 dark:border-[var(--border)]">
                  <td className={td}>{ddmm(p.dataPedido)}</td><td className={`${td} font-mono`}>{p.pedido}</td><td className={td}>{reais(p.valor)}</td>
                  <td className={td}>{p.tipoCobranca === "1" ? "à vista" : "boleto/prazo"}</td><td className={td}>{p.situacao}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </section>
        <section className="flex flex-col gap-1">
          <h4 className={titulo}>Romaneio {c.pedido.romaneio} · {c.pedido.situacao === "aberto" ? `aberto há ${c.diasAberto ?? "?"} dias` : `${c.pedido.situacao}${c.pedido.dataAcerto ? ` em ${ddmm(c.pedido.dataAcerto)}` : ""}`}</h4>
          <table className="w-full"><tbody>
            {[c, ...romaneio].map(r => (
              <tr key={r.pedido.pedido} className={`border-t border-slate-100 dark:border-[var(--border)] ${r === c ? "font-semibold" : ""}`}>
                <td className={`${td} font-mono`}>{r.pedido.pedido}</td><td className={td}>cliente {r.pedido.cliente}</td><td className={td}>{reais(r.pedido.valor)}</td>
                <td className={td}>{r.pedido.tipoCobranca === "1" ? "à vista" : "boleto/prazo"}</td><td className={td}>nota {r.nota}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
        <section className="flex flex-col gap-2">
          <h4 className={titulo}>Revisão {c.revisao && `· atual: ${REVISAO[c.revisao.situacao].texto}`}</h4>
          <input value={observacao} onChange={e => setObs(e.target.value)} maxLength={500} placeholder="Observação (o que foi conferido)"
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-[var(--background)] text-xs text-slate-800 dark:text-slate-100" />
          <div className="flex gap-2">
            {(Object.keys(REVISAO) as Situacao[]).map(s => (
              <button key={s} disabled={revisar.isPending} onClick={() => revisar.mutate({ revendaId, pedido, situacao: s, observacao })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${REVISAO[s].chip}`}>{REVISAO[s].texto}</button>
            ))}
          </div>
        </section>
      </div>
      <div>
        {ev && ev.clienteLat !== null && ev.clienteLon !== null ? (
          <MapaEntrega raioM={raioM} b={{
            entrega: { cliente: `Cliente ${c.pedido.cliente}`, codCliente: c.pedido.cliente, lat: ev.clienteLat, lon: ev.clienteLon, latApp: null, lonApp: null, baixaEm: null },
            maisProxima: ev.paradaLat !== null && ev.paradaLon !== null && ev.paradaInicio && ev.paradaFim && ev.distParadaM !== null
              ? { lat: ev.paradaLat, lon: ev.paradaLon, inicio: ev.paradaInicio, fim: ev.paradaFim, distM: ev.distParadaM } : null,
          }} />
        ) : <p className="text-xs text-slate-400">Sem evidência de GPS para mostrar no mapa.</p>}
      </div>
    </div>
  );
}

function LinhaCaso({ c, aberto, onClick, motivos }: { c: CasoTela; aberto: boolean; onClick: () => void; motivos?: boolean }) {
  return (
    <tr onClick={onClick} className={`cursor-pointer border-t border-slate-100 dark:border-[var(--border)] ${aberto ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
      <td className={td}><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${FAIXA[c.faixa]}`}>{c.nota}</span></td>
      <td className={td}>{c.estranheza
        ? <span className={c.estranheza.nota >= 99 ? "px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-semibold" : ""}>{c.estranheza.nota}</span>
        : "—"}</td>
      <td className={td}>{ddmm(c.dia)}</td>
      <td className={`${td} font-mono`}>{c.pedido.pedido}</td>
      <td className={`${td} font-mono`}>{c.pedido.romaneio}</td>
      <td className={td}>{c.pedido.cliente}</td>
      <td className={td}>{c.motorista}</td>
      <td className={`${td} font-mono`}>{c.pedido.placa}</td>
      <td className={`${td} text-right`}>{reais(c.pedido.valor)}</td>
      <td className={td}>
        <div className="flex flex-wrap gap-1">
          {c.pedido.tipoCobranca === "1" && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 text-[10px] font-semibold">à vista</span>}
          {motivos
            ? c.estranheza?.motivos.map((m, i) => <span key={i} className="text-[10px] text-slate-500 dark:text-slate-400">{m}</span>)
            : c.sinais.map(s => <span key={s.chave} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-[10px]">{ETIQUETA[s.chave] ?? s.chave}</span>)}
          {c.semGps && <span className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-[10px] text-slate-400">sem GPS</span>}
          {c.revisao && <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${REVISAO[c.revisao.situacao].chip}`}>{REVISAO[c.revisao.situacao].texto}</span>}
        </div>
      </td>
    </tr>
  );
}

function TabelaCasos({ casos, revendaId, raioM, motivos }: { casos: CasoTela[]; revendaId: number; raioM: number; motivos?: boolean }) {
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <table className="w-full">
      <thead><tr>
        <th className={th}>Nota</th><th className={th} title="Estranheza do modelo (percentil na revenda)">Estranheza</th><th className={th}>Data</th>
        <th className={th}>Pedido</th><th className={th}>Romaneio</th><th className={th}>Cliente</th><th className={th}>Motorista</th>
        <th className={th}>Placa</th><th className={`${th} text-right`}>Valor</th><th className={th}>{motivos ? "Por que é estranho" : "Sinais"}</th>
      </tr></thead>
      <tbody>
        {casos.map(c => (
          <React.Fragment key={c.pedido.pedido}>
            <LinhaCaso c={c} motivos={motivos} aberto={aberto === c.pedido.pedido} onClick={() => setAberto(a => (a === c.pedido.pedido ? null : c.pedido.pedido))} />
            {aberto === c.pedido.pedido && <tr><td colSpan={10}><Detalhe revendaId={revendaId} pedido={c.pedido.pedido} raioM={raioM} /></td></tr>}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

export function PainelDesvio({ revendaId, raioM }: { revendaId: number; raioM: number }) {
  const [dias, setDias] = useState(14);
  const [incluirRevisados, setIncluirRevisados] = useState(false);
  const hoje = diaBRT(new Date());
  const periodo = { revendaId, de: somaDias(hoje, -(dias - 1)), ate: hoje };
  const filaQ = trpc.desvio.fila.useQuery({ ...periodo, incluirRevisados });
  const abertosQ = trpc.desvio.abertos.useQuery({ revendaId });
  const motoristasQ = trpc.desvio.motoristas.useQuery(periodo);
  const olharQ = trpc.desvio.paraOlhar.useQuery(periodo);

  if (filaQ.isLoading) return <div className="flex items-center justify-center h-40 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin mr-2" /> Analisando os pedidos…</div>;
  if (filaQ.error) return <div className="m-6 text-sm text-red-600">{filaQ.error.message}</div>;

  const fila = filaQ.data ?? [];
  const abertos = abertosQ.data ?? [];
  const altos = fila.filter(c => c.faixa === "alta");
  const cartao = (rotulo: string, valor: string, destaque = false) => (
    <div className={`${caixa} px-4 py-3`}>
      <div className="text-xs text-slate-400">{rotulo}</div>
      <div className={`text-2xl font-bold ${destaque ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>{valor}</div>
    </div>
  );
  const semPedidos = !fila.length && !abertos.length && !(motoristasQ.data ?? []).length;

  return (
    <div className="px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-[var(--card)]">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDias(d)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${dias === d ? "bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}>{d} dias</button>
          ))}
        </div>
        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><AlertTriangle size={12} /> Sinais para conferir — a nota não é prova.</span>
      </div>

      {semPedidos ? (
        <div className="flex items-center justify-center p-12 rounded-xl border-2 border-dashed border-slate-200 dark:border-[var(--border)] text-sm text-slate-500 dark:text-slate-400">
          Nenhum pedido do ERP no período. Suba os pedidos no ⚙ › Contas › Arquivos do ERP.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cartao("Casos altos", String(altos.length), altos.length > 0)}
            {cartao("Casos médios", String(fila.filter(c => c.faixa === "media").length))}
            {cartao("Valor em risco (altos)", reais(altos.reduce((s, c) => s + c.pedido.valor, 0)), altos.length > 0)}
            {cartao("Romaneios abertos > 3 dias", String(abertos.filter(r => (r.dias ?? 0) > 3).length))}
          </div>

          <div className={`${caixa} overflow-x-auto`}>
            <div className="flex items-center gap-4 px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
              <b>Fila</b>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={incluirRevisados} onChange={e => setIncluirRevisados(e.target.checked)} /> mostrar revisados como OK</label>
              <span className="ml-auto text-slate-400">{fila.length} pedidos com nota ≥ 30 · clique para o detalhe</span>
            </div>
            {fila.length ? <TabelaCasos casos={fila} revendaId={revendaId} raioM={raioM} />
              : <p className="px-4 pb-4 text-xs text-slate-400">Nenhum pedido com nota ≥ 30 no período.</p>}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={`${caixa} overflow-x-auto`}>
              <div className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">Romaneios abertos</div>
              <table className="w-full">
                <thead><tr>
                  <th className={th}>Romaneio</th><th className={th}>Placa</th><th className={th}>Motorista</th><th className={th}>Saída</th>
                  <th className={th}>Dias</th><th className={th}>Pedidos</th><th className={`${th} text-right`}>Valor</th><th className={`${th} text-right`}>À vista</th>
                </tr></thead>
                <tbody>
                  {abertos.map(r => (
                    <tr key={r.romaneio} className="border-t border-slate-100 dark:border-[var(--border)]">
                      <td className={`${td} font-mono`}>{r.romaneio}</td><td className={`${td} font-mono`}>{r.placa}</td><td className={td}>{r.motorista}</td>
                      <td className={td}>{ddmm(r.saida)}</td>
                      <td className={`${td} ${(r.dias ?? 0) > 3 ? "text-red-600 dark:text-red-400 font-bold" : ""}`}>{r.dias ?? "—"}</td>
                      <td className={td}>{r.pedidos}</td><td className={`${td} text-right`}>{reais(r.valor)}</td><td className={`${td} text-right`}>{reais(r.valorAvista)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`${caixa} overflow-x-auto`}>
              <div className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">Por motorista</div>
              <table className="w-full">
                <thead><tr>
                  <th className={th}>Motorista</th><th className={th}>Romaneios abertos</th><th className={th}>À vista atípicos</th>
                  <th className={th}>Altos</th><th className={th}>Médios</th><th className={th}>Soma das notas</th>
                </tr></thead>
                <tbody>
                  {(motoristasQ.data ?? []).map(m => (
                    <tr key={m.motoristaCod} className="border-t border-slate-100 dark:border-[var(--border)]">
                      <td className={`${td} font-semibold`}>{m.motorista}</td>
                      <td className={`${td} ${m.romaneiosAbertos > 3 ? "text-red-600 dark:text-red-400 font-bold" : ""}`}>{m.romaneiosAbertos}</td>
                      <td className={td}>{m.avistaAtipicos}</td><td className={td}>{m.casosAltos}</td><td className={td}>{m.casosMedios}</td><td className={td}>{m.somaNotas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${caixa} overflow-x-auto`}>
            <div className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
              <b>Para olhar</b> · estranhos para o modelo, sem sinal forte — podem ser padrão novo
            </div>
            {(olharQ.data ?? []).length ? <TabelaCasos casos={olharQ.data!} revendaId={revendaId} raioM={raioM} motivos />
              : <p className="px-4 pb-4 text-xs text-slate-400">Nada fora do comum no período.</p>}
          </div>
        </>
      )}
    </div>
  );
}
