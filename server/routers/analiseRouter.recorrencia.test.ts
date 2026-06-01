import { describe, it, expect } from "vitest";
import {
    avaliarFlag,
    isRecorrente,
    calcularVendedorDia,
    computarRecorrenciaPeriodo,
    type FlagId,
} from "./analiseRouter";
import type { AnaliseVendedor } from "./analiseRouter";
import type { ProcessedVisita } from "../services/xlsxService";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Dia "saudável" — nenhuma flag dispara. Cada teste sobrescreve o necessário. */
function diaOk(partial: Partial<AnaliseVendedor> = {}): AnaliseVendedor {
    const base: AnaliseVendedor = {
        revenda: "Duttra FL",
        vendedor: 10,
        data: "2026-05-25",
        inicio: "08:00:00",
        fim: "17:00:00",
        almoco: 0,
        apos14h: 5,
        apos14h_pct: 50,
        apos14h_total: 10,
        visitas: 20,
        visitas_total: 20,
        visitas_total_dentro_raio: 22,
        visitas_pct: 100,
        relampago: 0,
        relampago_pct: 0,
        pdvs_total: 20,
        pdvs_visitados: 20,
        pdvs_sem_visita: 0,
        pedido_sfa: 5,
        pedido_heishop: 3,
        heishop_verif: 3,
        iv: 100,
        iav: 100,
        atend_maior35: 0,
        soma_maior35: 0,
        soma_maior35_fmt: "—",
        tempo_menor: 5,
        tempo_maior: 30,
        tempo_medio: 15,
        tempo_total: 240,
        tempo_menor_fmt: "00:05:00",
        tempo_maior_fmt: "00:30:00",
        tempo_medio_fmt: "00:15:00",
        tempo_total_fmt: "04:00:00",
        maior_percurso: 10,
        percurso_ini: "10:00",
        percurso_fim: "10:10",
        pdvs_apos_gap: 5,
        total_percurso: 30,
        total_percurso_fmt: "00:30:00",
        tempo_nao_atend: 30,
        tempo_nao_atend_fmt: "00:30:00",
        ranking_critico: 1,
    };
    return { ...base, ...partial };
}

/** Visita base — campos mínimos com defaults sensatos. */
function mkV(codCliente: number, partial: Partial<ProcessedVisita> = {}): ProcessedVisita {
    return {
        id: codCliente,
        vendedor: 10,
        gerente: 1,
        revenda: "Test",
        data: "2026-05-26",
        cliente: `C${codCliente}`,
        codCliente,
        seqERP: 1,
        seqPT: 1,
        valorPedido: "0,00",
        valorNumerico: 0,
        tipoCobr: "",
        horaInicio: "09:00:00",
        horaFim: "09:10:00",
        tempoVisita: "00:10:00",
        distR: "50",
        distPV: "100",   // dentro do raio (≤ 300m)
        status: "convertido",
        motivo: "",
        ...partial,
    };
}

// ─── isRecorrente ─────────────────────────────────────────────────────────────

describe("isRecorrente", () => {
    it("marca recorrência ao atingir o mínimo de dias (>= 3)", () => {
        expect(isRecorrente(3, 5)).toBe(true);
        expect(isRecorrente(4, 6)).toBe(true);
    });

    it("marca ao atingir minDias=2", () => {
        expect(isRecorrente(2, 5)).toBe(true);  // 2 >= minDias(2) ✓
        expect(isRecorrente(3, 5)).toBe(true);
    });

    it("não marca abaixo de minDias e de minPerc=0.4", () => {
        expect(isRecorrente(1, 5)).toBe(false); // 1 dia, 20% < 40%
        expect(isRecorrente(1, 3)).toBe(false); // 1 dia, 33% < 40%
    });

    it("marca por fração dos dias ativos (>= 40%) com apenas 1 de 2 dias", () => {
        expect(isRecorrente(1, 2)).toBe(true); // 50% >= 40%
    });

    it("é seguro para zero dias ativos", () => {
        expect(isRecorrente(0, 0)).toBe(false);
        expect(isRecorrente(3, 0)).toBe(false);
    });
});

// ─── avaliarFlag ──────────────────────────────────────────────────────────────

