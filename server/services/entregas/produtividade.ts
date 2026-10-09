/*
 * MetricFlow — produtividade em hL (spec produtividade §6): volume de cada entrega pelos itens do ERP e
 * medidas por motorista·dia (hL/h, hL/km, hL por parada, devolução, tempo fixo × por hL, min/hL por embalagem)
 * mais as etiquetas da aba "Por dia new". Puro: quem chama busca os itens e os pontos do "4 semanas".
 */
import type { EntregaCruzada, ResultadoLinha } from "./cruzar";
import type { ItemComProduto, PontoProdutividade } from "../erp/repo";
import { distM } from "./detectarParadas";
import { LIMITES, horaBRT } from "@shared/entregas";

export const DOMINANTE_PCT = 0.7, DEV_ALTA_PCT = 10, APP_ATRASO_MIN = 30, RETA_MIN_PONTOS = 6;
type Tipo = "retornavel" | "descartavel" | "barril";
const TIPOS: Tipo[] = ["retornavel", "descartavel", "barril"];
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function volumeItem(i: ItemComProduto): { hl: number; dev: number } | null {
  if (i.cancelado || !i.produto?.litrosEmb || !i.produto.litrosUn) return null;
  const { litrosEmb, litrosUn } = i.produto;
  return { hl: r3((i.liqCx * litrosEmb + i.liqUn * litrosUn) / 100), dev: r3((i.retCx * litrosEmb + i.retUn * litrosUn) / 100) };
}

export interface VolumeEntrega {
  hl: number; dev: number; porTipo: Record<Tipo, number>;
  dominante: Tipo | "misto" | null; motivos: string[]; semCadastro: string[]; casou: boolean;
}

export function volumeEntrega(docs: string[], itens: ItemComProduto[]): VolumeEntrega {
  const meus = itens.filter(i => docs.includes(i.pedido));
  const porTipo: Record<Tipo, number> = { retornavel: 0, descartavel: 0, barril: 0 };
  let hl = 0, dev = 0;
  for (const i of meus) {
    const v = volumeItem(i);
    if (!v) continue;
    hl += v.hl; dev += v.dev;
    if (i.produto?.tipo) porTipo[i.produto.tipo] += v.hl;
  }
  const top = TIPOS.reduce((a, b) => (porTipo[b] > porTipo[a] ? b : a));
  return {
    hl: r3(hl), dev: r3(dev), porTipo,
    dominante: hl > 0 ? (porTipo[top] / hl >= DOMINANTE_PCT ? top : "misto") : null,
    motivos: [...new Set(meus.flatMap(i => (i.motivoDev ? [i.motivoDev] : [])))],
    semCadastro: [...new Set(meus.filter(i => !i.produto && !i.cancelado).map(i => i.codProduto))].sort(),
    casou: meus.length > 0,
  };
}

export function ajustarReta(pontos: { hl: number; min: number }[]): { fixoMin: number; minPorHl: number; n: number } | null {
  const n = pontos.length;
  if (n < RETA_MIN_PONTOS) return null;
  const mx = pontos.reduce((s, p) => s + p.hl, 0) / n, my = pontos.reduce((s, p) => s + p.min, 0) / n;
  const sxx = pontos.reduce((s, p) => s + (p.hl - mx) ** 2, 0);
  if (sxx < 1e-9) return null;
  const minPorHl = pontos.reduce((s, p) => s + (p.hl - mx) * (p.min - my), 0) / sxx;
  const fixoMin = my - minPorHl * mx;
  return fixoMin < 0 || minPorHl < 0 ? null : { fixoMin, minPorHl, n };
}

export interface ProdutividadeLinha {
  hl: number; dev: number; devPct: number | null; hlPorHora: number | null; parcial: boolean;
  hlPorKm: number | null; hlPorParada: number | null; menorHl: number | null;
  reta: ReturnType<typeof ajustarReta>; reta4s: (NonNullable<ReturnType<typeof ajustarReta>> & { dias: number }) | null;
  porTipo: { tipo: Tipo | "misto"; hl: number; minPorHl: number }[];
  incompleto: boolean; // há entregas sem volume (sem pedido no ERP): o hL/h fica abaixo do real
  semVolume: number; etiquetas: { texto: string; nivel: "alerta" | "aviso" }[];
}

const descarregou = (b: EntregaCruzada, v: VolumeEntrega | null): v is VolumeEntrega =>
  !!v && v.hl > 0 && b.status === "no_raio" && b.permanenciaMin > 0;

