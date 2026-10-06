/*
 * MetricFlow — detecção de paradas a partir das posições brutas do GPS.
 * Parada = sequência contínua de posições abaixo de PARADA.velMaxKmh; termina
 * na primeira posição em movimento seguinte (cobre rastreador que reporta pouco
 * com motor desligado). Funde manobras curtas e descarta paradas de trânsito.
 */

export interface Posicao { lat: number; lon: number; em: Date; kmh: number; valida: boolean; ignicao: boolean | null }
export interface Parada { lat: number; lon: number; inicio: Date; fim: Date; min: number }
export interface ResultadoParadas {
  paradas: Parada[];
  saida: Date | null;
  retorno: Date | null;
  ociosoMin: number | null; // parado com ignição ligada dentro da jornada (saída → retorno)
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

export function detectarParadas(posicoes: Posicao[]): ResultadoParadas {
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

  const saida = longos[0]?.de ?? null;
  const retorno = longos[longos.length - 1]?.ate ?? null;

  // Motor ligado parado só dentro da jornada: há rastreador que marca ignição ligada a noite toda.
  let ocioso = 0;
  if (saida && retorno) {
    for (let i = 0; i < ps.length - 1; i++) {
      const p = ps[i];
      if (p.kmh >= PARADA.velMaxKmh || p.ignicao !== true) continue;
      const de = Math.max(p.em.getTime(), saida.getTime());
      const ate = Math.min(ps[i + 1].em.getTime(), retorno.getTime());
      if (ate > de) ocioso += (ate - de) / 60000;
    }
  }

  return { paradas, saida, retorno, ociosoMin: saida && retorno ? Math.round(ocioso) : null };
}
