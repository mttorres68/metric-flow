/*
 * MetricFlow — sinais de desvio de carga por pedido (spec desvio §5–6): perfil do cliente só com os pedidos
 * anteriores, romaneios abertos, evidência de GPS da entrega. Puro: quem chama carrega os dados.
 */
import { diaBRT, horaBRT } from "@shared/entregas";
import type { PedidoErp } from "../erp/parsePedidosErp";

export const LIMITES_DESVIO = { minPedidos: 5, avistaMaxPct: 20, valorX: 3, valorXX: 5, romaneiosAbertos: 3, diasAberto: 3, pertoM: 3000, alta: 60, media: 30 } as const;
export const PESOS = { avistaAtipico: 30, avistaSemHistorico: 15, valorAlto: 15, valorMuitoAlto: 25, motoristaAbertos: 30, romaneioAberto: 10, parouPerto: 25, semParada: 20, appLonge: 15 } as const;
export const AVISTA = "1";

export interface Evidencia {
  dia: string; placa: string; motorista: string; documentos: string[]; status: string;
  distParadaM: number | null; paradaLat: number | null; paradaLon: number | null; paradaInicio: Date | null; paradaFim: Date | null;
  distAppM: number | null; clienteLat: number | null; clienteLon: number | null;
}
export interface RotaPedido { inicio: Date; motorista: string; placa: string }
export interface EntradaDesvio {
  pedidos: PedidoErp[]; evidencias: Evidencia[]; semSinal: { placa: string; dia: string }[];
  rotas: Map<string, RotaPedido>; hoje: string; raioM: number;
  /** Pedidos abertos que não vieram nas últimas planilhas (mês anterior não reenviado): situação desconhecida. */
  desatualizados?: Set<string>;
}
export type ChaveSinal = keyof typeof PESOS;
export interface SinalDesvio { chave: ChaveSinal; peso: number; texto: string }
export interface PerfilCliente { pedidos: number; avistaPct: number; valorMediana: number | null; intervaloDias: number | null; ultimaCompra: string | null }
export type Faixa = "alta" | "media" | "baixa";
export interface Caso {
  pedido: PedidoErp; dia: string; saida: string | null; diasAberto: number | null; motorista: string;
  nota: number; faixa: Faixa; sinais: SinalDesvio[]; perfil: PerfilCliente; evidencia: Evidencia | null; semGps: boolean;
  desatualizado: boolean; // aberto na base, mas a planilha do mês dele não foi reenviada: não conta como aberto
}
export interface RomaneioAberto { romaneio: string; placa: string; motorista: string; motoristaCod: string; saida: string | null; dias: number | null; pedidos: number; valor: number; valorAvista: number; desatualizado: boolean }
export interface MotoristaDesvio { motoristaCod: string; motorista: string; romaneiosAbertos: number; avistaAtipicos: number; casosAltos: number; casosMedios: number; somaNotas: number }

const DIA_MS = 86_400_000;
const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA_MS);
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const vezes = (x: number) => x.toFixed(1).replace(".", ",");
const dist = (m: number) => (m >= 1000 ? `${vezes(m / 1000)} km` : `${Math.round(m)} m`);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const placaNorm = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** Pedido sem romaneio é um romaneio sozinho (não junta pedidos sem relação). */
export const chaveRomaneio = (p: PedidoErp) => p.romaneio || `#${p.pedido}`;
const JANELA_PERFIL = 100;
function agrupar<T>(xs: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = chave(x); const l = m.get(k); if (l) l.push(x); else m.set(k, [x]); }
  return m;
}

