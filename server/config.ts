/*
 * MetricFlow — Configuração de Métricas
 * Baseado no código Python de cálculo de métricas
 */

export const REPORT_CONFIG = {
  // Limites de distância em metros
  VENDEDORES_DIST_PDV: 500,
  
  // Limites de tempo para horários
  TIME_THRESHOLD_START: new Date("1970-01-01T08:00:00"),
  TIME_THRESHOLD_END: new Date("1970-01-01T18:00:00"),
  
  // Limite de duração para visita curta em minutos
  SHORT_VISIT_LIMIT_MINUTES: 3,
  
  // Janelas de tempo
  JANELA_ALMOCO_INICIO: "12:15",
  JANELA_ALMOCO_FIM: "13:45",
  JANELA_TARDE_INICIO: "14:00",
};

// Google Sheets Configuration
export const GOOGLE_SHEETS_CONFIG = {
  SHEET_ID: "1ftgCk2oMb2fk1ZbyphXnP6IaqP-bqoYkWzkQc6c5lmY",
  GID: "1857498475", // Sheet1
  CSV_URL: "https://docs.google.com/spreadsheets/d/1ftgCk2oMb2fk1ZbyphXnP6IaqP-bqoYkWzkQc6c5lmY/export?format=csv&gid=1857498475",
};
