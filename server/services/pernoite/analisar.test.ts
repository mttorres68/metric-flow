import { describe, it, expect } from "vitest";
import { analisarNoite, trocouDeCaminhao, type EntradaNoite } from "./analisar";
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
  it("para trás só acende quando os pendentes perto eram tudo o que faltava", () => {
    const comLonge = analisarNoite(base({
      pendentes: [{ lat: LAT_CLI - 0.05, lon: -43.02, codCliente: "9", cliente: "PERTO" }, { lat: LAT_CLI - 0.6, lon: -43.02, codCliente: "8", cliente: "LONGE" }] as never,
    }));
    expect(comLonge.sinais.paraTras).toMatchObject({ ok: false, clientes: 1, pendentes: 2 });
  });
  it("conta o que entregou no dia (só ENTREGUE)", () => {
    const b = (ini: string, fim: string, situacao: string) => {
      const x = baixa(ini, fim);
      return { ...x, entrega: { ...x.entrega, situacao } };
    };
    const n = analisarNoite(base({ baixas: [b("2026-10-05T14:00", "2026-10-05T14:10", "ENTREGUE"), b("2026-10-05T15:00", "2026-10-05T15:20", "PROBLEMA")] as never }));
    expect(n.sinais.paraTras).toMatchObject({ entregues: 1, problemas: 1 });
  });
  it("leva o que faltava entregar no início do dia (entregou X de Z)", () => {
    expect(analisarNoite(base({ aEntregar: 47 })).sinais.paraTras).toMatchObject({ aEntregar: 47 });
  });
  it("para trás não acende quando os de perto não cabiam na folga (no ritmo de descarga do dia)", () => {
    const muitos = Array.from({ length: 40 }, (_, i) => ({ lat: LAT_CLI - 0.05, lon: -43.02, codCliente: `p${i}`, cliente: "P" }));
    expect(analisarNoite(base({ pendentes: muitos as never })).sinais.paraTras).toMatchObject({ ok: false, clientes: 40, pendentes: 40 });
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
  it("na Sede também leva as entregas do dia e o que restou", () => {
    const b = baixa("2026-10-05T15:00", "2026-10-05T15:20");
    const n = analisarNoite(base({ aEntregar: 63, baixas: [{ ...b, entrega: { ...b.entrega, situacao: "ENTREGUE" } }] as never,
      paradas: [parada(-6.77, "2026-10-05T18:00", "2026-10-06T06:00")] }));
    expect(n.sinais.paraTras).toMatchObject({ ok: false, entregues: 1, problemas: 0, aEntregar: 63, pendentes: 0 });
  });
  it("rota concluída: nada pendente ao parar para dormir — só faltava voltar", () => {
    expect(analisarNoite(base()).sinais.rotaConcluida).toMatchObject({ ok: true });
    const comPendente = analisarNoite(base({ pendentes: [{ lat: -7.5, lon: -43.02, codCliente: "9", cliente: "P" }] as never }));
    expect(comPendente.sinais.rotaConcluida).toMatchObject({ ok: false, pendentes: 1 });
    const longe = analisarNoite(base({ paradas: [parada(-6.77 - 0.7, "2026-10-05T15:40", "2026-10-06T05:30")] }));
    expect(longe.classificacao).toBe("normal");
    expect(longe.sinais.rotaConcluida.ok).toBe(false); // só vale para na malícia / evitável
  });
  it("cidade onde dormiu vem do endereço do Infleet; sem endereço completo, a do cliente mais próximo", () => {
    const ev = (endereco: string) => [{ tipo: "deviceStopped", em: brt("2026-10-05T15:40"), endereco, lat: 0, lon: 0, cercaId: null, cerca: null, duracaoMin: null }];
    expect(analisarNoite(base({ eventos: ev("Avenida Dom Edilberto, Tanque do Piauí, Piauí, Brasil") as never })).cidade).toBe("TANQUE DO PIAUÍ");
    expect(analisarNoite(base({ eventos: ev("Rua X") as never })).cidade).toBe("AMARANTE");
  });
});

describe("trocouDeCaminhao", () => {
  const e = (placa: string, ini: string, baixa: string | null) => ({ placa, motorista: "ANTONIO WELTON", rotaInicio: brt(ini), baixaEm: baixa ? brt(baixa) : null }) as never;
  // 12/10: fechou a rota do UHQ às 07:26 (na Sede) e saiu às 07:54 com o SOL, entregando até 18:46.
  const entregas = [e("UHQ-5H38", "2026-10-08T07:40", "2026-10-12T07:26"), e("SOL-6B13", "2026-10-12T07:54", "2026-10-12T18:46"), e("SOL-6B13", "2026-10-12T07:54", "2026-10-13T07:10")];
  it("a noite fica com o caminhão da última atividade do motorista no dia", () => {
    expect(trocouDeCaminhao("2026-10-12", "UHQ-5H38", "ANTONIO WELTON", entregas)).toBe(true);
    expect(trocouDeCaminhao("2026-10-12", "SOL-6B13", "ANTONIO WELTON", entregas)).toBe(false);
  });
  it("rota recém-iniciada sem baixa conta pelo início", () => {
    const tarde = [e("UHQ-5H38", "2026-10-12T06:00", "2026-10-12T10:00"), e("SOL-6B13", "2026-10-12T14:00", null)];
    expect(trocouDeCaminhao("2026-10-12", "UHQ-5H38", "ANTONIO WELTON", tarde)).toBe(true);
    expect(trocouDeCaminhao("2026-10-12", "SOL-6B13", "ANTONIO WELTON", tarde)).toBe(false);
  });
});

