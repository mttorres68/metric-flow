/*
 * MetricFlow — XLSX Service
 * Substitui o googleSheetsService.ts — lê o database.xlsx gerado pelo
 * debug_pathtracker.py (projeto/automacao) diretamente do disco.
 *
 * Vantagem: ~300ms vs 5-15s do Google Sheets. Sem quota, sem rede.
 *
 * Configuração (.env):
 *   PT_DATABASE_PATH=C:/Users/duttr/Documents/Projetos/automacao/downloads/pathtracker/database.xlsx
 *
 * As interfaces RawVisita e ProcessedVisita são idênticas às do
 * googleSheetsService.ts para que dataCache.ts e todos os routers
 * não precisem mudar nada.
 */

import fs from "fs";

// xlsx é um pacote CJS. Em ESM (tsx + module: ESNext) a forma correta
// é import() dinâmico — o default ou o próprio módulo expõe readFile.
// Resolvido no topo do módulo com top-level await via função init.
let XLSX: typeof import("xlsx");

async function getXLSX() {
    if (!XLSX) {
        const mod = await import("xlsx");
        // xlsx pode expor via .default (quando bundled) ou direto no namespace
        XLSX = (mod.default ?? mod) as typeof import("xlsx");
    }
    return XLSX;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces — mantidas idênticas ao googleSheetsService.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface RawVisita {
    Revenda: string;
    User: string;
    data: string;
    data_coleta: string;
    Cod_Gerente: number;
    Cod_Supervisor: number;
    Cod_Vendedor: number;
    "Cód. Cli.": number;
    "Razão Social": string;
    "Seq. ERP": number;
    "Seq. PT": number;
    "Dist. PV": string;
    "Dist. R": string;
    "Dif. PxR": string;
    "Vel. Méd.": string;
    "Tempo Perc.": string;
    "Ini. Hour": string;
    "Hora Fin.": string;
    "Tempo Vis.": string;
    "Valor Ped.": string;
    "Tipo Cobr.": string;
    "F/R"?: string;
}

export interface ProcessedVisita {
    id: number;
    vendedor: number;
    gerente: number;
    revenda: string;
    data: string;
    cliente: string;
    codCliente: number;
    seqERP: number;
    seqPT: number;
    valorPedido: string;
    valorNumerico: number;
    tipoCobr: string | number;
    horaInicio: string;
    horaFim: string;
    tempoVisita: string;
    distR: string;
    distPV: string;
    status: "convertido" | "nao_convertido" | "sem_visita";
    motivo: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Carregamento do xlsx
// ─────────────────────────────────────────────────────────────────────────────

function getDbPath(): string {
    const p = process.env.PT_DATABASE_PATH;
    if (!p) throw new Error(
        "PT_DATABASE_PATH não configurado no .env\n" +
        "Exemplo: PT_DATABASE_PATH=C:/Users/duttr/Documents/Projetos/automacao/downloads/pathtracker/database.xlsx"
    );
    // Normaliza separadores Windows → Node
    return p.replace(/\\/g, "/");
}

export async function loadGoogleSheetsData(): Promise<RawVisita[]> {
    // Nome mantido intencionalmente para que dataCache.ts não precise mudar
    const dbPath = getDbPath();

    if (!fs.existsSync(dbPath)) {
        throw new Error(
            `Arquivo não encontrado: ${dbPath}\n` +
            "Execute o debug_pathtracker.py para gerar o database.xlsx."
        );
    }

    const stat = fs.statSync(dbPath);
    const idadeHoras = (Date.now() - stat.mtimeMs) / 3_600_000;
    if (idadeHoras > 24) {
        console.warn(
            `[XLSX] Aviso: database.xlsx tem ${idadeHoras.toFixed(0)}h — execute o debug_pathtracker.py para atualizar.`
        );
    }

    const jsonPath = dbPath.replace(/\.xlsx$/i, '.json');
    if (fs.existsSync(jsonPath)) {
        try {
            const jsonStat = fs.statSync(jsonPath);
            if (jsonStat.mtimeMs >= stat.mtimeMs) {
                console.log(`[Cache JSON] Lendo versão otimizada ${jsonPath} ...`);
                const t0 = Date.now();
                const jsonContent = fs.readFileSync(jsonPath, "utf-8");
                const data = JSON.parse(jsonContent) as RawVisita[];
                console.log(`[Cache JSON] ✓ ${data.length} registros em ${Date.now() - t0}ms`);
                return data;
            }
        } catch (err) {
            console.warn(`[Cache JSON] Erro ao ler cache JSON:`, err);
        }
    }

    console.log(`[XLSX] Carregando ${dbPath} ...`);
    const t0 = Date.now();

    const xlsx = await getXLSX();
    const wb = xlsx.readFile(dbPath, { dense: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
        raw: false, // tudo como string — parsing feito abaixo
    });

    console.log(`[XLSX] ✓ ${rows.length} registros em ${Date.now() - t0}ms`);

    // Mapeia colunas do xlsx (nomes gerados pelo debug_pathtracker.py)
    // para o formato RawVisita que o restante do metric-flow espera
    const result = rows.map(r => mapRow(r));

    try {
        console.log(`[Cache JSON] Salvando versão otimizada em ${jsonPath} ...`);
        const t1 = Date.now();
        fs.writeFileSync(jsonPath, JSON.stringify(result));
        console.log(`[Cache JSON] ✓ Cache salvo em ${Date.now() - t1}ms`);
    } catch (err) {
        console.warn(`[Cache JSON] Erro ao salvar cache JSON:`, err);
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento de colunas xlsx → RawVisita
// O debug_pathtracker.py usa os títulos originais do relatório PathTracker.
// Alguns nomes variam entre revendas — o str() garante que nenhum seja undefined.
// ─────────────────────────────────────────────────────────────────────────────

function str(v: unknown): string { return String(v ?? "").trim(); }
function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }

function mapRow(r: Record<string, unknown>): RawVisita {
    return {
        Revenda: str(r["Revenda"]),
        User: str(r["User"]),
        data: str(r["data"]),
        data_coleta: str(r["data_coleta"]),
        Cod_Gerente: num(r["Cod_Gerente"]),
        Cod_Supervisor: num(r["Cod_Supervisor"]),
        Cod_Vendedor: num(r["Cod_Vendedor"]),
        "Cód. Cli.": num(r["Cód. Cli."] ?? r["Cod_Cliente"] ?? r["cod_cli"]),
        "Razão Social": str(r["Razão Social"] ?? r["Razao Social"] ?? r["razao_social"] ?? ""),
        "Seq. ERP": num(r["Seq. ERP"] ?? r["Seq_ERP"]),
        "Seq. PT": num(r["Seq. PT"] ?? r["Seq_PT"]),
        "Dist. PV": str(r["Dist. PV"] ?? r["Dist_PV"]),
        "Dist. R": str(r["Dist. R"] ?? r["Dist_R"]),
        "Dif. PxR": str(r["Dif. PxR"] ?? r["Dif_PxR"]),
        "Vel. Méd.": str(r["Vel. Méd."] ?? r["Vel_Med"]),
        "Tempo Perc.": str(r["Tempo Perc."] ?? r["Tempo_Perc"]),
        "Ini. Hour": str(r["Ini. Hour"] ?? r["Hora Início"] ?? r["Hora Inicio"] ?? r["hora_inicio"]),
        "Hora Fin.": str(r["Hora Fin."] ?? r["Hora Fim"] ?? r["hora_fim"]),
        "Tempo Vis.": str(r["Tempo Vis."] ?? r["Tempo Visita"] ?? r["tempo_vis"]),
        "Valor Ped.": str(r["Valor Ped."] ?? r["Vl. Pedido"] ?? r["Valor Pedido"]),
        "Tipo Cobr.": str(r["Tipo Cobr."] ?? r["Tipo Cobrança"] ?? r["tipo_cobr"]),
        "F/R": str(r["F/R"]),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de transformação — idênticos ao googleSheetsService.ts
// ─────────────────────────────────────────────────────────────────────────────

export function converterValorPedido(valor: string): number {
    try {
        let cleaned = String(valor).trim().replace(/[^0-9,.]/g, "");
        if (cleaned.includes(",") && cleaned.includes(".")) {
            cleaned = cleaned.replace(".", "").replace(",", ".");
        } else if (cleaned.includes(",")) {
            cleaned = cleaned.replace(",", ".");
        }
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
    } catch { return 0; }
}

export function classificarVisita(
    visita: RawVisita,
    _tempoVisitaMinutos: number | null
): { status: "convertido" | "nao_convertido" | "sem_visita"; motivo: string } {
    const valor = converterValorPedido(visita["Valor Ped."]);

    if (visita["Ini. Hour"] === "ND" || !visita["Ini. Hour"]) {
        return { status: "sem_visita", motivo: "Sem visita registrada" };
    }

    if (valor > 0) return { status: "convertido", motivo: "Pedido realizado" };

    const v = String(visita["Valor Ped."]).trim();
    const motivos: Record<string, string> = {
        "SEM DINHEIRO": "Sem dinheiro",
        "RECUSOU A COMPRA": "Recusou a compra",
        "ESTOQUE CHEIO": "Estoque cheio",
        "COMPROU EM ADEGA": "Comprou em adega",
        "PEDIDO FEITO VIA HEISHOP": "Pedido via HeiShop",
        "FECHADO NO MOMENTO DA VISTA": "Fechado no momento da visita",
        "FECHADO NO DIA DA VISITA": "Fechado no dia da visita",
        "FECHADO (ENCERROU ATIVIDADE)": "Encerrou atividade",
        "BLOQUEADO (ATIVO NO PALM)": "Bloqueado (Ativo no Palm)",
        "INADIMPLENTE": "Inadimplente",
        "COMPRADOR DO PDV AUSENTE": "Comprador do PDV ausente",
        "DESISTIU": "Desistiu",
        "DONO DO PDV AUSENTE": "Dono do PDV ausente",
        "EXCLUSIVO CONCORRENTE": "Exclusivo Concorrente",
        "DEBITO/PEND.": "Débito/pend.",
        "REJEITA MARCA": "Rejeita a marca",
        "FECHADO": "Fechado",
        "AUSENTE": "Ausente",
        "SEM VASILHAME": "Sem vasilhame",
        "PRECO": "Preço",
        "PDV EM REFORMA": "PDV em reforma",
        "0,00 ": "Sem venda",
        "0,00": "Sem registro",
    };
    for (const [key, label] of Object.entries(motivos)) {
        if (v.includes(key)) return { status: "nao_convertido", motivo: label };
    }
    return { status: "nao_convertido", motivo: "Motivo não identificado" };
}

export function processarVisitas(rawVisitas: RawVisita[]): ProcessedVisita[] {
    return rawVisitas.map((v, idx) => {
        const valor = converterValorPedido(v["Valor Ped."]);
        const { status, motivo } = classificarVisita(v, null);

        // Normaliza data "DD/MM/YYYY" → "YYYY-MM-DD"
        let data = v.data ?? "";
        if (data.includes("/")) {
            const [d, m, y] = data.split("/");
            data = `${y}-${m}-${d}`;
        }

        return {
            id: idx + 1,
            vendedor: Number(v.Cod_Vendedor),
            gerente: Number(v.Cod_Gerente),
            revenda: v.Revenda,
            data,
            cliente: v["Razão Social"],
            codCliente: Number(v["Cód. Cli."]),
            seqERP: Number(v["Seq. ERP"]),
            seqPT: Number(v["Seq. PT"]),
            valorPedido: v["Valor Ped."],
            valorNumerico: valor,
            tipoCobr: v["Tipo Cobr."],
            horaInicio: v["Ini. Hour"],
            horaFim: v["Hora Fin."],
            tempoVisita: v["Tempo Vis."],
            distR: v["Dist. R"],
            distPV: v["Dist. PV"],
            status,
            motivo,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitário: metadados do arquivo (para endpoint de status)
// ─────────────────────────────────────────────────────────────────────────────

export function getDbStatus(): {
    disponivel: boolean;
    caminho: string;
    tamanhoMB: number;
    ultimaModificacao: string | null;
    idadeHoras: number;
} {
    const caminho = process.env.PT_DATABASE_PATH ?? "não configurado";
    if (!fs.existsSync(caminho)) {
        return { disponivel: false, caminho, tamanhoMB: 0, ultimaModificacao: null, idadeHoras: -1 };
    }
    const s = fs.statSync(caminho);
    return {
        disponivel: true,
        caminho,
        tamanhoMB: parseFloat((s.size / 1_048_576).toFixed(1)),
        ultimaModificacao: s.mtime.toISOString(),
        idadeHoras: parseFloat(((Date.now() - s.mtimeMs) / 3_600_000).toFixed(1)),
    };
}