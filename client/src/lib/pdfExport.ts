/**
 * MetricFlow — Exportações PDF do cliente (Assessment e Análise/Comparativo).
 *
 * Abrem uma nova janela com o HTML do relatório e disparam o print,
 * usando @media print para gerar o PDF.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Exportação PDF — Alocação de Responsabilidades por Revenda
// ─────────────────────────────────────────────────────────────────────────────
export interface AlocacaoItemPdf {
  item: string;
  macroArea: string;
  microArea: string;
  descricao: string;
}

export interface AlocacaoRevendaPdf {
  nome: string;
  totalItens: number;
  comResp: number;
  faltando: AlocacaoItemPdf[];
}

export function exportarPdfAlocacao(revendas: AlocacaoRevendaPdf[]): void {
  const geradoEm = new Date().toLocaleString("pt-BR");

  const blocos = revendas.map(rev => {
    const pct = rev.totalItens > 0 ? Math.round(rev.comResp / rev.totalItens * 100) : 0;
    const corBarra = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";

    const macros = Array.from(new Set(rev.faltando.map(i => i.macroArea))).sort();

    const linhas = macros.map(macro => {
      const itens = rev.faltando.filter(i => i.macroArea === macro);
      const rows = itens.map(i => `
        <tr>
          <td style="padding:5px 8px;font-family:monospace;font-weight:700;color:#e11d48;white-space:nowrap">${i.item}</td>
          <td style="padding:5px 8px;color:#64748b">${i.microArea}</td>
          <td style="padding:5px 8px;color:#334155;max-width:320px">${i.descricao}</td>
        </tr>`).join("");
      return `
        <tr style="background:#f1f5f9">
          <td colspan="3" style="padding:4px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#475569">${macro}</td>
        </tr>
        ${rows}`;
    }).join("");

    const tabela = rev.faltando.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:10px">
        <thead>
          <tr style="background:#e2e8f0">
            <th style="padding:6px 8px;text-align:left;font-weight:700;color:#475569;width:70px">Item</th>
            <th style="padding:6px 8px;text-align:left;font-weight:700;color:#475569;width:130px">Micro Área</th>
            <th style="padding:6px 8px;text-align:left;font-weight:700;color:#475569">Descrição</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>` : `<p style="font-size:11px;color:#10b981;font-weight:700;margin:8px 0 0">✓ Todos os itens estão alocados.</p>`;

    return `
      <div style="margin-bottom:28px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:14px;font-weight:800;color:#1e293b">${rev.nome}</span>
          <span style="font-size:12px;font-weight:700;color:${corBarra}">${pct}% alocado · ${rev.comResp}/${rev.totalItens} itens</span>
        </div>
        <div style="height:8px;border-radius:4px;background:#e2e8f0;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${corBarra};border-radius:4px"></div>
        </div>
        ${rev.faltando.length > 0
          ? `<p style="font-size:11px;color:#ef4444;font-weight:700;margin:6px 0 0">${rev.faltando.length} item${rev.faltando.length !== 1 ? "s" : ""} sem responsável</p>`
          : ""}
        ${tabela}
      </div>`;
  }).join('<div style="border-top:1px solid #e2e8f0;margin:12px 0"></div>');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Alocação de Responsabilidades — Assessment</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #1e293b; padding: 32px 40px; }
    table { border-collapse: collapse; }
    tbody tr:hover { background: #fef2f2; }
    @media print {
      body { padding: 16px 24px; }
      @page { margin: 14mm 12mm; }
    }
  </style>
</head>
<body>
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #6366f1">
    <div>
      <h1 style="font-size:18px;font-weight:900;color:#6366f1">Alocação de Responsabilidades</h1>
      <p style="font-size:11px;color:#64748b;margin-top:4px">Assessment — Itens sem responsável por revenda</p>
    </div>
    <p style="font-size:10px;color:#94a3b8;text-align:right">Gerado em ${geradoEm}</p>
  </div>
  ${blocos}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Não foi possível abrir a janela. Verifique o bloqueador de pop-ups.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 800);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exportação PDF — Comparativo de Scores (uma seção por setor, quebra de página)
// ─────────────────────────────────────────────────────────────────────────────
export interface ComparativoScoresPdfSetor {
  nome: string;
  mediaSetor: (number | null)[];
  vendedores: { vendedor: string; valores: (number | null)[] }[];
}

function scoreBadgeHtml(v: number | null): string {
  if (v === null) return `<span style="color:#94a3b8">—</span>`;
  const [bg, text, border] = v === 0
    ? ["#f0fdf4", "#15803d", "#bbf7d0"]
    : v < 1
    ? ["#fffbeb", "#b45309", "#fde68a"]
    : ["#fef2f2", "#dc2626", "#fecaca"];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${bg};color:${text};border:1px solid ${border};font-weight:700;font-size:10px">${v.toFixed(1)}</span>`;
}

// Mesma regra do TrendIcon da tela: delta < 0 = melhorou (desce), delta > 0 = piorou (sobe).
function trendArrowHtml(atual: number | null, anterior: number | null): string {
  if (atual === null || anterior === null) return "";
  const delta = atual - anterior;
  if (Math.abs(delta) < 0.05) return `<span style="color:#94a3b8;margin-left:3px;font-size:10px">−</span>`;
  return delta < 0
    ? `<span style="color:#16a34a;margin-left:3px;font-size:10px">↓</span>`
    : `<span style="color:#dc2626;margin-left:3px;font-size:10px">↑</span>`;
}

function celulasHtml(valores: (number | null)[]): string {
  return valores.map((v, idx) => `
    <td style="padding:6px 8px;text-align:center;white-space:nowrap">
      ${scoreBadgeHtml(v)}${trendArrowHtml(v, idx > 0 ? valores[idx - 1] : null)}
    </td>`).join("");
}

export interface ComparativoScoresPdfExplicacao {
  label: string;
  desc: string;
  itens?: { label: string; desc: string }[];
}

export function exportarComparativoScoresPDF(
  periodos: { label: string }[],
  setores: ComparativoScoresPdfSetor[],
  metricaLabel: string,
  filtroInfo: string,
  explicacao: ComparativoScoresPdfExplicacao
): void {
  const geradoEm = new Date().toLocaleString("pt-BR");

  const explicacaoHtml = `
    <div style="margin-bottom:22px;padding:12px 14px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;page-break-inside:avoid">
      <p style="font-size:11px;color:#3730a3"><strong>${explicacao.label}:</strong> ${explicacao.desc}</p>
      ${explicacao.itens ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;margin-top:8px">
          ${explicacao.itens.map(i => `<p style="font-size:10px;color:#4338ca"><strong>${i.label}:</strong> ${i.desc}</p>`).join("")}
        </div>` : ""}
    </div>`;

  // Cada setor começa em página própria (exceto o primeiro) — export separado por revenda dentro do mesmo PDF.
  const setoresHtml = setores.map((s, i) => {
    const linhas = [
      { label: `${s.nome} (média)`, valores: s.mediaSetor, bold: true },
      ...s.vendedores.map(v => ({ label: `Vend. ${v.vendedor}`, valores: v.valores, bold: false })),
    ];
    const trs = linhas.map(l => `
      <tr style="${l.bold ? "background:#eef2ff" : ""}">
        <td style="padding:6px 10px;font-weight:${l.bold ? 800 : 600};color:${l.bold ? "#4338ca" : "#475569"}">${l.label}</td>
        ${celulasHtml(l.valores)}
      </tr>`).join("");

    return `
      <div style="margin-bottom:26px;page-break-inside:avoid;${i > 0 ? "page-break-before:always;" : ""}">
        <div style="font-size:14px;font-weight:800;color:#1e293b;margin-bottom:6px;text-transform:uppercase">${s.nome}</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#052e16">
              <th style="padding:6px 10px;text-align:left;color:#f1f5f9;font-size:10px;text-transform:uppercase">Setor / Vendedor</th>
              ${periodos.map(p => `<th style="padding:6px 8px;text-align:center;color:#f1f5f9;font-size:10px;text-transform:uppercase;white-space:nowrap">${p.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comparativo de Scores</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #1e293b; padding: 24px 32px; }
    table { border-collapse: collapse; }
    @media print {
      body { padding: 12px 16px; }
      @page { size: A4 landscape; margin: 12mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #6366f1">
    <div>
      <h1 style="font-size:18px;font-weight:900;color:#4338ca">Comparativo de Scores — ${metricaLabel}</h1>
      <p style="font-size:11px;color:#64748b;margin-top:4px">${filtroInfo}</p>
    </div>
    <p style="font-size:10px;color:#94a3b8;text-align:right">Gerado em ${geradoEm}</p>
  </div>
  ${explicacaoHtml}
  ${setoresHtml}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 800);
}
