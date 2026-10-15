import { describe, it, expect } from "vitest";
import { alinharPlacas } from "./placas";

describe("alinharPlacas", () => {
  it("uma linha por placa (sem traço e maiúscula), com a grafia de cada fonte ou null", () => {
    const linhas = alinharPlacas({ pedidos: ["NFO0101", "sol6b13", ""], checknow: ["SOL-6B13", "UHQ-5H38"], infleet: ["SOL6B13", "UHQ5H38", "SOO8D21"] });
    expect(linhas).toEqual([
      { chave: "NFO0101", pedidos: "NFO0101", checknow: null, infleet: null },
      { chave: "SOL6B13", pedidos: "sol6b13", checknow: "SOL-6B13", infleet: "SOL6B13" },
      { chave: "SOO8D21", pedidos: null, checknow: null, infleet: "SOO8D21" },
      { chave: "UHQ5H38", pedidos: null, checknow: "UHQ-5H38", infleet: "UHQ5H38" },
    ]);
  });
});
