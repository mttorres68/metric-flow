/*
 * MetricFlow — coletor do portal CheckNow (JSF/PrimeFaces), sem navegador (spec checknow-coleta §3).
 * login → tela do relatório (ViewState) → datas → Excel → "Gerar Arquivo" (POST normal, devolve o xlsx).
 * A senha nunca entra em log nem em mensagem de erro.
 */
import { ColetaError } from "./repo";
import { Sessao as SessaoPortal } from "../portal/sessao";

const BASE = "https://checknowsistema.com.br/checknow";
const TELA = `${BASE}/relatorio/geracao_dado_bi_periodo_rel.jsf`;
const DIA_MS = 86_400_000;

/** Sessão do portal com o Referer da tela do relatório. */
class Sessao {
  private s: SessaoPortal;
  constructor(f: typeof fetch) { this.s = new SessaoPortal(f, "CheckNow", ColetaError); }
  req(url: string, init?: RequestInit) { return this.s.req(url, init); }
  post(url: string, campos: Record<string, string>, ajax: boolean) { return this.s.post(url, campos, ajax, TELA); }
}


const naTelaDeLogin = (html: string) => /name="j_username"/.test(html);
const dataBR = (iso: string, fim: boolean) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${fim ? "23:59:59" : "00:00:00"}`;
const somaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

/** O portal limita a quantidade de relatórios por conta; estourada, redireciona para limite_excedido_rel.jsf. */
export const LIMITE_EXCEDIDO = "o CheckNow limitou os relatórios desta conta (limite de requisições excedido); tente de novo mais tarde";

/** Blocos de até 31 dias — o limite do próprio portal; menos exportações gastam menos da cota de relatórios. */
export function blocosDeDias(de: string, ate: string, n = 31): { de: string; ate: string }[] {
  const out: { de: string; ate: string }[] = [];
  for (let d = de; d <= ate; d = somaDias(d, n)) {
    const fim = somaDias(d, n - 1);
    out.push({ de: d, ate: fim < ate ? fim : ate });
  }
  return out;
}

/** HTML da tela do relatório; login recusado quando o portal devolve a tela de login. */
async function abrirTela(s: Sessao): Promise<string> {
  const html = await (await s.req(TELA)).res.text();
  if (naTelaDeLogin(html)) throw new ColetaError("login recusado");
  return html;
}

async function entrar(s: Sessao, conta: { usuario: string; senha: string }): Promise<string> {
  await s.req(`${BASE}/publico/login.jsf`);
  await s.post(`${BASE}/publico/j_spring_security_check`, { j_username: conta.usuario, j_password: conta.senha }, false);
  return abrirTela(s);
}

function viewState(html: string): string {
  const input = html.match(/<input[^>]*javax\.faces\.ViewState[^>]*>/)?.[0];
  const v = input?.match(/value="([^"]*)"/)?.[1];
  if (!v) throw new ColetaError("tela do relatório mudou (ViewState não encontrado)");
  return v;
}

export async function testarLogin(conta: { usuario: string; senha: string }, f: typeof fetch = fetch): Promise<{ filial: string }> {
  const html = await entrar(new Sessao(f), conta);
  viewState(html);
  return { filial: html.match(/\d+-[^<>]*?\([^()<>]+\)/)?.[0].trim() ?? "login ok" };
}

/** Um arquivo por bloco de até 31 dias (filtro do portal: data de início da rota). */
export async function baixarCheckNow(conta: { usuario: string; senha: string }, de: string, ate: string, f: typeof fetch = fetch): Promise<Buffer[]> {
  const s = new Sessao(f);
  let html = await entrar(s, conta);
  const arquivos: Buffer[] = [];
  for (const b of blocosDeDias(de, ate)) {
    if (arquivos.length) html = await abrirTela(s);
    const vs = viewState(html);
    const datas = { formTemplate: "formTemplate", dtInicio_input: dataBR(b.de, false), dtFim_input: dataBR(b.ate, true) };
    const ajax = (fonte: string, evento: string, extra: Record<string, string> = {}) => s.post(TELA, {
      "javax.faces.partial.ajax": "true", "javax.faces.source": fonte, "javax.faces.partial.execute": fonte,
      "javax.faces.behavior.event": evento, "javax.faces.partial.event": evento === "valueChange" ? "change" : evento,
      ...datas, ...extra, "javax.faces.ViewState": vs,
    }, true);
    await ajax("dtInicio", "dateSelect");
    await ajax("tipoRelatorioId", "valueChange", { tipoRelatorioId: "11" });
    const { res } = await s.post(TELA, { ...datas, tipoRelatorioId: "11", commandLinkExporta: "commandLinkExporta", "javax.faces.ViewState": vs }, false);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 2).toString("latin1") !== "PK") {
      if (/limite de requisi|limite_excedido/i.test(buf.toString("latin1"))) throw new ColetaError(LIMITE_EXCEDIDO);
      throw new ColetaError("resposta não é Excel");
    }
    arquivos.push(buf);
  }
  return arquivos;
}
