import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("../../routers/infleetRouter", () => ({ infleetQuery: vi.fn() }));
import { infleetQuery } from "../../routers/infleetRouter";
import { blocos, buscarGpsLinha, mapaVeiculos, normalizarPlaca, SPEED_PARA_KMH } from "./infleetEntregas";

const q = infleetQuery as Mock;
const T0 = new Date("2026-10-05T07:00:00-03:00");
const em = (min: number) => new Date(T0.getTime() + min * 60000).toISOString();
const janela = { inicio: T0, fim: new Date(T0.getTime() + 2 * 3600000) };
const p = (min: number, speed: number) => ({ latitude: -7, longitude: -43, fixTime: em(min), speed, valid: true });

type Ev = {
  slugName: string; reportedAt: string; address?: string | null; latitude?: number; longitude?: number;
  geofenceId?: string | null; geofence?: { name: string } | null; attributes?: Record<string, unknown> | null;
};
/** Responde posições, eventos e km como o Infleet. */
const responder = (posicoes: ReturnType<typeof p>[], eventos: Ev[] = [], km = 10) =>
  q.mockImplementation(async (query: string) =>
    query.includes("routeVehicleDetails") ? { routeVehicleDetails: { totalDistanceTraveled: km } }
      : query.includes("listEvents") ? { listEvents: eventos }
      : { listVehiclePositions: posicoes });

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
    responder([p(0, 40 / SPEED_PARA_KMH), p(1, 0), p(10, 0), p(11, 40 / SPEED_PARA_KMH)], [], 123456);
    const r = await buscarGpsLinha("v1", janela);
    expect(r.erro).toBeNull();
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].min).toBe(10);
    expect(r.kmGps).toBe(123.5);
    expect(r.trajeto.t).toHaveLength(4); // km acumulado pela estrada, posição a posição
  });

  it("traz os eventos do dia em ordem, com endereço, cerca e duração da marcha lenta", async () => {
    responder([p(0, 0), p(10, 0)], [
      { slugName: "geofenceEnter", reportedAt: em(40), address: "Rua João Dantas, Floriano", latitude: -6.7, longitude: -43, geofenceId: "sede", geofence: { name: "Sede" }, attributes: {} },
      { slugName: "deviceIdle", reportedAt: em(30), address: "Rodovia PI-130, Palmeirais", latitude: -5.9, longitude: -43.1, geofenceId: null, geofence: null, attributes: { duration: 722 } },
    ]);
    const r = await buscarGpsLinha("v1", janela);
    expect(r.eventos.map(e => [e.tipo, e.em.toISOString(), e.endereco, e.cerca, e.duracaoMin])).toEqual([
      ["deviceIdle", em(30), "Rodovia PI-130, Palmeirais", null, 12],
      ["geofenceEnter", em(40), "Rua João Dantas, Floriano", "Sede", null],
    ]);
  });

  describe("saída e retorno pela cerca", () => {
    // GPS: parado 0–11, anda 11–21, parado 21–30 → saída GPS aos 11, retorno GPS aos 21
    const movimento = [p(0, 0), p(10, 0), p(11, 40), p(20, 40), p(21, 0), p(30, 0)];
    const saiu = (min: number, cerca = "sede"): Ev => ({ slugName: "geofenceExit", reportedAt: em(min), geofenceId: cerca });
    const entrou = (min: number, cerca = "sede"): Ev => ({ slugName: "geofenceEnter", reportedAt: em(min), geofenceId: cerca });

    it("dormiu na cerca: saída = quando saiu dela; retorno = quando entrou para ficar", async () => {
      responder(movimento, [saiu(8), saiu(5, "outra"), entrou(25), entrou(27, "outra")]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect(r.saida?.toISOString()).toBe(em(8));
      expect(r.saidaOrigem).toBe("cerca");
      expect(r.retorno?.toISOString()).toBe(em(25));
      expect(r.retornoOrigem).toBe("cerca");
    });

    it("dormiu fora e manobrou na borda da cerca (saiu e entrou em 1 min): saída pelo GPS, retorno na 1ª entrada", async () => {
      // caso real: SOO-8D21 em 06/10 — entrou 11:33, saiu 12:02, entrou 12:03
      responder(movimento, [entrou(22), saiu(24), entrou(25)]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect([r.saidaOrigem, r.saida?.toISOString()]).toEqual(["gps", em(11)]);
      expect([r.retornoOrigem, r.retorno?.toISOString()]).toEqual(["cerca", em(22)]);
    });

    it("saiu e voltou rápido logo cedo (menos de 15 min fora): a saída é a última", async () => {
      responder(movimento, [saiu(5), entrou(7), saiu(9)]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect([r.saidaOrigem, r.saida?.toISOString()]).toEqual(["cerca", em(9)]);
    });

    it("passou pela cerca no meio do dia e saiu de novo: não é retorno", async () => {
      responder(movimento, [saiu(8), entrou(40), saiu(60)]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect(r.saidaOrigem).toBe("cerca");
      expect(r.retornoOrigem).toBe("gps");
    });

    it("sem eventos da cerca escolhida, saída e retorno pelo GPS", async () => {
      responder(movimento, [saiu(5, "outra"), entrou(25, "outra")]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect(r.saida?.toISOString()).toBe(em(11));
      expect(r.retorno?.toISOString()).toBe(em(21));
      expect([r.saidaOrigem, r.retornoOrigem]).toEqual(["gps", "gps"]);
    });

    it("entrou na cerca sem ter saído dela no dia (saída pelo GPS): retorno pela cerca se for depois da saída", async () => {
      responder(movimento, [entrou(25)]);
      const r = await buscarGpsLinha("v1", janela, "sede");
      expect([r.saidaOrigem, r.retornoOrigem]).toEqual(["gps", "cerca"]);
      expect(r.retorno?.toISOString()).toBe(em(25));
    });

    it("sem cerca escolhida, saída e retorno pelo GPS mesmo com eventos de cerca", async () => {
      responder(movimento, [saiu(8), entrou(25)]);
      const r = await buscarGpsLinha("v1", janela);
      expect([r.saidaOrigem, r.retornoOrigem]).toEqual(["gps", "gps"]);
      expect(r.saida?.toISOString()).toBe(em(11));
    });
  });

  it("sem posições → 'sem sinal GPS'", async () => {
    q.mockResolvedValue({ listVehiclePositions: [] });
    expect((await buscarGpsLinha("v1", janela)).erro).toBe("sem sinal GPS");
  });

  it("erro do Infleet não lança: vira GpsLinha com erro curto (sem a página HTML)", async () => {
    q.mockRejectedValue(new Error("Infleet API HTTP 502: <!DOCTYPE html>\n<html>…página enorme…</html>"));
    expect((await buscarGpsLinha("v1", janela)).erro).toBe("falha no Infleet: Infleet API HTTP 502");
  });

  it("falha passageira do Infleet: tenta de novo uma vez", async () => {
    responder([p(0, 0), p(10, 0)]);
    const real = q.getMockImplementation()!;
    q.mockImplementationOnce(async () => { throw new Error("Infleet API HTTP 502"); });
    q.mockImplementation(real);
    expect((await buscarGpsLinha("v1", janela)).erro).toBeNull();
  });
});
