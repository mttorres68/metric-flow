/*
 * MetricFlow — PathTracker Router (Node/TypeScript)
 * Replica o fluxo de autenticação do debug_pathtracker.py:
 *   1. GET  /Landing/Login         → captura token CSRF
 *   2. POST /Landing/Login         → obtém cookie Control
 *   3. GET  /PathTrackerAPI/...    → baixa JSON de pedidos por hierarquia
 *
 * Também expõe endpoints para ler o .xlsx gerado pelo debug_pathtracker.py:
 *   pt.lerBaseDia      — lê o database.xlsx local, filtra por data/revenda
 *   pt.statusBase      — retorna metadados do arquivo (data, contagem)
 *
 * Configuração (variáveis de ambiente):
 *   PT_BASE_URL      = http://portal.controlinformatica.com.br
 *   PT_REVENDAS      = JSON array: [{"revenda":"FORTE QX","user":"adm3443","unit":"013443"}, ...]
 *   PT_DATABASE_PATH = caminho absoluto para o database.xlsx gerado pelo Python
 *                      ex: C:/Users/duttr/Documents/Projetos/PathTracker/Base de Dados/database.xlsx
 */

import { z } from "zod";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { publicProcedure, router } from "../_core/trpc";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos do JSON PathTracker
// ─────────────────────────────────────────────────────────────────────────────

interface PtCliente {
    clientNumber: string;
    clientRegion: string;
    clientCode: string;
    coordGpsX: string | null;
    coordGpsY: string | null;
    corporateName: string;
    abbreviation: string;
    id: string;
    channel: string;
    creditLimit: number;
    isDefaulter: boolean;
    countOfOverdueInvoices: number;
    priceOfOverdueInvoices: number;
}

interface PtPedido {
    id: string;
    client: PtCliente;
    netValue: number;
    coordGpsX: string | null;  // coord do VENDEDOR no momento do pedido
    coordGpsY: string | null;
    distanceFromSalesPoint: number;
    isOrderOutOfSalesPoint: boolean;
    initialHourOrder: string;         // ISO 8601
    noSalesCause: { code: string; description: string } | null;
    vendorCode: string;
    isOutOfRoute: boolean;
    NoSaleReasonCode: string;
}

interface PtClienteNaoVisitado extends PtCliente {
    visitSequence: number;
    appliedSequence: number;
}

interface PtSellerRouteInfo {
    visitedInRouteWithSale: PtPedido[];
    visitedInRouteWithoutSale: PtPedido[];
    visitedOutOfRouteWithSale: PtPedido[];
    visitedOutOfRouteWithoutSale: PtPedido[];
    notVisitedClients: PtClienteNaoVisitado[];
    routeId: string;
    vendorCode: string;
}

interface PtVendedorItem {
    sellerRouteInfo: PtSellerRouteInfo;
    vendorCode: string;
    vendorName: string;
    unitCode: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos normalizados para o MetricFlow
// ─────────────────────────────────────────────────────────────────────────────

export interface PtVisita {
    // Identificação
    revenda: string;
    vendorCode: string;
    vendorName: string;
    idCliente: string;   // clientRegion + clientCode (ex: "00010606")
    idClienteGlobal: string;   // "REVENDA-00010606" para cruzar com base GA
    nomeCliente: string;
    abrevCliente: string;

    // Status da visita
    tipo: "com_venda" | "sem_venda" | "nao_visitado" | "fora_rota_com_venda" | "fora_rota_sem_venda";
    valorPedido: number;
    motivoNaoVenda: string | null;
    foraDeRota: boolean;

    // Localização — CHAVE da Task 1
    latVendedor: number | null;   // onde o vendedor estava ao registrar
    lonVendedor: number | null;
    latCliente: number | null;   // coordenada cadastrada do PDV
    lonCliente: number | null;
    distanciaPDV: number | null;   // metros (já calculada pelo PathTracker)
    foraDoPDV: boolean;         // distanceFromSalesPoint > raio

    // Tempo
    horaInicio: string | null;   // "HH:MM:SS" local (convertido de UTC-3)

