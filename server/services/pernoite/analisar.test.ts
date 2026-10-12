import { describe, it, expect } from "vitest";
import { analisarNoite, type EntradaNoite } from "./analisar";
import { CONFIG_ENTREGAS_PADRAO } from "@shared/entregas";

const brt = (s: string) => new Date(`${s}:00-03:00`);
const q: [number, number][] = [[-43.025, -6.775], [-43.015, -6.775], [-43.015, -6.765], [-43.025, -6.765], [-43.025, -6.775]];
const sede = { cercaId: "sede", centro: { lat: -6.77, lon: -43.02 }, poligono: q };
const LAT_CLI = -6.77 - 0.35; // ~39 km ao sul (reta) → ~50 km de estrada
const parada = (lat: number, ini: string, fim: string) => ({ lat, lon: -43.02, inicio: brt(ini), fim: brt(fim), min: (brt(fim).getTime() - brt(ini).getTime()) / 60000 });
const baixa = (ini: string, fim: string, o: Record<string, unknown> = {}) => ({
  status: "no_raio", permanenciaMin: (brt(fim).getTime() - brt(ini).getTime()) / 60000,
  paradasNoRaio: [{ inicio: brt(ini), fim: brt(fim), distM: 10, lat: LAT_CLI, lon: -43.02 }],
  entrega: { lat: LAT_CLI, lon: -43.02, cidade: "AMARANTE", baixaEm: brt(ini), codCliente: "1", routeId: "R1" }, ...o,
});
const base = (o: Partial<EntradaNoite> = {}): EntradaNoite => ({
  dia: "2026-10-05", placa: "UHQ-5H38", motorista: "JOSIELTON",
  paradas: [
    parada(LAT_CLI, "2026-10-05T15:00", "2026-10-05T15:20"),       // último cliente
    parada(LAT_CLI - 0.01, "2026-10-05T15:40", "2026-10-06T05:30"), // dormiu ~1 km adiante
    parada(-6.77, "2026-10-06T06:30", "2026-10-06T07:00"),          // de manhã, na Sede
  ],
  eventos: [{ tipo: "geofenceEnter", em: brt("2026-10-06T06:30"), endereco: "Rua X, Amarante", lat: -6.77, lon: -43.02, cercaId: "sede", cerca: "Sede", duracaoMin: null }],
  baixas: [baixa("2026-10-05T15:00", "2026-10-05T15:20")] as never,
  pendentes: [], clientesSeguinte: [{ lat: -6.5, lon: -43.02 }], sede, cfg: CONFIG_ENTREGAS_PADRAO, ...o,
});

