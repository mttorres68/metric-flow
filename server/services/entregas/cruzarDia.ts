/*
 * MetricFlow — cruzamento do dia (tela "Por dia"): entregas do CheckNow × GPS × volumes do ERP, com a produtividade
 * em hL de cada linha. Usado pela tela e pelo processamento diário (spec rota-produtividade §5).
 */
import { diaBRT } from "@shared/entregas";
import { getConfigEntregas } from "../configService";
import * as repo from "../checknow/repo";
import * as erpRepo from "../erp/repo";
import { processarEntregas } from "./processar";
import { pontosDaLinha, produtividadeLinha, volumeEntrega, type ProdutividadeLinha, type VolumeEntrega } from "./produtividade";
import type { ResultadoLinha } from "./cruzar";
import type { AnaliseRota } from "./rota";
import type { Entrega } from "./parseCheckNow";
import { previstoDaLinha, type Previsto } from "../pathfind/previsto";
import { rotasPathfind } from "../pathfind/repo";

export type LinhaProcessada = ResultadoLinha & { volumes: (VolumeEntrega | null)[]; produtividade: ProdutividadeLinha; previsto: Previsto | null };

export async function cruzarDia(revendaId: number, de: string, ate: string, cercaId?: string): Promise<{ linhas: LinhaProcessada[]; rotas: AnaliseRota[]; entregas: Entrega[] }> {
  const [entregas, token, config] = await Promise.all([repo.entregasDoPeriodo(revendaId, de, ate), repo.tokenInfleet(revendaId), getConfigEntregas()]);
  const res = await processarEntregas(entregas, new Date(), { cercaId, token, config, periodo: { de, ate } });
  // Produtividade em hL: itens do ERP dos documentos das entregas; pontos de descarga guardados para o "4 semanas".
  const avisar = (o: string) => (e: unknown) => { console.warn(`[produtividade] ${o}: ${(e as Error).message}`); return undefined; };
  const itens = (await erpRepo.itensDosDocumentos(revendaId, entregas.flatMap(e => e.documentos)).catch(avisar("itens do ERP"))) ?? [];
  const desde = new Date(Date.parse(`${de}T12:00:00Z`) - 28 * 86_400_000).toISOString().slice(0, 10);
  // Previsto do Pathfind: simulação da véspera ou do dia de início de cada rota (spec pathfind-previsto §6).
  const inicioDaRota = new Map(entregas.filter(e => e.rotaInicio).map(e => [e.routeId, diaBRT(e.rotaInicio!)]));
  const inicios = res.linhas.map(l => inicioDaRota.get(l.linha.routeId) ?? l.linha.data).sort();
  const rotasPf = inicios.length
    ? (await rotasPathfind(revendaId, new Date(Date.parse(`${inicios[0]}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10), ate).catch(avisar("rotas do Pathfind"))) ?? []
    : [];
  const linhas = await Promise.all(res.linhas.map(async l => {
    const volume = (docs: string[]) => (docs.length ? volumeEntrega(docs, itens) : null);
    const volumes = l.baixas.map(b => volume(b.entrega.documentos));
    // Sem GPS não há baixas cruzadas: o volume do dia vem direto das entregas da rota naquele dia.
    const semGps = l.semGps ? entregas
      .filter(e => e.routeId === l.linha.routeId && e.situacao !== "AGUARDANDO" && e.baixaEm && diaBRT(e.baixaEm) === l.linha.data)
      .map(e => ({ situacao: e.situacao, vol: volume(e.documentos) })) : [];
    await erpRepo.gravarPontos(revendaId, pontosDaLinha(l, volumes)).catch(avisar("gravar pontos"));
    const p4 = (await erpRepo.pontosDoMotorista(revendaId, l.linha.motorista, desde, l.linha.data).catch(avisar("pontos de 4 semanas"))) ?? [];
    const previsto = previstoDaLinha(l, inicioDaRota.get(l.linha.routeId) ?? l.linha.data, rotasPf);
    return { ...l, volumes, produtividade: produtividadeLinha(l, volumes, config.raioM, p4, semGps), previsto };
  }));
  return { linhas, rotas: res.rotas, entregas };
}
