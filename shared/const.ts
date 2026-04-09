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
    limiteInicioTardio:  "08:45",  // alerta de início tardio
    alertaCurtasPerc:    10,       // alerta: % relâmpago acima disso
    alertaCoberturaPerc: 100,      // alerta: cobertura abaixo disso
    alertaTardePerc:     25,       // alerta: % após 14h abaixo disso
} as const;
