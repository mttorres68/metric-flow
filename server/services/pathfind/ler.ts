/*
 * MetricFlow — leitor das respostas do Pathfind (JSF/PrimeFaces): simulações da data, rotas carregadas e paradas
 * de uma rota expandida. Puro; testado com as respostas reais reduzidas em __fixtures__.
 */
import { PathfindError } from "./erro";

export interface SimulacaoPf { codigo: string }
export interface RotaPf {
  indice: number; rota: string; placa: string; motorista: string; tempoMin: number | null; km: number | null;
  campos: Record<string, string>; // inputs/selects da linha, reenviados como vieram no rowToggle
}
export interface ParadaPf { sequencia: number; pedido: string; codCliente: string; cliente: string; cidade: string; chegada: string; saida: string; km: number | null }

const texto = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const celulas = (linha: string) => [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => texto(m[1]));
/** "18,98" / "1.072,92" (pt-BR) ou "642.84". */
const numero = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
};
/** Linhas `<tr data-ri=…>` de um tbody, cortadas até a próxima linha (a linha pode ter tabelas dentro). */
function linhasDo(html: string, tbodyId: RegExp, tabela: string): string[] {
  const i = html.search(tbodyId);
  if (i < 0) throw new PathfindError(`tela do Pathfind mudou (tabela de ${tabela} não veio)`);
  const fim = html.indexOf("</tbody>", i);
  const corpo = html.slice(i, fim < 0 ? undefined : fim);
  const inicios = [...corpo.matchAll(/<tr[^>]*data-ri="/g)].map(m => m.index!);
  return inicios.map((p, k) => corpo.slice(p, inicios[k + 1]));
}
const marcada = (linha: string, nome: RegExp) => {
  const sel = [...linha.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)].find(m => nome.test(m[1]));
  const opt = sel?.[2].match(/<option[^>]*selected[^>]*>([^<]*)<\/option>/);
  return opt ? { valor: opt[0].match(/value="([^"]*)"/)?.[1] ?? "", texto: texto(opt[1]) } : null;
};

export const lerSimulacoes = (xml: string): SimulacaoPf[] =>
  linhasDo(xml, /id="idChange:simulacoesE_data"/, "simulações").map(l => l.match(/data-rk="([^"]+)"/)?.[1]).filter((c): c is string => !!c).map(codigo => ({ codigo }));

export function lerRotas(xml: string): RotaPf[] {
  return linhasDo(xml, /id="tabelaRotas_data"/, "rotas").map(l => {
    const indice = Number(l.match(/data-ri="(\d+)"/)![1]);
    const cs = celulas(l);
    const iTempo = cs.findIndex(c => /^\d+:\d\d \| \d+:\d\d$/.test(c));
    const tempo = iTempo >= 0 ? cs[iTempo].match(/\| (\d+):(\d\d)$/) : null;
    const campos: Record<string, string> = {};
    for (const m of l.matchAll(/<input[^>]*name="(tabelaRotas:[^"]+)"[^>]*>/g)) campos[m[1]] = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
    for (const m of l.matchAll(/<select[^>]*name="(tabelaRotas:[^"]+)"/g)) campos[m[1]] = marcada(l, new RegExp(`^${m[1]}$`))?.valor ?? "";
    return {
      indice,
      rota: texto(l.match(/ui-cell-editor-output">([^<]*)/)?.[1] ?? ""),
      placa: (marcada(l, /selectVeiculoComMotoristaId_input$/)?.texto ?? "").split(" - ")[0].trim(),
      motorista: marcada(l, /:motorista_input$/)?.texto ?? "",
      tempoMin: tempo ? Number(tempo[1]) * 60 + Number(tempo[2]) : null,
      km: iTempo >= 0 ? numero(cs[iTempo + 1]) : null,
      campos,
    };
  });
}

export function lerParadas(xml: string): ParadaPf[] {
  const titulos = [...(xml.match(/<thead[^>]*display_head[\s\S]*?<\/thead>/)?.[0] ?? "").matchAll(/<th[^>]*aria-label="([^"]*)"/g)].map(m => m[1]);
  const col = (re: RegExp) => titulos.findIndex(t => re.test(t));
  const c = { pedido: col(/Pedido/), cliente: col(/^Cliente$/), razao: col(/^Raz/), cidade: col(/^Cidade$/), chegada: col(/^Chegada$/), saida: col(/^Sa.?da$/), km: col(/^KM$/) };
  if (Object.values(c).some(i => i < 0)) throw new Error(`tela do Pathfind mudou (colunas da rota: ${titulos.join(", ")})`);
  return linhasDo(xml, /id="tabelaRotas:\d+:display_data"/, "pedidos da rota").map(l => {
    const cs = celulas(l);
    return {
      sequencia: Number(l.match(/input_ordem"[^>]*value="(\d+)"/)?.[1] ?? 0),
      pedido: cs[c.pedido], codCliente: cs[c.cliente], cliente: cs[c.razao], cidade: cs[c.cidade],
      chegada: cs[c.chegada], saida: cs[c.saida], km: numero(cs[c.km]),
    };
  });
}

export const viewStateParcial = (xml: string): string | null =>
  xml.match(/<update id="[^"]*javax\.faces\.ViewState[^"]*"><!\[CDATA\[([^\]]*)\]\]>/)?.[1] ?? null;
export const redirecionouParaLogin = (xml: string) => /<redirect url="[^"]*login/.test(xml);