describe("avaliarFlag", () => {
    const casos: Array<[FlagId, Partial<AnaliseVendedor>, Partial<AnaliseVendedor>]> = [
        ["relampagoAlto",      { relampago_pct: 30 },        { relampago_pct: 5 }],
        ["inicioTardio",       { inicio: "09:40:00" },       { inicio: "09:20:00" }],  // limiar 09:30
        ["coberturaBaixa",     { visitas_pct: 85 },          { visitas_pct: 92 }],       // limiar 90%
        ["almocoExcesso",      { almoco: 5 },                { almoco: 4 }],
        ["tardeInsuficiente",  { apos14h_pct: 10 },          { apos14h_pct: 40 }],
        ["tempoAtendBaixo",    { tempo_total: 90 },          { tempo_total: 130 }],
        ["fimCedo",            { fim: "13:30:00" },          { fim: "16:00:00" }],
    ];

    for (const [flag, on, off] of casos) {
        it(`${flag}: dispara e não dispara conforme o limiar`, () => {
            expect(avaliarFlag(flag, diaOk(on))).toBe(true);
            expect(avaliarFlag(flag, diaOk(off))).toBe(false);
        });
    }

    it("ociosidadeAlta dispara por tempo Ñ atend. alto OU percurso alto", () => {
        expect(avaliarFlag("ociosidadeAlta", diaOk({ tempo_nao_atend: 130, maior_percurso: 5 }))).toBe(true);
        expect(avaliarFlag("ociosidadeAlta", diaOk({ tempo_nao_atend: 30,  maior_percurso: 45 }))).toBe(true);
        expect(avaliarFlag("ociosidadeAlta", diaOk({ tempo_nao_atend: 30,  maior_percurso: 10 }))).toBe(false);
    });

    it("trata valores nulos de início/fim sem disparar", () => {
        expect(avaliarFlag("inicioTardio", diaOk({ inicio: null }))).toBe(false);
        expect(avaliarFlag("fimCedo",      diaOk({ fim: null }))).toBe(false);
    });
});

// ─── calcularVendedorDia ──────────────────────────────────────────────────────

