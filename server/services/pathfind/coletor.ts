/*
 * MetricFlow — coletor do Pathfind (roteirizador, JSF/PrimeFaces), sem navegador (spec pathfind-previsto §3).
 * Só leitura: login → roteirização → simulações da data → carregar → expandir cada rota.
 * A senha nunca entra em log nem em mensagem de erro.
 */
import { ColetaError } from "../checknow/repo";
import { Sessao } from "../portal/sessao";

export type ContaPathfind = { base: string; usuario: string; senha: string };

/** Erros do Pathfind: "login recusado", "sessão expirada", "sem simulação", "tela do Pathfind mudou (…)". */
export class PathfindError extends ColetaError {}

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