export function analisarPedidos(e: EntradaDesvio): Caso[] {
  const L = LIMITES_DESVIO;
  const validos = e.pedidos.filter(p => p.situacao !== "cancelado");
  const desat = e.desatualizados ?? new Set<string>();
  const abertoVale = (p: PedidoErp) => p.situacao === "aberto" && !desat.has(p.pedido);

  // Saída do romaneio: o início de rota mais cedo no CheckNow entre os pedidos dele; sem rota, a maior data de pedido.
  const romaneios = agrupar(validos, chaveRomaneio);
  const saidaRomaneio = new Map<string, string | null>();
  for (const [r, ps] of romaneios) {
    const inicios = ps.flatMap(p => { const x = e.rotas.get(p.pedido); return x ? [x.inicio.getTime()] : []; });
    saidaRomaneio.set(r, inicios.length ? diaBRT(new Date(Math.min(...inicios)))
      : ps.map(p => p.dataPedido).filter((d): d is string => !!d).sort().at(-1) ?? null);
  }
  // Romaneios abertos que já saíram (antes de hoje), por motorista.
  const abertosMot = new Map<string, Set<string>>();
  for (const [r, ps] of romaneios) {
    const s = saidaRomaneio.get(r);
    if (!s || s >= e.hoje || !ps.some(abertoVale)) continue;
    const m = ps[0].motoristaCod;
    abertosMot.set(m, (abertosMot.get(m) ?? new Set()).add(r));
  }

  // Perfil do cliente com os pedidos anteriores a cada um. Contagem e % à vista sobre todos os anteriores;
  // ponytail: medianas sobre os últimos 100 (cliente "balcão" tem milhares de pedidos no ano).
  const perfis = new Map<string, PerfilCliente>();
  for (const ps of agrupar(validos, p => p.cliente).values()) {
    ps.sort((a, b) => (a.dataPedido ?? "").localeCompare(b.dataPedido ?? "") || a.pedido.localeCompare(b.pedido));
    let avista = 0;
    let ultima: string | null = null;
    ps.forEach((p, i) => {
      const ant = ps.slice(Math.max(0, i - JANELA_PERFIL), i);
      const datas = ant.map(a => a.dataPedido).filter((d): d is string => !!d);
      const gaps = datas.slice(1).map((d, j) => dias(datas[j], d));
      perfis.set(p.pedido, {
        pedidos: i,
        avistaPct: i ? Math.round((avista / i) * 100) : 0,
        valorMediana: ant.length ? mediana(ant.map(a => a.valor)) : null,
        intervaloDias: gaps.length ? mediana(gaps) : null,
        ultimaCompra: ultima,
      });
      if (p.tipoCobranca === AVISTA) avista++;
      if (p.dataPedido) ultima = p.dataPedido;
    });
  }

  const porDoc = new Map<string, Evidencia>();
  for (const ev of [...e.evidencias].sort((a, b) => a.dia.localeCompare(b.dia))) for (const d of ev.documentos) porDoc.set(d, ev);
  const mudos = new Set(e.semSinal.map(s => `${placaNorm(s.placa)}|${s.dia}`));

  return validos.map(p => {
    const perfil = perfis.get(p.pedido)!;
    const saida = saidaRomaneio.get(chaveRomaneio(p)) ?? p.dataPedido;
    const diasAberto = abertoVale(p) && saida ? Math.max(0, dias(saida, e.hoje)) : null;
    const ev = porDoc.get(p.pedido) ?? null;
    const gps = ev && ev.status !== "sem_coordenada" ? ev : null; // cliente sem coordenada: não há o que medir
    const rota = e.rotas.get(p.pedido);
    const sinais: SinalDesvio[] = [];
    const s = (chave: ChaveSinal, texto: string) => sinais.push({ chave, peso: PESOS[chave], texto });

    if (p.tipoCobranca === AVISTA) {
      if (perfil.pedidos >= L.minPedidos && perfil.avistaPct <= L.avistaMaxPct)
        s("avistaAtipico", `À vista para um cliente que comprou à vista em ${perfil.avistaPct}% dos ${perfil.pedidos} pedidos anteriores (o resto no boleto ou a prazo)`);
      else if (perfil.pedidos < L.minPedidos)
        s("avistaSemHistorico", `À vista para um cliente com só ${perfil.pedidos} pedido(s) nos 12 meses anteriores`);
    }
    if (perfil.pedidos >= L.minPedidos && perfil.valorMediana) {
      const x = p.valor / perfil.valorMediana;
      const texto = `Valor ${reais(p.valor)}, ${vezes(x)}× o típico do cliente (${reais(perfil.valorMediana)})`;
      if (x > L.valorXX) s("valorMuitoAlto", texto);
      else if (x > L.valorX) s("valorAlto", texto);
    }
    if (abertoVale(p)) {
      const abertos = abertosMot.get(p.motoristaCod);
      if (abertos && abertos.size > L.romaneiosAbertos)
        s("motoristaAbertos", `O motorista tem ${abertos.size} romaneios sem acerto ao mesmo tempo (limite ${L.romaneiosAbertos})`);
      if (diasAberto !== null && diasAberto > L.diasAberto)
        s("romaneioAberto", `Romaneio ${p.romaneio} sem acerto há ${diasAberto} dias da saída (${ddmm(saida!)})`);
    }
    const diaGps = ev?.dia ?? (rota ? diaBRT(rota.inicio) : null);
    const mudo = !!diaGps && mudos.has(`${placaNorm(rota?.placa ?? ev?.placa ?? p.placa)}|${diaGps}`);
    if (gps && gps.distParadaM !== null && gps.distParadaM > e.raioM && gps.distParadaM <= L.pertoM)
      s("parouPerto", `A parada do caminhão mais perto do cliente ficou a ${dist(gps.distParadaM)} (raio ${e.raioM} m)${gps.paradaInicio ? `, às ${horaBRT(gps.paradaInicio)}` : ""}: parou perto, mas não no cliente`);
    else if (mudo) s("semParada", "O rastreador do caminhão ficou sem sinal no dia da entrega");
    else if (gps && (gps.distParadaM === null || gps.distParadaM > L.pertoM)) s("semParada", `Nenhuma parada do caminhão a até ${dist(L.pertoM)} do cliente`);
    if (gps?.distAppM != null && gps.distAppM > e.raioM) s("appLonge", `O motorista registrou a entrega no app a ${dist(gps.distAppM)} do cliente`);

    const nota = Math.min(100, sinais.reduce((t, x) => t + x.peso, 0));
    return {
      pedido: p, dia: saida ?? p.dataPedido ?? "", saida, diasAberto, motorista: rota?.motorista ?? ev?.motorista ?? p.motoristaCod,
      nota, faixa: nota >= L.alta ? "alta" : nota >= L.media ? "media" : "baixa", sinais, perfil, evidencia: ev, semGps: !gps && !mudo,
      desatualizado: p.situacao === "aberto" && desat.has(p.pedido),
    };
  });
}

