/*
 * MetricFlow — Isolation Forest (Liu, Ting e Zhou, 2008): pontos que se isolam com poucos cortes aleatórios são
 * anomalias. Semente fixa: o mesmo dado dá sempre a mesma nota. Spec desvio §7.
 */
export type No = { folha: true; n: number } | { folha: false; f: number; corte: number; esq: No; dir: No };
export interface Floresta { arvores: No[]; amostra: number }

export function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Comprimento médio de uma busca sem sucesso numa árvore binária com n pontos. */
const c = (n: number) => (n > 2 ? 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n : n === 2 ? 1 : 0);

function construir(pts: number[][], prof: number, limite: number, rnd: () => number): No {
  if (prof >= limite || pts.length <= 1) return { folha: true, n: pts.length };
  const dims = pts[0].length;
  for (let tentativa = 0; tentativa < dims; tentativa++) {
    const f = Math.floor(rnd() * dims);
    let min = Infinity, max = -Infinity;
    for (const p of pts) { if (p[f] < min) min = p[f]; if (p[f] > max) max = p[f]; }
    if (max > min) {
      const corte = min + rnd() * (max - min);
      return { folha: false, f, corte,
        esq: construir(pts.filter(p => p[f] < corte), prof + 1, limite, rnd),
        dir: construir(pts.filter(p => p[f] >= corte), prof + 1, limite, rnd) };
    }
  }
  return { folha: true, n: pts.length };
}

export function treinar(dados: number[][], { arvores = 100, amostra = 256, semente = 42 } = {}): Floresta {
  const rnd = mulberry32(semente);
  const m = Math.min(amostra, dados.length);
  const limite = Math.ceil(Math.log2(Math.max(m, 2)));
  return {
    amostra: m,
    arvores: Array.from({ length: arvores }, () => {
      const idx = new Set<number>();
      while (idx.size < m) idx.add(Math.floor(rnd() * dados.length));
      return construir([...idx].map(i => dados[i]), 0, limite, rnd);
    }),
  };
}

const caminho = (no: No, x: number[], prof: number): number =>
  no.folha ? prof + c(no.n) : caminho(x[no.f] < no.corte ? no.esq : no.dir, x, prof + 1);

/** 0–1: perto de 1 = anomalia; 0,5 ou menos = normal. */
export function pontuar(f: Floresta, x: number[]): number {
  if (f.amostra < 2 || !f.arvores.length) return 0;
  const media = f.arvores.reduce((s, a) => s + caminho(a, x, 0), 0) / f.arvores.length;
  return 2 ** (-media / c(f.amostra));
}