    // Financeiro / crédito
    creditLimit: number;
    inadimplente: boolean;
    titulosVencidos: number;
    valorVencido: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuração das revendas
// ─────────────────────────────────────────────────────────────────────────────

interface RevendaConfig {
    revenda: string;
    user: string;
    unit: string;
}

function getRevendas(): RevendaConfig[] {
    try {
        const raw = process.env.PT_REVENDAS;
        if (!raw) throw new Error("PT_REVENDAS não configurado");
        return JSON.parse(raw) as RevendaConfig[];
    } catch {
        // Fallback com as revendas conhecidas (edite conforme necessário)
        return [
            { revenda: "FORTE QX", user: "adm3443", unit: "013443" },
            { revenda: "FORTE AR", user: "adm3443", unit: "013443" },
            { revenda: "Duttra FL", user: "adm3443", unit: "013443" },
            { revenda: "Duttra MA", user: "adm3443", unit: "013443" },
            { revenda: "Duttra SR", user: "adm3443", unit: "013443" },
        ];
    }
}

const BASE_URL = (process.env.PT_BASE_URL ?? "http://portal.controlinformatica.com.br").replace(/\/$/, "");

// ─────────────────────────────────────────────────────────────────────────────
// Autenticação — replica exatamente o debug_pathtracker.py
// ─────────────────────────────────────────────────────────────────────────────

interface CookieJar {
    sessionId: string;
    control: string;
    token: string;
}

async function autenticar(user: string): Promise<CookieJar> {
    const senha = user; // senha == usuário (regra do sistema)

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "X-Requested-With": "XMLHttpRequest",
    };

    // ── Passo 1: GET login — captura token CSRF ──────────────────────────────
    const r1 = await fetch(`${BASE_URL}/PathTracker/Landing/Login`, { headers });
    if (!r1.ok) throw new Error(`Login GET falhou: ${r1.status}`);

    const html1 = await r1.text();
    const cookies1 = parseCookies(r1.headers.get("set-cookie") ?? "");

    // Extrai token CSRF do HTML (input[name="__RequestVerificationToken"])
    const csrfMatch = html1.match(/name="__RequestVerificationToken"\s+[^>]*value="([^"]+)"/);
    if (!csrfMatch) throw new Error("Token CSRF não encontrado na página de login");
    const csrfToken = csrfMatch[1];

    // ── Passo 2: POST login — obtém cookie Control ───────────────────────────
    const cookieHeader1 = buildCookieHeader(cookies1);

    const body2 = new URLSearchParams({
        "__RequestVerificationToken": csrfToken,
        "UserName": user,
        "Password": senha,
    });

