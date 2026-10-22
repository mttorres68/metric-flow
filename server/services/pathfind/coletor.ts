/*
 * MetricFlow — coletor do Pathfind (roteirizador, JSF/PrimeFaces), sem navegador (spec pathfind-previsto §3).
 * Só leitura: login → roteirização → simulações da data → carregar → expandir cada rota.
 * A senha nunca entra em log nem em mensagem de erro.
 */
import { Sessao } from "../portal/sessao";
import { PathfindError } from "./erro";
import { diaBRT } from "@shared/entregas";
import { lerParadas, lerRotas, lerSimulacoes, redirecionouParaLogin, viewStateParcial, type ParadaPf, type RotaPf } from "./ler";

export type ContaPathfind = { base: string; usuario: string; senha: string };

export { PathfindError };

export const novaSessao = (f: typeof fetch) => new Sessao(f, "Pathfind", PathfindError);
const telaDeLogin = (html: string) => /id="loginForm"|name="usuario"/.test(html);

export function viewState(html: string): string {
  const input = html.match(/<input[^>]*javax\.faces\.ViewState[^>]*>/)?.[0];
  const v = input?.match(/value="([^"]*)"/)?.[1];
  if (!v) throw new PathfindError("tela do Pathfind mudou (ViewState não encontrado)");
  return v;
}

/** Login e abertura da roteirização; devolve o HTML e o ViewState de pedido.xhtml. */
export async function entrar(s: Sessao, conta: ContaPathfind): Promise<{ html: string; vs: string; tela: string }> {
  const login = `${conta.base}/login.xhtml`;
  const vsLogin = viewState(await (await s.req(login)).res.text());
  await s.post(login, { usuario: conta.usuario, senha: conta.senha, entrar: "", loginForm_SUBMIT: "1", "javax.faces.ViewState": vsLogin }, false, login);
  const tela = `${conta.base}/pages/pathfind/pedido.xhtml`;
  const html = await (await s.req(tela)).res.text();
  if (telaDeLogin(html)) throw new PathfindError("login recusado");
  return { html, vs: viewState(html), tela };
}

/** O Pathfind pode responder em latin1: sem caracteres trocados em UTF-8, vale UTF-8. */
async function textoDe(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("latin1").decode(buf) : utf8;
}

const br = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
export type SimulacaoBaixada = { simulacao: string; rotas: (RotaPf & { paradas: ParadaPf[] })[] };

/** Sessão aberta na roteirização com os passos de leitura (spec §3, passos 3–7). Só leitura. */
async function roteirizacao(conta: ContaPathfind, f: typeof fetch, pausaMs: number) {
  const s = novaSessao(f);
  const { vs: inicial, tela } = await entrar(s, conta);
  let vs = inicial;
  const ajax = async (campos: Record<string, string>) => {
    const { res } = await s.post(tela, { "javax.faces.partial.ajax": "true", ...campos, "javax.faces.ViewState": vs }, true, tela);
    const xml = await textoDe(res);
    // Sessão que caiu: <redirect> do JSF ou o HTML do login depois de um redirect HTTP.
    if (redirecionouParaLogin(xml) || telaDeLogin(xml)) throw new PathfindError("sessão expirada");
    const erro = xml.match(/<error>[\s\S]*?<error-name>([^<]*)<\/error-name>/)?.[1];
    if (erro) throw new PathfindError(`Pathfind recusou a requisição (${erro.split(".").pop()})`);
    vs = viewStateParcial(xml) ?? vs;
    if (pausaMs) await new Promise(r => setTimeout(r, pausaMs));
    return xml;
  };
  const simulacoes = async (dia: string) => {
    await ajax({ "javax.faces.source": "CarregarSessao", "javax.faces.partial.execute": "CarregarSessao",
      "javax.faces.partial.render": "idChange dialogSimu", CarregarSessao: "CarregarSessao", formCart_SUBMIT: "1" });
    return lerSimulacoes(await ajax({ "javax.faces.source": "idChange:pesquisarSessao", "javax.faces.partial.execute": "@all",
      "javax.faces.partial.render": "idChange:simulacoesE idChange:panelCarregar idChange:msgForm", "idChange:pesquisarSessao": "idChange:pesquisarSessao",
      "idChange:dataSessao_input": br(dia), "idChange:simulacoesE_selection": "", idChange_SUBMIT: "1" }));
  };
  return { ajax, simulacoes };
}

/** A simulação mais recente (maior código) da data, com as paradas de cada rota. */
export async function baixarSimulacao(conta: ContaPathfind, dia: string, f: typeof fetch = fetch, pausaMs = 300): Promise<SimulacaoBaixada> {
  const { ajax, simulacoes } = await roteirizacao(conta, f, pausaMs);
  const codigos = (await simulacoes(dia)).map(s => s.codigo).sort((a, b) => Number(b) - Number(a));
  if (!codigos.length) throw new PathfindError("sem simulação");
  const rk = codigos[0];
  const sel = { "idChange:dataSessao_input": br(dia), "idChange:simulacoesE_selection": rk, idChange_SUBMIT: "1" };
  await ajax({ "javax.faces.source": "idChange:simulacoesE", "javax.faces.partial.execute": "idChange:simulacoesE",
    "javax.faces.partial.render": "idChange:panelCarregar", "javax.faces.behavior.event": "rowSelect", "javax.faces.partial.event": "rowSelect",
    "idChange:simulacoesE_instantSelectedRowKey": rk, ...sel });
  const rotas = lerRotas(await ajax({ "javax.faces.source": "idChange:carregarSimulacao", "javax.faces.partial.execute": "@all",
    "javax.faces.partial.render": "panelRotas gripMap geral3 geral4 pgCenario geral1 gridInformativos4 idComandos2 btnRasteamento",
    "idChange:carregarSimulacao": "idChange:carregarSimulacao", ...sel }));
  // Os selects de veículo/motorista vão de volta com os valores que a tela mandou (nada é alterado).
  const campos = Object.assign({}, ...rotas.map(r => r.campos)) as Record<string, string>;
  const comParadas: SimulacaoBaixada["rotas"] = [];
  for (const r of rotas) {
    const xml = await ajax({ "javax.faces.source": "tabelaRotas", "javax.faces.partial.execute": "tabelaRotas",
      "javax.faces.partial.render": "tabelaRotas:display tabelaRotas", "javax.faces.behavior.event": "rowToggle", "javax.faces.partial.event": "rowToggle",
      tabelaRotas_rowExpansion: "true", tabelaRotas_expandedRowIndex: String(r.indice), tabelaRotas_encodeFeature: "true", tabelaRotas_skipChildren: "true",
      ...campos, formCart_SUBMIT: "1" });
    comParadas.push({ ...r, paradas: lerParadas(xml) });
  }
  return { simulacao: rk, rotas: comParadas };
}

/** Login e quantas simulações há hoje (botão "Testar Pathfind"). */
export async function testarLogin(conta: ContaPathfind, f: typeof fetch = fetch): Promise<{ simulacoesHoje: number }> {
  const { simulacoes } = await roteirizacao(conta, f, 0);
  return { simulacoesHoje: (await simulacoes(diaBRT(new Date()))).length };
}
