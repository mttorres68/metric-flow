import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getMapeamento,
  salvarMapeamento,
  removerMapeamento,
  listarCiclos,
  registrarCiclo,
  getCrmConfig,
  setCrmConfig,
} from "../db/crm";

// ─── Config Trello (reutiliza mesma lógica do trelloRouter) ───────────────────

function getTrelloConfig() {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardsRaw = process.env.TRELLO_BOARDS;
  if (!apiKey || !token || !boardsRaw) {
    throw new Error("Variáveis TRELLO_API_KEY, TRELLO_TOKEN e TRELLO_BOARDS não configuradas");
  }
  const boards: { revenda: string; boardId: string }[] = JSON.parse(boardsRaw);
  return { apiKey, token, boards };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function trelloFetch<T>(path: string, apiKey: string, token: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.trello.com/1${path}${sep}key=${apiKey}&token=${token}`;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const delay = Number(res.headers.get("Retry-After")) * 1000 || 1000 * Math.pow(2, attempt);
      await sleep(delay);
      continue;
    }
    if (!res.ok) throw new Error(`Trello API ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }
  throw new Error("trelloFetch: rate limit excedido");
}

async function trelloPost<T>(path: string, apiKey: string, token: string, body: Record<string, unknown>): Promise<T> {
  const url = `https://api.trello.com/1${path}?key=${apiKey}&token=${token}`;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      const delay = Number(res.headers.get("Retry-After")) * 1000 || 1000 * Math.pow(2, attempt);
      await sleep(delay);
      continue;
    }
    if (!res.ok) throw new Error(`Trello API POST ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }
  throw new Error("trelloPost: rate limit excedido");
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TrelloMember { id: string; fullName: string; username: string }
interface TrelloList   { id: string; name: string }
interface TrelloLabel  { id: string; name: string; color: string }

const DEFAULT_LABEL = { name: "Agenda", color: "green" };

// Garante que a etiqueta existe no board e retorna seu ID
async function getOrCreateLabelId(
  boardId: string,
  labelName: string,
  labelColor: string,
  apiKey: string,
  token: string,
  cache: Map<string, string>,
): Promise<string> {
  const key = `${boardId}:${labelName}`;
  if (cache.has(key)) return cache.get(key)!;

  const labels = await trelloFetch<TrelloLabel[]>(
    `/boards/${boardId}/labels?limit=200`,
    apiKey, token,
  );
  const existing = labels.find((l) => l.name === labelName);
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  await sleep(150);
  const created = await trelloPost<TrelloLabel>(
    "/labels", apiKey, token,
    { name: labelName, color: labelColor, idBoard: boardId },
  );
  cache.set(key, created.id);
  return created.id;
}

const AtividadeInput = z.object({
  codigo:    z.string(),
  nome:      z.string(),
  due:       z.string().nullable(),
  descricao: z.string().optional().default(""),
  checklist: z.array(z.string()).optional().default([]),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const crmRouter = router({
  // Retorna os boards configurados (reutiliza TRELLO_BOARDS)
  getBoards: publicProcedure.query(() => {
    const { boards } = getTrelloConfig();
    return boards;
  }),

  // Membros de um board específico
  getBoardMembers: publicProcedure
    .input(z.object({ boardId: z.string() }))
    .query(async ({ input }) => {
      const { apiKey, token } = getTrelloConfig();
      return trelloFetch<TrelloMember[]>(
        `/boards/${input.boardId}/members?fields=id,fullName,username`,
        apiKey, token,
      );
    }),

  // Listas de um board (para o user identificar a lista "Agenda")
  getBoardLists: publicProcedure
    .input(z.object({ boardId: z.string() }))
    .query(async ({ input }) => {
      const { apiKey, token } = getTrelloConfig();
      return trelloFetch<TrelloList[]>(
        `/boards/${input.boardId}/lists?fields=id,name&filter=open`,
        apiKey, token,
      );
    }),

  // Mapeamento salvo de role → membro por revenda
  getMapeamento: publicProcedure.query(() => getMapeamento()),

  // Salvar mapeamento de uma revenda
  salvarMapeamento: publicProcedure
    .input(z.object({
      revenda: z.string(),
      mapeamentos: z.array(z.object({
        role:             z.string(),
        trelloMemberId:   z.string(),
        trelloMemberName: z.string(),
      })),
    }))
    .mutation(({ input }) => salvarMapeamento(input.revenda, input.mapeamentos)),

  // Remover um mapeamento específico
  removerMapeamento: publicProcedure
    .input(z.object({ revenda: z.string(), role: z.string() }))
    .mutation(({ input }) => removerMapeamento(input.revenda, input.role)),

  // Criar cards de uma revenda em seu board Trello
  criarCardsRevenda: publicProcedure
    .input(z.object({
      revenda:    z.string(),
      boardId:    z.string(),
      listaId:    z.string(),
      memberId:   z.string().optional(),
      atividades: z.array(AtividadeInput),
      mes:        z.number().int(),
      ano:        z.number().int(),
    }))
    .mutation(async ({ input }) => {
      const { apiKey, token } = getTrelloConfig();
      const criados: string[] = [];
      const erros: { nome: string; erro: string }[] = [];

      // Carrega config de etiqueta (padrão: Agenda / green)
      const labelConfigRaw = await getCrmConfig("label_config");
      const labelConfig = labelConfigRaw
        ? (JSON.parse(labelConfigRaw) as { name: string; color: string })
        : DEFAULT_LABEL;

      // Cache de etiquetas para evitar N+1 calls por board
      const labelCache = new Map<string, string>();

      // Pré-resolve a etiqueta do board (uma vez para todos os cards)
      let boardLabelId: string | null = null;
      try {
        boardLabelId = await getOrCreateLabelId(
          input.boardId, labelConfig.name, labelConfig.color,
          apiKey, token, labelCache,
        );
        await sleep(200);
      } catch { /* não bloqueia a criação se a etiqueta falhar */ }

      for (const ativ of input.atividades) {
        try {
          const body: Record<string, unknown> = {
            idList: input.listaId,
            name:   ativ.nome,
            desc:   ativ.descricao,
          };
          if (ativ.due) body.due = ativ.due;
          if (input.memberId) body.idMembers = input.memberId;
          if (boardLabelId) body.idLabels = boardLabelId;

          const card = await trelloPost<{ id: string; shortUrl: string }>(
            "/cards", apiKey, token, body,
          );
          criados.push(card.id);
          await sleep(250);

          // Cria checklist "Evidências" se houver itens
          if (ativ.checklist && ativ.checklist.length > 0) {
            const cl = await trelloPost<{ id: string }>(
              "/checklists", apiKey, token,
              { idCard: card.id, name: "Evidências" },
            );
            await sleep(150);
            for (const item of ativ.checklist) {
              await trelloPost(
                `/checklists/${cl.id}/checkItems`, apiKey, token,
                { name: item },
              );
              await sleep(100);
            }
          }
        } catch (e: any) {
          erros.push({ nome: ativ.nome, erro: e.message });
        }
      }

      await registrarCiclo(
        input.revenda, input.mes, input.ano,
        criados.length,
        erros.length === 0 ? "criado" : criados.length > 0 ? "parcial" : "erro",
      );

      return { revenda: input.revenda, criados: criados.length, erros };
    }),

  // Retorna a lista "Agenda" (ou primeira lista) de cada board configurado
  getAgendaLists: publicProcedure.query(async () => {
    const { apiKey, token, boards } = getTrelloConfig();
    const result: { revenda: string; boardId: string; listaId: string; listaNome: string }[] = [];
    for (const board of boards) {
      try {
        const listas = await trelloFetch<TrelloList[]>(
          `/boards/${board.boardId}/lists?fields=id,name&filter=open`,
          apiKey, token,
        );
        await sleep(300);
        // Prioridade: "A fazer" → "Agenda" → primeira lista
        const afazerLista =
          listas.find((l) => /a\s*fazer/i.test(l.name)) ??
          listas.find((l) => /agenda/i.test(l.name)) ??
          listas[0];
        const agendaLista = afazerLista;
        if (agendaLista) {
          result.push({ revenda: board.revenda, boardId: board.boardId, listaId: agendaLista.id, listaNome: agendaLista.name });
        }
      } catch {
        // ignora boards com erro e continua
      }
    }
    return result;
  }),

  // Configuração de etiqueta global
  getLabelConfig: publicProcedure.query(async () => {
    const raw = await getCrmConfig("label_config");
    return raw ? (JSON.parse(raw) as { name: string; color: string }) : DEFAULT_LABEL;
  }),

  setLabelConfig: publicProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await setCrmConfig("label_config", JSON.stringify({ name: input.name, color: input.color }));
      return { ok: true };
    }),

  // Histórico de ciclos criados
  listarCiclos: publicProcedure.query(() => listarCiclos()),
});
