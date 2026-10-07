import { describe, it, expect } from "vitest";
import { baixarCheckNow, blocosDeDias, testarLogin } from "./coletor";
import { ColetaError } from "./repo";

const conta = { usuario: "usuario-teste", senha: "senha-teste" };
const TELA_OK = `<html><form id="formTemplate"><span>3722-DUTTRA PI DISTRIBUIDORA (FLORIANO)</span>
<input type="hidden" id="j_id1:javax.faces.ViewState:0" value="-66:29" name="javax.faces.ViewState" autocomplete="off"/></form></html>`;
const LOGIN = `<form><input name="j_username" id="j_username"></form>`;
const EXCEL = Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.alloc(100)]);

type Chamada = { url: string; method: string; body: string; cookie: string | null };
function portal({ loginOk = true, tela = TELA_OK, arquivo = EXCEL as Buffer | string } = {}) {
  const chamadas: Chamada[] = [];
  const f = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input), method = init.method ?? "GET", body = String(init.body ?? "");
    chamadas.push({ url, method, body, cookie: new Headers(init.headers).get("Cookie") });
    if (url.endsWith("/publico/login.jsf")) return new Response(LOGIN, { headers: { "set-cookie": "JSESSIONID=abc; Path=/" } });
    if (url.endsWith("/j_spring_security_check")) return new Response(null, { status: 302, headers: { location: loginOk ? "/checknow/index.jsf" : "/checknow/publico/login.jsf?erro=true" } });
    if (url.endsWith("/index.jsf")) return new Response("<html>home</html>");
    if (url.includes("login.jsf?erro")) return new Response(LOGIN);
    if (url.endsWith("geracao_dado_bi_periodo_rel.jsf") && method === "GET") return new Response(loginOk ? tela : LOGIN);
    if (body.includes("commandLinkExporta")) return new Response(arquivo);
    return new Response("<partial-response/>");
  }) as typeof fetch;
  return { f, chamadas };
}

describe("blocosDeDias", () => {
  it("10 dias viram 2 blocos de até 7", () => {
    expect(blocosDeDias("2026-10-01", "2026-10-10")).toEqual([{ de: "2026-10-01", ate: "2026-10-07" }, { de: "2026-10-08", ate: "2026-10-10" }]);
  });
});

describe("baixarCheckNow", () => {
  it("faz login, marca período e Excel e baixa o arquivo com o cookie da sessão", async () => {
    const { f, chamadas } = portal();
    const [buf] = await baixarCheckNow(conta, "2026-10-01", "2026-10-07", f);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const final = chamadas.find(c => c.body.includes("commandLinkExporta"))!;
    const p = new URLSearchParams(final.body);
    expect(p.get("dtInicio_input")).toBe("01/10/2026 00:00:00");
    expect(p.get("dtFim_input")).toBe("07/10/2026 23:59:59");
    expect(p.get("tipoRelatorioId")).toBe("11");
    expect(p.get("javax.faces.ViewState")).toBe("-66:29");
    expect(final.cookie).toContain("JSESSIONID=abc");
    expect(chamadas.some(c => c.body.includes("javax.faces.source=dtInicio"))).toBe(true);
    expect(chamadas.some(c => c.body.includes("javax.faces.source=tipoRelatorioId"))).toBe(true);
  });

  it("login recusado", async () => {
    await expect(baixarCheckNow(conta, "2026-10-01", "2026-10-01", portal({ loginOk: false }).f)).rejects.toThrow("login recusado");
  });

  it("tela sem ViewState", async () => {
    await expect(baixarCheckNow(conta, "2026-10-01", "2026-10-01", portal({ tela: "<html>nada</html>" }).f)).rejects.toThrow("ViewState não encontrado");
  });

  it("HTML no lugar do Excel", async () => {
    const e = await baixarCheckNow(conta, "2026-10-01", "2026-10-01", portal({ arquivo: "<html>erro</html>" }).f).catch(x => x);
    expect(e).toBeInstanceOf(ColetaError);
    expect(e.message).toBe("resposta não é Excel");
  });

  it("período de 10 dias baixa 2 arquivos", async () => {
    expect(await baixarCheckNow(conta, "2026-10-01", "2026-10-10", portal().f)).toHaveLength(2);
  });

  it("a senha não aparece em mensagem de erro", async () => {
    const e = await baixarCheckNow(conta, "2026-10-01", "2026-10-01", portal({ loginOk: false }).f).catch(x => x);
    expect(e.message).not.toContain("senha-teste");
  });
});

describe("testarLogin", () => {
  it("devolve o nome da filial", async () => {
    expect(await testarLogin(conta, portal().f)).toEqual({ filial: "3722-DUTTRA PI DISTRIBUIDORA (FLORIANO)" });
  });
});
