/*
 * MetricFlow — Shared Data Cache
 * Cache único compartilhado entre dashboardRouter e vendedoresRouter.
 * Antes existia um cache duplicado em cada router — isso causava dupla
 * busca ao Sheets na primeira requisição de cada rota.
 */

import { loadGoogleSheetsData, processarVisitas, ProcessedVisita } from "../services/googleSheetsService";

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

let cachedVisitas: ProcessedVisita[] | null = null;
let lastCacheTime = 0;

/**
 * Retorna visitas processadas, usando cache quando válido.
 * Todos os routers devem chamar esta função em vez de chamar
 * loadGoogleSheetsData diretamente.
 */
export async function getVisitasData(): Promise<ProcessedVisita[]> {
    const now = Date.now();

    if (cachedVisitas && now - lastCacheTime < CACHE_DURATION_MS) {
        console.log("[Cache] Usando dados em cache");
        return cachedVisitas;
    }

    console.log("[Cache] Carregando dados do Google Sheets...");
    try {
        const rawData = await loadGoogleSheetsData();
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
        throw new Error("Falha ao carregar dados");
    }
}

/**
 * Invalida o cache forçando nova busca na próxima chamada.
 */
export function invalidarCache(): void {
    cachedVisitas = null;
    lastCacheTime = 0;
    console.log("[Cache] Cache invalidado");
}

/**
 * Retorna metadados do estado atual do cache.
 */
export function getCacheInfo(): { ativo: boolean; idadeSegundos: number; registros: number } {
    return {
        ativo: cachedVisitas !== null && Date.now() - lastCacheTime < CACHE_DURATION_MS,
        idadeSegundos: cachedVisitas ? Math.floor((Date.now() - lastCacheTime) / 1000) : 0,
        registros: cachedVisitas?.length ?? 0,
    };
}