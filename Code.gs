/**
 * MetricFlow — Apps Script API
 *
 * Endpoints:
 *   ?action=appCampeao  → dados de Rota Campeã (Duttra R1 + Forte R2 unificados)
 *   ?action=agendaGA    → agenda dos GAs
 *
 * Como publicar:
 *   1. Abra este arquivo no Apps Script (script.google.com)
 *   2. Implantações → Nova implantação → Tipo: App da Web
 *   3. Executar como: "Eu" | Quem tem acesso: "Qualquer pessoa"
 *   4. Copie a URL gerada e adicione ao .env: APPS_SCRIPT_URL=<url>
 */

// ─── IDs das planilhas ─────────────────────────────────────────────────────────
var DUTTRA_SS_ID = "1B2iEkl60AB0hnhBQdgf1RwlFokGX-uH2xP9rXD_LcjA";
var FORTE_SS_ID  = "1UKAHWhX5NCi6nk2SSjfLRRp-8wDQO4TMfns4_sXWNWw";
var AGENDA_SS_ID = "1Y7dn1pDT0z6eIXQnJwdGb36IIS53b3U9m4iQGEP4ByY";

var CAMPEAO_GID  = 1591931045;
var AGENDA_GID   = 0;

var REGIOES = {
  Duttra: { regional: "R1", revendas: ["Duttra FLO", "Duttra MA", "Duttra SRN"] },
  Forte:  { regional: "R2", revendas: ["Forte Aracati", "Forte Quixada"] }
};

// ─── Entry point ───────────────────────────────────────────────────────────────
function doGet(e) {
  var params     = (e && e.parameter) ? e.parameter : {};
  var action     = params.action     || "appCampeao";
  var dataInicio = params.dataInicio || todayFortaleza();
  var dataFim    = params.dataFim    || dataInicio;

  try {
    var data;
    if      (action === "appCampeao") data = getAppCampeao(dataInicio, dataFim);
    else if (action === "agendaGA")   data = getAgendaGA(dataInicio, dataFim);
    else if (action === "info")       data = { regioes: REGIOES };
    else throw new Error("Ação desconhecida: " + action);

    return buildResponse({ ok: true, data: data, dataInicio: dataInicio, dataFim: dataFim });
  } catch (err) {
    return buildResponse({ ok: false, error: String(err.message || err) });
  }
}

// ─── App Campeão ───────────────────────────────────────────────────────────────
function getAppCampeao(dataInicio, dataFim) {
  var cacheKey = "appCampeao_" + dataInicio + "_" + dataFim;
  var cached   = getCached(cacheKey);
  if (cached !== null) return cached;

  var duttra = readSheetByDateRange(DUTTRA_SS_ID, CAMPEAO_GID, dataInicio, dataFim)
    .map(function(r) { return merge(r, { _grupo: "Duttra", _regional: "R1" }); });
  var forte = readSheetByDateRange(FORTE_SS_ID, CAMPEAO_GID, dataInicio, dataFim)
    .map(function(r) { return merge(r, { _grupo: "Forte", _regional: "R2" }); });

  var result = duttra.concat(forte);
  putCached(cacheKey, result, dataFim);
  return result;
}

// ─── Agenda GA ────────────────────────────────────────────────────────────────
function getAgendaGA(dataInicio, dataFim) {
  var cacheKey = "agendaGA_" + dataInicio + "_" + dataFim;
  var cached   = getCached(cacheKey);
  if (cached !== null) return cached;

  var result = readSheetByDateRange(AGENDA_SS_ID, AGENDA_GID, dataInicio, dataFim);
  putCached(cacheKey, result, dataFim);
  return result;
}

// ─── Leitura eficiente por range de data (Opção A) ────────────────────────────
/**
 * Fluxo:
 *  1. Lê cabeçalhos (1 linha × todas as colunas) — 1 chamada
 *  2. Detecta coluna de data
 *  3. Lê somente a coluna de data (1 coluna × N linhas) — 1 chamada
 *  4. Mapeia quais linhas batem com o intervalo
 *  5. Lê lotes consecutivos dessas linhas — mínimo de chamadas
 *
 * Sem coluna de data detectada: faz leitura completa como fallback.
 */
