export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// ---------------------------------------------------------------------------
// Parâmetros base do cálculo — compartilhados entre análise diária e recorrência.
// ---------------------------------------------------------------------------
export interface ConfigCalcBase {
    raioPDV: number;      // metros — raio para considerar visita dentro do PDV
    minutosCurta: number; // duração < X min = relâmpago
    janelaInicioVisitas: string; // "HH:MM" — visitas que iniciam antes disso são ignoradas
    janelaFimVisitas:    string; // "HH:MM" — visitas que iniciam após disso são ignoradas
}

// ---------------------------------------------------------------------------
// Configuração da análise DIÁRIA — thresholds de alerta para a visão diária.
// ---------------------------------------------------------------------------
export interface ConfigMetricasDiaria extends ConfigCalcBase {
    limiteInicioTardio:  string; // "HH:MM" — início acima disso = destaque
    alertaCurtasPerc:    number; // % relâmpago acima disso = destaque
    alertaCoberturaPerc: number; // IV abaixo disso = destaque
    alertaTardePerc:     number; // % após 14h abaixo disso = destaque
}

// ---------------------------------------------------------------------------
// Configuração da análise de RECORRÊNCIA — thresholds das flags semanais.
// Os alertas de comportamento usam limiares distintos da análise diária porque
// um único dia com atraso pode ter justificativa; padrão repetido é diferente.
// ---------------------------------------------------------------------------
export interface ConfigMetricasRecorrencia extends ConfigCalcBase {
    limiteInicioTardio:  string; // "HH:MM" — threshold para flag inicioTardio
    alertaCurtasPerc:    number; // threshold para flag relampagoAlto
    alertaCoberturaPerc: number; // threshold para flag coberturaBaixa
    alertaTardePerc:     number; // threshold para flag tardeInsuficiente
    recorrenciaMinDias:  number; // >= X dias com problema = recorrente
    recorrenciaMinPerc:  number; // OU >= X% dos dias ativos com problema
    ociosidadeMin:       number; // min — tempo não-atendimento > X = ociosidadeAlta
    percursoMax:         number; // min — maior percurso > X = ociosidadeAlta
    almocoMax:           number; // visitas 12:15-13:45 > X = almocoExcesso
    tempoAtendMin:       number; // min — Σ atendimento < X = tempoAtendBaixo
    fimCedo:             string; // "HH:MM" — fim antes disso = fimCedo
}

// ---------------------------------------------------------------------------
// Objeto retornado por getConfigMetricas() — uma config por contexto.
// ---------------------------------------------------------------------------
export interface ConfigMetricas {
    diaria:      ConfigMetricasDiaria;
    recorrencia: ConfigMetricasRecorrencia;
}

// ---------------------------------------------------------------------------
// Defaults — usados como fallback quando o banco está indisponível.
// ---------------------------------------------------------------------------
export const CONFIG_METRICAS_DEFAULT: ConfigMetricas = {
    diaria: {
        raioPDV:                300,
        minutosCurta:           3,
        janelaInicioVisitas:    "07:00",
        janelaFimVisitas:       "17:00",
        limiteInicioTardio:     "08:45",
        alertaCurtasPerc:       10,
        alertaCoberturaPerc:    100,
        alertaTardePerc:        25,
    },
    recorrencia: {
        raioPDV:                300,
        minutosCurta:           3,
        janelaInicioVisitas:    "07:00",
        janelaFimVisitas:       "17:00",
        limiteInicioTardio:  "09:30", // mais tolerante que a análise diária
        alertaCurtasPerc:    10,
        alertaCoberturaPerc: 100,
        alertaTardePerc:     25,
        recorrenciaMinDias:  2,
        recorrenciaMinPerc:  0.4,
        ociosidadeMin:       120,
        percursoMax:         30,
        almocoMax:           4,
        tempoAtendMin:       120,
        fimCedo:             "14:00",
    },
};

// Mantidos para compatibilidade com código existente que ainda os referencia
export const CONFIG_PADRAO_METRICAS = CONFIG_METRICAS_DEFAULT.diaria;
export const CONFIG_RECORRENCIA     = {
    minDias:       CONFIG_METRICAS_DEFAULT.recorrencia.recorrenciaMinDias,
    minPerc:       CONFIG_METRICAS_DEFAULT.recorrencia.recorrenciaMinPerc,
    ociosidadeMin: CONFIG_METRICAS_DEFAULT.recorrencia.ociosidadeMin,
    percursoMax:   CONFIG_METRICAS_DEFAULT.recorrencia.percursoMax,
    almocoMax:     CONFIG_METRICAS_DEFAULT.recorrencia.almocoMax,
    tempoAtendMin: CONFIG_METRICAS_DEFAULT.recorrencia.tempoAtendMin,
    fimCedo:       CONFIG_METRICAS_DEFAULT.recorrencia.fimCedo,
};

// ---------------------------------------------------------------------------
// Legendas das métricas — texto compartilhado entre o PDF de recorrência e a
// tela de Comparativo de Scores, para não divergir a descrição em dois lugares.
// ---------------------------------------------------------------------------
export interface LegendaItem { label: string; desc: string }

export const LEGENDA_REGRA_RECORRENCIA: LegendaItem = {
    label: "Recorrente",
    desc: "Flag marcada quando o problema aparece em ≥ 2 dias OU em ≥ 40% dos dias ativos do vendedor no período.",
};

export const LEGENDA_SCORE_CRITICO: LegendaItem = {
    label: "Score Crítico",
    desc: "Número de flags recorrentes do vendedor no período (0 a 7). Quanto maior, mais padrões críticos se repetiram.",
};

/** Descrição das 7 flags que compõem o Score Crítico (ociosidadeAlta fica de fora — ver recorrencia.ts). */
export const LEGENDA_FLAGS_RECORRENCIA: LegendaItem[] = [
    { label: "Relâmpago alto",        desc: "% de visitas dentro do raio com duração < 3 min acima de 10%." },
    { label: "Início tardio",         desc: "Primeiro atendimento dentro do raio após 09:30." },
    { label: "Cobertura/IV baixa",    desc: "Clientes visitados dentro do raio / total da carteira abaixo de 90%." },
    { label: "Almoço acima do limite",desc: "Mais de 4 visitas registradas na janela 12:15–13:45." },
    { label: "Pouca visita após 14h", desc: "% de visitas com início após 14h abaixo de 25%." },
    { label: "Σ atendimento < 2h",    desc: "Soma do tempo dentro dos PDVs visitados inferior a 2 horas no dia." },
    { label: "Finaliza cedo",         desc: "Último atendimento dentro do raio encerrado antes das 14:00." },
];

/** Descrição das 3 flags manuais marcadas pelo gestor na tela Diária (tabela analiseFlagsDiarias). */
export const LEGENDA_FLAGS_DIARIAS: LegendaItem[] = [
    { label: "Deslocamento",     desc: "Vendedor realizou deslocamento extenso até o primeiro PDV do dia." },
    { label: "Problema",         desc: "Vendedor apresentou problema no PathTracker (falha de rastreamento) no dia." },
    { label: "Não iniciou rota", desc: "Vendedor não iniciou a rota de visitas no dia." },
];
