import { describe, it, expect } from "vitest";
import { detectarParadas, distM, type Posicao } from "./detectarParadas";

const T0 = Date.UTC(2026, 9, 5, 12, 0); // 05/10 09:00 BRT
const pos = (min: number, kmh: number, lat = -7, lon = -43, valida = true): Posicao =>
  ({ lat, lon, em: new Date(T0 + min * 60000), kmh, valida });
const minDe = (d: Date | null) => (d ? (d.getTime() - T0) / 60000 : null);

describe("distM", () => {
  it("0,001° de longitude no equador ≈ 111 m", () => {
    expect(distM(0, 0, 0, 0.001)).toBeCloseTo(111.2, 0);
  });
});

describe("detectarParadas", () => {
  it("parada simples entre dois movimentos", () => {
    const r = detectarParadas([pos(0, 40), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(m => pos(m, 0)), pos(11, 40)]);
    expect(r.paradas).toHaveLength(1);
    expect(minDe(r.paradas[0].inicio)).toBe(1);
    expect(minDe(r.paradas[0].fim)).toBe(11);
    expect(r.paradas[0].min).toBe(10);
    expect(minDe(r.primeiroMovimento)).toBe(0);
    expect(minDe(r.ultimoMovimento)).toBe(11);
  });

  it("descarta parada com menos de 1 min", () => {
    const r = detectarParadas([pos(0, 40), pos(1, 0), pos(1.5, 0), pos(1.8, 40)]);
    expect(r.paradas).toHaveLength(0);
  });

  it("funde paradas a menos de 50 m separadas por menos de 2 min", () => {
    const vinteM = -7 + 0.00018; // ≈ 20 m ao norte
    const r = detectarParadas([
      pos(0, 40), pos(1, 0), pos(5, 0), pos(6, 30), pos(7, 0, vinteM), pos(10, 0, vinteM), pos(11, 40),
    ]);
    expect(r.paradas).toHaveLength(1);
    expect(minDe(r.paradas[0].inicio)).toBe(1);
    expect(minDe(r.paradas[0].fim)).toBe(11);
    expect(r.paradas[0].min).toBe(10);
  });

  it("não funde paradas distantes", () => {
    const duzentosM = -7 + 0.0018; // ≈ 200 m
    const r = detectarParadas([
      pos(0, 40), pos(1, 0), pos(5, 0), pos(6, 30), pos(7, 0, duzentosM), pos(10, 0, duzentosM), pos(11, 40),
    ]);
    expect(r.paradas).toHaveLength(2);
  });

  it("intervalo longo sem posições (motor desligado) é uma parada só", () => {
    const r = detectarParadas([pos(0, 0), pos(120, 0), pos(121, 40)]);
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].min).toBe(121);
  });

  it("janela que termina parada fecha na última posição", () => {
    const r = detectarParadas([pos(0, 40), pos(1, 0), pos(5, 0)]);
    expect(r.paradas).toHaveLength(1);
    expect(minDe(r.paradas[0].fim)).toBe(5);
    expect(r.paradas[0].min).toBe(4);
  });

  it("ignora posições inválidas e ordena por horário", () => {
    const r = detectarParadas([pos(11, 40), pos(5, 0), pos(3, 90, -7, -43, false), pos(1, 0), pos(0, 40)]);
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].min).toBe(10);
  });

  it("sem nenhum movimento: primeiro/último movimento null", () => {
    const r = detectarParadas([pos(0, 0), pos(600, 0)]);
    expect(r.primeiroMovimento).toBeNull();
    expect(r.ultimoMovimento).toBeNull();
    expect(r.paradas).toHaveLength(1);
  });
});
