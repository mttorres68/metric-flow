/*
 * MetricFlow — sessão HTTP de portal JSF sem navegador (CheckNow, Pathfind): pote de cookies próprio, segue
 * redirecionamentos guardando os cookies de cada passo. Erros saem com o nome do portal, nunca com o corpo enviado.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const TIMEOUT_MS = 120_000;

export class Sessao {
  private cookies = new Map<string, string>();
  constructor(private f: typeof fetch, private portal: string, private Erro: new (msg: string) => Error) {}

  async req(url: string, init: RequestInit = {}, saltos = 5): Promise<{ url: string; res: Response }> {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", UA);
    headers.set("Accept-Language", "pt-BR,pt;q=0.9");
    if (this.cookies.size) headers.set("Cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    let res: Response;
    try {
      res = await this.f(url, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new this.Erro(`${this.portal} não respondeu (${(e as Error).name === "TimeoutError" ? "tempo esgotado" : "falha de rede"})`);
    }
    for (const c of res.headers.getSetCookie()) {
      const par = c.split(";")[0];
      const i = par.indexOf("=");
      if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
    const destino = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && destino && saltos > 0) return this.req(new URL(destino, url).toString(), {}, saltos - 1);
    if (res.status >= 400) throw new this.Erro(`${this.portal} não respondeu (HTTP ${res.status})`);
    return { url, res };
  }

  post(url: string, campos: Record<string, string>, ajax: boolean, referer: string) {
    return this.req(url, {
      method: "POST",
      body: new URLSearchParams(campos).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: referer,
        ...(ajax ? { "Faces-Request": "partial/ajax", "X-Requested-With": "XMLHttpRequest" } : {}),
      },
    });
  }
}