export function romaneiosAbertos(casos: Caso[]): RomaneioAberto[] {
  return [...agrupar(casos.filter(c => c.pedido.situacao === "aberto"), c => chaveRomaneio(c.pedido))].map(([, cs]) => ({
    romaneio: cs[0].pedido.romaneio, placa: cs[0].pedido.placa, desatualizado: cs.every(c => c.desatualizado), motorista: cs[0].motorista, motoristaCod: cs[0].pedido.motoristaCod,
    saida: cs[0].saida, dias: cs[0].diasAberto, pedidos: cs.length,
    valor: cs.reduce((s, c) => s + c.pedido.valor, 0),
    valorAvista: cs.filter(c => c.pedido.tipoCobranca === AVISTA).reduce((s, c) => s + c.pedido.valor, 0),
  })).sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));
}

export function porMotorista(doPeriodo: Caso[], abertos: RomaneioAberto[]): MotoristaDesvio[] {
  const m = new Map<string, MotoristaDesvio>();
  const de = (cod: string, nome: string) => {
    const r = m.get(cod) ?? { motoristaCod: cod, motorista: nome, romaneiosAbertos: 0, avistaAtipicos: 0, casosAltos: 0, casosMedios: 0, somaNotas: 0 };
    if (r.motorista === cod && nome !== cod) r.motorista = nome; // nome do CheckNow quando houver
    m.set(cod, r);
    return r;
  };
  for (const r of abertos) if (!r.desatualizado) de(r.motoristaCod, r.motorista).romaneiosAbertos++;
  for (const c of doPeriodo) {
    const r = de(c.pedido.motoristaCod, c.motorista);
    if (c.sinais.some(s => s.chave === "avistaAtipico")) r.avistaAtipicos++;
    if (c.faixa === "alta") r.casosAltos++;
    if (c.faixa === "media") r.casosMedios++;
    r.somaNotas += c.nota;
  }
  return [...m.values()].sort((a, b) => b.somaNotas - a.somaNotas || b.romaneiosAbertos - a.romaneiosAbertos);
}