    const r2 = await fetch(`${BASE_URL}/PathTracker/Landing/Login`, {
        method: "POST",
        headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": `${BASE_URL}/PathTracker/`,
            "Cookie": cookieHeader1,
        },
        body: body2.toString(),
        redirect: "manual", // não seguir redirect — precisamos pegar os cookies
    });

    const cookies2 = parseCookies(r2.headers.get("set-cookie") ?? "");
    const allCookies = { ...cookies1, ...cookies2 };

    if (!allCookies["Control"]) {
        throw new Error(`Autenticação falhou para usuário '${user}' — cookie 'Control' ausente`);
    }

    return {
        sessionId: allCookies["ASP.NET_SessionId"] ?? "",
        control: allCookies["Control"] ?? "",
        token: allCookies["__RequestVerificationToken_L1BhdGhUcmFja2Vy0"] ?? csrfToken,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch do JSON de pedidos
// ─────────────────────────────────────────────────────────────────────────────

async function buscarPedidos(
    unit: string,
    date: string,       // "YYYY/MM/DD"
    cookies: CookieJar,
): Promise<PtVendedorItem[]> {
    const cookieStr = [
        `Culture=pt`,
        `ASP.NET_SessionId=${cookies.sessionId}`,
        `Control=${cookies.control}`,
    ].join("; ");

    const url = `${BASE_URL}/PathTrackerAPI/API/v1/Order/getordersbyhierarchy/?unit=${unit}&date=${date}&loggedEmployeeCode=`;

    const r = await fetch(url, {
        headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json;charset=utf-8",
            "Cookie": cookieStr,
            "Referer": `${BASE_URL}/PathTracker/Sellers/SellersDashboard`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });

    if (!r.ok) throw new Error(`getordersbyhierarchy falhou: ${r.status}`);

    const data = await r.json() as PtVendedorItem[];
    return Array.isArray(data) ? data : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalização — converte o JSON bruto para PtVisita[]
// ─────────────────────────────────────────────────────────────────────────────

function parseCoord(val: string | null): number | null {
    if (!val || val.trim() === "") return null;
    const n = parseFloat(val.replace(",", "."));
    return isNaN(n) ? null : n;
}

function isoParaHoraLocal(iso: string | null): string | null {
    if (!iso) return null;
    try {
        // O PathTracker retorna UTC (sufixo Z), converte para Brasília (UTC-3)
        const d = new Date(iso);
        d.setHours(d.getHours() - 3);
        return d.toTimeString().slice(0, 8); // "HH:MM:SS"
    } catch {
        return null;
    }
}

function normalizarId(region: string, code: string): string {
    // Remove zeros à esquerda de cada parte e concatena com zeros
    // "0001" + "0606" → "00010606" (mantém o formato da planilha)
    return region.padStart(4, "0") + code.padStart(4, "0");
}

function normalizarPedido(
    pedido: PtPedido,
    tipo: PtVisita["tipo"],
    revenda: string,
    vendorName: string,
): PtVisita {
    const idCliente = normalizarId(pedido.client.clientRegion, pedido.client.clientCode);

    return {
        revenda,
        vendorCode: pedido.vendorCode,
        vendorName,
        idCliente,
        idClienteGlobal: `${revenda}-${idCliente}`,
        nomeCliente: pedido.client.corporateName,
        abrevCliente: pedido.client.abbreviation,
        tipo,
        valorPedido: pedido.netValue ?? 0,
        motivoNaoVenda: pedido.noSalesCause?.description ?? null,
        foraDeRota: pedido.isOutOfRoute ?? false,
        latVendedor: parseCoord(pedido.coordGpsY),
        lonVendedor: parseCoord(pedido.coordGpsX),
        latCliente: parseCoord(pedido.client.coordGpsY),
        lonCliente: parseCoord(pedido.client.coordGpsX),
        distanciaPDV: pedido.distanceFromSalesPoint ?? null,
        foraDoPDV: pedido.isOrderOutOfSalesPoint ?? false,
        horaInicio: isoParaHoraLocal(pedido.initialHourOrder),
        creditLimit: pedido.client.creditLimit ?? 0,
        inadimplente: pedido.client.isDefaulter ?? false,
        titulosVencidos: pedido.client.countOfOverdueInvoices ?? 0,
        valorVencido: pedido.client.priceOfOverdueInvoices ?? 0,
    };
}

function normalizarNaoVisitado(
    cliente: PtClienteNaoVisitado,
    revenda: string,
    vendorCode: string,
    vendorName: string,
): PtVisita {
    const idCliente = normalizarId(cliente.clientRegion, cliente.clientCode);
    return {
        revenda,
        vendorCode,
        vendorName,
        idCliente,
        idClienteGlobal: `${revenda}-${idCliente}`,
        nomeCliente: cliente.corporateName,
        abrevCliente: cliente.abbreviation,
        tipo: "nao_visitado",
        valorPedido: 0,
        motivoNaoVenda: null,
        foraDeRota: false,
        latVendedor: null,
        lonVendedor: null,
        latCliente: parseCoord(cliente.coordGpsY),
        lonCliente: parseCoord(cliente.coordGpsX),
        distanciaPDV: null,
        foraDoPDV: false,
        horaInicio: null,
        creditLimit: cliente.creditLimit ?? 0,
        inadimplente: cliente.isDefaulter ?? false,
        titulosVencidos: cliente.countOfOverdueInvoices ?? 0,
        valorVencido: cliente.priceOfOverdueInvoices ?? 0,
    };
}

function normalizarVendedor(item: PtVendedorItem, revenda: string): PtVisita[] {
    const { sellerRouteInfo, vendorCode, vendorName } = item;
    const visitas: PtVisita[] = [];

    for (const p of sellerRouteInfo.visitedInRouteWithSale)
        visitas.push(normalizarPedido(p, "com_venda", revenda, vendorName));

    for (const p of sellerRouteInfo.visitedInRouteWithoutSale)
        visitas.push(normalizarPedido(p, "sem_venda", revenda, vendorName));

    for (const p of sellerRouteInfo.visitedOutOfRouteWithSale)
        visitas.push(normalizarPedido(p, "fora_rota_com_venda", revenda, vendorName));

    for (const p of sellerRouteInfo.visitedOutOfRouteWithoutSale)
        visitas.push(normalizarPedido(p, "fora_rota_sem_venda", revenda, vendorName));

    for (const c of sellerRouteInfo.notVisitedClients)
        visitas.push(normalizarNaoVisitado(c, revenda, vendorCode, vendorName));

    return visitas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache em memória por [revenda + data] — evita reautenticar a cada query
// ─────────────────────────────────────────────────────────────────────────────

const _cache = new Map<string, { ts: number; data: PtVisita[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min (alinhado com o ping do SignalR)

async function buscarComCache(
    cfg: RevendaConfig,
    date: string,
): Promise<PtVisita[]> {
    const key = `${cfg.unit}__${date}`;
    const hit = _cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

    const cookies = await autenticar(cfg.user);
    const raw = await buscarPedidos(cfg.unit, date, cookies);

    const visitas = raw.flatMap(item => normalizarVendedor(item, cfg.revenda));
    _cache.set(key, { ts: Date.now(), data: visitas });
    return visitas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de cookie (Node fetch não tem cookie jar nativo)
// ─────────────────────────────────────────────────────────────────────────────

function parseCookies(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const part of raw.split(/,(?=[^ ])/)) {
        const [kv] = part.trim().split(";");
        if (!kv) continue;
        const eq = kv.indexOf("=");
        if (eq === -1) continue;
        const k = kv.slice(0, eq).trim();
        const v = kv.slice(eq + 1).trim();
        if (k) result[k] = v;
    }
    return result;
}

function buildCookieHeader(jar: Record<string, string>): string {
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Router tRPC
// ─────────────────────────────────────────────────────────────────────────────

export const ptRouter = router({

    // ── Pedidos de uma revenda em uma data ──────────────────────────────────────
    pedidosDia: publicProcedure
        .input(z.object({
            revenda: z.string(),                          // "FORTE QX"
            date: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/), // "2026/03/20"
        }))
        .query(async ({ input }) => {
            const revendas = getRevendas();
            const cfg = revendas.find(r => r.revenda === input.revenda);
            if (!cfg) throw new Error(`Revenda '${input.revenda}' não encontrada na configuração`);

            const visitas = await buscarComCache(cfg, input.date);
            return { revenda: input.revenda, date: input.date, visitas };
        }),

    // ── Todas as revendas de uma data (paralelo) ───────────────────────────────
    todasRevendas: publicProcedure
        .input(z.object({
            date: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/),
        }))
        .query(async ({ input }) => {
            const revendas = getRevendas();

            const resultados = await Promise.allSettled(
                revendas.map(cfg => buscarComCache(cfg, input.date))
            );

            const visitas: PtVisita[] = [];
            const erros: string[] = [];

            for (let i = 0; i < resultados.length; i++) {
                const r = resultados[i];
                if (r.status === "fulfilled") {
                    visitas.push(...r.value);
                } else {
                    erros.push(`${revendas[i].revenda}: ${r.reason?.message ?? "erro desconhecido"}`);
                }
            }

            return { date: input.date, total: visitas.length, erros, visitas };
        }),

    // ── Lista as revendas configuradas ─────────────────────────────────────────
    listarRevendas: publicProcedure.query(() =>
        getRevendas().map(r => ({ revenda: r.revenda, unit: r.unit }))
    ),

    // ── Lê o .xlsx gerado pelo Python, filtra por data e revenda ───────────────
    // Muito mais rápido que baixar do Google Sheets — leitura local instantânea.
    lerBaseDia: publicProcedure
        .input(z.object({
            date: z.string(),            // "YYYY-MM-DD" ou "DD/MM/YYYY"
            revenda: z.string().optional(), // se omitido, retorna todas
        }))
        .query(async ({ input }) => {
            const dbPath = process.env.PT_DATABASE_PATH;
            if (!dbPath) throw new Error("PT_DATABASE_PATH não configurado no .env");
            if (!fs.existsSync(dbPath)) throw new Error(`Arquivo não encontrado: ${dbPath}`);

            // Lê o xlsx — usa sheet_to_json para não carregar tudo em memória
            const wb = XLSX.readFile(dbPath, { dense: false });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, {
                defval: "",
                raw: false, // datas como string
            });

            // Normaliza a data de input para "DD/MM/YYYY" (formato do Python)
            const dateNorm = normalizarDataFiltro(input.date);

            // Filtra
            const filtrado = rows.filter(r => {
                const dataMatch = !dateNorm || String(r["data"] ?? "").includes(dateNorm);
                const revendaMatch = !input.revenda || r["Revenda"] === input.revenda;
                return dataMatch && revendaMatch;
            });

            // Mapeia para PtVisitaPlanilha (estrutura da planilha, diferente do JSON)
            const visitas = filtrado.map(r => mapearLinhaXlsx(r));

            return {
                date: input.date,
                revenda: input.revenda ?? "todas",
                total: visitas.length,
                visitas,
            };
        }),

    // ── Metadados do arquivo local ──────────────────────────────────────────────
    statusBase: publicProcedure.query(() => {
        const dbPath = process.env.PT_DATABASE_PATH;
        if (!dbPath || !fs.existsSync(dbPath)) {
            return { disponivel: false, caminho: dbPath ?? "não configurado", linhas: 0, ultimaModificacao: null };
        }

        const stats = fs.statSync(dbPath);
        const wb = XLSX.readFile(dbPath, { sheetRows: 2 }); // só cabeçalho para contar
        const ws = wb.Sheets[wb.SheetNames[0]];
        const ref = ws["!ref"] ?? "";
        // Extrai número de linhas do ref (ex: "A1:AB90123" → 90123)
        const linhas = ref ? parseInt(ref.split(":")[1]?.replace(/[A-Z]/g, "") ?? "0") - 1 : 0;

        return {
            disponivel: true,
            caminho: dbPath,
            linhas,
            ultimaModificacao: stats.mtime.toISOString(),
            tamanhoMB: parseFloat((stats.size / 1024 / 1024).toFixed(1)),
        };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para leitura do xlsx
// ─────────────────────────────────────────────────────────────────────────────

// Tipo das linhas da planilha (colunas geradas pelo debug_pathtracker.py)
export interface PtVisitaPlanilha {
    revenda: string;
    vendedor: string;     // Cod_Vendedor
    gerente: string;     // Cod_Gerente
    codCliente: string;     // Cod. Cliente normalizado
    horaInicio: string;
    horaFim: string;
    duracao: string;
    distPV: string;
    valorPedido: string;
    status: string;
    motivo: string;
    data: string;
    // Pode ter mais colunas dependendo do relatório
    [key: string]: string;
}

function normalizarDataFiltro(date: string): string {
    // Aceita "YYYY-MM-DD" ou "DD/MM/YYYY", normaliza para "DD/MM/YYYY"
    if (date.includes("-")) {
        const [y, m, d] = date.split("-");
        return `${d}/${m}/${y}`;
    }
    return date; // já está no formato correto
}

function mapearLinhaXlsx(r: Record<string, string | number>): PtVisitaPlanilha {
    // As colunas espelham o que o tratar_arquivo_excel() gera
    const str = (v: unknown) => String(v ?? "").trim();
    return {
        revenda: str(r["Revenda"]),
        vendedor: str(r["Cod_Vendedor"]),
        gerente: str(r["Cod_Gerente"]),
        codCliente: str(r["Cód. Cli."] ?? r["Cod. Cliente"] ?? r["codigo_cliente"] ?? ""),
        horaInicio: str(r["Hora Início"] ?? r["Hora Inicio"] ?? r["hora_inicio"] ?? ""),
        horaFim: str(r["Hora Fim"] ?? r["hora_fim"] ?? ""),
        duracao: str(r["Tempo Vis."] ?? r["Tempo Visita"] ?? r["duracao"] ?? ""),
        distPV: str(r["Dist. PV"] ?? r["dist_pv"] ?? ""),
        valorPedido: str(r["Vl. Pedido"] ?? r["Valor Pedido"] ?? r["valor_pedido"] ?? ""),
        status: str(r["Status"] ?? r["status"] ?? ""),
        motivo: str(r["Motivo"] ?? r["motivo"] ?? ""),
        data: str(r["data"] ?? ""),
        // passa todas as colunas restantes como fallback
        ...Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, str(v)])
        ),
    };
}