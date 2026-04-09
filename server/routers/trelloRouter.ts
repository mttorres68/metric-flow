/*
 * MetricFlow — Trello Router
 * Busca cards em atraso de cada board de revenda via Trello REST API
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

// ─── Tipos Trello ─────────────────────────────────────────────────────────────

interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

interface TrelloCard {
  id: string;
  name: string;
  due: string | null;
  dueComplete: boolean;
  labels: TrelloLabel[];
  idMembers: string[];
  idList: string;
  shortUrl: string;
  desc: string;
}

interface TrelloList {
  id: string;
  name: string;
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

export interface Comentario {
  id: string;
  autor: string;
  texto: string;
  data: string; // ISO string
}

export interface CardAtraso {
  id: string;
  nome: string;
  due: string;
  diasAtraso: number;
  lista: string;
  membros: string[];
  etiquetas: { nome: string; cor: string }[];
  url: string;
  descricao: string;
  comentarios: Comentario[];
}

export interface RevendaAtraso {
  revenda: string;
  boardId: string;
  boardUrl: string;
  totalAtraso: number;
  cards: CardAtraso[];
  todasListas: string[];
  erro?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

function getTrelloConfig() {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardsRaw = process.env.TRELLO_BOARDS;

  if (!apiKey || !token || !boardsRaw) {
    throw new Error("Variáveis TRELLO_API_KEY, TRELLO_TOKEN e TRELLO_BOARDS não configuradas no .env");
  }

  const boards: { revenda: string; boardId: string }[] = JSON.parse(boardsRaw);
  return { apiKey, token, boards };
}

// ─── Helpers API ──────────────────────────────────────────────────────────────

async function trelloFetch<T>(path: string, apiKey: string, token: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.trello.com/1${path}${sep}key=${apiKey}&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Trello API erro ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// Tipo da action de comentário retornada pela Trello API
interface TrelloCommentAction {
  id: string;
  idMemberCreator: string;
  data: { text: string; card: { id: string } };
  date: string;
  memberCreator: { fullName: string; username: string };
}

async function getBoardOverdueCards(
  boardId: string,
  apiKey: string,
  token: string,
  listasPermitidas?: string[]
): Promise<{ cards: CardAtraso[]; boardUrl: string; todasListas: string[] }> {
  const now = new Date();

  // Busca em paralelo: cards, listas, membros e comentários do board
  const [cards, lists, members, comentariosBoard] = await Promise.all([
    trelloFetch<TrelloCard[]>(
      `/boards/${boardId}/cards?filter=open&fields=id,name,due,dueComplete,labels,idMembers,idList,shortUrl,desc`,
      apiKey,
      token
    ),
    trelloFetch<TrelloList[]>(
      `/boards/${boardId}/lists?fields=id,name`,
      apiKey,
      token
    ),
    trelloFetch<TrelloMember[]>(
      `/boards/${boardId}/members?fields=id,fullName,username`,
      apiKey,
      token
    ),
    // Busca todos os comentários do board de uma vez (mais eficiente que por card)
    trelloFetch<TrelloCommentAction[]>(
      `/boards/${boardId}/actions?filter=commentCard&fields=id,idMemberCreator,data,date,memberCreator&limit=1000`,
      apiKey,
      token
    ),
  ]);

  const listMap = new Map(lists.map((l) => [l.id, l.name]));
  const memberMap = new Map(members.map((m) => [m.id, m.fullName || m.username]));
  const todasListas = lists.map((l) => l.name);

  // Agrupa comentários por cardId e ordena do mais recente para o mais antigo
  const comentariosPorCard = new Map<string, Comentario[]>();
  for (const action of comentariosBoard) {
    const cardId = action.data?.card?.id;
    if (!cardId) continue;
    if (!comentariosPorCard.has(cardId)) comentariosPorCard.set(cardId, []);
    comentariosPorCard.get(cardId)!.push({
      id: action.id,
      autor: action.memberCreator?.fullName || action.memberCreator?.username || "Desconhecido",
      texto: action.data?.text ?? "",
      data: action.date,
    });
  }
  // Ordena comentários: mais recente primeiro dentro de cada card
  for (const [, lista] of comentariosPorCard) {
    lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  // Filtro por lista
  const listasSet = listasPermitidas && listasPermitidas.length > 0
    ? new Set(listasPermitidas)
    : null;

  const overdueCards: CardAtraso[] = cards
    .filter((c) => {
      if (!c.due || c.dueComplete || new Date(c.due) >= now) return false;
      if (listasSet) {
        const nomeLista = listMap.get(c.idList) ?? "";
        return listasSet.has(nomeLista);
      }
      return true;
    })
    .map((c) => {
      const dueDate = new Date(c.due!);
      const diasAtraso = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: c.id,
        nome: c.name,
        due: c.due!,
        diasAtraso,
        lista: listMap.get(c.idList) ?? "Lista desconhecida",
        membros: c.idMembers.map((id) => memberMap.get(id) ?? id),
        etiquetas: c.labels.map((l) => ({ nome: l.name, cor: l.color })),
        url: c.shortUrl,
        descricao: c.desc,
        comentarios: comentariosPorCard.get(c.id) ?? [],
      };
    })
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  const boardUrl = `https://trello.com/b/${boardId}`;
  return { cards: overdueCards, boardUrl, todasListas };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const trelloRouter = router({

  /** Retorna os cards em atraso de todas as revendas */
  getCardsAtraso: publicProcedure
    .input(z.object({
      // Filtro global de listas: se vazio, busca todas
      listasPermitidas: z.array(z.string()).optional(),
    }).optional())
    .query(async ({ input }): Promise<RevendaAtraso[]> => {
      const { apiKey, token, boards } = getTrelloConfig();
      const listasPermitidas = input?.listasPermitidas;

      const results = await Promise.allSettled(
        boards.map(async ({ revenda, boardId }) => {
          const { cards, boardUrl, todasListas } = await getBoardOverdueCards(boardId, apiKey, token, listasPermitidas);
          return {
            revenda,
            boardId,
            boardUrl,
            totalAtraso: cards.length,
            cards,
            todasListas,
          } satisfies RevendaAtraso;
        })
      );

      return results.map((result, i) => {
        if (result.status === "fulfilled") return result.value;
        return {
          revenda: boards[i].revenda,
          boardId: boards[i].boardId,
          boardUrl: `https://trello.com/b/${boards[i].boardId}`,
          totalAtraso: 0,
          cards: [],
          todasListas: [],
          erro: result.reason?.message ?? "Erro desconhecido",
        };
      });
    }),

  /** Retorna cards em atraso de uma revenda específica */
  getCardsPorRevenda: publicProcedure
    .input(z.object({
      revenda: z.string(),
      listasPermitidas: z.array(z.string()).optional(),
    }))
    .query(async ({ input }): Promise<RevendaAtraso> => {
      const { apiKey, token, boards } = getTrelloConfig();
      const board = boards.find((b) => b.revenda === input.revenda);
      if (!board) throw new Error(`Revenda "${input.revenda}" não encontrada na configuração`);

      const { cards, boardUrl, todasListas } = await getBoardOverdueCards(board.boardId, apiKey, token, input.listasPermitidas);
      return {
        revenda: board.revenda,
        boardId: board.boardId,
        boardUrl,
        totalAtraso: cards.length,
        cards,
        todasListas,
      };
    }),
});
