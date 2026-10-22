import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { baixarSimulacao, PathfindError, testarLogin } from "./coletor";

const fx = (f: string) => readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), "utf8");
const conta = { base: "https://routing.exemplo/pathfind_teste", usuario: "usuario-teste", senha: "senha-secreta-123" };
const LOGIN = `<form id="loginForm"><input name="usuario"/><input type="hidden" name="javax.faces.ViewState" value="VS-LOGIN"/></form>`;
const TELA = `<form id="formCart"><input type="hidden" name="javax.faces.ViewState" value="VS-1"/></form>`;
const PROIBIDO = /Salvar|Simular|Nova|Reprocessar|Deletar|Liberar|CheckNow|Check Now/i;

type Chamada = { url: string; method: string; body: URLSearchParams };
function portal({ loginOk = true, simulacoes = fx("simulacoes.xml"), expiraNaRota = false, rotasLatin1 = false } = {}) {
  const chamadas: Chamada[] = [];
  const f = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input), method = init.method ?? "GET", body = new URLSearchParams(String(init.body ?? ""));
    chamadas.push({ url, method, body });
    if (url.endsWith("/login.xhtml")) return new Response(method === "GET" ? LOGIN : "ok", { headers: { "set-cookie": "JSESSIONID=abc; Path=/" } });
    if (method === "GET") return new Response(loginOk ? TELA : LOGIN);
    const fonte = body.get("javax.faces.source");
    if (fonte === "idChange:pesquisarSessao") return new Response(simulacoes);
    if (fonte === "idChange:carregarSimulacao") {
      const xml = fx("rotas.xml").replace("MOTORISTA 1", "JOSÉ");
      return new Response(rotasLatin1 ? Buffer.from(xml, "latin1") : xml);
    }
    if (fonte === "tabelaRotas") return new Response(expiraNaRota ? fx("expirou.xml") : fx("paradas.xml"));
    return new Response("<partial-response><changes></changes></partial-response>");
  }) as typeof fetch;
  return { f, chamadas };
}

describe("baixarSimulacao (só leitura)", () => {
  it("login → simulação mais recente da data → carrega → expande cada rota", async () => {
    const { f, chamadas } = portal();
    const r = await baixarSimulacao(conta, "2026-10-21", f, 0);
    expect(r.simulacao).toBe("1288");
    expect(r.rotas.map(x => x.rota)).toEqual(["RT001001", "RT001002"]);
    expect(r.rotas[0].paradas).toHaveLength(5);
    const pesquisa = chamadas.find(c => c.body.get("javax.faces.source") === "idChange:pesquisarSessao")!;
    expect(pesquisa.body.get("idChange:dataSessao_input")).toBe("21/10/2026");
    expect(chamadas.find(c => c.body.get("javax.faces.source") === "idChange:carregarSimulacao")!.body.get("idChange:simulacoesE_selection")).toBe("1288");
    const toggles = chamadas.filter(c => c.body.get("javax.faces.source") === "tabelaRotas");
    expect(toggles.map(c => c.body.get("tabelaRotas_expandedRowIndex"))).toEqual(["0", "1"]);
    expect(toggles[0].body.get("tabelaRotas:0:selectVeiculoComMotoristaId_input")).toBe("22");
    expect(toggles[0].body.get("javax.faces.ViewState")).toBe("VS-NOVO-123");
  });

  it("nunca aciona salvar, simular, nova, deletar, liberar nem Check Now WS", async () => {
    const { f, chamadas } = portal();
    await baixarSimulacao(conta, "2026-10-21", f, 0);
    for (const c of chamadas.filter(x => x.method === "POST" && x.url.endsWith("pedido.xhtml"))) {
      expect(c.body.get("javax.faces.source") ?? "").not.toMatch(PROIBIDO);
      expect([...c.body.keys()].join(" ")).not.toMatch(PROIBIDO);
    }
  });

  it("data sem simulação → 'sem simulação'", async () => {
    await expect(baixarSimulacao(conta, "2026-10-21", portal({ simulacoes: fx("sem-simulacao.xml") }).f, 0)).rejects.toThrow("sem simulação");
  });

  it("login recusado, sem a senha na mensagem", async () => {
    const e = await baixarSimulacao(conta, "2026-10-21", portal({ loginOk: false }).f, 0).catch(x => x);
    expect(e).toBeInstanceOf(PathfindError);
    expect(e.message).toBe("login recusado");
    expect(e.message).not.toContain(conta.senha);
  });

  it("sessão que cai no meio (redirect para o login) → 'sessão expirada'", async () => {
    await expect(baixarSimulacao(conta, "2026-10-21", portal({ expiraNaRota: true }).f, 0)).rejects.toThrow("sessão expirada");
  });

  it("resposta em latin1 mantém os acentos", async () => {
    const r = await baixarSimulacao(conta, "2026-10-21", portal({ rotasLatin1: true }).f, 0);
    expect(r.rotas[0].motorista).toBe("JOSÉ");
  });

  it("testarLogin conta as simulações de hoje", async () => {
    expect(await testarLogin(conta, portal().f)).toEqual({ simulacoesHoje: 2 });
  });
});
