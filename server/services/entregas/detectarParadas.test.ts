import { describe, it, expect } from "vitest";
import { detectarParadas, distM, kmEntre, trajetoAcumulado, type Posicao } from "./detectarParadas";

const T0 = Date.UTC(2026, 9, 5, 12, 0); // 05/10 09:00 BRT
const pos = (min: number, kmh: number, lat = -7, lon = -43, valida = true): Posicao =>
  ({ lat, lon, em: new Date(T0 + min * 60000), kmh, valida });

const minDe = (d: Date | null) => (d ? (d.getTime() - T0) / 60000 : null);

describe("distM", () => {
  it("0,001° de longitude no equador ≈ 111 m", () => {
    expect(distM(0, 0, 0, 0.001)).toBeCloseTo(111.2, 0);
  });
});

describe("trajeto pela estrada", () => {
  it("soma o caminho percorrido (não a linha reta) entre dois horários", () => {
    // anda 1,1 km para o norte e depois 1,1 km para o leste: caminho ≈ 2,2 km, linha reta ≈ 1,56 km
    const tr = trajetoAcumulado([pos(0, 40, -7, -43), pos(1, 40, -6.99, -43), pos(2, 40, -6.99, -42.99), pos(3, 0, -6.99, -42.99)]);
    expect(kmEntre(tr, new Date(T0), new Date(T0 + 3 * 60000))).toBeCloseTo(2.21, 1);
    expect(kmEntre(tr, new Date(T0 + 60000), new Date(T0 + 3 * 60000))).toBeCloseTo(1.1, 1);
  });

  it("ignora o tremor do GPS com o caminhão parado", () => {
    const tremendo = [0, 1, 2, 3, 4].map(m => pos(m, 0, -7 + (m % 2) * 0.0002, -43)); // pula ~20 m para lá e para cá
    expect(kmEntre(trajetoAcumulado(tremendo), new Date(T0), new Date(T0 + 4 * 60000))).toBe(0);
  });

  it("sem posições, não há trajeto", () => {
    expect(kmEntre(trajetoAcumulado([]), new Date(T0), new Date(T0 + 60000))).toBeNull();
  });
});

describe("detectarParadas", () => {
  it("parada simples entre dois movimentos", () => {
    const r = detectarParadas([pos(0, 40), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(m => pos(m, 0)), pos(11, 40)]);
    expect(r.paradas).toHaveLength(1);
    expect(minDe(r.paradas[0].inicio)).toBe(1);
    expect(minDe(r.paradas[0].fim)).toBe(11);
    expect(r.paradas[0].min).toBe(10);
  });

  const parado = (de: number, ate: number, lat = -7) => Array.from({ length: ate - de + 1 }, (_, i) => pos(de + i, 0, lat));
  const andando = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => pos(de + i, 40, -7 + 0.01 * (i + 1)));

  it("saída = início do 1º trecho em movimento de 3 min ou mais; retorno = fim do último", () => {
    const r = detectarParadas([...parado(0, 60), ...andando(61, 80), ...parado(81, 100, -6.8), ...andando(101, 120), ...parado(121, 200)]);
    expect(minDe(r.saida)).toBe(61);
    expect(minDe(r.retorno)).toBe(121);
  });

  it("manobra de pátio (menos de 3 min em movimento) não conta como saída", () => {
    const cemM = -7 + 0.0009; // ≈ 100 m: não funde com a parada anterior
    const r = detectarParadas([...parado(0, 30), pos(31, 20, -7.0004), pos(32, 20, -7.0007), ...parado(33, 60, cemM), ...andando(61, 80), ...parado(81, 90, -6.5)]);
    expect(minDe(r.saida)).toBe(61);
    expect(minDe(r.retorno)).toBe(81);
  });

  it("janela toda em movimento: saída e retorno nas pontas", () => {
    const r = detectarParadas(andando(0, 10));
    expect(minDe(r.saida)).toBe(0);
    expect(minDe(r.retorno)).toBe(10);
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
    expect(r.saida).toBeNull();
    expect(r.retorno).toBeNull();
    expect(r.paradas).toHaveLength(1);
  });
});
