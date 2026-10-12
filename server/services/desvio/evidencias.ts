/* MetricFlow — evidência de GPS de uma entrega para o detector de desvio (spec desvio §4). */
import { distM } from "../entregas/detectarParadas";
import type { EntregaCruzada } from "../entregas/cruzar";
import type { Evidencia } from "./analisar";

export type EvidenciaNova = Evidencia & { routeId: string; codCliente: string };

export function evidenciaDe(dia: string, b: EntregaCruzada): EvidenciaNova {
  const e = b.entrega, p = b.maisProxima;
  return {
    dia, routeId: e.routeId, codCliente: e.codCliente, placa: e.placa, motorista: e.motorista, documentos: e.documentos, status: b.status,
    distParadaM: p ? Math.round(p.distM) : null, paradaLat: p?.lat ?? null, paradaLon: p?.lon ?? null, paradaInicio: p?.inicio ?? null, paradaFim: p?.fim ?? null,
    distAppM: e.lat !== null && e.lon !== null && e.latApp !== null && e.lonApp !== null ? Math.round(distM(e.lat, e.lon, e.latApp, e.lonApp)) : null,
    clienteLat: e.lat, clienteLon: e.lon,
  };
}
