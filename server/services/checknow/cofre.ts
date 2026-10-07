/*
 * MetricFlow — cifra senhas/tokens das contas do CheckNow e do Infleet (AES-256-GCM).
 * Chave: CHECKNOW_CHAVE (32 bytes em base64) só no .env. Formato: iv:tag:dados (base64).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function chave(): Buffer {
  const k = process.env.CHECKNOW_CHAVE ? Buffer.from(process.env.CHECKNOW_CHAVE, "base64") : null;
  if (!k || k.length !== 32) throw new Error("CHECKNOW_CHAVE não configurada (32 bytes em base64 no .env).");
  return k;
}

export function cofreDisponivel(): boolean {
  try { chave(); return true; } catch { return false; }
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map(b => b.toString("base64")).join(":");
}

export function decifrar(cifrado: string): string {
  const [iv, tag, dados] = cifrado.split(":").map(p => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}
