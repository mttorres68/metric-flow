import { getDb } from "../db";
import { entregasConfig, metricasConfig } from "../../drizzle/schema";
import { CONFIG_METRICAS_DEFAULT, type ConfigMetricas } from "@shared/const";
import { CONFIG_ENTREGAS_PADRAO, type ConfigEntregas } from "@shared/entregas";

let _cache: ConfigMetricas | null = null;
let _cacheAt = 0;
const TTL_MS = 60_000;

/** Retorna config separada por contexto (diaria / recorrencia), com fallback para defaults. */
export async function getConfigMetricas(): Promise<ConfigMetricas> {
    const now = Date.now();
    if (_cache && now - _cacheAt < TTL_MS) return _cache;

    try {
        const db = await getDb();
        if (!db) return CONFIG_METRICAS_DEFAULT;

        const rows = await db.select().from(metricasConfig).limit(1);
        if (!rows.length) return CONFIG_METRICAS_DEFAULT;

        const r = rows[0];
        _cache = {
            diaria: {
                raioPDV:                r.raioPDV,
                minutosCurta:           r.minutosCurta,
                janelaInicioVisitas:    r.janelaInicioVisitas ?? "07:00",
                janelaFimVisitas:       r.janelaFimVisitas    ?? "17:00",
                limiteInicioTardio:     r.limiteInicioTardio,
                alertaCurtasPerc:       r.alertaCurtasPerc,
                alertaCoberturaPerc:    r.alertaCoberturaPerc,
                alertaTardePerc:        r.alertaTardePerc,
            },
            recorrencia: {
                raioPDV:                r.raioPDV,
                minutosCurta:           r.minutosCurta,
                janelaInicioVisitas:    r.janelaInicioVisitas ?? "07:00",
                janelaFimVisitas:       r.janelaFimVisitas    ?? "17:00",
                limiteInicioTardio:     r.recLimiteInicioTardio,
                alertaCurtasPerc:    r.recAlertaCurtasPerc,
                alertaCoberturaPerc: r.recAlertaCoberturaPerc,
                alertaTardePerc:     r.recAlertaTardePerc,
                recorrenciaMinDias:  r.recorrenciaMinDias,
                recorrenciaMinPerc:  parseFloat(String(r.recorrenciaMinPerc)),
                ociosidadeMin:       r.ociosidadeMin,
                percursoMax:         r.percursoMax,
                almocoMax:           r.almocoMax,
                tempoAtendMin:       r.tempoAtendMin,
                fimCedo:             r.fimCedo,
            },
        };
        _cacheAt = now;
        return _cache;
    } catch {
        return CONFIG_METRICAS_DEFAULT;
    }
}

/** Config do Relatório de Entregas (tabela entregas_config); padrão de shared/entregas quando vazia ou sem banco. */
export async function getConfigEntregas(): Promise<ConfigEntregas> {
    try {
        const db = await getDb();
        if (!db) return CONFIG_ENTREGAS_PADRAO;
        const [r] = await db.select().from(entregasConfig).limit(1);
        if (!r) return CONFIG_ENTREGAS_PADRAO;
        return { raioM: r.raioM, desvioFator: r.desvioFator, desvioMinKm: r.desvioMinKm, lentoMinMin: r.lentoMinMin, lentoMaxKmh: r.lentoMaxKmh, saidaMinima: r.saidaMinima, almocoDe: r.almocoDe, almocoAte: r.almocoAte,
            pernoiteMaxKm: r.pernoiteMaxKm, pernoiteChegarAte: r.pernoiteChegarAte, pernoiteFatorEstrada: r.pernoiteFatorEstrada,
            pernoiteVelKmh: r.pernoiteVelKmh, pernoiteParouCedo: r.pernoiteParouCedo, pernoiteFinalLentoX: r.pernoiteFinalLentoX };
    } catch {
        return CONFIG_ENTREGAS_PADRAO;
    }
}

export function invalidateConfigCache() {
    _cache = null;
    _cacheAt = 0;
}
