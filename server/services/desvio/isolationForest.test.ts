import { describe, it, expect } from "vitest";
import { mulberry32, pontuar, treinar } from "./isolationForest";

const rnd = mulberry32(1);
const normais = Array.from({ length: 1000 }, () => [rnd(), rnd(), rnd()]);
const fora = [5, 5, 5];

describe("isolationForest", () => {
  it("a anomalia plantada tem a maior nota", () => {
    const dados = [...normais, fora];
    const f = treinar(dados);
    const notas = dados.map(x => pontuar(f, x));
    expect(Math.max(...notas)).toBe(notas.at(-1));
    expect(notas.at(-1)!).toBeGreaterThan(0.6);
    expect(pontuar(f, [0.5, 0.5, 0.5])).toBeLessThan(0.5);
  });
  it("mesma semente → mesmas notas", () => {
    expect(pontuar(treinar(normais), fora)).toBe(pontuar(treinar(normais), fora));
  });
  it("dados constantes ou poucos não quebram", () => {
    expect(Number.isFinite(pontuar(treinar([[1], [1], [1]]), [1]))).toBe(true);
    expect(pontuar(treinar([[1]]), [1])).toBe(0);
  });
});
