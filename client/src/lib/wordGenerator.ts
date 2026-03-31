import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";

const CORES = {
  laranja: "#D4610B",
  vermelho: "#FF2B00",
  vermelhoClaro: "#FF5533",
  cinzaClaro: "#F2F2F2",
  cinzaMedio: "#C3C3C3",
  branco: "#E6E6E6",
  preto: "#121212",
  brancoTitulo: "#FFFFFF",
  verdeTitulo: "#205527",
};

const LARGURA_TABELA = 9360;

// Vendedor | Início | Fim | 12:15-13:45 | Após 14h | Visitas | Relâmpago
const COL_WIDTHS = [1100, 1200, 1200, 1260, 1400, 1600, 1600];

const borda = (cor = "CCCCCC") => ({ style: BorderStyle.SINGLE, size: 4, color: cor });
const bordaInterna = () => ({
  top: borda("CCCCCC"), bottom: borda("CCCCCC"),
  left: borda("CCCCCC"), right: borda("CCCCCC")
});

function texto(conteudo: string | number, opcoes: any = {}) {
  return new TextRun({
    text: String(conteudo ?? "-"),
    font: "Arial",
    size: opcoes.size ?? 18,
    bold: opcoes.bold ?? false,
    color: opcoes.color ?? CORES.preto,
    italics: opcoes.italics ?? false,
  });
}

function paragrafo(runs: TextRun | TextRun[], opcoes: any = {}) {
  return new Paragraph({
    alignment: opcoes.alignment ?? AlignmentType.LEFT,
    spacing: { before: opcoes.before ?? 0, after: opcoes.after ?? 60 },
    children: Array.isArray(runs) ? runs : [runs],
  });
}

function celula(conteudo: any, largura: number, opcoes: any = {}) {
  const { bg, bold = false, color = CORES.preto, align = AlignmentType.CENTER, size = 18 } = opcoes;
  const runs = Array.isArray(conteudo) ? conteudo : [texto(conteudo, { bold, color, size })];
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    borders: bordaInterna(),
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({ alignment: align, spacing: { before: 0, after: 0 }, children: runs })],
  });
}

function celulaHeader(titulo: string, largura: number) {
  return celula(titulo, largura, { bg: CORES.verdeTitulo, bold: true, color: CORES.brancoTitulo, size: 17 });
}

function linhaHeader() {
  const titulos = ["Vendedor", "Início", "Fim", "12:15 a\n13:45", "Após às 14h", "Visitas", "Visitas\nRelâmpagos"];
  return new TableRow({
    tableHeader: true,
    children: titulos.map((t, i) => celulaHeader(t, COL_WIDTHS[i])),
  });
}

function formatarHora(h: any) {
  if (!h || h === "—" || h === "-") return "-";
  return String(h).substring(0, 8); // 08:30:00
}

function corIni(inicio: string) {
  if (!inicio || inicio === "—" || inicio === "-") return CORES.preto;
  const [h, m] = String(inicio).split(":").map(Number);
  const minutos = h * 60 + (m || 0);
  const minPermitido = 7 * 60 + 30; // 07:30 = 450
  const maxPermitido = 8 * 60 + 45; // 08:45 = 525
  if (minutos < minPermitido || minutos > maxPermitido) {
    return CORES.vermelho;
  }
  return CORES.preto;
}

