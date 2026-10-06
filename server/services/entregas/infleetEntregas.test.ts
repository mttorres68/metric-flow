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
        ? { routeVehicleDetails: { totalDistanceTraveled: 123456, totalTimeStoppedWithIgnitionOn: 1800 } }
        : { listVehiclePositions: [p(0, 40 / SPEED_PARA_KMH), p(1, 0), p(10, 0), p(11, 40 / SPEED_PARA_KMH)] });
    const r = await buscarGpsLinha("v1", janela);
    expect(r.erro).toBeNull();
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].min).toBe(10);
    expect(r.kmGps).toBe(123.5);
    expect(r.ociosoMin).toBe(30); // 1800 s parado com motor ligado
  });


  describe("saída e retorno pela cerca", () => {
    // GPS: parado 0–11, anda 11–21, parado 21–30 → saída GPS aos 11, retorno GPS aos 21
    const movimento = [p(0, 0), p(10, 0), p(11, 40), p(20, 40), p(21, 0), p(30, 0)];
    type Ev = { slugName: "geofenceExit" | "geofenceEnter"; reportedAt: string; geofenceId: string };
    const saiu = (min: number, cerca = "sede"): Ev => ({ slugName: "geofenceExit", reportedAt: em(min), geofenceId: cerca });
    const entrou = (min: number, cerca = "sede"): Ev => ({ slugName: "geofenceEnter", reportedAt: em(min), geofenceId: cerca });
    const responder = (eventos: Ev[]) =>
      q.mockImplementation(async (query: string) =>
        query.includes("routeVehicleDetails") ? { routeVehicleDetails: { totalDistanceTraveled: 10 } }
          : query.includes("listEvents") ? { listEvents: eventos }
          : { listVehiclePositions: movimento });

    it("saída = 1ª saída da cerca escolhida; retorno = última entrada depois da saída", async () => {
      responder([entrou(2), saiu(8), saiu(5, "outra"), entrou(25), entrou(27, "outra")]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect(r.saida?.toISOString()).toBe(em(8));
      expect(r.saidaOrigem).toBe("cerca");
      expect(r.retorno?.toISOString()).toBe(em(25));
      expect(r.retornoOrigem).toBe("cerca");
    });

    it("entrada só antes da saída não é retorno: retorno volta para o GPS", async () => {
      responder([entrou(2), saiu(8)]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect(r.saidaOrigem).toBe("cerca");
      expect(r.retorno?.toISOString()).toBe(em(21));
      expect(r.retornoOrigem).toBe("gps");
    });

    it("sem eventos da cerca escolhida, saída e retorno pelo GPS", async () => {
      responder([saiu(5, "outra"), entrou(25, "outra")]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect(r.saida?.toISOString()).toBe(em(11));
      expect(r.retorno?.toISOString()).toBe(em(21));
      expect([r.saidaOrigem, r.retornoOrigem]).toEqual(["gps", "gps"]);
    });

    it("entrou na cerca sem ter saído dela no dia (saída pelo GPS): retorno pela cerca se for depois da saída", async () => {
      responder([entrou(25)]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect([r.saidaOrigem, r.retornoOrigem]).toEqual(["gps", "cerca"]);
      expect(r.retorno?.toISOString()).toBe(em(25));
    });

    it("sem cerca escolhida, nem consulta eventos", async () => {
      responder([saiu(8), entrou(25)]);
      const r = await buscarGpsLinha("v1", janela);
      expect([r.saidaOrigem, r.retornoOrigem]).toEqual(["gps", "gps"]);
      expect(q.mock.calls.some(c => String(c[0]).includes("listEvents"))).toBe(false);
    });
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
