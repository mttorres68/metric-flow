/* MetricFlow — Sede da revenda pelo polígono da cerca do Infleet (GeoJSON, pares [lon, lat]). */
export interface Sede { cercaId: string | null; centro: { lat: number; lon: number }; poligono: [number, number][] }

export function centroDoPoligono(p: [number, number][]): { lat: number; lon: number } {
  const pts = p.length > 1 && p[0][0] === p.at(-1)![0] && p[0][1] === p.at(-1)![1] ? p.slice(0, -1) : p;
  return { lat: pts.reduce((s, x) => s + x[1], 0) / pts.length, lon: pts.reduce((s, x) => s + x[0], 0) / pts.length };
}

/** Ray casting. */
export function dentroDoPoligono(lat: number, lon: number, p: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