function linhaVendedor(v: any, bgAlternado: boolean) {
  const bg = bgAlternado ? CORES.cinzaClaro : CORES.branco;

  const textoAlmoco = (v.almoco ?? 0) > 0
    ? [texto(`${v.almoco}`, { bold: true, color: CORES.vermelho, size: 17 })]
    : [texto("-", { size: 17 })];

  const percApos14h = (v.apos14h_pct ?? 0).toFixed(0);
  const emAlertaApos = parseInt(percApos14h) < 25;
  const runsApos14h = [
    texto(`${percApos14h}%`, { bold: true, color: emAlertaApos ? CORES.vermelho : CORES.preto, size: 18 }),
    texto(` (${v.apos14h ?? 0}/${v.apos14h_total ?? 0})`, { size: 16, color: CORES.preto }),
  ];

  const percVisitas = (v.visitas_pct ?? 0).toFixed(0);
  const emAlertaVisitas = parseInt(percVisitas) < 100;
  const runsVisitas = [
    texto(`${percVisitas}%`, { bold: true, size: 18, color: emAlertaVisitas ? CORES.vermelho : CORES.preto }),
    texto(` (${v.visitas ?? 0}/${v.visitas_total ?? 0})`, { size: 16, color: emAlertaVisitas ? CORES.vermelho : CORES.preto }),
  ];

  const percRelampago = (v.relampago_pct ?? 0).toFixed(0);
  const emAlertaRelampago = parseInt(percRelampago) > 10;
  const runsRelampago = [
    texto(`${percRelampago}%`, { bold: true, color: emAlertaRelampago ? CORES.vermelho : CORES.preto, size: 18 }),
    texto(` (${v.relampago ?? 0}/${v.visitas_total_dentro_raio ?? 0})`, { size: 16, color: CORES.preto }),
  ];

  const celulas = [
    celula(String(v.vendedor), COL_WIDTHS[0], { bg, align: AlignmentType.CENTER }),
    celula(formatarHora(v.inicio), COL_WIDTHS[1], {
      bg, color: corIni(v.inicio), bold: corIni(v.inicio) === CORES.vermelho
    }),
    celula(formatarHora(v.fim), COL_WIDTHS[2], { bg }),
    new TableCell({
      width: { size: COL_WIDTHS[3], type: WidthType.DXA },
      borders: bordaInterna(), margins: { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER, shading: { fill: bg, type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: textoAlmoco })]
    }),
    new TableCell({
      width: { size: COL_WIDTHS[4], type: WidthType.DXA },
      borders: bordaInterna(), margins: { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER, shading: { fill: bg, type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: runsApos14h })]
    }),
    new TableCell({
      width: { size: COL_WIDTHS[5], type: WidthType.DXA },
      borders: bordaInterna(), margins: { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER, shading: { fill: bg, type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: runsVisitas })]
    }),
    new TableCell({
      width: { size: COL_WIDTHS[6], type: WidthType.DXA },
      borders: bordaInterna(), margins: { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER, shading: { fill: bg, type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: runsRelampago })]
    }),
  ];

  return new TableRow({ children: celulas });
}

function linhaResumo(vendedores: any[]) {
  const BG_RESUMO = "#009900";

  function mediaHorario(campo: string) {
    const minutos = vendedores
      .map(v => v[campo]).filter(h => h && h !== "—" && h !== "-")
      .map(h => { const [hr, mn] = String(h).split(":").map(Number); return hr * 60 + (mn || 0); });
    if (!minutos.length) return "-";
    const media = Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length);
    return `${String(Math.floor(media / 60)).padStart(2, "0")}:${String(media % 60).padStart(2, "0")}`;
  }

  const somaAlmoco = vendedores.reduce((s, v) => s + (v.almoco ?? 0), 0);
  const somaApos14h = vendedores.reduce((s, v) => s + (v.apos14h ?? 0), 0);
  const somaApos14hTotal = vendedores.reduce((s, v) => s + (v.apos14h_total ?? 0), 0);
  const percApos14h = somaApos14hTotal > 0 ? ((somaApos14h / somaApos14hTotal) * 100).toFixed(0) : "0";
  const alertaApos14h = parseInt(percApos14h) < 25;

  const somaVisitas = vendedores.reduce((s, v) => s + (v.visitas ?? 0), 0);
  const somaVisitasTotal = vendedores.reduce((s, v) => s + (v.visitas_total ?? 0), 0);
  const percVisitas = somaVisitasTotal > 0 ? ((somaVisitas / somaVisitasTotal) * 100).toFixed(0) : "0";
  const alertaVisitas = parseInt(percVisitas) < 100;

  const somaRelampago = vendedores.reduce((s, v) => s + (v.relampago ?? 0), 0);
  const somaBrutas = vendedores.reduce((s, v) => s + (v.visitas_total_dentro_raio ?? 0), 0);
  const percRelampago = somaBrutas > 0 ? ((somaRelampago / somaBrutas) * 100).toFixed(0) : "0";
  const alertaRelampago = parseInt(percRelampago) > 10;

  function celulaResumo(runs: any, largura: number) {
    return new TableCell({
      width: { size: largura, type: WidthType.DXA },
      borders: bordaInterna(), margins: { top: 80, bottom: 80, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER, shading: { fill: BG_RESUMO, type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: Array.isArray(runs) ? runs : [runs] })]
    });
  }

  return new TableRow({
    children: [
      celulaResumo(texto("Geral", { bold: true, color: CORES.branco, size: 17 }), COL_WIDTHS[0]),
      celulaResumo(texto(mediaHorario("inicio"), { bold: true, color: CORES.branco, size: 17 }), COL_WIDTHS[1]),
      celulaResumo(texto(mediaHorario("fim"), { bold: true, color: CORES.branco, size: 17 }), COL_WIDTHS[2]),
      celulaResumo(
        somaAlmoco > 0
          ? texto(String(somaAlmoco), { bold: true, color: CORES.branco, size: 17 })
          : texto("-", { color: CORES.branco, size: 17 }),
        COL_WIDTHS[3]
      ),
      celulaResumo([
        texto(`${percApos14h}%`, { bold: true, color: alertaApos14h ? CORES.vermelhoClaro : CORES.branco, size: 17 }),
        texto(` (${somaApos14h}/${somaApos14hTotal})`, { size: 15, color: CORES.branco }),
      ], COL_WIDTHS[4]),
      celulaResumo([
        texto(`${percVisitas}%`, { bold: true, color: alertaVisitas ? CORES.vermelhoClaro : CORES.branco, size: 17 }),
        texto(` (${somaVisitas}/${somaVisitasTotal})`, { size: 15, color: CORES.branco }),
      ], COL_WIDTHS[5]),
      celulaResumo([
        texto(`${percRelampago}%`, { bold: true, color: alertaRelampago ? CORES.vermelhoClaro : CORES.branco, size: 17 }),
        texto(` (${somaRelampago}/${somaBrutas})`, { size: 15, color: CORES.branco }),
      ], COL_WIDTHS[6]),
    ]
  });
}