describe("calcularVendedorDia — métricas calculadas", () => {
    const V = 10;
    const D = "2026-05-26";
    const calc = (vs: ProcessedVisita[]) => calcularVendedorDia(vs, V, D, 1, 0);

    it("separa visitas dentro/fora do raio e conta carteira corretamente", () => {
        const vs = [
            mkV(1),                                    // dentro do raio (100m)
            mkV(2),                                    // dentro do raio
            mkV(3),                                    // dentro do raio
            mkV(4, { distPV: "400" }),                 // FORA do raio
            mkV(5, { distPV: "AC" }),                  // AC → conta como dentro
            mkV(6, { horaInicio: "ND" }),              // sem visita
        ];
        const r = calc(vs);

        expect(r.visitas_total).toBe(6);           // carteira: todos os unique codCliente
        expect(r.visitas).toBe(4);                  // unicos dentro do raio: 1,2,3,5
        expect(r.pdvs_sem_visita).toBe(1);          // só codCliente 6 sem horaInicio
        expect(r.iv).toBeCloseTo(4 / 6 * 100, 0);  // 66.7%
    });

    it("detecta relâmpagos (duração < 3 min) e calcula percentual sobre dentroRaio", () => {
        const vs = [
            mkV(1, { tempoVisita: "00:01:00" }), // relâmpago
            mkV(2, { tempoVisita: "00:02:30" }), // relâmpago (2.5 min)
            mkV(3, { tempoVisita: "00:10:00" }), // normal
        ];
        const r = calc(vs);

        expect(r.relampago).toBe(2);
        expect(r.relampago_pct).toBeCloseTo(2 / 3 * 100, 0); // 66.7%
    });

    it("conta almoço (12:15–13:45) e visitas após 14h", () => {
        const vs = [
            mkV(1, { horaInicio: "12:30:00" }),  // almoço
            mkV(2, { horaInicio: "15:00:00" }),  // após 14h
            mkV(3, { horaInicio: "09:00:00" }),  // horário normal
        ];
        const r = calc(vs);

        expect(r.almoco).toBe(1);
        expect(r.apos14h).toBe(1);
        expect(r.apos14h_pct).toBeCloseTo(1 / 3 * 100, 0);
    });

    it("distingue pedidos Heishop de SFA e calcula IAV", () => {
        const vs = [
            // Heishop verificado (tipoCobr preenchida)
            mkV(1, { valorPedido: "PEDIDO FEITO VIA HEISHOP", tipoCobr: "Boleto" }),
            // Heishop sem verificação (tipoCobr vazia)
            mkV(2, { valorPedido: "PEDIDO FEITO VIA HEISHOP", tipoCobr: "" }),
            // SFA (valor numérico > 0, não Heishop)
            mkV(3, { valorPedido: "150,00", valorNumerico: 150 }),
        ];
        const r = calc(vs);

        expect(r.pedido_heishop).toBe(2);
        expect(r.heishop_verif).toBe(1);
        expect(r.pedido_sfa).toBe(1);
        expect(r.iav).toBeCloseTo(50, 0); // 1/2 * 100
    });

    it("calcula maior percurso, total percurso e PDVs após gap", () => {
        const vs = [
            mkV(1, { horaInicio: "09:00:00", horaFim: "09:30:00", tempoVisita: "00:30:00" }),
            mkV(2, { horaInicio: "10:00:00", horaFim: "10:30:00", tempoVisita: "00:30:00" }),
            mkV(3, { horaInicio: "12:00:00", horaFim: "12:30:00", tempoVisita: "00:30:00" }),
        ];
        const r = calc(vs);

        // Gap 1: 09:30→10:00 = 30 min
        // Gap 2: 10:30→12:00 = 90 min  ← maior
        expect(r.maior_percurso).toBe(90);
        expect(r.percurso_ini).toBe("10:30");
        expect(r.percurso_fim).toBe("12:00");
        expect(r.pdvs_apos_gap).toBe(1);         // só visita 3 é após 12:00
        expect(r.total_percurso).toBeCloseTo(120, 0); // 30 + 90
    });

    it("calcula tempo_nao_atend descontando tempo em visita", () => {
        const vs = [
            mkV(1, { horaInicio: "09:00:00", horaFim: "09:30:00", tempoVisita: "00:30:00" }),
            mkV(2, { horaInicio: "11:00:00", horaFim: "11:30:00", tempoVisita: "00:30:00" }),
        ];
        const r = calc(vs);

        // Jornada: 09:00–11:30 = 150 min; tempo_total = 60 min
        expect(r.tempo_nao_atend).toBeCloseTo(90, 0);
    });

    it("cap de 17:00 no tempo_nao_atend para fim acima das 17h", () => {
        const vs = [
            mkV(1, { horaInicio: "09:00:00", horaFim: "18:00:00", tempoVisita: "09:00:00" }),
        ];
        const r = calc(vs);

        // fim_efetivo = 17:00 (1020 min), inicio = 540 min → jornada = 480 min
        // tempo_total = 540 min → excede jornada → nao_atend = max(0, 480-540) = 0
        expect(r.tempo_nao_atend).toBe(0);
    });

    it("deduplica PDVs repetidos (mesmo codCliente) nas visitas únicas", () => {
        const vs = [
            mkV(1, { horaInicio: "09:00:00", horaFim: "09:10:00", tempoVisita: "00:10:00" }),
            mkV(1, { horaInicio: "10:00:00", horaFim: "10:10:00", tempoVisita: "00:10:00" }), // mesmo PDV
            mkV(2),
        ];
        const r = calc(vs);

        // codCliente 1 aparece 2x mas conta como 1 único
        expect(r.visitas).toBe(2); // unicos: 1 e 2
        expect(r.visitas_total_dentro_raio).toBe(3); // todas as visitas dentro do raio (com repetição)
    });

    it("retorna —/null quando não há visitas dentro do raio", () => {
        const vs = [
            mkV(1, { distPV: "500" }), // fora do raio
            mkV(2, { distPV: "600" }),
        ];
        const r = calc(vs);

        expect(r.visitas).toBe(0);
        expect(r.inicio).toBeNull();
        expect(r.fim).toBeNull();
        expect(r.maior_percurso).toBeNull();
        expect(r.tempo_nao_atend).toBeNull();
    });
});

// ─── computarRecorrenciaPeriodo ───────────────────────────────────────────────

