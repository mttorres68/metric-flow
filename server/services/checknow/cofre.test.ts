import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "crypto";
import { cifrar, decifrar, cofreDisponivel } from "./cofre";

beforeEach(() => { process.env.CHECKNOW_CHAVE = randomBytes(32).toString("base64"); });

describe("cofre", () => {
  it("ida e volta", () => {
    expect(decifrar(cifrar("s3nh@ çã"))).toBe("s3nh@ çã");
  });
  it("mesmo texto vira cifras diferentes (iv aleatório)", () => {
    expect(cifrar("x")).not.toBe(cifrar("x"));
  });
  it("chave errada não decifra", () => {
    const c = cifrar("x");
    process.env.CHECKNOW_CHAVE = randomBytes(32).toString("base64");
    expect(() => decifrar(c)).toThrow();
  });
  it("sem chave: indisponível e erro claro", () => {
    delete process.env.CHECKNOW_CHAVE;
    expect(cofreDisponivel()).toBe(false);
    expect(() => cifrar("x")).toThrow("CHECKNOW_CHAVE não configurada");
  });
});
