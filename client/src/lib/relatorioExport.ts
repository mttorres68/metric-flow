/**
 * MetricFlow — Exportação Unificada de Relatórios por Revenda
 *
 * Cada revenda gera um "pacote" com duas páginas:
 *   Página 1 — Vendedores (KPIs de jornada e cobertura) + análise do gestor
 *   Página 2 — GAs (Rota Coaching, conformidade) + análise do gestor
 *
 * Usa HTML + CSS @media print (sem dependências extra).
 * Abre nova janela e dispara window.print() — o usuário salva como PDF.
 *
 * Exportar uma revenda:  exportarRelatorioRevenda(params)
 * Exportar todas:        exportarTodosRelatorios(params)
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface VendedorRow {
  vendedor: number | string;
  inicio?: string | null;
  fim?: string | null;
  almoco?: number;
  apos14h?: number;
  apos14h_pct?: number;
  apos14h_total?: number;
  visitas?: number;
  visitas_total?: number;
  visitas_total_dentro_raio?: number;
  visitas_pct?: number;
  relampago?: number;
  relampago_pct?: number;
}

export interface CoachingRow {
  gaId?: string;
  vendId?: string;
  vendedor_agenda?: string;
  agendado?: boolean;
  status?: string;
  pdvsProg?: number;
  pdvsVis?: number;
  gaVis?: number;
  atividade?: string;
  vendedor_no_app?: string;
  rev?: string;
}

export interface RelatorioParams {
  revenda: string;
  data: string;                   // YYYY-MM-DD
  vendedoresData: VendedorRow[];
  coachingData: CoachingRow[];
  analiseVendedores?: string;     // HTML do editor
  analiseGAs?: string;            // HTML do editor
}

export interface TodosRelatoriosParams {
  data: string;
  revendas: string[];
  vendedoresGrouped: Record<string, VendedorRow[]>;
  coachingGrouped: Record<string, CoachingRow[]>;
  analisesVendedores: Record<string, string>;
  analisesGAs: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtHora(h: string | null | undefined): string {
  if (!h || h === "ND" || h === "—" || h === "-") return "—";
  return String(h).substring(0, 8);
}

function corInicio(inicio: string | null | undefined): string {
  if (!inicio || inicio === "—" || inicio === "-") return "#121212";
  const [hr, mn] = String(inicio).split(":").map(Number);
  const min = hr * 60 + (mn || 0);
  return (min < 7 * 60 + 30 || min > 8 * 60 + 45) ? "#cc2244" : "#121212";
}

function fmtDataLonga(data: string): string {
  const [y, m, d] = data.split("-").map(Number);
  const obj = new Date(y, m - 1, d);
  return obj.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ─── CSS Compartilhado ────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 11px;
    color: #1a2540;
    background: #e2e8f0;
    padding: 20px;
  }
  .pagina {
    max-width: 1000px;
    margin: 0 auto 40px;
    background: #ffffff;
    padding: 36px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.10);
    page-break-after: always;
  }
  .pagina:last-child { page-break-after: avoid; }

  /* Cabeçalho da página */
  .header {
    background: #205527;
    color: white;
    padding: 18px 22px;
    border-radius: 8px;
    margin-bottom: 22px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .header-rev  { font-size: 13px; font-weight: 700; opacity: 0.75; letter-spacing: 1px; text-transform: uppercase; }
  .header-tipo { font-size: 20px; font-weight: 900; margin-top: 4px; }
  .header-data { font-size: 11px; opacity: 0.65; margin-top: 3px; }

  /* KPIs (linha de cards) */
  .kpis {
    display: flex; gap: 12px; margin-bottom: 20px;
  }
  .kpi {
    flex: 1; border: 1px solid #c8d4e8; border-radius: 6px;
    padding: 10px 12px; text-align: center;
  }
  .kpi-val { font-size: 22px; font-weight: 900; color: #0055cc; }
  .kpi-label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #5a6a80; margin-top: 3px; }

  /* Tabela */
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
  thead th {
    background: #205527; color: #f4f6f8;
    text-transform: uppercase; font-size: 9px; font-weight: 700;
    padding: 8px 7px; border: 1px solid #c8d4e8; vertical-align: bottom;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  tbody td { padding: 7px; border: 1px solid #c8d4e8; vertical-align: middle; }
  tbody tr:nth-child(even) {
    background: #f0f0f0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .tc { text-align: center; }
  .bold { font-weight: 700; }
  .red { color: #cc2244; }
  .blue { color: #0055cc; }
  .green { color: #007a3d; }

  /* Linha Geral */
  .geral-row td {
    background: #009900; color: white; font-weight: 800;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .geral-row .alerta { color: #ffcc44; }

  /* Caixa de análise */
  .analise-box {
    background: #f8fafc; border: 1px dashed #c8d4e8;
    border-radius: 6px; padding: 14px; margin-top: 8px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .analise-titulo {
    font-size: 9px; font-weight: 700; color: #5a7299;
    text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;
  }
  .analise-conteudo { font-size: 11px; color: #1a2540; line-height: 1.65; }
  .analise-conteudo * { color: #1a2540 !important; background: transparent !important; }
  .analise-conteudo mark { background: #fde047 !important; padding: 0 2px; border-radius: 2px; }
  .analise-conteudo h2 { font-size: 12px; font-weight: 700; margin: 6px 0 3px; }
  .analise-conteudo ul, .analise-conteudo ol { padding-left: 18px; margin: 3px 0; }
  .analise-conteudo li { margin: 2px 0; }
  .analise-conteudo em { color: #8a9ab8 !important; font-style: italic; }
  .analise-vazia { color: #94a3b8; font-style: italic; }

  /* Rodapé da página */
  .rodape { font-size: 9px; color: #94a3b8; text-align: right; margin-top: 18px; }

  @media print {
    @page { size: A4 landscape; margin: 1cm; }
    body { background: white; padding: 0; }
    .pagina {
      max-width: 100%; margin: 0; padding: 0;
      box-shadow: none; border-radius: 0;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

// ─── Página 1: Vendedores ─────────────────────────────────────────────────────

function paginaVendedores(
  revenda: string,
  data: string,
  rows: VendedorRow[],
  analise: string
): string {
  if (!rows.length) return "";

  const dataLonga = fmtDataLonga(data);
  const dataFmt   = data.split("-").reverse().join("/");

  // Linha por vendedor
  const trs = rows.map((v, i) => {
    const bg     = i % 2 === 1 ? ' style="background:#f0f0f0"' : "";
    const almoco = v.almoco ?? 0;
    const pApos  = (v.apos14h_pct ?? 0).toFixed(0);
    const alertaApos = parseInt(pApos) < 25;
    const pVis   = (v.visitas_pct ?? 0).toFixed(0);
    const alertaVis  = parseInt(pVis) < 100;
    const pRel   = (v.relampago_pct ?? 0).toFixed(0);
    const alertaRel  = parseInt(pRel) > 10;
    const corIni = corInicio(v.inicio);

    return `
      <tr${bg}>
        <td class="tc bold">${v.vendedor ?? "—"}</td>
        <td class="tc" style="color:${corIni};font-weight:${corIni !== "#121212" ? "700" : "400"}">${fmtHora(v.inicio)}</td>
        <td class="tc">${fmtHora(v.fim)}</td>
        <td class="tc ${almoco > 0 ? "red bold" : ""}">${almoco > 0 ? almoco : "—"}</td>
        <td class="tc ${alertaApos ? "red bold" : "bold"}">${pApos}% <span style="font-weight:400;color:#555;font-size:9px">(${v.apos14h ?? 0}/${v.apos14h_total ?? 0})</span></td>
        <td class="tc ${alertaVis ? "red bold" : "bold"}">${pVis}% <span style="font-weight:400;color:#555;font-size:9px">(${v.visitas ?? 0}/${v.visitas_total ?? 0})</span></td>
        <td class="tc ${alertaRel ? "red bold" : "bold"}">${pRel}% <span style="font-weight:400;color:#555;font-size:9px">(${v.relampago ?? 0}/${v.visitas_total_dentro_raio ?? 0})</span></td>
      </tr>
    `;
  }).join("");

  // Linha geral
  const somaAlm  = rows.reduce((s, v) => s + (v.almoco ?? 0), 0);
  const somaAp   = rows.reduce((s, v) => s + (v.apos14h ?? 0), 0);
  const somaApT  = rows.reduce((s, v) => s + (v.apos14h_total ?? 0), 0);
  const somaVis  = rows.reduce((s, v) => s + (v.visitas ?? 0), 0);
  const somaVisT = rows.reduce((s, v) => s + (v.visitas_total ?? 0), 0);
  const somaRel  = rows.reduce((s, v) => s + (v.relampago ?? 0), 0);
  const somaBrut = rows.reduce((s, v) => s + (v.visitas_total_dentro_raio ?? 0), 0);
  const pGeralAp  = somaApT > 0 ? ((somaAp / somaApT) * 100).toFixed(0) : "0";
  const pGeralVis = somaVisT > 0 ? ((somaVis / somaVisT) * 100).toFixed(0) : "0";
  const pGeralRel = somaBrut > 0 ? ((somaRel / somaBrut) * 100).toFixed(0) : "0";

  function mediaHora(campo: keyof VendedorRow): string {
    const mins = rows.map(v => {
      const h = String(v[campo] ?? "");
      if (!h || h === "ND" || h === "—") return null;
      const [hr, mn] = h.split(":").map(Number);
      return isNaN(hr) ? null : hr * 60 + (mn || 0);
    }).filter((n): n is number => n !== null);
    if (!mins.length) return "—";
    const m = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }

  const linhaGeral = `
    <tr class="geral-row">
      <td class="tc">Geral</td>
      <td class="tc">${mediaHora("inicio")}</td>
      <td class="tc">${mediaHora("fim")}</td>
      <td class="tc">${somaAlm > 0 ? somaAlm : "—"}</td>
      <td class="tc ${parseInt(pGeralAp) < 25 ? "alerta" : ""}">${pGeralAp}% (${somaAp}/${somaApT})</td>
      <td class="tc ${parseInt(pGeralVis) < 100 ? "alerta" : ""}">${pGeralVis}% (${somaVis}/${somaVisT})</td>
      <td class="tc ${parseInt(pGeralRel) > 10 ? "alerta" : ""}">${pGeralRel}% (${somaRel}/${somaBrut})</td>
    </tr>
  `;

  const caixaAnalise = `
    <div class="analise-box">
      <div class="analise-titulo">Análise do Gestor — Vendedores</div>
      <div class="analise-conteudo">
        ${analise?.trim()
          ? analise
          : '<em class="analise-vazia">Nenhuma análise registrada para esta revenda.</em>'}
      </div>
    </div>
  `;

  return `
    <div class="pagina">
      <div class="header">
        <div class="header-rev">${revenda}</div>
        <div class="header-tipo">Relatório de Vendedores</div>
        <div class="header-data">${dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="tc" width="10%">Vendedor</th>
            <th class="tc" width="11%">Início</th>
            <th class="tc" width="11%">Fim</th>
            <th class="tc" width="13%">12:15 a 13:45</th>
            <th class="tc" width="18%">Após às 14h</th>
            <th class="tc" width="18%">Visitas</th>
            <th class="tc" width="19%">Visitas Relâmpagos</th>
          </tr>
        </thead>
        <tbody>
          ${trs}
          ${linhaGeral}
        </tbody>
      </table>

      ${caixaAnalise}

      <div class="rodape">
        MetricFlow · ${revenda} · Vendedores · ${dataFmt}
      </div>
    </div>
  `;
}

// ─── Página 2: GAs — Rota Coaching ───────────────────────────────────────────

function paginaGAs(
  revenda: string,
  data: string,
  rows: CoachingRow[],
  analise: string
): string {
  if (!rows.length) return "";

  const dataLonga = fmtDataLonga(data);
  const dataFmt   = data.split("-").reverse().join("/");

  // KPIs da revenda
  const agendados = rows.filter(r => r.agendado);
  const ok  = agendados.filter(r => r.status === "ok").length;
  const par = agendados.filter(r => r.status === "partial").length;
  const nok = agendados.filter(r => r.status === "nok").length;
  const taxa = agendados.length
    ? Math.round(((ok + par * 0.5) / agendados.length) * 100) + "%"
    : "—";

  const kpisHtml = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-val green">${ok}</div><div class="kpi-label">Completos</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#8a5c00">${par}</div><div class="kpi-label">Parciais</div></div>
      <div class="kpi"><div class="kpi-val red">${nok}</div><div class="kpi-label">Não Realizados</div></div>
      <div class="kpi"><div class="kpi-val">${taxa}</div><div class="kpi-label">Taxa</div></div>
    </div>
  `;

  const STATUS_LABELS: Record<string, string> = {
    ok: "✅ Completo", partial: "⚠️ Parcial", nok: "❌ Não Realizado", na: "— Sem Agenda",
  };

  const trs = rows.map((r, i) => {
    const bg = i % 2 === 1 ? ' style="background:#f0f0f0"' : "";
    const alertaVis = r.agendado && (r.pdvsVis ?? 0) < (r.pdvsProg ?? 0);
    // vendId pode vir como "-" quando não há vínculo — ignorar nesse caso
    const vendIdValido = r.vendId && r.vendId !== "-" ? r.vendId : "";
    const codVend = r.vendedor_agenda || r.vendedor_no_app || vendIdValido || "—";
    return `
      <tr${bg}>
        <td class="bold">${r.gaId || "—"}</td>
        <td>${r.atividade || "—"}</td>
        <td class="tc bold blue">${codVend !== "—" ? codVend : ""}</td>
        <td class="tc blue bold">${r.agendado ? (r.gaVis ?? "") : ""}</td>
        <td class="tc">${r.agendado ? (r.pdvsProg ?? "") : ""}</td>
        <td class="tc ${alertaVis ? "red bold" : ""}">${r.agendado ? (r.pdvsVis ?? "") : ""}</td>
        <td class="tc">${r.agendado ? (STATUS_LABELS[r.status ?? "na"] ?? r.status) : "—"}</td>
      </tr>
    `;
  }).join("");

  const caixaAnalise = `
    <div class="analise-box">
      <div class="analise-titulo">Análise do Gestor — GAs (Rota Coaching)</div>
      <div class="analise-conteudo">
        ${analise?.trim()
          ? analise
          : '<em class="analise-vazia">Nenhuma análise registrada para esta revenda.</em>'}
      </div>
    </div>
  `;

  return `
    <div class="pagina">
      <div class="header">
        <div class="header-rev">${revenda}</div>
        <div class="header-tipo">Relatório de GAs — Rota Coaching</div>
        <div class="header-data">${dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)}</div>
      </div>

      ${kpisHtml}

      <table>
        <thead>
          <tr>
            <th width="9%">GA</th>
            <th width="22%">Atividade / Agenda</th>
            <th class="tc" width="13%">Cod.<br>Vendedor</th>
            <th class="tc" width="12%">Visitas<br>GA</th>
            <th class="tc" width="13%">Qtd.<br>Carteira</th>
            <th class="tc" width="13%">Visitas<br>Vendedor</th>
            <th class="tc" width="18%">Status</th>
          </tr>
        </thead>
        <tbody>
          ${trs}
        </tbody>
      </table>

      ${caixaAnalise}

      <div class="rodape">
        MetricFlow · ${revenda} · GAs — Rota Coaching · ${dataFmt}
      </div>
    </div>
  `;
}

// ─── Abre janela e imprime ────────────────────────────────────────────────────

function abrirJanelaImpressao(titulo: string, corpoHtml: string): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Não foi possível abrir a janela. Verifique o bloqueador de pop-ups.");
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${titulo}</title>
      <style>${CSS}</style>
    </head>
    <body>${corpoHtml}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 700);
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Exporta o relatório de UMA revenda (2 páginas: Vendedores + GAs).
 */
export function exportarRelatorioRevenda(params: RelatorioParams): void {
  const { revenda, data, vendedoresData, coachingData, analiseVendedores = "", analiseGAs = "" } = params;

  const p1 = paginaVendedores(revenda, data, vendedoresData, analiseVendedores);
  const p2 = paginaGAs(revenda, data, coachingData, analiseGAs);

  if (!p1 && !p2) {
    alert(`Sem dados para exportar a revenda ${revenda} em ${data}.`);
    return;
  }

  const dataFmt = data.split("-").reverse().join("/");
  abrirJanelaImpressao(
    `Relatório ${revenda} — ${dataFmt}`,
    p1 + p2
  );
}

/**
 * Exporta TODAS as revendas em sequência no mesmo documento.
 * Cada revenda tem 2 páginas (Vendedores + GAs).
 */
export function exportarTodosRelatorios(params: TodosRelatoriosParams): void {
  const {
    data, revendas,
    vendedoresGrouped, coachingGrouped,
    analisesVendedores, analisesGAs,
  } = params;

  let corpo = "";
  for (const rev of revendas) {
    corpo += paginaVendedores(rev, data, vendedoresGrouped[rev] ?? [], analisesVendedores[rev] ?? "");
    corpo += paginaGAs(rev, data, coachingGrouped[rev] ?? [], analisesGAs[rev] ?? "");
  }

  if (!corpo) {
    alert(`Sem dados para exportar em ${data}.`);
    return;
  }

  const dataFmt = data.split("-").reverse().join("/");
  abrirJanelaImpressao(`Relatórios — ${dataFmt}`, corpo);
}