function construirTabelaRevenda(vendedores: any[]) {
  const vendedoresOrdenados = [...vendedores].sort((a, b) => {
    const idA = a.vendedor && !isNaN(parseInt(a.vendedor, 10)) ? parseInt(a.vendedor, 10) : 0;
    const idB = b.vendedor && !isNaN(parseInt(b.vendedor, 10)) ? parseInt(b.vendedor, 10) : 0;
    return idA - idB;
  });

  const linhas = vendedoresOrdenados.map((v, i) => linhaVendedor(v, i % 2 === 1));

  return new Table({
    width: { size: LARGURA_TABELA, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows: [linhaHeader(), ...linhas, linhaResumo(vendedoresOrdenados)],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser HTML → docx paragraphs (para o conteúdo do editor de análise)
// ─────────────────────────────────────────────────────────────────────────────

function nodeParaRuns(node: Node): TextRun[] {
  const runs: TextRun[] = [];

  function processar(n: Node, bold = false, italic = false, underline = false, highlight = false) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent || "";
      if (t) runs.push(new TextRun({
        text: t,
        font: "Arial",
        size: 20,
        bold,
        italics: italic,
        underline: underline ? { type: "single" } : undefined,
        highlight: highlight ? "yellow" : undefined,
        color: CORES.preto,
      }));
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const isBold = bold || tag === "b" || tag === "strong";
    const isItalic = italic || tag === "i" || tag === "em";
    const isUnderline = underline || tag === "u";
    const isHighlight = highlight || tag === "mark";
    for (const child of Array.from(el.childNodes)) {
      processar(child, isBold, isItalic, isUnderline, isHighlight);
    }
  }

  processar(node);
  return runs;
}

function htmlParaParagrafos(html: string): Paragraph[] {
  if (!html || !html.trim()) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstChild as HTMLElement;
  if (!container) return [];

  const paragrafos: Paragraph[] = [];

  function processarNo(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || "").trim();
      if (t) paragrafos.push(new Paragraph({
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: t, font: "Arial", size: 20, color: CORES.preto })],
      }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "h2") {
      const runs = nodeParaRuns(el);
      if (runs.length) paragrafos.push(new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [new TextRun({ text: el.textContent || "", font: "Arial", size: 22, bold: true, color: CORES.verdeTitulo })],
      }));
    } else if (tag === "ul" || tag === "ol") {
      const isOrdered = tag === "ol";
      Array.from(el.querySelectorAll("li")).forEach((li, idx) => {
        const bullet = isOrdered ? `${idx + 1}. ` : "\u2022 ";
        const runs = nodeParaRuns(li);
        const children = runs.length
          ? [new TextRun({ text: bullet, font: "Arial", size: 20, color: CORES.preto }), ...runs]
          : [new TextRun({ text: bullet + (li.textContent || ""), font: "Arial", size: 20, color: CORES.preto })];
        paragrafos.push(new Paragraph({ spacing: { before: 0, after: 60 }, indent: { left: 360 }, children }));
      });
    } else if (tag === "p" || tag === "div" || tag === "br") {
      const runs = nodeParaRuns(el);
      if (runs.length) {
        paragrafos.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: runs }));
      } else if (el.childNodes.length > 0) {
        Array.from(el.childNodes).forEach(processarNo);
      }
    } else {
      // inline ou outros: tenta criar parágrafo com os runs
      const runs = nodeParaRuns(el);
      if (runs.length) paragrafos.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: runs }));
    }
  }

  Array.from(container.childNodes).forEach(processarNo);
  return paragrafos;
}

