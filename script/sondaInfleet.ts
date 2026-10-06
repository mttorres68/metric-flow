/*
 * Sonda do Infleet (Task 1 do plano de entregas) — só leitura.
 * Confirma: unidade do `speed`, volume de posições por janela e formato de `plate`.
 * Uso (a partir da worktree): pnpm tsx --env-file=../../../.env script/sondaInfleet.ts
 */
import { infleetQuery } from "../server/routers/infleetRouter";

const PLACA = "SOO8D21";
const INICIO = "2026-10-05T06:00:00-03:00";
const FIM = "2026-10-05T12:00:00-03:00";

type Pos = { latitude: number; longitude: number; fixTime: string; speed: number; ignition: boolean | null; valid: boolean };

function distM(a: Pos, b: Pos): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const { listVehicles } = await infleetQuery<{ listVehicles: { id: string; plate: string }[] }>(
  `query { listVehicles { id plate } }`, {});
console.log("Veículos:", listVehicles.length, "| exemplos de plate:", listVehicles.slice(0, 5).map(v => v.plate));

const v = listVehicles.find(x => x.plate.toUpperCase().replace(/[^A-Z0-9]/g, "") === PLACA);
if (!v) { console.log("Placa não encontrada:", PLACA); process.exit(1); }

const filter = { vehicleId: v.id, fixTime: { startAt: INICIO, endAt: FIM } };
const { listVehiclePositions: pos } = await infleetQuery<{ listVehiclePositions: Pos[] }>(
  `query($filter: ListVehiclePositionsFilterInput!) {
     listVehiclePositions(filter: $filter) { latitude longitude fixTime speed ignition valid }
   }`, { filter });

console.log("Posições em 6h:", pos.length, "(número redondo como 1000/5000/10000 sugere truncamento)");
console.log("Primeiras 3:", pos.slice(0, 3));
console.log("speed máximo:", Math.max(...pos.map(p => p.speed)));

const ordenadas = [...pos].sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());
const razoes: number[] = [];
for (let i = 1; i < ordenadas.length; i++) {
  const a = ordenadas[i - 1], b = ordenadas[i];
  const horas = (new Date(b.fixTime).getTime() - new Date(a.fixTime).getTime()) / 3600000;
  if (horas <= 0 || horas > 0.05 || b.speed < 10) continue;
  razoes.push((distM(a, b) / 1000 / horas) / b.speed);
}
razoes.sort((x, y) => x - y);
console.log("Mediana (km/h calculado ÷ speed):", razoes[Math.floor(razoes.length / 2)]?.toFixed(2),
  "→ ~1.00 = km/h | ~1.85 = nós | amostras:", razoes.length);

const { routeVehicleDetails } = await infleetQuery<{ routeVehicleDetails: unknown }>(
  `query($filter: ListVehiclePositionsFilterInput!) {
     routeVehicleDetails(filter: $filter) { totalDistanceTraveled totalTimeStopped }
   }`, { filter });
console.log("routeVehicleDetails:", routeVehicleDetails);
