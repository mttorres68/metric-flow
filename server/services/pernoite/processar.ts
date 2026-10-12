/* MetricFlow — monta e grava as noites de uma revenda num dia (spec pernoite §7). */
import { diaBRT } from "@shared/entregas";
import * as cn from "../checknow/repo";
import { cruzar, montarLinhas } from "../entregas/cruzar";
import { buscarGpsLinha, mapaVeiculos, normalizarPlaca, sedeDaConta } from "../entregas/infleetEntregas";
import { getConfigEntregas } from "../configService";
import { analisarNoite, type Noite } from "./analisar";
import { gravarNoites } from "./repo";

const DIA_MS = 86_400_000;
const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

export async function processarNoites(revendaId: number, dia: string): Promise<number> {
  const seguinte = somaDias(dia, 1);
  const [token, cfg, entregas, doSeguinte] = await Promise.all([
    cn.tokenInfleet(revendaId), getConfigEntregas(), cn.entregasDoPeriodo(revendaId, dia, dia), cn.entregasDoPeriodo(revendaId, seguinte, seguinte),
  ]);
  const sede = await sedeDaConta(token);
  if (!sede) throw new Error("cerca Sede não encontrada no Infleet");
  const veiculos = await mapaVeiculos(token);
  const linhas = montarLinhas(entregas, new Date()).filter(l => l.data === dia);
  const porPlaca = new Map<string, typeof linhas>();
  for (const l of linhas) porPlaca.set(l.placa, [...(porPlaca.get(l.placa) ?? []), l]);

  const noites: Noite[] = [];
  for (const [placa, ls] of porPlaca) {
    const vId = veiculos.get(normalizarPlaca(placa));
    if (!vId) continue;
    const janela = { inicio: new Date(`${dia}T00:00:00-03:00`), fim: new Date(`${seguinte}T12:00:00-03:00`) };
    const gps = await buscarGpsLinha(vId, janela, { token, saidaMinima: cfg.saidaMinima });
    if (gps.erro) continue;
    const rotas = new Set(ls.map(l => l.routeId));
    const daPlaca = entregas.filter(e => rotas.has(e.routeId));
    const baixas = ls.flatMap(l => cruzar(l, daPlaca.filter(e => e.routeId === l.routeId), gps, cfg).baixas);
    const pendentes = daPlaca.filter(e => e.situacao === "AGUARDANDO" || !e.baixaEm || diaBRT(e.baixaEm) > dia);
    const clientesSeguinte = doSeguinte.filter(e => e.placa === placa && e.lat !== null && e.lon !== null).map(e => ({ lat: e.lat!, lon: e.lon! }));
    const motorista = [...ls].sort((a, b) => a.janela.inicio.getTime() - b.janela.inicio.getTime()).at(-1)!.motorista;
    noites.push(analisarNoite({ dia, placa, motorista, paradas: gps.paradas, eventos: gps.eventos, baixas, pendentes, clientesSeguinte, sede, cfg }));
  }
  await gravarNoites(revendaId, noites);
  return noites.length;
}

const status = new Map<number, { feitos: number; total: number; rodando: boolean }>();
export const statusReprocessamento = (revendaId: number) => status.get(revendaId) ?? null;

/** Um dia por vez, em segundo plano; erros de um dia não param os outros. */
export function reprocessar(revendaId: number, de: string, ate: string): void {
  if (status.get(revendaId)?.rodando) return;
  const dias: string[] = [];
  for (let d = de; d <= ate; d = somaDias(d, 1)) dias.push(d);
  status.set(revendaId, { feitos: 0, total: dias.length, rodando: true });
  void (async () => {
    for (const d of dias) {
      await processarNoites(revendaId, d).catch(e => console.warn(`[pernoite] ${revendaId} ${d}: ${(e as Error).message}`));
      status.get(revendaId)!.feitos++;
    }
    status.get(revendaId)!.rodando = false;
  })();
}
