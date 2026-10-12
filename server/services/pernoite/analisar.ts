/*
 * MetricFlow — análise de uma noite de um caminhão (spec pernoite §4–5): onde dormiu, se era evitável
 * ("na malícia": fora da Sede, perto, dava para chegar, voltou de manhã) e os sinais de "cozinhando o galo".
 * Puro: quem chama busca GPS, entregas e a Sede.
 */
import { distM, type Parada } from "../entregas/detectarParadas";
import type { EntregaCruzada, EventoGps } from "../entregas/cruzar";
import type { Entrega } from "../entregas/parseCheckNow";
import { tempoDeDescarga } from "../entregas/produtividade";
import { horaBRT, type ConfigEntregas } from "@shared/entregas";
import { dentroDoPoligono, type Sede } from "./sede";

export const PARA_TRAS_KM = 20, FINAL_N = 3, FINAL_MIN_ENTREGAS = 5;
export const OCIOSIDADE = { paradaMin: 10, janelaH: 2, totalMin: 30 } as const;

export interface EntradaNoite {
  dia: string; placa: string; motorista: string;
  paradas: Parada[]; eventos: EventoGps[];
  baixas: EntregaCruzada[]; pendentes: Entrega[];
  clientesSeguinte: { lat: number; lon: number }[];
  sede: Sede; cfg: ConfigEntregas;
}
export type Classificacao = "na_malicia" | "evitavel" | "normal" | "na_base" | "sem_parada";
export interface Sinal { ok: boolean; [k: string]: unknown }
type ChaveSinal = "foraDaSede" | "perto" | "davaParaChegar" | "voltou" | "finalLento" | "parouCedo" | "ociosidade" | "paraTras";
export interface Noite {
  dia: string; placa: string; motorista: string;
  lat: number | null; lon: number | null; endereco: string | null; cidade: string | null; distSedeKm: number | null;
  chegada: Date | null; saidaManha: Date | null; descansoMin: number | null; ultimoClienteSaida: Date | null;
  chaveLigadaMin: number | null; madrugadaEventos: number;
  classificacao: Classificacao; sinais: Record<ChaveSinal, Sinal>; galo: number;
}

const DIA_MS = 86_400_000;
const proximoDia = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) + DIA_MS).toISOString().slice(0, 10);
const as = (dia: string, hm: string) => new Date(`${dia}T${hm}:00-03:00`);
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const NAO = (motivo: string): Sinal => ({ ok: false, motivo });

