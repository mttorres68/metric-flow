import fs from "fs";
import path from "path";
import { loadGoogleSheetsData, processarVisitas, ProcessedVisita, getDbStatus }
    from "../services/xlsxService";
import { loadFromDatabase, VisitasFiltro } from "../services/pgDataService";
import { loadRotaCoachingFromDatabase } from "../services/pgRotaCoachingService";

let cachedVisitas: ProcessedVisita[] | null = null;
let cachedFileMtime = 0;
let cachedAt = 0;
// TTL do cache quando fonte é PostgreSQL (padrão: 5 min)
const PG_CACHE_TTL_MS = parseInt(process.env.PG_CACHE_TTL_MS ?? "300000", 10);
let loadingPromise: Promise<ProcessedVisita[]> | null = null;

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

function cacheCompletoValido(mtime: number): boolean {
    return process.env.DATABASE_URL
        ? cachedVisitas !== null && Date.now() - cachedAt < PG_CACHE_TTL_MS
        : cachedVisitas !== null && mtime === cachedFileMtime;
}

/**
 * Carrega e cacheia o histórico completo de visitas.
 * Usado pelas telas que precisam enumerar valores (dropdowns, seletor de
 * datas). Multiplas chamadas simultâneas durante o reload compartilham a
 * mesma Promise (anti-stampede).
 */
async function getVisitasCompletas(): Promise<ProcessedVisita[]> {
    const mtime = getSourceMtime();

    if (cacheCompletoValido(mtime)) {
        console.log("[Cache] Usando visitas em cache");
        return cachedVisitas!;
    }

    if (loadingPromise) {
        console.log("[Cache] Aguardando carregamento em andamento...");
        return loadingPromise;
    }

    console.log("[Cache] Recarregando histórico completo de visitas...");

    loadingPromise = (async () => {
        const visitas = process.env.DATABASE_URL
            ? await loadFromDatabase()
            : processarVisitas(await loadGoogleSheetsData());
        cachedVisitas = visitas;
        cachedFileMtime = mtime;
        cachedAt = Date.now();
        console.log(`[Cache] ✓ ${visitas.length} visitas carregadas`);
        return visitas;
    })().catch(err => {
        console.error("[Cache] Erro ao carregar dados:", err);
        if (cachedVisitas) {
            console.log("[Cache] Usando cache anterior como fallback");
            return cachedVisitas;
        }
        throw err;
    }).finally(() => {
        loadingPromise = null;
    });

    return loadingPromise;
}

/**
 * Retorna visitas, opcionalmente filtradas por revenda/vendedor/gerente/período.
 *
 * Sem filtro → usa o cache completo do histórico (TTL/mtime), para telas que
 * precisam enumerar valores (dropdowns, seletor de datas).
 *
 * Com filtro e fonte PostgreSQL → consulta direto no banco com WHERE, sem
 * passar pelo cache completo. Evita carregar e classificar ~300 mil linhas
 * na memória só para descartar a maioria em seguida — a maior parte das
 * telas já sabe revenda/vendedor/período antes de pedir os dados.
 */
export async function getVisitasData(filtro: VisitasFiltro = {}): Promise<ProcessedVisita[]> {
    const temFiltro = Object.values(filtro).some(v => v !== undefined);
    if (!temFiltro) return getVisitasCompletas();

    if (!process.env.DATABASE_URL) {
        // Fonte xlsx já carrega tudo em memória de uma vez — filtra em JS.
        const todas = await getVisitasCompletas();
        return todas.filter(v =>
            (filtro.revenda === undefined    || v.revenda === filtro.revenda) &&
            (filtro.vendedor === undefined   || v.vendedor === filtro.vendedor) &&
            (filtro.gerente === undefined    || v.gerente === filtro.gerente) &&
            (filtro.dataInicio === undefined || v.data >= filtro.dataInicio) &&
            (filtro.dataFim === undefined    || v.data <= filtro.dataFim)
        );
    }

    return loadFromDatabase(filtro);
}

/** Filtra por período (YYYY-MM-DD, inclusivo). Sem filtro → retorna tudo. */
function filtrarPorPeriodo(data: any[], dateStart?: string, dateEnd?: string): any[] {
    if (!dateStart && !dateEnd) return data;
    return data.filter(r =>
        (!dateStart || r.data >= dateStart) && (!dateEnd || r.data <= dateEnd));
}

export async function getRotaCoachingData(dateStart?: string, dateEnd?: string): Promise<any[]> {
    const now = Date.now();

    if (cachedRotaCoaching && now - lastRotaCacheTime < ROTA_CACHE_DURATION_MS) {
        console.log("[Cache] Usando dados Rota Coaching em cache");
        return filtrarPorPeriodo(cachedRotaCoaching, dateStart, dateEnd);
    }

    if (process.env.DATABASE_URL) {
        console.log("[Cache] Carregando Rota Coaching do PostgreSQL...");
        try {
            const data = await loadRotaCoachingFromDatabase();
            cachedRotaCoaching = data;
            lastRotaCacheTime = now;
            console.log(`[Cache] ✓ ${data.length} rota coaching do banco`);
            return filtrarPorPeriodo(data, dateStart, dateEnd);
        } catch (error) {
            console.error("[Cache] Erro ao carregar Rota Coaching do banco:", error);
            if (cachedRotaCoaching) return filtrarPorPeriodo(cachedRotaCoaching, dateStart, dateEnd);
            throw error;
        }
    }

    console.log("[Cache] Carregando rota_coaching_all.json do disco...");
    try {
        const filePath = process.env.COACHING_DATA_PATH
            ?? path.join(process.cwd(), "client", "public", "rota_coaching_all.json");
        const rawContent = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(rawContent);
        cachedRotaCoaching = data;
        lastRotaCacheTime = now;
        console.log(`[Cache] ✓ ${data.length} rota coaching do arquivo`);
        return filtrarPorPeriodo(data, dateStart, dateEnd);
    } catch (error) {
        console.error("[Cache] Erro ao carregar rota coaching:", error);
        if (cachedRotaCoaching) {
            console.log("[Cache] Usando cache expirado como fallback");
            return filtrarPorPeriodo(cachedRotaCoaching, dateStart, dateEnd);
        }
        throw error;
    }
}

/** Força nova leitura do arquivo na próxima chamada. */
export function invalidarCache(): void {
    cachedVisitas = null;
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
            ativo: cacheCompletoValido(mtime),
            registros: cachedVisitas?.length ?? 0,
            datas: cachedVisitas ? new Set(cachedVisitas.map(v => v.data)).size : 0,
            revendas: cachedVisitas ? new Set(cachedVisitas.map(v => v.revenda)).size : 0,
            vendedores: cachedVisitas ? new Set(cachedVisitas.map(v => v.vendedor)).size : 0,
        },
        arquivo: db,
    };
}
