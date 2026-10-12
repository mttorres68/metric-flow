/*
 * MetricFlow — estranheza do pedido (spec desvio §7): Isolation Forest sobre características do ERP, nota em percentil
 * dentro da revenda e explicação pelas características mais extremas (percentil de cada uma no histórico).
 */
import { pontuar, treinar } from "./isolationForest";
import { AVISTA, type Caso } from "./analisar";

export const MIN_CASOS = 50, MOTIVO_PCT = 95;
export const CARACTERISTICAS = ["valor", "valorRelativo", "surpresaAvista", "intervaloRelativo", "itens", "produtos", "devolucao", "diasAcerto"] as const;
export interface Estranheza { nota: number; motivos: string[] }

const DIA_MS = 86_400_000;
const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA_MS);
const vezes = (x: number) => x.toFixed(1).replace(".", ",");
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function vetor(c: Caso): number[] {
  const p = c.pedido, f = c.perfil;
  const gap = f.ultimaCompra && p.dataPedido ? dias(f.ultimaCompra, p.dataPedido) : null;
  return [
    Math.log1p(Math.max(0, p.valor)),
    f.valorMediana ? p.valor / f.valorMediana : 1,
    p.tipoCobranca === AVISTA ? 1 - f.avistaPct / 100 : 0,
    gap !== null && f.intervaloDias ? gap / f.intervaloDias : 1,
    p.itens,
    p.produtos,
    p.valor > 0 ? p.valorRetorno / p.valor : 0,
    p.situacao === "acertado" && p.dataAcerto && p.dataPedido ? dias(p.dataPedido, p.dataAcerto) : (c.diasAberto ?? 0),
  ];
}

const TEXTO: ((c: Caso, v: number) => string)[] = [
  c => `valor ${reais(c.pedido.valor)}`,
  (_, v) => `valor ${vezes(v)}× o típico do cliente`,
  c => `à vista num cliente que compra à vista em ${c.perfil.avistaPct}% das vezes`,
  (c, v) => `cliente sem comprar desde ${c.perfil.ultimaCompra?.split("-").reverse().join("/")} (${vezes(v)}× o intervalo típico)`,
  c => `${c.pedido.itens} itens`,
  c => `${c.pedido.produtos} produtos diferentes`,
  (_, v) => `devolução de ${Math.round(v * 100)}% do valor`,
  (c, v) => (c.pedido.situacao === "aberto" ? `${v} dias em aberto` : `${v} dias até o acerto`),
];

/** % dos valores ordenados estritamente menores que v. */
function abaixo(ordenados: number[], v: number): number {
  let lo = 0, hi = ordenados.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ordenados[m] < v) lo = m + 1; else hi = m; }
  return (lo / ordenados.length) * 100;
}

export function estranheza(casos: Caso[]): Map<string, Estranheza> {
  const r = new Map<string, Estranheza>();
  if (casos.length < MIN_CASOS) return r;
  const X = casos.map(vetor);
  const f = treinar(X);
  const notas = X.map(x => pontuar(f, x));
  const notasOrd = [...notas].sort((a, b) => a - b);
  const colunas = CARACTERISTICAS.map((_, j) => X.map(x => x[j]).sort((a, b) => a - b));
  casos.forEach((c, i) => {
    const motivos = CARACTERISTICAS.map((_, j) => ({ j, pct: abaixo(colunas[j], X[i][j]) }))
      .filter(m => m.pct >= MOTIVO_PCT).sort((a, b) => b.pct - a.pct).slice(0, 3)
      .map(m => `${TEXTO[m.j](c, X[i][m.j])} — mais alto que ${vezes(m.pct)}% dos pedidos`);
    r.set(c.pedido.pedido, { nota: Math.round(abaixo(notasOrd, notas[i])), motivos });
  });
  return r;
}
