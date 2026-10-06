import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("../../routers/infleetRouter", () => ({ infleetQuery: vi.fn() }));
import { infleetQuery } from "../../routers/infleetRouter";
import { blocos, buscarGpsLinha, mapaVeiculos, normalizarPlaca, SPEED_PARA_KMH } from "./infleetEntregas";

const q = infleetQuery as Mock;
const T0 = new Date("2026-10-05T07:00:00-03:00");
const em = (min: number) => new Date(T0.getTime() + min * 60000).toISOString();
const janela = { inicio: T0, fim: new Date(T0.getTime() + 2 * 3600000) };
const p = (min: number, speed: number) => ({ latitude: -7, longitude: -43, fixTime: em(min), speed, valid: true });

// Chaves: um beforeEach que devolve função vira teardown no vitest (chamaria o mock sem argumentos).
beforeEach(() => { q.mockReset(); });

describe("normalizarPlaca", () => {
  // Review Focus 3
  it("ignora caixa, hífen e espaços", () => {
    expect(normalizarPlaca("SOL-6B13")).toBe("SOL6B13");
    expect(normalizarPlaca(" sol 6b13 ")).toBe("SOL6B13");
  });
});

describe("mapaVeiculos", () => {
  it("indexa por placa normalizada", async () => {
    q.mockResolvedValue({ listVehicles: [{ id: "v1", plate: "SOL6B13" }] });
    expect((await mapaVeiculos()).get(normalizarPlaca("SOL-6B13"))).toBe("v1");
  });
});

describe("blocos", () => {
  it("divide a janela em blocos de 6 h", () => {
    const b = blocos(new Date("2026-10-05T07:00:00-03:00"), new Date("2026-10-05T23:59:59-03:00"));
    expect(b).toHaveLength(3);
    expect(b[0]).toEqual({ startAt: "2026-10-05T10:00:00.000Z", endAt: "2026-10-05T16:00:00.000Z" });
    expect(b[2].endAt).toBe("2026-10-06T02:59:59.000Z");
  });
});

describe("buscarGpsLinha", () => {
  it("converte posições, detecta paradas e lê o km", async () => {
    q.mockImplementation(async (query: string) =>
      query.includes("routeVehicleDetails")
        ? { routeVehicleDetails: { totalDistanceTraveled: 123456 } }
        : { listVehiclePositions: [p(0, 40 / SPEED_PARA_KMH), p(1, 0), p(10, 0), p(11, 40 / SPEED_PARA_KMH)] });
    const r = await buscarGpsLinha("v1", janela);
    expect(r.erro).toBeNull();
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].min).toBe(10);
    expect(r.kmGps).toBe(123.5);
  });

  it("sem posições → 'sem sinal GPS'", async () => {
    q.mockResolvedValue({ listVehiclePositions: [] });
    expect((await buscarGpsLinha("v1", janela)).erro).toBe("sem sinal GPS");
  });

  it("erro do Infleet não lança: vira GpsLinha com erro", async () => {
    q.mockRejectedValue(new Error("Infleet API HTTP 502"));
    expect((await buscarGpsLinha("v1", janela)).erro).toBe("falha no Infleet: Infleet API HTTP 502");
  });
});