describe("analisarNoite", () => {
  it("na malícia: fora da Sede, perto, dava para chegar e voltou de manhã — com os números", () => {
    const n = analisarNoite(base());
    expect(n.classificacao).toBe("na_malicia");
    expect(n.distSedeKm).toBeGreaterThan(45);
    expect(n.distSedeKm).toBeLessThan(80);
    expect(n.sinais.davaParaChegar).toMatchObject({ ok: true, ultimo: { lat: LAT_CLI, lon: -43.02 } });
    expect(String(n.sinais.davaParaChegar.estimada)).toMatch(/^1[6-7]:\d\d$/);
    expect(n.sinais.voltou.ok).toBe(true);
    expect(n.chegada?.toISOString()).toBe(brt("2026-10-05T15:40").toISOString());
    expect(n.descansoMin).toBe(830);
  });
  it("sem voltar de manhã → evitável", () => {
    const n = analisarNoite(base({ paradas: base().paradas.slice(0, 2), eventos: [] }));
    expect(n.classificacao).toBe("evitavel");
  });
  it("longe (> 80 km de estrada) → normal", () => {
    const longe = -6.77 - 0.7; // ~78 km reta → ~101 km
    expect(analisarNoite(base({ paradas: [parada(longe, "2026-10-05T15:40", "2026-10-06T05:30")] })).classificacao).toBe("normal");
  });
  it("chegaria depois das 21h → normal", () => {
    const tarde = [baixa("2026-10-05T20:10", "2026-10-05T20:30")];
    const n = analisarNoite(base({ baixas: tarde as never, paradas: [parada(LAT_CLI, "2026-10-05T20:10", "2026-10-05T20:30"), parada(LAT_CLI - 0.01, "2026-10-05T20:40", "2026-10-06T05:30")] }));
    expect(n.classificacao).toBe("normal");
    expect(n.sinais.davaParaChegar.ok).toBe(false);
  });
  it("dormiu dentro da Sede → na_base (pelo polígono)", () => {
    expect(analisarNoite(base({ paradas: [parada(-6.77, "2026-10-05T18:00", "2026-10-06T06:00")] })).classificacao).toBe("na_base");
  });
  it("rodando às 02:00 → sem_parada", () => {
    expect(analisarNoite(base({ paradas: [parada(LAT_CLI, "2026-10-05T15:00", "2026-10-05T15:20")] })).classificacao).toBe("sem_parada");
  });
  it("galo: parou cedo (antes das 17h) conta; chegada às 18h não", () => {
    expect(analisarNoite(base()).sinais.parouCedo.ok).toBe(true);
    const n = analisarNoite(base({ paradas: [parada(LAT_CLI, "2026-10-05T15:00", "2026-10-05T15:20"), parada(LAT_CLI - 0.01, "2026-10-05T18:00", "2026-10-06T05:30")] }));
    expect(n.sinais.parouCedo.ok).toBe(false);
  });
  it("galo: final lento (3 últimas entregas > 2× o dia)", () => {
    const rapidas = ["08", "09", "10", "11"].map(h => baixa(`2026-10-05T${h}:00`, `2026-10-05T${h}:05`));
    const lentas = ["12", "13", "14"].map(h => baixa(`2026-10-05T${h}:00`, `2026-10-05T${h}:40`));
    const n = analisarNoite(base({ baixas: [...rapidas, ...lentas] as never }));
    expect(n.sinais.finalLento).toMatchObject({ ok: true, finalMin: 40, diaMin: 5 });
  });
  it("galo: ociosidade no fim (≥ 30 min fora de cliente nas 2 h antes) e cliente que ficou para trás", () => {
    const n = analisarNoite(base({
      paradas: [parada(LAT_CLI, "2026-10-05T13:00", "2026-10-05T13:20"), parada(LAT_CLI + 0.2, "2026-10-05T14:00", "2026-10-05T14:40"), parada(LAT_CLI - 0.01, "2026-10-05T15:40", "2026-10-06T05:30")],
      baixas: [baixa("2026-10-05T13:00", "2026-10-05T13:20")] as never,
      pendentes: [{ lat: LAT_CLI - 0.05, lon: -43.02, codCliente: "9", cliente: "PENDENTE" }] as never,
    }));
    expect(n.sinais.ociosidade).toMatchObject({ ok: true, min: 40 });
    expect(n.sinais.paraTras).toMatchObject({ ok: true, clientes: 1 });
    expect(n.galo).toBeGreaterThanOrEqual(3);
  });
  it("parou depois da meia-noite não é 'parou cedo'", () => {
    const n = analisarNoite(base({ paradas: [parada(LAT_CLI, "2026-10-05T15:00", "2026-10-05T15:20"), parada(LAT_CLI - 0.01, "2026-10-06T00:40", "2026-10-06T05:30")] }));
    expect(n.sinais.parouCedo.ok).toBe(false);
  });
  it("a parada da noite perto de um cliente não entra no ritmo das últimas entregas", () => {
    const noite = { inicio: brt("2026-10-05T15:40"), fim: brt("2026-10-06T05:30"), distM: 100, lat: LAT_CLI, lon: -43.02 };
    const rapidas = ["08", "09", "10", "11", "12"].map(h => baixa(`2026-10-05T${h}:00`, `2026-10-05T${h}:05`));
    const ultimas = ["13", "14"].map(h => {
      const b = baixa(`2026-10-05T${h}:00`, `2026-10-05T${h}:05`);
      return { ...b, paradasNoRaio: [...b.paradasNoRaio, noite] };
    });
    const n = analisarNoite(base({ baixas: [...rapidas, ...ultimas] as never, paradas: [parada(LAT_CLI, "2026-10-05T14:00", "2026-10-05T14:05"), parada(LAT_CLI, "2026-10-05T15:40", "2026-10-06T05:30")] }));
    expect(n.sinais.finalLento).toMatchObject({ ok: false, finalMin: 5 });
  });
  it("na Sede: os sinais dizem que dormiu na Sede", () => {
    const n = analisarNoite(base({ paradas: [parada(-6.77, "2026-10-05T18:00", "2026-10-06T06:00")] }));
    expect(n.sinais.perto).toEqual({ ok: false, motivo: "dormiu na Sede" });
    expect(n.sinais.parouCedo).toEqual({ ok: false, motivo: "dormiu na Sede" });
  });
});
