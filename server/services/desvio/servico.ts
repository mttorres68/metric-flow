/*
 * MetricFlow — detector de desvio de carga (spec desvio §8): junta pedidos (12 meses), evidências de GPS,
 * noites sem sinal e rotas; calcula sinais e estranheza; cache em memória por revenda até os dados mudarem.
 * ponytail: cache em processo único (produção = 1 réplica), como o agendador.
 */
import { diaBRT } from "@shared/entregas";
import { getConfigEntregas } from "../configService";
import { analisarPedidos, chaveRomaneio, porMotorista, romaneiosAbertos, type Caso } from "./analisar";
import { estranheza, type Estranheza } from "./estranheza";
import * as repo from "./repo";
import type { Revisao } from "./repo";

export type CasoTela = Caso & { estranheza: Estranheza | null; revisao: Revisao | null };
interface Base { casos: Caso[]; estranheza: Map<string, Estranheza> }

const DIA_MS = 86_400_000;
const menosDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) - n * DIA_MS).toISOString().slice(0, 10);
// A Promise fica no cache: as 4 consultas da aba chegam juntas e calculam uma vez só.
const cache = new Map<number, { chave: string; base: Promise<Base> }>();

async function calcular(revendaId: number, hoje: string, raioM: number): Promise<Base> {
  const desde = menosDias(hoje, 365);
  const [pedidos, evidencias, semSinal, rotas, desatualizados] = await Promise.all([
    repo.carregarPedidos(revendaId, desde), repo.carregarEvidencias(revendaId, desde),
    repo.noitesSemSinal(revendaId, desde), repo.rotasDosPedidos(revendaId, desde), repo.pedidosDesatualizados(revendaId),
  ]);
  const casos = analisarPedidos({ pedidos, evidencias, semSinal, rotas, hoje, raioM, desatualizados });
  return { casos, estranheza: estranheza(casos) };
}

async function base(revendaId: number): Promise<Base> {
  const hoje = diaBRT(new Date());
  const [cfg, versao] = await Promise.all([getConfigEntregas(), repo.versao(revendaId)]);
  const chave = `${hoje}|${cfg.raioM}|${versao}`;
  const c = cache.get(revendaId);
  if (c?.chave === chave) return c.base;
  const nova = calcular(revendaId, hoje, cfg.raioM);
  cache.set(revendaId, { chave, base: nova });
  nova.catch(() => { if (cache.get(revendaId)?.base === nova) cache.delete(revendaId); });
  return nova;
}

async function paraTela(revendaId: number, casos: Caso[], b: Base): Promise<CasoTela[]> {
  const rev = await repo.revisoes(revendaId);
  return casos.map(c => ({ ...c, estranheza: b.estranheza.get(c.pedido.pedido) ?? null, revisao: rev.get(c.pedido.pedido) ?? null }));
}
const noPeriodo = (c: Caso, de: string, ate: string) => c.dia >= de && c.dia <= ate;
const ordem = (a: Caso, b: Caso) => b.nota - a.nota || b.pedido.valor - a.pedido.valor;

export async function fila(revendaId: number, de: string, ate: string, incluirRevisados = false): Promise<CasoTela[]> {
  const b = await base(revendaId);
  const cs = await paraTela(revendaId, b.casos.filter(c => c.nota >= 30 && noPeriodo(c, de, ate)), b);
  return cs.filter(c => incluirRevisados || c.revisao?.situacao !== "ok").sort(ordem);
}

export async function paraOlhar(revendaId: number, de: string, ate: string): Promise<CasoTela[]> {
  const b = await base(revendaId);
  const cs = b.casos.filter(c => c.nota < 30 && noPeriodo(c, de, ate) && (b.estranheza.get(c.pedido.pedido)?.nota ?? 0) >= 99);
  return (await paraTela(revendaId, cs, b)).sort((x, y) => (y.estranheza?.nota ?? 0) - (x.estranheza?.nota ?? 0));
}

export const abertos = async (revendaId: number) => romaneiosAbertos((await base(revendaId)).casos);

export async function motoristas(revendaId: number, de: string, ate: string) {
  const b = await base(revendaId);
  return porMotorista(b.casos.filter(c => noPeriodo(c, de, ate)), romaneiosAbertos(b.casos));
}

export async function detalhe(revendaId: number, pedido: string) {
  const b = await base(revendaId);
  const caso = b.casos.find(c => c.pedido.pedido === pedido);
  if (!caso) return null;
  const doCliente = b.casos.map(c => c.pedido).filter(p => p.cliente === caso.pedido.cliente && p.pedido !== pedido
    && (p.dataPedido ?? "") <= (caso.pedido.dataPedido ?? "")).sort((x, y) => (y.dataPedido ?? "").localeCompare(x.dataPedido ?? ""));
  const [t, ...romaneio] = await paraTela(revendaId, [caso, ...b.casos.filter(c => chaveRomaneio(c.pedido) === chaveRomaneio(caso.pedido) && c !== caso)], b);
  return { caso: t, anteriores: doCliente.slice(0, 5), romaneio };
}

export const revisar = repo.revisar;
