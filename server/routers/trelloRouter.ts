/*
 * MetricFlow — Trello Router
 * Busca cards em atraso e atividades do dia de cada board de revenda via Trello REST API
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

export interface CardAtividade {
  id: string;
  nome: string;
  due: string;
  lista: string;
  membros: string[];
  etiquetas: { nome: string; cor: string }[];
  url: string;
  descricao: string;
  comentarios: Comentario[];
}

export interface AtividadeRevenda {
  revenda: string;
  boardId: string;
  boardUrl: string;
  hoje: CardAtividade[];
  amanha: CardAtividade[];
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function trelloFetch<T>(
  path: string,
  apiKey: string,
  token: string,
  retries = 4,
  baseDelayMs = 1000
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.trello.com/1${path}${sep}key=${apiKey}&token=${token}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);

    if (res.status === 429) {
      if (attempt === retries) {
        throw new Error(`Trello API erro 429: rate limit excedido após ${retries + 1} tentativas`);
      }
      const retryAfter = Number(res.headers.get("Retry-After")) * 1000 || baseDelayMs * Math.pow(2, attempt);
      await sleep(retryAfter);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Trello API erro ${res.status}: ${await res.text()}`);
    }

    return res.json() as Promise<T>;
  }

  // unreachable, mas satisfaz o TypeScript
  throw new Error("trelloFetch: loop inesperado");
}

// Tipo da action de comentário retornada pela Trello API
interface TrelloCommentAction {
  id: string;
  idMemberCreator: string;
  data: { text: string; card: { id: string } };
  date: string;
  memberCreator: { fullName: string; username: string };
}

// ─── Helper compartilhado: busca dados brutos do board ───────────────────────

interface BoardData {
  cards: TrelloCard[];
  listMap: Map<string, string>;
  memberMap: Map<string, string>;
  comentariosPorCard: Map<string, Comentario[]>;
  todasListas: string[];
  boardUrl: string;
}

// Delay entre requests dentro de um board para evitar rajadas
const INTER_REQUEST_DELAY_MS = 200;

async function fetchBoardData(boardId: string, apiKey: string, token: string): Promise<BoardData> {
  const cards = await trelloFetch<TrelloCard[]>(
    `/boards/${boardId}/cards?filter=open&fields=id,name,due,dueComplete,labels,idMembers,idList,shortUrl,desc`,
    apiKey, token
  );
  await sleep(INTER_REQUEST_DELAY_MS);

  const lists = await trelloFetch<TrelloList[]>(
    `/boards/${boardId}/lists?fields=id,name`,
    apiKey, token
  );
  await sleep(INTER_REQUEST_DELAY_MS);

  const members = await trelloFetch<TrelloMember[]>(
    `/boards/${boardId}/members?fields=id,fullName,username`,
    apiKey, token
  );
  await sleep(INTER_REQUEST_DELAY_MS);

  const comentariosBoard = await trelloFetch<TrelloCommentAction[]>(
    `/boards/${boardId}/actions?filter=commentCard&fields=id,idMemberCreator,data,date,memberCreator&limit=1000`,
    apiKey, token
  );

  const listMap = new Map(lists.map((l) => [l.id, l.name]));
  const memberMap = new Map(members.map((m) => [m.id, m.fullName || m.username]));
  const todasListas = lists.map((l) => l.name);

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
  for (const [, lista] of comentariosPorCard) {
    lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  return { cards, listMap, memberMap, comentariosPorCard, todasListas, boardUrl: `https://trello.com/b/${boardId}` };
}

function toCardAtividade(c: TrelloCard, data: BoardData): CardAtividade {
  return {
    id: c.id,
    nome: c.name,
    due: c.due!,
    lista: data.listMap.get(c.idList) ?? "Lista desconhecida",
    membros: c.idMembers.map((id) => data.memberMap.get(id) ?? id),
    etiquetas: c.labels.map((l) => ({ nome: l.name, cor: l.color })),
    url: c.shortUrl,
    descricao: c.desc,
    comentarios: data.comentariosPorCard.get(c.id) ?? [],
  };
}

// ─── Cards em Atraso ──────────────────────────────────────────────────────────

async function getBoardOverdueCards(
  boardId: string,
  apiKey: string,
  token: string,
  listasPermitidas?: string[]
): Promise<{ cards: CardAtraso[]; boardUrl: string; todasListas: string[] }> {
  const now = new Date();
  const data = await fetchBoardData(boardId, apiKey, token);

  const listasSet = listasPermitidas && listasPermitidas.length > 0
    ? new Set(listasPermitidas)
    : null;

  const overdueCards: CardAtraso[] = data.cards
    .filter((c) => {
      if (!c.due || c.dueComplete || new Date(c.due) >= now) return false;
      if (listasSet) return listasSet.has(data.listMap.get(c.idList) ?? "");
      return true;
    })
    .map((c) => {
      const dueDate = new Date(c.due!);
      const diasAtraso = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...toCardAtividade(c, data),
        diasAtraso,
      };
    })
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  return { cards: overdueCards, boardUrl: data.boardUrl, todasListas: data.todasListas };
}

// ─── Atividades do Dia ────────────────────────────────────────────────────────

async function getBoardAtividades(
  boardId: string,
  apiKey: string,
  token: string,
  listasPermitidas?: string[]
): Promise<{ hoje: CardAtividade[]; amanha: CardAtividade[]; boardUrl: string; todasListas: string[] }> {
  const now = new Date();

  // Início e fim do dia de hoje (horário local do servidor)
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Início e fim do dia de amanhã
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(todayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const data = await fetchBoardData(boardId, apiKey, token);

  const listasSet = listasPermitidas && listasPermitidas.length > 0
    ? new Set(listasPermitidas)
    : null;

  const candidatos = data.cards.filter((c) => {
    if (!c.due || c.dueComplete) return false;
    if (listasSet && !listasSet.has(data.listMap.get(c.idList) ?? "")) return false;
    const due = new Date(c.due);
    return (due >= todayStart && due <= tomorrowEnd);
  });

  const hoje = candidatos
    .filter((c) => {
      const due = new Date(c.due!);
      return due >= todayStart && due <= todayEnd;
    })
    .map((c) => toCardAtividade(c, data))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  const amanha = candidatos
    .filter((c) => {
      const due = new Date(c.due!);
      return due >= tomorrowStart && due <= tomorrowEnd;
    })
    .map((c) => toCardAtividade(c, data))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return { hoje, amanha, boardUrl: data.boardUrl, todasListas: data.todasListas };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const trelloRouter = router({

  /** Retorna os cards em atraso de todas as revendas */
  getCardsAtraso: publicProcedure
    .input(z.object({
      listasPermitidas: z.array(z.string()).optional(),
    }).optional())
    .query(async ({ input }): Promise<RevendaAtraso[]> => {
      const { apiKey, token, boards } = getTrelloConfig();
      const listasPermitidas = input?.listasPermitidas;

      const resultados: RevendaAtraso[] = [];
      for (const { revenda, boardId } of boards) {
        try {
          const { cards, boardUrl, todasListas } = await getBoardOverdueCards(boardId, apiKey, token, listasPermitidas);
          resultados.push({ revenda, boardId, boardUrl, totalAtraso: cards.length, cards, todasListas });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          resultados.push({
            revenda, boardId,
            boardUrl: `https://trello.com/b/${boardId}`,
            totalAtraso: 0, cards: [], todasListas: [], erro: msg,
          });
        }
        await sleep(500); // pausa entre boards para respeitar o rate limit
      }
      return resultados;
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

  /** Retorna as atividades do dia (hoje e amanhã) de todas as revendas */
  getAtividadesDia: publicProcedure
    .input(z.object({
      listasPermitidas: z.array(z.string()).optional(),
    }).optional())
    .query(async ({ input }): Promise<AtividadeRevenda[]> => {
      const { apiKey, token, boards } = getTrelloConfig();
      const listasPermitidas = input?.listasPermitidas;

      const resultados: AtividadeRevenda[] = [];
      for (const { revenda, boardId } of boards) {
        try {
          const { hoje, amanha, boardUrl, todasListas } = await getBoardAtividades(boardId, apiKey, token, listasPermitidas);
          resultados.push({ revenda, boardId, boardUrl, hoje, amanha, todasListas });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          resultados.push({
            revenda, boardId,
            boardUrl: `https://trello.com/b/${boardId}`,
            hoje: [], amanha: [], todasListas: [], erro: msg,
          });
        }
        await sleep(500); // pausa entre boards para respeitar o rate limit
      }
      return resultados;
    }),
});