export function analisarNoite(e: EntradaNoite): Noite {
  const { cfg, sede } = e;
  const seguinte = proximoDia(e.dia);
  const vazio: Noite = {
    dia: e.dia, placa: e.placa, motorista: e.motorista, lat: null, lon: null, endereco: null, cidade: null, distSedeKm: null,
    chegada: null, saidaManha: null, descansoMin: null, ultimoClienteSaida: null, chaveLigadaMin: null, madrugadaEventos: 0,
    classificacao: "sem_parada", galo: 0,
    sinais: Object.fromEntries((["foraDaSede", "perto", "davaParaChegar", "voltou", "finalLento", "parouCedo", "ociosidade", "paraTras"] as ChaveSinal[])
      .map(k => [k, NAO("sem parada às 02:00")])) as Record<ChaveSinal, Sinal>,
  };
  const t02 = as(seguinte, "02:00");
  const noite = e.paradas.find(p => p.inicio <= t02 && p.fim >= t02);
  if (!noite) return vazio;

  // Último cliente do dia: a parada no raio que termina por último (sem parada, a hora do app).
  const comParada = e.baixas.flatMap(b => b.paradasNoRaio.filter(p => p.fim <= noite.inicio).map(p => ({ b, fim: p.fim })));
  const ultimo = comParada.sort((a, b) => b.fim.getTime() - a.fim.getTime())[0];
  const appUltima = e.baixas.map(b => b.entrega.baixaEm).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
  const ultimoClienteSaida = ultimo?.fim ?? appUltima ?? null;
  const ultimoLocal = ultimo?.b.entrega ?? e.baixas.find(b => b.entrega.baixaEm?.getTime() === appUltima?.getTime())?.entrega ?? null;

  const retaKm = distM(noite.lat, noite.lon, sede.centro.lat, sede.centro.lon) / 1000;
  const distSedeKm = Math.round(retaKm * cfg.pernoiteFatorEstrada * 10) / 10;
  const naBase = dentroDoPoligono(noite.lat, noite.lon, sede.poligono);
  const evento = e.eventos.filter(ev => ev.endereco && Math.abs(ev.em.getTime() - noite.inicio.getTime()) <= 30 * 60000)
    .sort((a, b) => Math.abs(a.em.getTime() - noite.inicio.getTime()) - Math.abs(b.em.getTime() - noite.inicio.getTime()))[0];
  const cidade = e.baixas.map(b => b.entrega).filter(x => x.lat !== null && x.lon !== null)
    .map(x => ({ x, d: distM(noite.lat, noite.lon, x.lat!, x.lon!) })).sort((a, b) => a.d - b.d)[0]?.x.cidade || null;

  const desligou = e.eventos.find(ev => ev.tipo === "ignitionOff" && ev.em >= noite.inicio && ev.em <= noite.fim);
  const madrugada = e.eventos.filter(ev => (ev.tipo === "ignitionOn" || ev.tipo === "deviceMoving") && ev.em >= noite.inicio && ev.em <= noite.fim
    && (horaBRT(ev.em) >= "22:00" || horaBRT(ev.em) < "05:00")).length;

  const r: Noite = {
    ...vazio, lat: noite.lat, lon: noite.lon, endereco: evento?.endereco ?? null, cidade, distSedeKm,
    chegada: noite.inicio, saidaManha: noite.fim, descansoMin: Math.round(noite.min), ultimoClienteSaida,
    chaveLigadaMin: desligou ? Math.round((desligou.em.getTime() - noite.inicio.getTime()) / 60000) : null, madrugadaEventos: madrugada,
  };
  if (naBase) return { ...r, classificacao: "na_base", sinais: { ...r.sinais, foraDaSede: NAO("dormiu na Sede") } };

  // Sinais de "na malícia".
  const foraDaSede: Sinal = { ok: true };
  const perto: Sinal = { ok: distSedeKm <= cfg.pernoiteMaxKm, km: distSedeKm, limiteKm: cfg.pernoiteMaxKm };
  const limite = as(e.dia, cfg.pernoiteChegarAte);
  const estimada = ultimoClienteSaida ? new Date(ultimoClienteSaida.getTime() + (distSedeKm / cfg.pernoiteVelKmh) * 3_600_000) : null;
  const davaParaChegar: Sinal = estimada
    ? { ok: estimada <= limite, estimada: horaBRT(estimada), limite: cfg.pernoiteChegarAte, saiuDoUltimo: horaBRT(ultimoClienteSaida!),
        ultimo: ultimoLocal?.lat != null && ultimoLocal.lon != null ? { lat: ultimoLocal.lat, lon: ultimoLocal.lon } : null }
    : NAO("sem entrega no dia");
  const fimManha = (() => {
    const cli = e.paradas.find(p => p.inicio >= noite.fim && e.clientesSeguinte.some(c => distM(p.lat, p.lon, c.lat, c.lon) <= cfg.raioM));
    return cli?.inicio ?? as(seguinte, "12:00");
  })();
  const entrouSede = e.eventos.find(ev => ev.tipo === "geofenceEnter" && ev.cercaId === sede.cercaId && ev.em >= noite.fim && ev.em <= fimManha);
  const chegouPerto = e.paradas.find(p => p.inicio >= noite.fim && p.inicio <= fimManha
    && distM(p.lat, p.lon, sede.centro.lat, sede.centro.lon) / 1000 <= retaKm / 2);
  const voltou: Sinal = entrouSede ? { ok: true, como: "entrou na Sede", as: horaBRT(entrouSede.em) }
    : chegouPerto ? { ok: true, como: "chegou perto da Sede", as: horaBRT(chegouPerto.inicio) } : { ok: false };

  const classificacao: Classificacao = perto.ok && davaParaChegar.ok ? (voltou.ok ? "na_malicia" : "evitavel") : "normal";

  // Sinais de "cozinhando o galo".
  const ordem = e.baixas.map((b, i) => ({ b, i })).sort((x, y) =>
    (x.b.paradasNoRaio[0]?.inicio.getTime() ?? x.b.entrega.baixaEm?.getTime() ?? 0) - (y.b.paradasNoRaio[0]?.inicio.getTime() ?? y.b.entrega.baixaEm?.getTime() ?? 0));
  const tempos = tempoDeDescarga(e.baixas, e.baixas.map(() => null));
  const comTempo = ordem.filter(o => tempos[o.i] > 0).map(o => tempos[o.i]);
  const finalMin = mediana(comTempo.slice(-FINAL_N)), diaMin = mediana(comTempo);
  const finalLento: Sinal = comTempo.length >= FINAL_MIN_ENTREGAS
    ? { ok: finalMin > cfg.pernoiteFinalLentoX * diaMin, finalMin: Math.round(finalMin), diaMin: Math.round(diaMin) }
    : NAO(`menos de ${FINAL_MIN_ENTREGAS} entregas com parada`);
  const parouCedo: Sinal = { ok: horaBRT(noite.inicio) < cfg.pernoiteParouCedo, chegada: horaBRT(noite.inicio), limite: cfg.pernoiteParouCedo };
  const janela = noite.inicio.getTime() - OCIOSIDADE.janelaH * 3_600_000;
  const clientes = e.baixas.map(b => b.entrega).filter(x => x.lat !== null && x.lon !== null);
  const ociosaMin = e.paradas.filter(p => p !== noite && p.min >= OCIOSIDADE.paradaMin && p.fim.getTime() > janela && p.inicio < noite.inicio
    && !clientes.some(c => distM(p.lat, p.lon, c.lat!, c.lon!) <= cfg.raioM))
    .reduce((s, p) => s + (Math.min(p.fim.getTime(), noite.inicio.getTime()) - Math.max(p.inicio.getTime(), janela)) / 60000, 0);
  const ociosidade: Sinal = { ok: ociosaMin >= OCIOSIDADE.totalMin, min: Math.round(ociosaMin) };
  const folgaMin = ultimoClienteSaida ? (limite.getTime() - ultimoClienteSaida.getTime()) / 60000 : 0;
  const pertoDoUltimo = ultimoLocal?.lat != null && ultimoLocal?.lon != null
    ? e.pendentes.filter(p => p.lat !== null && p.lon !== null && distM(ultimoLocal.lat!, ultimoLocal.lon!, p.lat, p.lon) / 1000 <= PARA_TRAS_KM).length : 0;
  const paraTras: Sinal = ultimoClienteSaida
    ? { ok: folgaMin >= 60 && pertoDoUltimo > 0, clientes: pertoDoUltimo, folgaMin: Math.round(folgaMin) }
    : NAO("sem entrega no dia");

  const galo = [finalLento, parouCedo, ociosidade, paraTras].filter(s => s.ok).length;
  return { ...r, classificacao, galo, sinais: { foraDaSede, perto, davaParaChegar, voltou, finalLento, parouCedo, ociosidade, paraTras } };
}