describe("computarRecorrenciaPeriodo — recorrência semanal", () => {
    /** Cria um conjunto de visitas simples para um vendedor/dia.
     *  `relampago=true` → única visita com 1 min de duração (flag relampagoAlto dispara).
     *  `ativo=false`    → única visita fora do raio (dia não conta como ativo). */
    function mkDia(
        vendedor: number,
        data: string,
        opts: { relampago?: boolean; ativo?: boolean } = {},
    ): ProcessedVisita {
        const { relampago = false, ativo = true } = opts;
        return mkV(100 + vendedor, {
            vendedor,
            data,
            distPV: ativo ? "100" : "500",
            tempoVisita: relampago ? "00:01:00" : "00:10:00",
        });
    }

    const DATAS = ["2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23"];

    it("dias sem visitas dentro do raio não contam como ativos", () => {
        const vs = [
            mkDia(10, DATAS[0], { ativo: true }),
            mkDia(10, DATAS[1], { ativo: false }),  // fora do raio
            mkDia(10, DATAS[2], { ativo: true }),
        ];
        const result = computarRecorrenciaPeriodo(vs);
        const vend = result["Test"]?.find(v => v.vendedor === 10);

        expect(vend).toBeDefined();
        expect(vend!.diasAtivos).toBe(2);
    });

    it("flag torna-se recorrente ao atingir minDias (3 de 5 dias)", () => {
        const vs = [
            mkDia(10, DATAS[0], { relampago: true }),
            mkDia(10, DATAS[1], { relampago: true }),
            mkDia(10, DATAS[2], { relampago: true }),
            mkDia(10, DATAS[3], { relampago: false }),
            mkDia(10, DATAS[4], { relampago: false }),
        ];
        const result = computarRecorrenciaPeriodo(vs);
        const vend = result["Test"]?.find(v => v.vendedor === 10);

        expect(vend!.metricas.relampagoAlto.dias).toBe(3);
        expect(vend!.metricas.relampagoAlto.recorrente).toBe(true);
    });

    it("flag NÃO é recorrente com 1 de 5 dias (20% < minPerc 40%)", () => {
        const vs = [
            mkDia(20, DATAS[0], { relampago: true }),
            mkDia(20, DATAS[1], { relampago: false }),
            mkDia(20, DATAS[2], { relampago: false }),
            mkDia(20, DATAS[3], { relampago: false }),
            mkDia(20, DATAS[4], { relampago: false }),
        ];
        const result = computarRecorrenciaPeriodo(vs);
        const vend = result["Test"]?.find(v => v.vendedor === 20);

        expect(vend!.metricas.relampagoAlto.recorrente).toBe(false);
    });

    it("flag torna-se recorrente por minPerc com 1 de 2 dias ativos (50% >= 40%)", () => {
        const vs = [
            mkDia(30, DATAS[0], { relampago: true }),
            mkDia(30, DATAS[1], { relampago: false }),
        ];
        const result = computarRecorrenciaPeriodo(vs);
        const vend = result["Test"]?.find(v => v.vendedor === 30);

        expect(vend!.metricas.relampagoAlto.recorrente).toBe(true);
    });

    it("scoreCritico reflete o número de flags recorrentes", () => {
        // Vendedor com 3 dias de relâmpago alto E inicio tardio
        const vs = DATAS.slice(0, 3).flatMap(data => [
            mkV(99, {
                vendedor: 40,
                data,
                distPV: "100",
                tempoVisita: "00:01:00",   // relâmpago alto
                horaInicio: "09:45:00",    // início tardio (> 09:30)
                horaFim: "09:31:00",
            }),
        ]);
        const result = computarRecorrenciaPeriodo(vs);
        const vend = result["Test"]?.find(v => v.vendedor === 40);

        expect(vend!.metricas.relampagoAlto.recorrente).toBe(true);
        expect(vend!.metricas.inicioTardio.recorrente).toBe(true);
        expect(vend!.scoreCritico).toBeGreaterThanOrEqual(2);
    });

    it("agrupa por revenda e ordena por scoreCritico DESC dentro de cada revenda", () => {
        const mkVRev = (rev: string, vendedor: number, data: string, relampago: boolean) =>
            mkV(100 + vendedor, {
                vendedor,
                data,
                revenda: rev,
                distPV: "100",
                tempoVisita: relampago ? "00:01:00" : "00:10:00",
            });

        const vs = [
            // Vendedor 50: 3 dias com relâmpago (score >= 1)
            mkVRev("Rev A", 50, DATAS[0], true),
            mkVRev("Rev A", 50, DATAS[1], true),
            mkVRev("Rev A", 50, DATAS[2], true),
            // Vendedor 51: sem problema (score = 0)
            mkVRev("Rev A", 51, DATAS[0], false),
            mkVRev("Rev A", 51, DATAS[1], false),
        ];

        const result = computarRecorrenciaPeriodo(vs);
        const lista = result["Rev A"];

        expect(lista).toBeDefined();
        expect(lista[0].vendedor).toBe(50); // maior score vem primeiro
        expect(lista[0].scoreCritico).toBeGreaterThan(lista[1].scoreCritico);
    });

    it("mantém datas corretas no mapa de cada flag", () => {
        const vs = [
            mkDia(60, DATAS[0], { relampago: true }),
            mkDia(60, DATAS[1], { relampago: false }),
            mkDia(60, DATAS[2], { relampago: true }),
        ];
        const result = computarRecorrenciaPeriodo(vs);
        const vend = result["Test"]?.find(v => v.vendedor === 60);
        const datas = vend!.metricas.relampagoAlto.datas;

        expect(datas).toHaveLength(2);
        expect(datas).toContain(DATAS[0]);
        expect(datas).toContain(DATAS[2]);
        expect(datas).not.toContain(DATAS[1]);
    });
});
