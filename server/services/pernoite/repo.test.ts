import { describe, it, expect, vi } from "vitest";
vi.mock("../../db", () => ({ getDb: async () => null }));
import { resumir } from "./repo";

describe("resumir", () => {
  it("conta só as noites fora da Sede, ordena por na malícia e traz as cidades mais frequentes", () => {
    const n = (motorista: string, classificacao: string, cidade: string, galo = 0) => ({ motorista, classificacao, cidade, galo }) as never;
    const r = resumir([n("ANA", "normal", "A"), n("BETO", "na_malicia", "B", 2), n("BETO", "na_malicia", "B"), n("BETO", "evitavel", "C"), n("BETO", "na_base", "S")]);
    expect(r.map(x => x.motorista)).toEqual(["BETO", "ANA"]);
    expect(r[0]).toMatchObject({ noitesFora: 3, naMalicia: 2, evitavel: 1, comGalo: 1, lugares: [{ cidade: "B", noites: 2 }, { cidade: "C", noites: 1 }] });
  });
  it("noites sem sinal GPS contam à parte, fora das noites fora da Sede", () => {
    const n = (classificacao: string) => ({ motorista: "ISRAEL", classificacao, cidade: null, galo: 0 }) as never;
    expect(resumir([n("sem_sinal"), n("sem_sinal"), n("na_base")])).toEqual([
      { motorista: "ISRAEL", noitesFora: 0, naMalicia: 0, evitavel: 0, comGalo: 0, semSinal: 2, lugares: [] },
    ]);
  });
});