function readSheetByDateRange(spreadsheetId, gid, dataInicio, dataFim) {
  var ss    = SpreadsheetApp.openById(spreadsheetId);
  var sheet = findSheetByGid(ss, gid);
  if (!sheet) throw new Error("Aba GID " + gid + " não encontrada em " + spreadsheetId);

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var tz = Session.getScriptTimeZone();

  // 1. Cabeçalhos
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h).trim(); });

  // 2. Detecta coluna de data (1-indexed para Apps Script)
  var dateCol1 = findDateCol1(headers); // retorna índice 1-based, ou -1

  // Fallback: sem coluna de data detectada → leitura total
  if (dateCol1 < 0 || !dataInicio || !dataFim) {
    return readAllRows(sheet, headers, lastRow, lastCol, tz);
  }

  // 3. Lê só a coluna de data (linhas 2 até lastRow)
  var dataRows = lastRow - 1;
  var dateColValues = sheet.getRange(2, dateCol1, dataRows, 1).getValues();

  // 4. Descobre quais linhas (1-based) batem com o intervalo
  var matchingLines = []; // linha real na planilha (1-based)
  for (var i = 0; i < dateColValues.length; i++) {
    var cell = dateColValues[i][0];
    var iso  = cellToIso(cell, tz);
    if (iso >= dataInicio && iso <= dataFim) {
      matchingLines.push(i + 2); // i=0 é a linha 2 da planilha
    }
  }

  if (matchingLines.length === 0) return [];

  // 5. Lê lotes de linhas consecutivas (minimiza chamadas ao Sheets)
  var objects = [];
  var batchStart = matchingLines[0];
  var batchEnd   = matchingLines[0];

  for (var j = 1; j < matchingLines.length; j++) {
    if (matchingLines[j] === batchEnd + 1) {
      batchEnd = matchingLines[j];
    } else {
      objects = objects.concat(readBatch(sheet, headers, batchStart, batchEnd, lastCol, tz));
      batchStart = matchingLines[j];
      batchEnd   = matchingLines[j];
    }
  }
  objects = objects.concat(readBatch(sheet, headers, batchStart, batchEnd, lastCol, tz));

  return objects;
}

// ─── Helpers de leitura ───────────────────────────────────────────────────────

function readBatch(sheet, headers, rowStart, rowEnd, lastCol, tz) {
  var count  = rowEnd - rowStart + 1;
  var values = sheet.getRange(rowStart, 1, count, lastCol).getValues();
  return valuesToObjects(values, headers, tz);
}

function readAllRows(sheet, headers, lastRow, lastCol, tz) {
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return valuesToObjects(values, headers, tz);
}

function valuesToObjects(values, headers, tz) {
  var result = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    // Pula linhas totalmente vazias
    var hasData = false;
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== "" && row[c] !== null && row[c] !== undefined) { hasData = true; break; }
    }
    if (!hasData) continue;

    var obj = {};
    for (var k = 0; k < headers.length; k++) {
      var headerName = headers[k] || ("Col_" + (k + 1));
      var val = row[k];
      if (val instanceof Date) {
        obj[headerName] = Utilities.formatDate(val, tz, "yyyy-MM-dd");
      } else if (typeof val === "number") {
        obj[headerName] = val;
      } else {
        obj[headerName] = (val === null || val === undefined) ? "" : String(val);
      }
    }
    result.push(obj);
  }
  return result;
}

// Retorna índice 1-based da coluna de data, ou -1
function findDateCol1(headers) {
  // Tentativa exata: coluna chamada exatamente "DATA", "Date", "Dia"
  for (var i = 0; i < headers.length; i++) {
    if (/^data$|^date$|^dia$/i.test(headers[i])) return i + 1;
  }
  // Tentativa parcial: contém "data", "date" ou "dia"
  for (var i = 0; i < headers.length; i++) {
    if (/data|date|dia/i.test(headers[i])) return i + 1;
  }
  return -1;
}

function cellToIso(cell, tz) {
  if (cell instanceof Date) {
    return Utilities.formatDate(cell, tz, "yyyy-MM-dd");
  }
  return String(cell || "").trim().slice(0, 10);
}

// ─── Cache com TTL diferenciado ───────────────────────────────────────────────
// Datas passadas: imutáveis → cache de 6h
// Hoje: pode mudar → cache de 5min

function cacheTtl(dataFim) {
  var today = todayFortaleza();
  return dataFim < today ? 21600 : 300; // 6h : 5min
}

function getCached(key) {
  try {
    var val = CacheService.getScriptCache().get(key);
    return val ? JSON.parse(val) : null;
  } catch(e) { return null; }
}

function putCached(key, data, dataFim) {
  try {
    var ttl     = cacheTtl(dataFim);
    var payload = JSON.stringify(data);
    // CacheService limita a 100 KB por entrada; fragmenta se necessário
    if (payload.length <= 100000) {
      CacheService.getScriptCache().put(key, payload, ttl);
    }
  } catch(e) {}
}

// ─── Utilitários gerais ───────────────────────────────────────────────────────

function findSheetByGid(ss, gid) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  return sheets[0] || null;
}

function merge(obj, extra) {
  var result = {};
  for (var k in obj)   { if (obj.hasOwnProperty(k))   result[k] = obj[k]; }
  for (var k in extra) { if (extra.hasOwnProperty(k)) result[k] = extra[k]; }
  return result;
}

function todayFortaleza() {
  return Utilities.formatDate(new Date(), "America/Fortaleza", "yyyy-MM-dd");
}

function buildResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
