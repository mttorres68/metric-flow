/*
 * MetricFlow — leitura do CSV de pedidos do ERP ("PEDIDOS <MÊS><AA>.CSV"): `;`, latin1, decimais com vírgula,
 * uma linha por item. O cabeçalho repete "Desc" e traz "||Item" — vale a 1ª ocorrência de cada nome.
 * Pedido = Documento do CheckNow. Canc 009 = cancelado/não saiu. Spec produtividade §3.
 */
import { ArquivoErpInvalidoError, codigoProduto } from "./parseProdutos";

export interface ItemPedido {
  pedido: string; item: number; romaneio: string; cliente: string; placa: string; motoristaCod: string;
  dataPedido: string | null; codProduto: string;
  qtdCx: number; qtdUn: number; retCx: number; retUn: number; liqCx: number; liqUn: number;
  motivoDev: string | null; valor: number; cancelado: boolean;
}

export const COLUNAS_PEDIDOS = [
  "Pedido", "Romaneio", "Cliente", "Placa", "Mot", "Canc", "Mot Dev", "Dt.Pedido", "||Item", "Cod Red",
  "Vlr Total", "Quant CX", "Quant UN", "Retorno CX", "Retorno UN", "Qtd.CX Liq.", "Qtd.Un Liq.",
] as const;

const num = (s: string | undefined) => { const n = Number((s ?? "").trim().replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const dataIso = (s: string | undefined) => { const m = (s ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m && m[3] !== "0000" ? `${m[3]}-${m[2]}-${m[1]}` : null; };

export function parsePedidosErp(buffer: Buffer): ItemPedido[] {
  const linhas = buffer.toString("latin1").split(/\r?\n/);
  const cab = (linhas[0] ?? "").split(";").map(c => c.trim());
  const faltando = COLUNAS_PEDIDOS.filter(c => !cab.includes(c));
  if (faltando.length) throw new ArquivoErpInvalidoError(faltando, "CSV de pedidos");
  const col = Object.fromEntries(COLUNAS_PEDIDOS.map(c => [c, cab.indexOf(c)])) as Record<(typeof COLUNAS_PEDIDOS)[number], number>;

  const itens: ItemPedido[] = [];
  for (const l of linhas.slice(1)) {
    const v = l.split(";");
    const pedido = (v[col["Pedido"]] ?? "").trim();
    if (!pedido) continue;
    const g = (c: (typeof COLUNAS_PEDIDOS)[number]) => (v[col[c]] ?? "").trim();
    itens.push({
      // O valor do item também vem com "||" ("||001").
      pedido, item: num(g("||Item").replace(/\D/g, "")), romaneio: g("Romaneio"), cliente: g("Cliente").replace(/\D/g, ""),
      placa: g("Placa"), motoristaCod: g("Mot"), dataPedido: dataIso(g("Dt.Pedido")), codProduto: codigoProduto(g("Cod Red")),
      qtdCx: num(g("Quant CX")), qtdUn: num(g("Quant UN")), retCx: num(g("Retorno CX")), retUn: num(g("Retorno UN")),
      liqCx: num(g("Qtd.CX Liq.")), liqUn: num(g("Qtd.Un Liq.")),
      motivoDev: g("Mot Dev") && g("Mot Dev") !== "0" ? g("Mot Dev") : null,
      valor: num(g("Vlr Total")), cancelado: g("Canc") === "009",
    });
  }
  return itens;
}
export type SituacaoPedido = "aberto" | "acertado" | "cancelado";
/** Cabeçalho do pedido (spec desvio §3–4): cobrança, acerto do romaneio e o valor somado dos itens. */
export interface PedidoErp {
  pedido: string; romaneio: string; cliente: string; vendedor: string; canal: string; origem: string;
  placa: string; motoristaCod: string; dataPedido: string | null;
  tipoCobranca: string; condicaoPagamento: string; banco: string; vencimento1: string | null;
  situacao: SituacaoPedido; dataAcerto: string | null; flagRomaneio: string;
  valor: number; valorRetorno: number; itens: number; produtos: number;
}

export const COLUNAS_CABECALHO = [
  "Pedido", "Romaneio", "Cliente", "Vendedor", "Canal", "Origem do Pedido", "Placa", "Mot", "Dt.Pedido",
  "T.C.", "C.P.", "Banco", "Dt.Ven 1a", "Canc", "Dt.Acerto", "Flag Romaneio", "Cod Red", "Vlr Total", "Vlr Retorno",
] as const;

const centavos = (x: number) => Math.round(x * 100) / 100;

export function parseCabecalhosPedidos(buffer: Buffer): PedidoErp[] {
  const linhas = buffer.toString("latin1").split(/\r?\n/);
  const cab = (linhas[0] ?? "").split(";").map(c => c.trim());
  const faltando = COLUNAS_CABECALHO.filter(c => !cab.includes(c));
  if (faltando.length) throw new ArquivoErpInvalidoError(faltando, "CSV de pedidos");
  const col = Object.fromEntries(COLUNAS_CABECALHO.map(c => [c, cab.indexOf(c)])) as Record<(typeof COLUNAS_CABECALHO)[number], number>;

  const porPedido = new Map<string, PedidoErp & { cods: Set<string> }>();
  for (const l of linhas.slice(1)) {
    const v = l.split(";");
    const g = (c: (typeof COLUNAS_CABECALHO)[number]) => (v[col[c]] ?? "").trim();
    const pedido = g("Pedido");
    if (!pedido) continue;
    let p = porPedido.get(pedido);
    if (!p) {
      const canc = g("Canc");
      p = {
        pedido, romaneio: g("Romaneio"), cliente: g("Cliente").replace(/\D/g, ""), vendedor: g("Vendedor"), canal: g("Canal"),
        origem: g("Origem do Pedido"), placa: g("Placa"), motoristaCod: g("Mot"), dataPedido: dataIso(g("Dt.Pedido")),
        tipoCobranca: g("T.C."), condicaoPagamento: g("C.P."), banco: g("Banco"), vencimento1: dataIso(g("Dt.Ven 1a")),
        situacao: canc === "009" ? "cancelado" : canc === "008" ? "acertado" : "aberto",
        dataAcerto: dataIso(g("Dt.Acerto")), flagRomaneio: g("Flag Romaneio"),
        valor: 0, valorRetorno: 0, itens: 0, produtos: 0, cods: new Set(),
      };
      porPedido.set(pedido, p);
    }
    p.valor += num(g("Vlr Total"));
    p.valorRetorno += num(g("Vlr Retorno"));
    p.itens++;
    p.cods.add(g("Cod Red"));
  }
  return [...porPedido.values()].map(({ cods, ...p }) => ({ ...p, valor: centavos(p.valor), valorRetorno: centavos(p.valorRetorno), produtos: cods.size }));
}
