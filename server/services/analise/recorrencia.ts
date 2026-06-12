import type { ProcessedVisita } from "../xlsxService";
import type { ConfigMetricasRecorrencia } from "@shared/const";
import { CONFIG_METRICAS_DEFAULT } from "@shared/const";
import type { AnaliseVendedor, FlagId, MetricaRecorrencia, RecorrenciaVendedor } from "./types";
import { FLAGS_RECORRENCIA } from "./types";
import { calcularAnalisePeriodo } from "./calcVendedorDia";

export { FLAGS_RECORRENCIA };

/** Marca recorrência: >= minDias dias com problema OU >= minPerc dos dias ativos. */
export function isRecorrente(dias: number, diasAtivos: number, cfg: ConfigMetricasRecorrencia): boolean {
    return diasAtivos > 0 && (
        dias >= cfg.recorrenciaMinDias || dias / diasAtivos >= cfg.recorrenciaMinPerc
    );
}

/** Avalia se a flag disparou em um dia ativo. */
export function avaliarFlag(id: FlagId, r: AnaliseVendedor, cfg: ConfigMetricasRecorrencia): boolean {
    switch (id) {
        case "relampagoAlto":
            return r.relampago_pct > cfg.alertaCurtasPerc;
        case "inicioTardio":
            return r.inicio !== null && r.inicio.substring(0, 5) > cfg.limiteInicioTardio;
        case "coberturaBaixa":
            return r.visitas_pct < cfg.alertaCoberturaPerc;
        case "ociosidadeAlta":
            return (r.tempo_nao_atend !== null && r.tempo_nao_atend > cfg.ociosidadeMin)
                || (r.maior_percurso !== null && r.maior_percurso > cfg.percursoMax);
        case "almocoExcesso":
            return r.almoco > cfg.almocoMax;
        case "tardeInsuficiente":
            return r.apos14h_pct < cfg.alertaTardePerc;
        case "tempoAtendBaixo":
            return r.tempo_total !== null && r.tempo_total < cfg.tempoAtendMin;
        case "fimCedo":
            return r.fim !== null && r.fim.substring(0, 5) < cfg.fimCedo;
    }
}

/** Computa o mapa de recorrência por revenda. */
export function computarRecorrenciaPeriodo(
    visitas: ProcessedVisita[],
    cfg: ConfigMetricasRecorrencia = CONFIG_METRICAS_DEFAULT.recorrencia,
): Record<string, RecorrenciaVendedor[]> {
    const analise = calcularAnalisePeriodo(visitas, cfg);

    const porChave = new Map<string, AnaliseVendedor[]>();
    for (const r of analise) {
        const k = `${r.revenda}|${r.vendedor}`;
        if (!porChave.has(k)) porChave.set(k, []);
        porChave.get(k)!.push(r);
    }

    const porRevenda: Record<string, RecorrenciaVendedor[]> = {};
    for (const [k, linhas] of porChave) {
        const [revenda, vStr] = k.split("|");
        const vendedor = parseInt(vStr, 10);
        const ativos = linhas.filter(l => l.visitas_total_dentro_raio > 0);
        const diasAtivos = ativos.length;

        const metricas = {} as Record<FlagId, MetricaRecorrencia>;
        for (const f of FLAGS_RECORRENCIA) {
            const datas = ativos.filter(l => avaliarFlag(f.id, l, cfg)).map(l => l.data).sort();
            const dias = datas.length;
            metricas[f.id] = { dias, datas, recorrente: isRecorrente(dias, diasAtivos, cfg) };
        }

        // ociosidadeAlta oculta na UI — não entra no score para evitar divergência visual
        const scoreCritico = FLAGS_RECORRENCIA.reduce(
            (s, f) => f.id === "ociosidadeAlta" ? s : s + (metricas[f.id].recorrente ? 1 : 0), 0
        );

        (porRevenda[revenda] ??= []).push({ revenda, vendedor, diasAtivos, metricas, scoreCritico });
    }

    for (const rev of Object.keys(porRevenda)) {
        porRevenda[rev].sort((a, b) => b.scoreCritico - a.scoreCritico || a.vendedor - b.vendedor);
    }

    return porRevenda;
}