function criarLegenda() {
  const itens = [
    { rotulo: "12:15 a 13:45", desc: "Qtd. de clientes visitados no horário de almoço" },
    { rotulo: "Após as 14h", desc: "% de visitas após as 14h (vermelho se < 25%)" },
    { rotulo: "Visitas", desc: "Clientes visitados dentro do raio de 300m / total da carteira" },
    { rotulo: "Visitas Relâmpagos", desc: "% de visitas com duração < 3 min dentro do raio (vermelho se > 10%)" },
  ];

  return itens.map((item, i) => new Paragraph({
    spacing: { before: 0, after: i < itens.length - 1 ? 80 : 400 },
    children: [
      texto(item.rotulo, { size: 16, bold: true, color: CORES.verdeTitulo }),
      texto(`: ${item.desc}`, { size: 16, color: "595959" }),
    ],
  }));
}

export async function generateWordReport(
  groupedData: Record<string, any[]>,
  revendas: string[],
  dataInicio: string,
  dataFim: string,
  analises?: Record<string, string>   // { revenda: htmlString }
) {
  const todasSecoes: any[] = [];

  let dataMapeada = "";
  if (dataInicio && dataFim && dataInicio !== dataFim) {
    const i = dataInicio.split("-").reverse().join("/");
    const f = dataFim.split("-").reverse().join("/");
    dataMapeada = `${i} a ${f}`;
  } else if (dataInicio) {
    dataMapeada = dataInicio.split("-").reverse().join("/");
  } else {
    dataMapeada = new Date().toLocaleDateString("pt-BR");
  }

  todasSecoes.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
    children: [
      new TextRun({
        text: "RELATÓRIO GERENCIAL DE ROTAS E VISITAS - " + dataMapeada,
        bold: true,
        size: 32,
        color: CORES.verdeTitulo
      })
    ]
  }));

  const dataHoje = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  todasSecoes.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600 },
    children: [
      new TextRun({
        text: `Gerado em: ${dataHoje}`,
        italics: true,
        size: 15,
        color: "#595959"
      })
    ]
  }));

  todasSecoes.push(...criarLegenda());

  revendas.forEach(revenda => {
    todasSecoes.push(new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [texto(revenda.toUpperCase(), { bold: true, size: 26, color: CORES.verdeTitulo })]
    }));

    todasSecoes.push(new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [texto("Detalhamento da jornada de trabalho, cobertura de clientes e qualidade dos atendimentos. ", { size: 18 })]
    }));

    todasSecoes.push(construirTabelaRevenda(groupedData[revenda]));

    // Análise do gestor (se houver)
    const htmlAnalise = analises?.[revenda]?.trim();
    if (htmlAnalise) {
      const paras = htmlParaParagrafos(htmlAnalise);
      if (paras.length) {
        todasSecoes.push(paragrafo(texto(" "), { after: 80 }));
        todasSecoes.push(...paras);
      }
    }

    todasSecoes.push(paragrafo(texto(" "), { after: 200 }));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children: todasSecoes
    }]
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Relatorio_${dataMapeada.replace(/\//g, "-").replace(/\s/g, "_")}.docx`;
  saveAs(blob, fileName);
}
