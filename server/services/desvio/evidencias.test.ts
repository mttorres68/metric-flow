import { describe, it, expect } from "vitest";
import { evidenciaDe } from "./evidencias";
import type { EntregaCruzada } from "../entregas/cruzar";

const inicio = new Date("2026-10-07T10:00:00-03:00"), fim = new Date("2026-10-07T10:30:00-03:00");
const cruzada = (o: Partial<EntregaCruzada> = {}, e: Record<string, unknown> = {}) => ({
  entrega: { routeId: "R1", codCliente: "9", placa: "SOL-6B13", motorista: "ANA", documentos: ["P1"], lat: -6.8, lon: -43, latApp: -6.809, lonApp: -43, ...e },
  status: "relampago", maisProxima: { inicio, fim, distM: 450.4, lat: -6.804, lon: -43 }, ...o,
}) as unknown as EntregaCruzada;

describe("evidenciaDe", () => {
  it("parada mais próxima e distância do registro no app", () => {
    const ev = evidenciaDe("2026-10-07", cruzada());
    expect(ev).toMatchObject({ dia: "2026-10-07", routeId: "R1", codCliente: "9", status: "relampago", distParadaM: 450, paradaLat: -6.804,
      paradaInicio: inicio, documentos: ["P1"], clienteLat: -6.8 });
    expect(ev.distAppM).toBeGreaterThan(995);
    expect(ev.distAppM).toBeLessThan(1005);
  });
  it("sem parada e sem registro no app → nulos", () => {
    const ev = evidenciaDe("2026-10-07", cruzada({ maisProxima: null }, { latApp: null, lonApp: null }));
    expect(ev).toMatchObject({ distParadaM: null, paradaInicio: null, distAppM: null });
  });
});
