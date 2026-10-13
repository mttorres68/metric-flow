/* MetricFlow — evidência de GPS de uma entrega para o detector de desvio (spec desvio §4). */
import { diaBRT, horaBRT } from "@shared/entregas";
import { distM, type Parada } from "../entregas/detectarParadas";
import type { EntregaCruzada } from "../entregas/cruzar";
import type { Evidencia } from "./analisar";

export type EvidenciaNova = Evidencia & { routeId: string; codCliente: string };

/** Parada mais longa que isso é descanso/pernoite, não descarga. */
export const PARADA_MAX_MIN = 180;

/**
 * Com `paradas` (GPS da janela do pernoite, que vai até o meio-dia seguinte), a parada mais próxima do cliente é
 * procurada só no dia de trabalho: início no próprio dia, a partir da saída mínima, e até PARADA_MAX_MIN — a noite
 * dormida perto de um cliente não é "parou perto". Sem `paradas`, vale a mais próxima do cruzamento.
 */
export function evidenciaDe(dia: string, b: EntregaCruzada, paradas?: Parada[], saidaMinima = "04:00"): EvidenciaNova {
  const e = b.entrega;
  const doDia = paradas?.filter(p => diaBRT(p.inicio) === dia && horaBRT(p.inicio) >= saidaMinima && p.min <= PARADA_MAX_MIN);
  const p = !doDia ? b.maisProxima
    : e.lat === null || e.lon === null ? null
    : doDia.map(x => ({ ...x, distM: distM(x.lat, x.lon, e.lat!, e.lon!) })).sort((a, z) => a.distM - z.distM)[0] ?? null;
  return {
    dia, routeId: e.routeId, codCliente: e.codCliente, placa: e.placa, motorista: e.motorista, documentos: e.documentos, status: b.status,
    distParadaM: p ? Math.round(p.distM) : null, paradaLat: p?.lat ?? null, paradaLon: p?.lon ?? null, paradaInicio: p?.inicio ?? null, paradaFim: p?.fim ?? null,
    distAppM: e.lat !== null && e.lon !== null && e.latApp !== null && e.lonApp !== null ? Math.round(distM(e.lat, e.lon, e.latApp, e.lonApp)) : null,
    clienteLat: e.lat, clienteLon: e.lon,
  };
}
