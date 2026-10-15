/* MetricFlow — monta e grava as noites de uma revenda num dia (spec pernoite §7). */
import { diaBRT } from "@shared/entregas";
import * as cn from "../checknow/repo";
import { cruzar, montarLinhas } from "../entregas/cruzar";
import { buscarGpsLinha, mapaVeiculos, normalizarPlaca, sedeDaConta } from "../entregas/infleetEntregas";
import { getConfigEntregas } from "../configService";
import { analisarNoite, noiteSemLugar, SEM_ROTA, trocouDeCaminhao, type Noite } from "./analisar";
import { gravarNoites } from "./repo";
import { evidenciaDe, type EvidenciaNova } from "../desvio/evidencias";
import { gravarEvidencias } from "../desvio/repo";
import { registrarRotasDia } from "../produtividadeRota/registrar";

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
  const evidencias: EvidenciaNova[] = []; // GPS de cada entrega do dia, para o detector de desvio
  for (const [placa, ls] of porPlaca) {
    const vId = veiculos.get(normalizarPlaca(placa));
    if (!vId) continue;
    const janela = { inicio: new Date(`${dia}T00:00:00-03:00`), fim: new Date(`${seguinte}T12:00:00-03:00`) };
    const gps = await buscarGpsLinha(vId, janela, { token, saidaMinima: cfg.saidaMinima });
    const doDia = [...ls].sort((a, b) => a.janela.inicio.getTime() - b.janela.inicio.getTime()).at(-1)!.motorista;
    // Trocou de caminhão no dia: esta noite não é dele (nem as entregas e pendências dele contam aqui).
    const trocou = trocouDeCaminhao(dia, placa, doDia, entregas);
    const motorista = trocou ? SEM_ROTA : doDia;
    // Rastreador mudo com rota no dia vira noite "sem sinal"; falha da API do Infleet não acusa o motorista.
    if (gps.erro === "sem sinal GPS") { noites.push(noiteSemLugar({ dia, placa, motorista }, "sem_sinal")); continue; }
    if (gps.erro) { console.warn(`[pernoite] ${revendaId} ${dia} ${placa}: ${gps.erro}`); continue; }
    const rotas = new Set(ls.map(l => l.routeId));
    const daPlaca = entregas.filter(e => rotas.has(e.routeId));
    const baixas = ls.flatMap(l => cruzar(l, daPlaca.filter(e => e.routeId === l.routeId), gps, cfg).baixas);
    evidencias.push(...baixas.map(b => evidenciaDe(dia, b, gps.paradas, cfg.saidaMinima)));
    const pendentes = daPlaca.filter(e => e.situacao === "AGUARDANDO" || !e.baixaEm || diaBRT(e.baixaEm) > dia);
    // Rota de vários dias volta inteira no dia seguinte: cliente já entregue em D não é cliente da manhã.
    const clientesSeguinte = doSeguinte.filter(e => e.placa === placa && e.lat !== null && e.lon !== null && (!e.baixaEm || diaBRT(e.baixaEm) > dia)).map(e => ({ lat: e.lat!, lon: e.lon! }));
    noites.push(analisarNoite({ dia, placa, motorista, paradas: gps.paradas, eventos: gps.eventos, baixas: trocou ? [] : baixas, pendentes: trocou ? [] : pendentes, totalRota: trocou ? 0 : daPlaca.length, clientesSeguinte, sede, cfg }));
  }
  await gravarNoites(revendaId, noites);
  await gravarEvidencias(revendaId, evidencias);
  // Produtividade da rota (spec rota-produtividade §5): o mesmo cruzamento da tela "Por dia", com a cerca Sede.
  // O erro sobe: pernoite e evidências já estão gravados; o reprocessamento conta o dia como erro.
  await registrarRotasDia(revendaId, dia, sede.cercaId ?? undefined);
  return noites.length;
}

const status = new Map<number, { feitos: number; total: number; rodando: boolean; erros: number; ultimoErro: string | null }>();
export const statusReprocessamento = (revendaId: number) => status.get(revendaId) ?? null;

/** Um dia por vez, em segundo plano; erros de um dia não param os outros. */
export function reprocessar(revendaId: number, de: string, ate: string): void {
  if (status.get(revendaId)?.rodando) return;
  const dias: string[] = [];
  for (let d = de; d <= ate; d = somaDias(d, 1)) dias.push(d);
  status.set(revendaId, { feitos: 0, total: dias.length, rodando: true, erros: 0, ultimoErro: null });
  void (async () => {
    for (const d of dias) {
      const s = status.get(revendaId)!;
      await processarNoites(revendaId, d).catch(e => {
        s.erros++;
        s.ultimoErro = (e as Error).message;
        console.warn(`[pernoite] ${revendaId} ${d}: ${s.ultimoErro}`);
      });
      s.feitos++;
    }
    status.get(revendaId)!.rodando = false;
  })();
}
