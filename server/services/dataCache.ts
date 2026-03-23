/*
 * MetricFlow — Shared Data Cache
 * Cache único compartilhado entre dashboardRouter e vendedoresRouter.
 *
 * MUDANÇA: agora lê o database.xlsx local (via xlsxService)
 * em vez do Google Sheets — ~300ms vs 5-15s, sem dependência de rede.
 *
 * Todos os routers continuam chamando getVisitasData() sem mudança.
 */

import { loadGoogleSheetsData, processarVisitas, ProcessedVisita, getDbStatus }
    from "../services/xlsxService";

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

let cachedVisitas: ProcessedVisita[] | null = null;
let lastCacheTime = 0;

/**
 * Retorna visitas processadas, usando cache quando válido.
 * Todos os routers devem chamar esta função em vez de acessar
 * xlsxService diretamente.
 */
export async function getVisitasData(): Promise<ProcessedVisita[]> {
    const now = Date.now();

    if (cachedVisitas && now - lastCacheTime < CACHE_DURATION_MS) {
        console.log("[Cache] Usando dados em cache");
        return cachedVisitas;
    }

    console.log("[Cache] Carregando database.xlsx...");
    try {
        const rawData = await loadGoogleSheetsData(); // nome mantido para compatibilidade
        cachedVisitas = processarVisitas(rawData);
        lastCacheTime = now;
        console.log(`[Cache] ✓ ${cachedVisitas.length} visitas processadas`);
        return cachedVisitas;
    } catch (error) {
        console.error("[Cache] Erro ao carregar dados:", error);
        if (cachedVisitas) {
            console.log("[Cache] Usando cache expirado como fallback");
            return cachedVisitas;
        }
        throw error;
    }
}

/** Invalida o cache forçando nova leitura do xlsx na próxima chamada. */
export function invalidarCache(): void {
    cachedVisitas = null;
    lastCacheTime = 0;
    console.log("[Cache] Cache invalidado");
}

/** Estado atual do cache + metadados do arquivo xlsx. */
export function getCacheInfo() {
    const db = getDbStatus();
    return {
        cache: {
            ativo: cachedVisitas !== null && Date.now() - lastCacheTime < CACHE_DURATION_MS,
            idadeSegundos: cachedVisitas ? Math.floor((Date.now() - lastCacheTime) / 1000) : 0,
            registros: cachedVisitas?.length ?? 0,
        },
        arquivo: db,
    };
}