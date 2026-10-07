import { describe, it, expect, vi } from "vitest";
vi.mock("./repo", () => ({}));
vi.mock("./sincronizar", () => ({}));
import { periodoDoTipo, periodoRecuperacao, proximaExecucao } from "./agendador";

const brt = (s: string) => new Date(`${s}-03:00`);

describe("proximaExecucao", () => {
  it("antes das 6h → 06:05", () => expect(proximaExecucao(brt("2026-10-07T05:50:00"))).toEqual({ em: brt("2026-10-07T06:05:00"), tipo: "hora" }));
  it("no meio do dia → próxima hora :05", () => expect(proximaExecucao(brt("2026-10-07T10:05:00")).em).toEqual(brt("2026-10-07T11:05:00")));
  it("depois das 22:05 → 23:30 (noite)", () => expect(proximaExecucao(brt("2026-10-07T22:10:00"))).toEqual({ em: brt("2026-10-07T23:30:00"), tipo: "noite" }));
  it("depois das 23:30 → 06:05 do dia seguinte", () => expect(proximaExecucao(brt("2026-10-07T23:40:00")).em).toEqual(brt("2026-10-08T06:05:00")));
});

describe("períodos", () => {
  it("hora: ontem e hoje; noite: últimos 3 dias", () => {
    expect(periodoDoTipo("hora", "2026-10-07")).toEqual({ de: "2026-10-06", ate: "2026-10-07" });
    expect(periodoDoTipo("noite", "2026-10-07")).toEqual({ de: "2026-10-05", ate: "2026-10-07" });
  });
  it("recuperação: desde o último ok, no máximo 7 dias", () => {
    expect(periodoRecuperacao("2026-10-05", "2026-10-07")).toEqual({ de: "2026-10-05", ate: "2026-10-07" });
    expect(periodoRecuperacao("2026-09-01", "2026-10-07")).toEqual({ de: "2026-09-30", ate: "2026-10-07" });
    expect(periodoRecuperacao(null, "2026-10-07")).toEqual({ de: "2026-09-30", ate: "2026-10-07" });
  });
});
