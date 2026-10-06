/*
 * MetricFlow — análise por rota (RouteId): resumo, sequência planejada × GPS, tempo,
 * distância e devoluções com prova. Agrega as linhas por dia já cruzadas (cruzar.ts).
 */
import type { Entrega } from "./parseCheckNow";
import { distM } from "./detectarParadas";
import { agruparPorRota, type EntregaCruzada, type ResultadoLinha } from "./cruzar";

export interface ItemSequencia {
  ordemReal: number;
  ordemPlanejada: number;
  codCliente: string;
  cliente: string;
  chegada: Date; // chegada da parada mais próxima do cliente (GPS)
  foraSequencia: boolean;
}

export interface Devolucao {
  codCliente: string;
  cliente: string;
  motivo: string;
  valor: number;
  pesoKg: number;
  baixaEm: Date | null;
  gps: "esteve" | "nao_parou" | "sem_coordenada" | "sem_gps";
  permanenciaMin: number;
}

export interface AnaliseRota {
  routeId: string;
  placa: string;
  motorista: string;
  inicio: Date;
  fim: Date | null; // null = rota aberta
  dias: string[];
  clientes: number;
  notas: number;
  entregue: { qtd: number; valor: number };
  devolvido: { qtd: number; valor: number };
  pendente: { qtd: number; valor: number };
  pesoKg: number;
  capacidadeKg: number | null;
  ocupacaoPct: number | null;
  pernoites: { data: string; lat: number; lon: number; cidade: string | null; distM: number }[];
  sequencia: { itens: ItemSequencia[]; naSequenciaPct: number | null; semParada: number };
  tempoPorDia: { data: string; jornadaMin: number; rodandoMin: number; emClienteMin: number; paradoSemClienteMin: number; ociosoMin: number | null }[];
  tempoMedioEntregaMin: number | null;
  entregasPorHora: number | null;
  distancia: { kmGps: number | null; kmInformado: number | null; diferencaKm: number | null; diferencaPct: number | null; kmPorEntrega: number | null; reaisPorKm: number | null };
  devolucoes: { itens: Devolucao[]; porMotivo: { motivo: string; qtd: number; valor: number }[] };
}

const soma = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
const div = (a: number, b: number) => (b > 0 ? a / b : null);

/** Índices do maior trecho que respeita a ordem (maior subsequência crescente). n pequeno: O(n²). */
function maiorTrechoEmOrdem(seq: number[]): Set<number> {
  const tam = seq.map(() => 1), ant = seq.map(() => -1);
  for (let i = 0; i < seq.length; i++)
    for (let j = 0; j < i; j++)
      if (seq[j] < seq[i] && tam[j] + 1 > tam[i]) { tam[i] = tam[j] + 1; ant[i] = j; }
  let k = tam.indexOf(Math.max(...tam));
  const ids = new Set<number>();
  while (k >= 0) { ids.add(k); k = ant[k]; }
  return ids;
}

function sequencia(baixas: EntregaCruzada[]): AnaliseRota["sequencia"] {
  const visitas = baixas
    .filter(b => b.paradasNoRaio.length && b.entrega.ordemPlanejada !== null)
    .map(b => ({ b, chegada: b.paradasNoRaio.reduce((m, p) => (p.distM < m.distM ? p : m)).inicio }))
    .sort((x, y) => x.chegada.getTime() - y.chegada.getTime());
  const emOrdem = maiorTrechoEmOrdem(visitas.map(v => v.b.entrega.ordemPlanejada!));
  return {
    itens: visitas.map((v, i) => ({
      ordemReal: i + 1,
      ordemPlanejada: v.b.entrega.ordemPlanejada!,
      codCliente: v.b.entrega.codCliente,
      cliente: v.b.entrega.cliente,
      chegada: v.chegada,
      foraSequencia: !emOrdem.has(i),
    })),
    naSequenciaPct: visitas.length ? (emOrdem.size / visitas.length) * 100 : null,
    semParada: baixas.filter(b => b.status === "sem_parada").length,
  };
}

