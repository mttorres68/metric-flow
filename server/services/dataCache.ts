import fs from "fs";
import path from "path";
import { loadGoogleSheetsData, processarVisitas, ProcessedVisita, getDbStatus }
    from "../services/xlsxService";

// ─────────────────────────────────────────────────────────────────────────────
// Índice — construído uma vez no load, queries O(1) em vez de O(n)
// ─────────────────────────────────────────────────────────────────────────────

export interface VisitasIndex {
    visitas: ProcessedVisita[];
    byData: Map<string, ProcessedVisita[]>;
    byRevenda: Map<string, ProcessedVisita[]>;
    byVendedor: Map<number, ProcessedVisita[]>;
    /** Chave composta `${vendedor}:${data}` */
    byVendedorData: Map<string, ProcessedVisita[]>;
    /** Chave composta `${revenda}:${data}` */
    byRevendaData: Map<string, ProcessedVisita[]>;
}

let cachedIndex: VisitasIndex | null = null;
let cachedFileMtime = 0;
let loadingPromise: Promise<VisitasIndex> | null = null;

let cachedRotaCoaching: any[] | null = null;
let lastRotaCacheTime = 0;
const ROTA_CACHE_DURATION_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

function getSourceMtime(): number {
    try {
        const p = (process.env.PT_DATABASE_PATH ?? "").replace(/\\/g, "/");
        const jsonPath = p.replace(/\.xlsx$/i, ".json");
        // JSON cache é escrito pelo xlsxService após cada parse do xlsx;
        // usar seu mtime evita re-parse desnecessário.
        const target = fs.existsSync(jsonPath) ? jsonPath : p;
        return target ? fs.statSync(target).mtimeMs : 0;
    } catch {
        return 0;
    }
}

function buildIndex(visitas: ProcessedVisita[]): VisitasIndex {
    const byData = new Map<string, ProcessedVisita[]>();
    const byRevenda = new Map<string, ProcessedVisita[]>();
    const byVendedor = new Map<number, ProcessedVisita[]>();
    const byVendedorData = new Map<string, ProcessedVisita[]>();
    const byRevendaData = new Map<string, ProcessedVisita[]>();

    for (const v of visitas) {
        if (!byData.has(v.data)) byData.set(v.data, []);
        byData.get(v.data)!.push(v);

        if (!byRevenda.has(v.revenda)) byRevenda.set(v.revenda, []);
        byRevenda.get(v.revenda)!.push(v);

        if (!byVendedor.has(v.vendedor)) byVendedor.set(v.vendedor, []);
        byVendedor.get(v.vendedor)!.push(v);

        const vdKey = `${v.vendedor}:${v.data}`;
        if (!byVendedorData.has(vdKey)) byVendedorData.set(vdKey, []);
        byVendedorData.get(vdKey)!.push(v);

        const rdKey = `${v.revenda}:${v.data}`;
        if (!byRevendaData.has(rdKey)) byRevendaData.set(rdKey, []);
        byRevendaData.get(rdKey)!.push(v);
    }

    return { visitas, byData, byRevenda, byVendedor, byVendedorData, byRevendaData };
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o índice de visitas.
 * O cache é invalidado automaticamente quando o arquivo fonte muda no disco —
 * sem TTL fixo. Múltiplas chamadas simultâneas durante o reload compartilham
 * a mesma Promise (anti-stampede).
 */
export async function getVisitasIndex(): Promise<VisitasIndex> {
    const mtime = getSourceMtime();

    if (cachedIndex && mtime === cachedFileMtime) {
        console.log("[Cache] Usando índice em cache");
        return cachedIndex;
    }

    // Anti-stampede: reutiliza a Promise de carregamento em andamento
    if (loadingPromise) {
        console.log("[Cache] Aguardando carregamento em andamento...");
        return loadingPromise;
    }

    console.log("[Cache] Arquivo atualizado — reconstruindo índice...");

    loadingPromise = (async () => {
        const rawData = await loadGoogleSheetsData();
        const visitas = processarVisitas(rawData);
        const index = buildIndex(visitas);
        cachedIndex = index;
        cachedFileMtime = mtime;
        console.log(
            `[Cache] ✓ Índice pronto: ${visitas.length} visitas | ` +
            `${index.byData.size} datas | ${index.byRevenda.size} revendas | ` +
            `${index.byVendedor.size} vendedores`
        );
        return index;
    })().catch(err => {
        console.error("[Cache] Erro ao carregar dados:", err);
        if (cachedIndex) {
            console.log("[Cache] Usando índice anterior como fallback");
            return cachedIndex;
        }
        throw err;
    }).finally(() => {
        loadingPromise = null;
    });

    return loadingPromise;
}

/**
 * Compatibilidade reversa — todos os routers existentes continuam funcionando
 * sem mudança. Para queries filtradas, prefira getVisitasIndex().
 */
export async function getVisitasData(): Promise<ProcessedVisita[]> {
    return (await getVisitasIndex()).visitas;
}

export async function getRotaCoachingData(): Promise<any[]> {
    const now = Date.now();

    if (cachedRotaCoaching && now - lastRotaCacheTime < ROTA_CACHE_DURATION_MS) {
        console.log("[Cache] Usando dados Rota Coaching em cache");
        return cachedRotaCoaching;
    }

    console.log("[Cache] Carregando rota_coaching_all.json do disco...");
    try {
        const filePath = process.env.COACHING_DATA_PATH
            ?? path.join(process.cwd(), "client", "public", "rota_coaching_all.json");
        const rawContent = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(rawContent);
        cachedRotaCoaching = data;
        lastRotaCacheTime = now;
        console.log(`[Cache] ✓ ${data.length} rota coaching processadas`);
        return data;
    } catch (error) {
        console.error("[Cache] Erro ao carregar rota coaching:", error);
        if (cachedRotaCoaching) {
            console.log("[Cache] Usando cache expirado de Rota Coaching como fallback");
            return cachedRotaCoaching;
        }
        throw error;
    }
}

/** Força nova leitura do arquivo na próxima chamada. */
export function invalidarCache(): void {
    cachedIndex = null;
    cachedFileMtime = 0;
    loadingPromise = null;
    cachedRotaCoaching = null;
    lastRotaCacheTime = 0;
    console.log("[Cache] Cache invalidado");
}

/** Estado atual do cache + metadados do arquivo. */
export function getCacheInfo() {
    const db = getDbStatus();
    const mtime = getSourceMtime();
    return {
        cache: {
            ativo: cachedIndex !== null && mtime === cachedFileMtime,
            registros: cachedIndex?.visitas.length ?? 0,
            datas: cachedIndex?.byData.size ?? 0,
            revendas: cachedIndex?.byRevenda.size ?? 0,
            vendedores: cachedIndex?.byVendedor.size ?? 0,
        },
        arquivo: db,
    };
}
