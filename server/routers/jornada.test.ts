import { describe, it, expect } from "vitest";
import { nivelJornada, semanasAte } from "@shared/jornada";

describe("calendário de jornada", () => {
  it("53 semanas de domingo a sábado terminando na semana de `fim`; dias depois de `fim` ficam null", () => {
    const s = semanasAte("2026-10-15"); // quinta
    expect(s).toHaveLength(53);
    expect(s[0][0]).toBe("2025-10-12"); // domingo
    expect(s.at(-1)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", null, null]);
  });
  it("nível por horas: 0 sem jornada; <4h, <8h, <10h, 10h+", () => {
    expect([0, 3 * 60, 7 * 60, 9 * 60, 10 * 60].map(nivelJornada)).toEqual([0, 1, 2, 3, 4]);
  });
});