export function produtividadeLinha(
  r: ResultadoLinha, volumes: (VolumeEntrega | null)[], raioM: number,
  pontos4s: { hl: number; minDescarga: number; dia: string }[] = [],
  /** Linha sem GPS não tem baixas cruzadas: o volume do dia vem das entregas dela (o hL/h fica vazio). */
  semGps: { situacao: string; vol: VolumeEntrega | null }[] = [],
): ProdutividadeLinha {
  const vs = [...volumes, ...semGps.map(s => s.vol)].filter((v): v is VolumeEntrega => !!v);
  const hl = r3(vs.reduce((s, v) => s + v.hl, 0)), dev = r3(vs.reduce((s, v) => s + v.dev, 0));
  const casados = vs.filter(v => v.casou).length;
  const fim = r.retorno ?? r.gpsClientes.ultimaSaida;
  const horas = r.saida && fim ? (fim.getTime() - r.saida.getTime()) / 3_600_000 : 0;
  const comHl = vs.filter(v => v.hl > 0);
  const pontos = r.baixas.flatMap((b, i) => (descarregou(b, volumes[i]) ? [{ hl: volumes[i]!.hl, min: b.permanenciaMin }] : []));

  const grupos = new Map<Tipo | "misto", { hl: number; min: number }>();
  r.baixas.forEach((b, i) => {
    const v = volumes[i];
    if (!descarregou(b, v) || !v.dominante) return;
    const g = grupos.get(v.dominante) ?? { hl: 0, min: 0 };
    grupos.set(v.dominante, { hl: g.hl + v.hl, min: g.min + b.permanenciaMin });
  });

  const reta4 = ajustarReta(pontos4s.map(p => ({ hl: p.hl, min: p.minDescarga })));
  const semVolume = r.baixas.filter((b, i) => b.entrega.situacao === "ENTREGUE" && !volumes[i]?.casou).length
    + semGps.filter(s => s.situacao === "ENTREGUE" && !s.vol?.casou).length;
  const devPct = hl + dev > 0 ? Math.round((dev / (hl + dev)) * 10000) / 100 : null;

  const etiquetas: ProdutividadeLinha["etiquetas"] = [];
  const add = (texto: string, nivel: "alerta" | "aviso" = "alerta") => etiquetas.push({ texto, nivel });
  if (r.semGps) add(`sem GPS: ${r.semGps}`, "aviso");
  if (r.saida && horaBRT(r.saida) > LIMITES.saidaAte) add(`saída ${horaBRT(r.saida)}`);
  // Atraso do app: o 1º registro do dia contra a passagem do caminhão por aquele mesmo cliente (momento do
  // registro). Comparar com a 1ª chegada a qualquer cliente erra quando o caminhão dorme perto de um cliente.
  const primeiro = r.baixas.filter(b => b.entrega.baixaEm).sort((a, b) => a.entrega.baixaEm!.getTime() - b.entrega.baixaEm!.getTime())[0];
  const atraso = primeiro?.momentoBaixa?.tipo === "depois" ? primeiro.momentoBaixa.min : 0;
  if (atraso > APP_ATRASO_MIN) add(`app ${atraso >= 60 ? `${Math.floor(atraso / 60)}h${String(atraso % 60).padStart(2, "0")}` : `${atraso} min`} depois`);
  const longe = r.baixas.filter(b => b.entrega.lat !== null && b.entrega.lon !== null && b.entrega.latApp !== null && b.entrega.lonApp !== null
    && distM(b.entrega.lat, b.entrega.lon, b.entrega.latApp, b.entrega.lonApp) > raioM).length;
  if (longe) add(`${longe} registro${longe > 1 ? "s" : ""} longe do cliente`);
  if (devPct !== null && devPct > DEV_ALTA_PCT) add(`devolução ${Math.round(devPct)}%`);
  if (r.paradasSemCliente.qtd) add(`${r.paradasSemCliente.qtd} parada(s) sem cliente`, "aviso");
  if (r.desvios) add(`${r.desvios} desvio(s)`, "aviso");
  if (r.trechosLentos) add(`${r.trechosLentos} trecho(s) lento(s)`, "aviso");
  if (semVolume) add(`${semVolume} entrega${semVolume > 1 ? "s" : ""} sem pedido no ERP`, "aviso");

  return {
    hl, dev, devPct,
    // Sem nenhuma entrega casada com o ERP o volume é desconhecido: vazio, não zero.
    hlPorHora: casados && horas > 0 ? r3(hl / horas) : null, parcial: !r.retorno,
    hlPorKm: casados && r.kmGps ? r3(hl / r.kmGps) : null,
    hlPorParada: comHl.length ? r3(hl / comHl.length) : null,
    menorHl: comHl.length ? Math.min(...comHl.map(v => v.hl)) : null,
    reta: ajustarReta(pontos),
    reta4s: reta4 && { ...reta4, dias: new Set(pontos4s.map(p => p.dia)).size },
    porTipo: [...grupos].map(([tipo, g]) => ({ tipo, hl: r3(g.hl), minPorHl: g.min / g.hl })),
    incompleto: semVolume > 0, semVolume, etiquetas,
  };
}

export function pontosDaLinha(r: ResultadoLinha, volumes: (VolumeEntrega | null)[]): PontoProdutividade[] {
  return r.baixas.flatMap((b, i) => (descarregou(b, volumes[i])
    ? [{ dia: r.linha.data, placa: r.linha.placa, motorista: r.linha.motorista, routeId: r.linha.routeId, codCliente: b.entrega.codCliente, hl: volumes[i]!.hl, minDescarga: b.permanenciaMin }]
    : []));
}
