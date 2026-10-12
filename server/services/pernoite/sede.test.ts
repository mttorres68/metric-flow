import { describe, it, expect } from "vitest";
import { centroDoPoligono, dentroDoPoligono } from "./sede";

// quadrado 0,01° em volta de (-6,77, -43,02) — GeoJSON é [lon, lat]
const q: [number, number][] = [[-43.025, -6.775], [-43.015, -6.775], [-43.015, -6.765], [-43.025, -6.765], [-43.025, -6.775]];

describe("sede", () => {
  it("centro do polígono", () => {
    const c = centroDoPoligono(q);
    expect(c.lat).toBeCloseTo(-6.77, 6);
    expect(c.lon).toBeCloseTo(-43.02, 6);
  });
  it("ponto dentro e fora", () => {
    expect(dentroDoPoligono(-6.77, -43.02, q)).toBe(true);
    expect(dentroDoPoligono(-6.70, -43.02, q)).toBe(false);
  });
});
