import { describe, it, expect } from "vitest";
import { atalhos, diasEntre, somaDiasIso } from "@shared/intervalos";
import { periodoAte } from "./periodo";
import { CONFIG_ENTREGAS_PADRAO } from "@shared/entregas";

describe("intervalos de datas", () => {
  it("dias entre duas datas, contando as duas pontas", () => {
    expect(diasEntre("2026-09-01", "2026-09-30")).toBe(30);
    expect(diasEntre("2026-10-14", "2026-10-14")).toBe(1);
    expect(somaDiasIso("2026-02-28", 1)).toBe("2026-03-01");
  });
  it("atalhos terminam no último dia permitido; os que passam do limite somem", () => {
    const r = atalhos("2026-10-14", "2026-10-13", 31);
    expect(r.map(a => a.rotulo)).toEqual(["Ontem", "Últimos 7 dias", "Últimos 14 dias", "Últimos 30 dias", "Este mês", "Mês passado"]);
    expect(r.find(a => a.rotulo === "Últimos 7 dias")).toEqual({ rotulo: "Últimos 7 dias", de: "2026-10-07", ate: "2026-10-13" });
    expect(r.find(a => a.rotulo === "Este mês")).toEqual({ rotulo: "Este mês", de: "2026-10-01", ate: "2026-10-13" });
    expect(r.find(a => a.rotulo === "Mês passado")).toEqual({ rotulo: "Mês passado", de: "2026-09-01", ate: "2026-09-30" });
    expect(atalhos("2026-10-14", "2026-10-14").map(a => a.rotulo)[0]).toBe("Hoje");
    expect(atalhos("2026-10-14", "2026-10-14", 7).map(a => a.rotulo)).toEqual(["Hoje", "Ontem", "Últimos 7 dias"]);
  });
});

describe("periodoAte (validação das rotas)", () => {
  it("aceita até o limite de dias e recusa acima, ou datas invertidas", () => {
    const p = periodoAte(366);
    expect(p.safeParse({ revendaId: 5, de: "2025-10-15", ate: "2026-10-14" }).success).toBe(true);
    expect(p.safeParse({ revendaId: 5, de: "2025-10-13", ate: "2026-10-14" }).success).toBe(false);
    expect(p.safeParse({ revendaId: 5, de: "2026-10-14", ate: "2026-10-13" }).success).toBe(false);
    expect(periodoAte(31).safeParse({ revendaId: 5, de: "2026-09-01", ate: "2026-10-01" }).success).toBe(true);
  });
});

describe("config do previsto (Pathfind)", () => {
  it("tolerância do previsto: padrão 15 min", () => expect(CONFIG_ENTREGAS_PADRAO.previstoToleranciaMin).toBe(15));
});
