import type { ProcessedVisita } from "../xlsxService";
import type { ConfigCalcBase } from "@shared/const";
import { CONFIG_METRICAS_DEFAULT } from "@shared/const";
import type { AnaliseVendedor } from "./types";
import { hmsToMin, minToHms, minToHM, parseDistPV } from "./helpers";

export function calcularVendedorDia(
    visitas: ProcessedVisita[],
    vendedor: number,
    data: string,
    rankPos: number,
    cfg: ConfigCalcBase = CONFIG_METRICAS_DEFAULT.diaria,
): AnaliseVendedor {
    const TRAVA_H = 17 * 60;

    const all = visitas.filter(v => v.vendedor === vendedor && v.data === data);
    const revenda = all[0]?.revenda ?? "";

    const carteira = new Set(all.map(v => v.codCliente)).size;

    // Janela de horário configurável — visitas fora do intervalo são desconsideradas
    const janelaIni = hmsToMin(cfg.janelaInicioVisitas ?? "07:00");
    const janelaFim = hmsToMin(cfg.janelaFimVisitas    ?? "17:00");

    const comVisita = all.filter(v => {
        if (!v.horaInicio || v.horaInicio === "ND") return false;
        const ini = hmsToMin(v.horaInicio);
        if (ini === null) return false;
        if (janelaIni !== null && ini < janelaIni) return false;
        if (janelaFim !== null && ini > janelaFim) return false;
        return true;
    });
    const semVisita = all.filter(v => !v.horaInicio || v.horaInicio === "ND");

    const dentroRaio = comVisita.filter(v => parseDistPV(v.distPV) <= cfg.raioPDV);
    const unicos = [...new Map(dentroRaio.map(v => [v.codCliente, v])).values()];

    // Tempos
    const tempos = unicos
        .map(v => hmsToMin(v.tempoVisita))
        .filter((t): t is number => t !== null && t > 0);

    const tempo_menor = tempos.length ? Math.min(...tempos) : null;
    const tempo_maior = tempos.length ? Math.max(...tempos) : null;
    const tempo_total = tempos.length ? tempos.reduce((a, b) => a + b, 0) : null;
    const tempo_medio = tempos.length ? tempo_total! / tempos.length : null;

    // Relâmpago: visita única dentro do raio com duração < minutosCurta
    const relampago = unicos.filter(v => {
        const t = hmsToMin(v.tempoVisita);
        return t !== null && t < cfg.minutosCurta;
    }).length;

    // Atend > 35 min
    const maiores35 = unicos.filter(v => { const t = hmsToMin(v.tempoVisita); return t !== null && t > 35; });
    const soma35 = maiores35.reduce((acc, v) => acc + (hmsToMin(v.tempoVisita) ?? 0), 0);

    // Horários início/fim
    const horasIni = dentroRaio.map(v => hmsToMin(v.horaInicio)).filter((t): t is number => t !== null);
    const horasFim = dentroRaio.map(v => hmsToMin(v.horaFim)).filter((t): t is number => t !== null);
    const inicio_min = horasIni.length ? Math.min(...horasIni) : null;
    const fim_min   = horasFim.length ? Math.max(...horasFim) : null;

    // Almoço (12:15–13:45) e Após 14h
    const almoco = dentroRaio.filter(v => {
        const t = hmsToMin(v.horaInicio);
        return t !== null && t >= 12 * 60 + 15 && t <= 13 * 60 + 45;
    }).length;
    const apos14 = dentroRaio.filter(v => {
        const t = hmsToMin(v.horaInicio);
        return t !== null && t >= 14 * 60;
    }).length;

    // Pedidos
    const isHeishop = (v: ProcessedVisita) => v.valorPedido.toUpperCase().includes("HEISHOP");
    const heishopVisitas = dentroRaio.filter(isHeishop);
    const sfaVisitas = dentroRaio.filter(v =>
        v.valorNumerico > 0 || (v.valorPedido !== "0,00" && !isHeishop(v) && v.horaInicio !== "ND")
    );
    const heishop_verif = heishopVisitas.filter(v =>
        v.tipoCobr && String(v.tipoCobr).trim() !== "" && String(v.tipoCobr).trim() !== "-"
    ).length;

    // IV e IAV
    const iv  = carteira > 0 ? (unicos.length / carteira) * 100 : 0;
    const iav = heishopVisitas.length > 0 ? (heishop_verif / heishopVisitas.length) * 100 : 0;

    // Maior percurso
    const visitasOrd = [...dentroRaio]
        .map(v => ({ ini: hmsToMin(v.horaInicio), fim: hmsToMin(v.horaFim) }))
        .filter((x): x is { ini: number; fim: number } => x.ini !== null && x.fim !== null)
        .sort((a, b) => a.ini - b.ini);

    let maior_percurso: number | null = null;
    let percurso_ini_min: number | null = null;
    let percurso_fim_min: number | null = null;
    let total_percurso = 0;

    for (let i = 0; i < visitasOrd.length - 1; i++) {
        const gap = visitasOrd[i + 1].ini - visitasOrd[i].fim;
        if (gap > 0) {
            total_percurso += gap;
            if (maior_percurso === null || gap > maior_percurso) {
                maior_percurso = gap;
                percurso_ini_min = visitasOrd[i].fim;
                percurso_fim_min = visitasOrd[i + 1].ini;
            }
        }
    }

    const pdvs_apos_gap = percurso_fim_min !== null
        ? visitasOrd.filter(x => x.ini >= percurso_fim_min!).length
        : 0;

    // Tempo não-atendimento
    // Limitação conhecida: almoço (~60 min) não é descontado → inflaciona o valor.
    // Flag ociosidadeAlta fica oculta na UI enquanto isso não for corrigido.
    let tempo_nao_atend: number | null = null;
    if (inicio_min !== null && fim_min !== null && tempo_total !== null) {
        const fim_efetivo = Math.min(fim_min, TRAVA_H);
        const jornada = Math.max(0, fim_efetivo - inicio_min);
        tempo_nao_atend = Math.max(0, jornada - tempo_total);
    }

    return {
        revenda,
        vendedor,
        data,
        inicio: inicio_min !== null ? minToHms(inicio_min) : null,
        fim:    fim_min    !== null ? minToHms(fim_min)    : null,
        almoco,
        apos14h: apos14,
        apos14h_pct:  dentroRaio.length > 0 ? (apos14 / dentroRaio.length) * 100 : 0,
        apos14h_total: dentroRaio.length,
        visitas: unicos.length,
        visitas_total: carteira,
        visitas_total_dentro_raio: dentroRaio.length,
        visitas_pct: carteira > 0 ? (unicos.length / carteira) * 100 : 0,
        relampago,
        relampago_pct: dentroRaio.length > 0 ? (relampago / dentroRaio.length) * 100 : 0,
        pdvs_total: carteira,
        pdvs_visitados: unicos.length,
        pdvs_sem_visita: semVisita.length,
        pedido_sfa: sfaVisitas.length,
        pedido_heishop: heishopVisitas.length,
        heishop_verif,
        iv:  parseFloat(iv.toFixed(1)),
        iav: parseFloat(iav.toFixed(1)),
        atend_maior35: maiores35.length,
        soma_maior35:  parseFloat(soma35.toFixed(1)),
        soma_maior35_fmt: minToHms(soma35),
        tempo_menor,
        tempo_maior,
        tempo_medio: tempo_medio !== null ? parseFloat(tempo_medio.toFixed(1)) : null,
        tempo_total: tempo_total !== null ? parseFloat(tempo_total.toFixed(1)) : null,
        tempo_menor_fmt: tempo_menor !== null ? minToHms(tempo_menor) : "—",
        tempo_maior_fmt: tempo_maior !== null ? minToHms(tempo_maior) : "—",
        tempo_medio_fmt: tempo_medio !== null ? minToHms(tempo_medio) : "—",
        tempo_total_fmt: tempo_total !== null ? minToHms(tempo_total) : "—",
        maior_percurso,
        percurso_ini: percurso_ini_min !== null ? minToHM(percurso_ini_min) : null,
        percurso_fim: percurso_fim_min !== null ? minToHM(percurso_fim_min) : null,
        pdvs_apos_gap,
        total_percurso: visitasOrd.length > 1 ? parseFloat(total_percurso.toFixed(1)) : null,
        total_percurso_fmt: visitasOrd.length > 1 && total_percurso > 0 ? minToHms(total_percurso) : "—",
        tempo_nao_atend: tempo_nao_atend !== null ? parseFloat(tempo_nao_atend.toFixed(1)) : null,
        tempo_nao_atend_fmt: tempo_nao_atend !== null ? minToHms(tempo_nao_atend) : "—",
        ranking_critico: rankPos + 1,
    };
}

export function calcularAnalisePeriodo(
    visitas: ProcessedVisita[],
    cfg: ConfigCalcBase = CONFIG_METRICAS_DEFAULT.diaria,
): AnaliseVendedor[] {
    const porChave: Record<string, ProcessedVisita[]> = {};
    for (const v of visitas) {
        const c = `${v.revenda}__${v.vendedor}__${v.data}`;
        (porChave[c] ??= []).push(v);
    }

    const preLista = Object.entries(porChave).map(([chave, lista]) => {
        const [, vStr, data] = chave.split("__");
        return calcularVendedorDia(lista, parseInt(vStr, 10), data, 0, cfg);
    });

    const sorted = [...preLista].sort((a, b) => b.relampago_pct - a.relampago_pct);
    const rankMap = new Map(sorted.map((r, i) => [`${r.revenda}__${r.vendedor}__${r.data}`, i]));

    return preLista.map(pre => ({
        ...pre,
        ranking_critico: (rankMap.get(`${pre.revenda}__${pre.vendedor}__${pre.data}`) ?? 0) + 1,
    }));
}
