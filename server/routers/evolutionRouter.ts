/*
 * MetricFlow — Evolution Router
 * Proxy para a Evolution API + CRUD de destinatários via PostgreSQL
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as waDb from "../db/whatsapp";

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  const apiUrl   = process.env.EVOLUTION_API_URL  || "http://localhost:8080";
  const apiKey   = process.env.EVOLUTION_API_KEY  || "";
  const instance = process.env.EVOLUTION_INSTANCE || "metricflow";
  return { apiUrl, apiKey, instance };
}

function getRevendasDisponiveis(): string[] {
  try {
    const raw = process.env.TRELLO_BOARDS;
    if (!raw) return [];
    const boards: { revenda: string }[] = JSON.parse(raw);
    return boards.map((b) => b.revenda);
  } catch {
    return [];
  }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function evoFetch<T>(method: string, urlPath: string, body?: unknown): Promise<T> {
  const { apiUrl, apiKey } = getConfig();
  const res = await fetch(`${apiUrl}${urlPath}`, {
    method,
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const evolutionRouter = router({

  // ── Configuração ────────────────────────────────────────────────────────────

  getConfig: publicProcedure.query(() => {
    const { instance, apiUrl } = getConfig();
    const apiKeySet = Boolean(
      process.env.EVOLUTION_API_KEY &&
      process.env.EVOLUTION_API_KEY !== "<MESMA_CHAVE_DO_EVOLUTION_ENV>"
    );
    return { instance, apiUrl, apiKeySet };
  }),

  getRevendas: publicProcedure.query(() => getRevendasDisponiveis()),

  // ── Conexão ─────────────────────────────────────────────────────────────────

  getStatus: publicProcedure.query(async () => {
    const { instance } = getConfig();
    try {
      const data = await evoFetch<{ instance?: { state?: string }; state?: string }>(
        "GET", `/instance/connectionState/${instance}`
      );
      const state: string = data.instance?.state ?? (data as any).state ?? "unknown";
      return { connected: state === "open", state, instance, error: null };
    } catch (e: any) {
      const notFound = e.message?.includes("404") || e.message?.includes("not found");
      return { connected: false, state: notFound ? "not_created" : "error", instance, error: e.message as string };
    }
  }),

  createInstance: publicProcedure.mutation(async () => {
    const { instance } = getConfig();
    const data = await evoFetch<unknown>("POST", "/instance/create", {
      instanceName: instance,
      integration: "WHATSAPP-BAILEYS",
    });
    return { success: true, data };
  }),

  connect: publicProcedure.mutation(async () => {
    const { instance } = getConfig();
    const data = await evoFetch<{ base64?: string; code?: string }>(
      "GET", `/instance/connect/${instance}`
    );
    return { qrCode: data.base64 ?? null, pairingCode: data.code ?? null };
  }),

  disconnect: publicProcedure.mutation(async () => {
    const { instance } = getConfig();
    await evoFetch("DELETE", `/instance/logout/${instance}`);
    return { success: true };
  }),

  // ── Destinatários ────────────────────────────────────────────────────────────

  listDestinatarios: publicProcedure.query(() => waDb.listDestinatarios()),

  getDestinatariosPorRevenda: publicProcedure
    .input(z.object({ revenda: z.string() }))
    .query(({ input }) => waDb.getDestinatariosByRevenda(input.revenda)),

  addDestinatario: publicProcedure
    .input(z.object({
      nome:     z.string().min(1),
      apelido:  z.string().default(""),
      telefone: z.string().min(10),
      revendas: z.array(z.string()).default([]),
    }))
    .mutation(({ input }) =>
      waDb.addDestinatario({
        nome:     input.nome,
        apelido:  input.apelido,
        telefone: input.telefone.replace(/\D/g, ""),
        revendas: input.revendas,
      })
    ),

  updateDestinatario: publicProcedure
    .input(z.object({
      id:       z.string(),
      nome:     z.string().min(1),
      apelido:  z.string().default(""),
      telefone: z.string().min(10),
      revendas: z.array(z.string()).default([]),
    }))
    .mutation(({ input }) =>
      waDb.updateDestinatario(input.id, {
        nome:     input.nome,
        apelido:  input.apelido,
        telefone: input.telefone.replace(/\D/g, ""),
        revendas: input.revendas,
      })
    ),

  setRevendasDestinatario: publicProcedure
    .input(z.object({ id: z.string(), revendas: z.array(z.string()) }))
    .mutation(({ input }) => waDb.setRevendas(input.id, input.revendas)),

  removeDestinatario: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await waDb.removeDestinatario(input.id);
      return { success: true };
    }),

  // ── Envio ────────────────────────────────────────────────────────────────────

  sendMessage: publicProcedure
    .input(z.object({ telefone: z.string(), texto: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { instance } = getConfig();
      await evoFetch("POST", `/message/sendText/${instance}`, {
        number: input.telefone,
        text: input.texto,
      });
      return { success: true, sentAt: new Date().toISOString() };
    }),

  sendPDF: publicProcedure
    .input(z.object({
      telefone:  z.string(),
      base64:    z.string(),
      filename:  z.string(),
      caption:   z.string().default(""),
      thumbnail: z.string().optional(), // base64 JPEG — exibido como prévia no WhatsApp
    }))
    .mutation(async ({ input }) => {
      const { instance } = getConfig();
      await evoFetch("POST", `/message/sendMedia/${instance}`, {
        number:    input.telefone,
        mediatype: "document",
        mimetype:  "application/pdf",
        media:     input.base64,
        fileName:  input.filename,
        caption:   input.caption,
        ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
      });
      return { success: true, sentAt: new Date().toISOString() };
    }),
});