function devolucoes(es: Entrega[], baixas: EntregaCruzada[]): AnaliseRota["devolucoes"] {
  const itens: Devolucao[] = es
    .filter(e => e.situacao === "PROBLEMA")
    .sort((a, b) => (a.baixaEm?.getTime() ?? 0) - (b.baixaEm?.getTime() ?? 0))
    .map(e => {
      const b = baixas.find(x => x.entrega === e);
      const gps: Devolucao["gps"] = !b ? "sem_gps"
        : b.status === "sem_coordenada" ? "sem_coordenada"
        : b.status === "sem_parada" ? "nao_parou" : "esteve";
      return {
        codCliente: e.codCliente, cliente: e.cliente, motivo: e.motivoProblema ?? "SEM MOTIVO",
        valor: e.valor, pesoKg: e.pesoKg, baixaEm: e.baixaEm, gps, permanenciaMin: b?.permanenciaMin ?? 0,
      };
    });
  const porMotivo = new Map<string, { motivo: string; qtd: number; valor: number }>();
  for (const d of itens) {
    const m = porMotivo.get(d.motivo) ?? { motivo: d.motivo, qtd: 0, valor: 0 };
    m.qtd++; m.valor += d.valor;
    porMotivo.set(d.motivo, m);
  }
  return { itens, porMotivo: [...porMotivo.values()].sort((a, b) => b.qtd - a.qtd || a.motivo.localeCompare(b.motivo)) };
}

/** Uma análise por rota (RouteId) presente nas linhas, ordenadas pelo início da rota. */
export function analisarRotas(entregas: Entrega[], linhas: ResultadoLinha[]): AnaliseRota[] {
  const porRota = agruparPorRota(entregas);
  const rotas: AnaliseRota[] = [];
  for (const [routeId, es] of porRota) {
    const ls = linhas.filter(l => l.linha.routeId === routeId).sort((a, b) => a.linha.data.localeCompare(b.linha.data));
    if (!ls.length) continue;
    const baixas = ls.flatMap(l => l.baixas);
    const total = (s: Entrega["situacao"]) => {
      const xs = es.filter(e => e.situacao === s);
      return { qtd: xs.length, valor: soma(xs, e => e.valor) };
    };
    const entregue = total("ENTREGUE");
    const pesoKg = soma(es, e => e.pesoKg);
    const capacidadeKg = es.find(e => e.capacidadeKg)?.capacidadeKg ?? null;

    const comCoord = es.filter((e): e is Entrega & { lat: number; lon: number } => e.lat !== null && e.lon !== null);
    const pernoites = ls.slice(0, -1).flatMap(l => {
      if (!l.ultimaParada) return [];
      const { lat, lon } = l.ultimaParada;
      const perto = comCoord
        .map(c => ({ c, d: distM(lat, lon, c.lat, c.lon) }))
        .reduce<{ c: Entrega; d: number } | null>((m, x) => (!m || x.d < m.d ? x : m), null);
      return [{ data: l.linha.data, lat, lon, cidade: perto?.c.cidade || null, distM: perto?.d ?? 0 }];
    });

    const tempoPorDia = ls.flatMap(l => (l.tempo ? [{ data: l.linha.data, ...l.tempo, ociosoMin: l.ociosoMin }] : []));
    const kms = ls.map(l => l.kmGps).filter((k): k is number => k !== null);
    const kmGps = kms.length ? Math.round(soma(kms, k => k) * 10) / 10 : null;
    const e0 = es[0];
    const kmInformado = e0.odoIniInformado !== null && e0.odoFimInformado !== null ? e0.odoFimInformado - e0.odoIniInformado : null;
    const diferencaKm = kmGps !== null && kmInformado !== null ? Math.round((kmGps - kmInformado) * 10) / 10 : null;

    rotas.push({
      routeId,
      placa: e0.placa,
      motorista: e0.motorista,
      inicio: e0.rotaInicio ?? ls[0].linha.janela.inicio,
      fim: e0.rotaFim,
      dias: ls.map(l => l.linha.data),
      clientes: es.length,
      notas: soma(es, e => e.notas),
      entregue,
      devolvido: total("PROBLEMA"),
      pendente: total("AGUARDANDO"),
      pesoKg,
      capacidadeKg,
      ocupacaoPct: capacidadeKg ? (pesoKg / capacidadeKg) * 100 : null,
      pernoites,
      sequencia: sequencia(baixas),
      tempoPorDia,
      tempoMedioEntregaMin: div(soma(tempoPorDia, t => t.emClienteMin), entregue.qtd),
      entregasPorHora: div(entregue.qtd, soma(tempoPorDia, t => t.jornadaMin) / 60),
      distancia: {
        kmGps,
        kmInformado,
        diferencaKm,
        diferencaPct: diferencaKm !== null && kmInformado ? (diferencaKm / kmInformado) * 100 : null,
        kmPorEntrega: kmGps !== null ? div(kmGps, entregue.qtd) : null,
        reaisPorKm: kmGps !== null ? div(entregue.valor, kmGps) : null,
      },
      devolucoes: devolucoes(es, baixas),
    });
  }
  return rotas.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}
