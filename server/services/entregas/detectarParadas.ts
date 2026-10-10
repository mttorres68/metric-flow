/*
 * MetricFlow — detecção de paradas a partir das posições brutas do GPS.
 * Parada = sequência contínua de posições abaixo de PARADA.velMaxKmh; termina
 * na primeira posição em movimento seguinte (cobre rastreador que reporta pouco
 * com motor desligado). Funde manobras curtas e descarta paradas de trânsito.
 */

export interface Posicao { lat: number; lon: number; em: Date; kmh: number; valida: boolean }
export interface Parada { lat: number; lon: number; inicio: Date; fim: Date; min: number }
export interface ResultadoParadas {
  paradas: Parada[];
  saida: Date | null;
  retorno: Date | null;
}

export const PARADA = { velMaxKmh: 5, minDuracaoMin: 1, fundirDistM: 50, fundirGapMin: 2, movimentoMinMin: 3 } as const;

/** Distância haversine em metros. */
export function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const minutos = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60000;

/** Km acumulado pela estrada ao longo do dia: t[i] (ms) → km[i]. */
export interface Trajeto { t: number[]; km: number[] }

/** Soma os trechos entre posições consecutivas em movimento (o tremor do GPS parado não conta). */
export function trajetoAcumulado(posicoes: Posicao[]): Trajeto {
  const ps = posicoes.filter(p => p.valida).sort((a, b) => a.em.getTime() - b.em.getTime());
  const tr: Trajeto = { t: [], km: [] };
  let acum = 0;
  ps.forEach((p, i) => {
    const a = ps[i - 1];
    if (a && (a.kmh >= PARADA.velMaxKmh || p.kmh >= PARADA.velMaxKmh)) acum += distM(a.lat, a.lon, p.lat, p.lon) / 1000;
    tr.t.push(p.em.getTime());
    tr.km.push(acum);
  });
  return tr;
}

/** Km rodado pela estrada entre dois horários (null sem trajeto). */
export function kmEntre(tr: Trajeto, de: Date, ate: Date): number | null {
  if (!tr.t.length) return null;
  const kmEm = (t: number) => {
    let lo = 0, hi = tr.t.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (tr.t[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; }
    return k < 0 ? 0 : tr.km[k];
  };
  return Math.max(0, kmEm(ate.getTime()) - kmEm(de.getTime()));
}

/** saidaNaoAntes: movimento que termina antes disso não é saída (madrugada fora da base); o que começa antes e segue viagem sai nesse horário. */
export function detectarParadas(posicoes: Posicao[], { saidaNaoAntes }: { saidaNaoAntes?: Date } = {}): ResultadoParadas {
  const ps = posicoes.filter(p => p.valida).sort((a, b) => a.em.getTime() - b.em.getTime());
  const movendo = ps.filter(p => p.kmh >= PARADA.velMaxKmh);

  const brutas: Parada[] = [];
  let grupo: Posicao[] = [];
  const fechar = (fim: Date) => {
    if (!grupo.length) return;
    const inicio = grupo[0].em;
    brutas.push({
      lat: grupo.reduce((s, p) => s + p.lat, 0) / grupo.length,
      lon: grupo.reduce((s, p) => s + p.lon, 0) / grupo.length,
      inicio, fim, min: minutos(inicio, fim),
    });
    grupo = [];
  };
  for (const p of ps) {
    if (p.kmh < PARADA.velMaxKmh) grupo.push(p);
    else fechar(p.em);
  }
  if (grupo.length) fechar(grupo[grupo.length - 1].em);

  const fundidas: Parada[] = [];
  for (const p of brutas) {
    const ant = fundidas[fundidas.length - 1];
    if (ant && minutos(ant.fim, p.inicio) < PARADA.fundirGapMin
        && distM(ant.lat, ant.lon, p.lat, p.lon) < PARADA.fundirDistM) {
      ant.lat = (ant.lat + p.lat) / 2;
      ant.lon = (ant.lon + p.lon) / 2;
      ant.fim = p.fim;
      ant.min = minutos(ant.inicio, ant.fim);
    } else {
      fundidas.push({ ...p });
    }
  }

  const paradas = fundidas.filter(p => p.min >= PARADA.minDuracaoMin);

  // Trechos em movimento = intervalos entre paradas (e antes da 1ª / depois da última).
  // Saída/retorno só contam trechos de PARADA.movimentoMinMin ou mais (ignora manobra de pátio).
  const trechos: { de: Date; ate: Date }[] = [];
  let cursor: Date | undefined = ps[0]?.em;
  for (const p of paradas) {
    if (cursor) trechos.push({ de: cursor, ate: p.inicio });
    cursor = p.fim;
  }
  if (cursor && ps.length) trechos.push({ de: cursor, ate: ps[ps.length - 1].em });
  const longos = trechos.filter(t =>
    minutos(t.de, t.ate) >= PARADA.movimentoMinMin && movendo.some(m => m.em >= t.de && m.em <= t.ate));

  const valeSaida = longos.find(t => !saidaNaoAntes || t.ate > saidaNaoAntes);
  return {
    paradas,
    saida: valeSaida ? (saidaNaoAntes && valeSaida.de < saidaNaoAntes ? saidaNaoAntes : valeSaida.de) : null,
    retorno: longos[longos.length - 1]?.ate ?? null,
  };
}
