export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// ---------------------------------------------------------------------------
// Fonte única de verdade para thresholds de métricas.
// Editável via ConfigPanel (UI) — não altere aqui sem atualizar o painel.
// Espelhado em automacao/config.py (REPORT_CONFIG).
// ---------------------------------------------------------------------------
export const CONFIG_PADRAO_METRICAS = {
    raioPDV:             300,      // metros — VENDEDORES_DIST_PDV no Python
    minutosCurta:        3,        // SHORT_VISIT_LIMIT
    limiteInicioTardio:  "09:30",  // alerta de início tardio
    alertaCurtasPerc:    10,       // alerta: % relâmpago acima disso
    alertaCoberturaPerc: 90,       // alerta: cobertura abaixo disso
    alertaTardePerc:     25,       // alerta: % após 14h abaixo disso
} as const;

// ---------------------------------------------------------------------------
// Thresholds do mapeamento de recorrência semanal (módulo Análise → aba semanal).
// Cada flag é avaliada por dia; a métrica vira "recorrente" quando o problema
// aparece em RECORRENCIA_MIN_DIAS dias OU em >= RECORRENCIA_MIN_PERC dos dias ativos.
// ---------------------------------------------------------------------------
export const CONFIG_RECORRENCIA = {
    minDias:        2,        // nº mínimo de dias com problema para marcar recorrência
    minPerc:        0.4,      // OU fração dos dias ativos com problema
    ociosidadeMin:  120,      // min — tempo Ñ atendimento alto (> isso)
    percursoMax:    30,       // min — maior percurso alto (> isso)
    almocoMax:      4,        // visitas no almoço acima disso = alerta
    tempoAtendMin:  120,      // min — Σ tempo de atendimento abaixo disso (< 2h) = alerta
    fimCedo:        "14:00",  // finalizar antes disso = alerta
} as const;
