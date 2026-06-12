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
        raioPDV:             300,
        minutosCurta:        3,
        limiteInicioTardio:  "08:45",
        alertaCurtasPerc:    10,
        alertaCoberturaPerc: 100,
        alertaTardePerc:     25,
    },
    recorrencia: {
        raioPDV:             300,
        minutosCurta:        3,
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
