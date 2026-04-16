/**
 * MetricFlow — Exportação PDF de Rota Coaching
 * Migrado do monitor-rota/pdfExport.js com tipos TypeScript.
 *
 * Abre uma nova janela com o HTML do relatório e dispara o print,
 * usando @media print para gerar o PDF.
 */

export interface RotaPdfRow {
  rev?: string;
  gaId?: string;
  vendId?: string;
  vendedor_agenda?: string;
  agendado?: boolean;
  status?: string;
  pdvsProg?: number;
  pdvsVis?: number;
  gaVis?: number;
  pctGA?: number;
  atividade?: string;
  vendedor_no_app?: string;
  data?: string;
}

export interface RotaPdfKPIs {
  revendas: number;
  ok: number;
  par: number;
  nok: number;
  taxa: string | number;
}

export function exportarPDF(
  filteredData: RotaPdfRow[],
  date: string,
  kpis: RotaPdfKPIs,
  analises: Record<string, string> = {}
): void {
  if (!filteredData.length) {
    alert("Sem dados para exportar.");
    return;
  }

  const dtParts = date.split("-");
  const dataObj = new Date(
    Number(dtParts[0]),
    Number(dtParts[1]) - 1,
    Number(dtParts[2])
  );
  const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 1. Agrupar dados por Revenda, deduplica GA+dia mantendo o de mais visitas do vendedor
  const rawGrouped: Record<string, RotaPdfRow[]> = filteredData.reduce(
    (acc, curr) => {
      const rev = curr.rev || "Sem Revenda";
      if (!acc[rev]) acc[rev] = [];
      acc[rev].push(curr);
      return acc;
    },
    {} as Record<string, RotaPdfRow[]>
  );

  const groupedData: Record<string, RotaPdfRow[]> = {};
  for (const [rev, rows] of Object.entries(rawGrouped)) {
    // Agrupa por gaId+data e mantém o de maior pdvsVis
    const byGaDay: Record<string, RotaPdfRow[]> = {};
    rows.forEach(r => {
      const key = `${r.gaId || ""}__${r.data || ""}`;
      if (!byGaDay[key]) byGaDay[key] = [];
      byGaDay[key].push(r);
    });
    groupedData[rev] = Object.values(byGaDay).map(entries =>
      entries.length === 1
        ? entries[0]
        : entries.reduce((best, cur) =>
            (cur.pdvsVis ?? 0) >= (best.pdvsVis ?? 0) ? cur : best
          )
    );
  }

  let tablesHtml = "";
  for (const [revenda, rows] of Object.entries(groupedData)) {
    const analiseTexto = (analises[revenda] || "").trim();

    const trs = rows
      .map((r) => {
        const isRC = r.agendado;
        const colAtividade = r.atividade || "-";
        const vendIdValido = r.vendId && r.vendId !== "-" ? r.vendId : "";
        const codVendedor = r.vendedor_agenda || vendIdValido || "";
        const colCodeVend = codVendedor || (isRC ? "-" : "");
        const colVisGa = isRC ? r.gaVis : "";
        const colIdApp = isRC ? r.vendedor_no_app || "-" : "";
        const colProg = isRC ? r.pdvsProg : "";
        const colVisVend = isRC ? r.pdvsVis : "";
        const redWarning =
          isRC && (r.pdvsVis ?? 0) < (r.pdvsProg ?? 0)
            ? "color: #cc2244; font-weight: bold;"
            : "";

        return `
        <tr>
          <td><strong>${r.gaId || "-"}</strong></td>
          <td>${colAtividade}</td>
          <td class="text-center">${colCodeVend}</td>
          <td class="text-center" style="font-weight: bold; color: ${(colVisGa ?? 0) > 0 ? "#0055cc" : "#333"}">${colVisGa ?? ""}</td>
          <td class="text-center">${colIdApp}</td>
          <td class="text-center">${colProg ?? ""}</td>
          <td class="text-center" style="${redWarning}">${colVisVend ?? ""}</td>
        </tr>
      `;
      })
      .join("");

    tablesHtml += `
      <div class="revenda-section">
        <div class="revenda-title">${revenda}</div>
        <table>
          <thead>
            <tr>
              <th width="10%">GA</th>
              <th width="20%">Atividade/agenda</th>
              <th width="12%" class="text-center">ID<br>Vendedor agenda</th>
              <th width="12%" class="text-center">Visitas realizadas GA</th>
              <th width="18%" class="text-center">Id Vendedor app</th>
              <th width="14%" class="text-center">Qtd total carteira</th>
              <th width="14%" class="text-center">Qtd de visitas<br>realizada vendedor</th>
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
        <div class="analise-box">
          <div class="analise-title">Análise Gerencial:</div>
          <div class="analise-content">${
            analiseTexto ||
            `<em>(Sem análise registrada para ${revenda}.)</em>`
          }</div>
        </div>
      </div>
    `;
  }

  // 2. Dados do gráfico (visitas por GA)
  const chartDataMap: Record<string, number> = {};
  filteredData.forEach((r) => {
    if (r.gaId && r.gaId !== "-") {
      chartDataMap[r.gaId] = (chartDataMap[r.gaId] || 0) + (r.gaVis || 0);
    }
  });

  const chartData = Object.entries(chartDataMap)
    .map(([ga, visitas]) => ({ ga, visitas }))
    .sort((a, b) => b.visitas - a.visitas);

  const maxVisitas = Math.max(...chartData.map((d) => d.visitas), 5);

  let chartBarsHtml = "";
  chartData.forEach((d) => {
    const heightPct = Math.max((d.visitas / maxVisitas) * 100, 0.5);
    chartBarsHtml += `
      <div style="position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; flex: 1; max-width: 65px; height: ${heightPct}%;">
        <div style="position: absolute; top: -20px; font-size: 11px; font-weight: bold; color: #0055cc; width: 100%; text-align: center;">${d.visitas}</div>
        <div style="background-color: #3b82f6; width: 100%; height: 100%; border-radius: 4px 4px 0 0; border: 1px solid rgba(59, 130, 246, 0.8); border-bottom: none; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
        <div style="position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); font-size: 9px; color: #5a7299; font-weight: bold; text-align: center; text-transform: uppercase; white-space: nowrap;">${d.ga}</div>
      </div>
    `;
  });

  const chartHtml = `
    <div style="margin-top: 50px; padding: 25px 30px 45px; border: 1px solid #c8d4e8; border-radius: 12px; background: #ffffff; page-break-inside: avoid;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 45px;">
        <div>
          <h3 style="font-size: 14px; font-weight: bold; color: #205527; margin: 0; text-transform: uppercase;">Visitas Dia por GA</h3>
          <p style="font-size: 11px; color: #5a7299; margin: 4px 0 0 0;">Volume total de visitas acompanhadas validadas via App</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 10px; color: #5a7299; font-weight: bold; text-transform: uppercase;">
          <div style="width: 12px; height: 12px; background-color: #3b82f6; border-radius: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
          Visitas Realizadas
        </div>
      </div>
      <div style="position: relative; height: 240px; margin-left: 20px; border-bottom: 1px solid #e8edf5; display: flex; align-items: flex-end; justify-content: center; gap: 20px;">
        <div style="position: absolute; top: 0; left: 0; right: 0; border-top: 1px dashed #e8edf5; z-index: 0;"></div>
        <div style="position: absolute; top: 25%; left: 0; right: 0; border-top: 1px dashed #e8edf5; z-index: 0;"></div>
        <div style="position: absolute; top: 50%; left: 0; right: 0; border-top: 1px dashed #e8edf5; z-index: 0;"></div>
        <div style="position: absolute; top: 75%; left: 0; right: 0; border-top: 1px dashed #e8edf5; z-index: 0;"></div>
        <div style="position: absolute; top: -6px; left: -30px; width: 20px; text-align: right; font-size: 10px; color: #8a9ab8;">${maxVisitas}</div>
        <div style="position: absolute; top: calc(25% - 6px); left: -30px; width: 20px; text-align: right; font-size: 10px; color: #8a9ab8;">${Math.round(maxVisitas * 0.75)}</div>
        <div style="position: absolute; top: calc(50% - 6px); left: -30px; width: 20px; text-align: right; font-size: 10px; color: #8a9ab8;">${Math.round(maxVisitas * 0.5)}</div>
        <div style="position: absolute; top: calc(75% - 6px); left: -30px; width: 20px; text-align: right; font-size: 10px; color: #8a9ab8;">${Math.round(maxVisitas * 0.25)}</div>
        <div style="position: absolute; bottom: -6px; left: -30px; width: 20px; text-align: right; font-size: 10px; color: #8a9ab8;">0</div>
        ${chartBarsHtml}
      </div>
    </div>
  `;

  // 3. HTML do PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório - ${date}</title>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #1a2540; margin: 0; padding: 20px; background-color: #e2e8f0; }
        .container { max-width: 1000px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 25px; background: #205527; padding: 20px; border-radius: 8px; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
        .header h1 { font-size: 20px; margin: 0; letter-spacing: 1px; }
        .header p { color: #a8bcd8; margin: 5px 0 0 0; font-size: 12px; }
        .kpis { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 35px; }
        .kpi-box { flex: 1; border: 1px solid #c8d4e8; padding: 12px; border-radius: 6px; text-align: center; }
        .kpi-val { font-size: 22px; font-weight: bold; color: #0055cc; }
        .kpi-label { font-size: 9px; text-transform: uppercase; color: #121212; font-weight: bold; margin-top: 4px; }
        .revenda-section { margin-bottom: 35px; page-break-inside: avoid; }
        .revenda-title { font-size: 16px; font-weight: bold; color: #205527; margin-bottom: 10px; border-bottom: 2px solid #009900; padding-bottom: 4px; display: inline-block; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th { background-color: #205527; color: #f4f6f8; text-transform: uppercase; font-size: 9px; padding: 8px; border: 1px solid #c8d4e8; text-align: left; vertical-align: bottom; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
        td { padding: 8px; border: 1px solid #c8d4e8; font-size: 11px; vertical-align: middle;}
        tr:nth-child(even) { background-color: #E6E6E6; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
        .text-center { text-align: center; }
        .analise-box { background-color: #f8fafc; border: 1px dashed #c8d4e8; border-radius: 6px; padding: 12px; margin-top: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
        .analise-title { font-size: 10px; font-weight: bold; color: #5a7299; text-transform: uppercase; margin-bottom: 6px; }
        .analise-content { font-size: 11px; color: #1a2540 !important; line-height: 1.65; }
        .analise-content * { color: #1a2540 !important; background-color: transparent !important; }
        .analise-content em { color: #8a9ab8 !important; font-style: italic; }
        .analise-content mark { background: #fde047 !important; padding: 0 2px; border-radius: 2px; color: #1a1a1a !important; }
        .analise-content h2 { font-size: 12px; font-weight: bold; margin: 5px 0 2px; }
        .analise-content ul { padding-left: 18px; margin: 3px 0; list-style: disc; }
        .analise-content ol { padding-left: 18px; margin: 3px 0; list-style: decimal; }
        .analise-content li { margin: 2px 0; }
        @media print {
          @page { margin: 1cm auto; size: A4 landscape; }
          body { background-color: #ffffff; padding: 0; }
          .container { max-width: 1000px; margin: 0 auto; padding: 0; box-shadow: none; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>RELATÓRIO DE CONFORMIDADE — ROTA COACHING</h1>
          <p>${dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)}</p>
        </div>
        <div class="kpis">
          <div class="kpi-box"><div class="kpi-val">${kpis.revendas}</div><div class="kpi-label">Revendas</div></div>
          <div class="kpi-box"><div class="kpi-val" style="color:#007a3d">${kpis.ok}</div><div class="kpi-label">Completos</div></div>
          <div class="kpi-box"><div class="kpi-val" style="color:#8a5c00">${kpis.par}</div><div class="kpi-label">Parciais</div></div>
          <div class="kpi-box"><div class="kpi-val" style="color:#a01030">${kpis.nok}</div><div class="kpi-label">Não Realizados</div></div>
          <div class="kpi-box"><div class="kpi-val">${kpis.taxa}</div><div class="kpi-label">Taxa Geral</div></div>
        </div>
        ${tablesHtml}
        ${chartHtml}
      </div>
    </body>
    </html>
  `;

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
