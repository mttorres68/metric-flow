/**
 * MetricFlow — PDF Report Service
 *
 * Gera relatórios em PDF por revenda com duas páginas:
 *   - Página 1: tabela de vendedores (mesmo padrão do Word) + análise do gestor
 *   - Página 2: tabela de GAs / Rota Coaching + análise do gestor
 *
 * Usa @react-pdf/renderer v4 (server-side rendering, sem necessidade de browser).
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface VendedorRow {
  vendedor: string;
  hrInicio: string;
  hrFim: string;
  visitasAlmoco: number;
  percTarde: number;
  visitasTarde: number;
  visitasBrutasRaio: number;
  percCobertura: number;
  visitasUnicasRaio: number;
  totalCarteira: number;
  percCurtas: number;
  curtasCount: number;
}

export interface CoachingRecord {
  gaId: string;
  ga: string;
  atividade?: string;
  codVendedor?: string;
  status: string;
  pdvsProg: number;
  pdvsVis: number;
  gaVis: number;
  conformidade_pct: number;
}

export interface CoachingKPIs {
  ok: number;
  parcial: number;
  nok: number;
  total: number;
  taxa: number;
  registros: CoachingRecord[];
}

export interface PDFReportData {
  revenda: string;
  data: string;
  vendedoresRows: VendedorRow[];
  coachingKPIs: CoachingKPIs;
  analiseVendedores: string; // HTML — será convertido para texto plano
  analiseGAs: string;        // HTML — será convertido para texto plano
}

// ---------------------------------------------------------------------------
// Cores (baseadas no Word)
// ---------------------------------------------------------------------------

const VERDE_TITULO = "#205527";
const VERDE_RESUMO = "#009900";
const VERMELHO = "#CC2200";
const CINZA_CLARO = "#F2F2F2";
const TEXTO_NORMAL = "#121212";
const TEXTO_BRANCO = "#FFFFFF";
const MUTED = "#94a3b8";
const BORDER_COLOR = "#D0D0D0";

// Cores de status GA
const COR_OK = "#16a34a";
const COR_PARCIAL = "#d97706";
const COR_NOK = "#dc2626";
const COR_NA = "#94a3b8";

// ---------------------------------------------------------------------------
// Larguras das colunas — Vendedores (total ≈ 539pt para A4 com padding 28)
// ---------------------------------------------------------------------------

const CV = {
  vend: 90,
  ini: 60,
  fim: 60,
  almoco: 58,
  tarde: 84,
  vis: 84,
  relamp: 103,
} as const;

// Larguras das colunas — GAs
const CG = {
  ga: 45,
  atividade: 90,
  codVend: 48,
  status: 68,
  pdvProg: 52,
  gaVis: 50,
  pdvVis: 50,
  conf: 76,
} as const;

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    padding: 0,
  },
  // Cabeçalho da página
  pageHeader: {
    backgroundColor: VERDE_TITULO,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  pageHeaderTitle: {
    color: TEXTO_BRANCO,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  pageHeaderMeta: {
    color: "#a8d4b8",
    fontSize: 8,
    marginTop: 3,
  },
  // Corpo
  content: {
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 44,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: VERDE_TITULO,
    marginTop: 14,
    marginBottom: 2,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectionSubTitle: {
    fontSize: 8,
    fontFamily: "Helvetica",
    color: TEXTO_NORMAL,
    letterSpacing: 0.7,
    paddingBottom: 3,
  },
  // Tabela — linhas
  tblHeaderRow: {
    flexDirection: "row",
    backgroundColor: VERDE_TITULO,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: VERDE_TITULO,
  },
  tblRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  tblRowAlt: {
    flexDirection: "row",
    backgroundColor: CINZA_CLARO,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  tblResumoRow: {
    flexDirection: "row",
    backgroundColor: VERDE_RESUMO,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  // Células
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: TEXTO_BRANCO,
    textAlign: "center",
  },
  td: {
    fontSize: 7.5,
    color: TEXTO_NORMAL,
    textAlign: "center",
  },
  tdAlert: {
    fontSize: 7.5,
    color: VERMELHO,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  tdResumo: {
    fontSize: 7.5,
    color: TEXTO_BRANCO,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  // Análise do gestor
  analysisBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 10,
    marginTop: 6,
    minHeight: 60,
    backgroundColor: "#fafafa",
  },
  analysisText: {
    fontSize: 8.5,
    color: "#334155",
    lineHeight: 1.6,
  },
  analysisEmpty: {
    fontSize: 8.5,
    color: MUTED,
    fontFamily: "Helvetica-Oblique",
    lineHeight: 1.6,
  },
  // Legenda
  legendRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  legendLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: VERDE_TITULO,
    width: 105,
  },
  legendDesc: {
    fontSize: 7.5,
    color: "#595959",
    flex: 1,
  },
  // Rodapé
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
  },
  footerText: {
    fontSize: 6.5,
    color: MUTED,
  },
  // Caixa vazia
  emptyBox: {
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: "#f8fafc",
  },
  emptyText: {
    fontSize: 8,
    color: MUTED,
    fontFamily: "Helvetica-Oblique",
  },
});

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Remove tags HTML, retornando texto simples para o PDF. */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtPct(v: number, decimals = 0): string {
  return `${v.toFixed(decimals)}%`;
}

function corIni(hrInicio: string): boolean {
  // Retorna true (alerta) se fora do range 07:30-08:45
  if (!hrInicio || hrInicio === "ND") return false;
  const [h, m] = hrInicio.split(":").map(Number);
  const min = h * 60 + (m || 0);
  return min < 7 * 60 + 30 || min > 8 * 60 + 45;
}

function mediaHora(rows: VendedorRow[], campo: "hrInicio" | "hrFim"): string {
  const minutos = rows
    .map(v => v[campo])
    .filter(h => h && h !== "ND")
    .map(h => { const [hr, mn] = h.split(":").map(Number); return hr * 60 + (mn || 0); });
  if (!minutos.length) return "ND";
  const media = Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length);
  return `${String(Math.floor(media / 60)).padStart(2, "0")}:${String(media % 60).padStart(2, "0")}`;
}

function statusColor(s: string): string {
  switch (s?.toLowerCase()) {
    case "ok": return COR_OK;
    case "partial": case "parcial": return COR_PARCIAL;
    case "nok": return COR_NOK;
    default: return COR_NA;
  }
}

function statusLabel(s: string): string {
  switch (s?.toLowerCase()) {
    case "ok": return "Completo";
    case "partial": case "parcial": return "Parcial";
    case "nok": return "Não Realizado";
    case "na": return "N/A";
    default: return s ?? "—";
  }
}

// ---------------------------------------------------------------------------
// Rodapé fixo
// ---------------------------------------------------------------------------

const FooterBar = ({ data, revenda }: { data: string; revenda: string }) => (
  <View style={s.footer} fixed>
    <Text style={s.footerText}>
      MetricFlow · {revenda} · {fmtDate(data)} · Gerado em {new Date().toLocaleDateString("pt-BR")}
    </Text>
    <Text
      style={s.footerText}
      render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`}
    />
  </View>
);

// ---------------------------------------------------------------------------
// Página 1 — Vendedores (mesmo padrão do Word)
// ---------------------------------------------------------------------------

const LEGENDA_VEND = [
  { desc: "Todas as informações consideradas são referentes ao atendimento realizado dentro do raio de 300m" },
  { label: "Início", desc: "Fora de conformidade início > 08:45" },
  { label: "12:15 a 13:45", desc: "Qtd. de clientes visitados no horário de almoço" },
  { label: "Após às 14h", desc: "% de visitas após as 14h (vermelho se < 25%)" },
  { label: "Visitas", desc: "Clientes visitados dentro do raio de 300m / total da carteira (vermelho se < 100%)" },
  { label: "Visitas Relâmpago", desc: "% de visitas com duração < 3 min dentro do raio (vermelho se > 10%)" },
];

const PaginaVendedores = ({ d }: { d: PDFReportData }) => {
  const rows = d.vendedoresRows;

  // Linha "Geral" — resumo
  const somaAlmoco = rows.reduce((a, r) => a + r.visitasAlmoco, 0);
  const somaTarde = rows.reduce((a, r) => a + r.visitasTarde, 0);
  const somaTardeT = rows.reduce((a, r) => a + r.visitasBrutasRaio, 0);
  const percTardeG = somaTardeT > 0 ? (somaTarde / somaTardeT) * 100 : 0;
  const somaVis = rows.reduce((a, r) => a + r.visitasUnicasRaio, 0);
  const somaVisT = rows.reduce((a, r) => a + r.totalCarteira, 0);
  const percVisG = somaVisT > 0 ? (somaVis / somaVisT) * 100 : 0;
  const somaRelamp = rows.reduce((a, r) => a + r.curtasCount, 0);
  const somaRelampT = rows.reduce((a, r) => a + r.visitasUnicasRaio, 0);
  const percRelampG = somaRelampT > 0 ? (somaRelamp / somaRelampT) * 100 : 0;

  const analise = stripHtml(d.analiseVendedores);

  return (
    <Page size="A4" style={s.page}>
      <View style={s.pageHeader}>
        <Text style={s.pageHeaderTitle}>Relatório Gerencial de Rotas e Visitas</Text>
        <Text style={s.pageHeaderMeta}>
          Revenda: {d.revenda} · Data: {fmtDate(d.data)} - 16:45
        </Text>
      </View>

      <View style={s.content}>
        {/* Legenda */}
        <Text style={s.sectionTitle}>Legenda</Text>
        {LEGENDA_VEND.map((item, i) => (
          <View key={i} style={s.legendRow}>
            <Text style={s.legendLabel}>{item.label}</Text>
            <Text style={s.legendDesc}>{item.desc}</Text>
          </View>
        ))}

        {/* Tabela de vendedores */}
        <Text style={s.sectionTitle}>Detalhamento por Vendedor</Text>
        <Text style={s.sectionSubTitle}>Detalhamento da jornada de trabalho, cobertura de clientes e qualidade dos atendimentos.</Text>

        {rows.length > 0 ? (
          <View>
            {/* Header */}
            <View style={s.tblHeaderRow}>
              <Text style={[s.th, { width: CV.vend }]}>Vendedor</Text>
              <Text style={[s.th, { width: CV.ini }]}>Início</Text>
              <Text style={[s.th, { width: CV.fim }]}>Fim</Text>
              <Text style={[s.th, { width: CV.almoco }]}>12:15{"\n"}13:45</Text>
              <Text style={[s.th, { width: CV.tarde }]}>Após às 14h</Text>
              <Text style={[s.th, { width: CV.vis }]}>Visitas</Text>
              <Text style={[s.th, { width: CV.relamp }]}>Visitas Relâmpago</Text>
            </View>

            {/* Linhas de vendedores */}
            {rows.map((v, i) => {
              const rowStyle = i % 2 === 1 ? s.tblRowAlt : s.tblRow;
              const iniAlerta = corIni(v.hrInicio);
              const tardeAlerta = v.percTarde < 25;
              const visAlerta = v.percCobertura < 100;
              const relampAlerta = v.percCurtas > 10;

              return (
                <View key={i} style={rowStyle}>
                  <Text style={[s.td, { width: CV.vend }]}>{v.vendedor.replace(/^V0*/, "")}</Text>
                  <Text style={[iniAlerta ? s.tdAlert : s.td, { width: CV.ini }]}>
                    {v.hrInicio || "ND"}
                  </Text>
                  <Text style={[s.td, { width: CV.fim }]}>{v.hrFim || "ND"}</Text>
                  <Text style={[v.visitasAlmoco > 0 ? s.tdAlert : s.td, { width: CV.almoco }]}>
                    {v.visitasAlmoco > 0 ? String(v.visitasAlmoco) : "-"}
                  </Text>
                  <Text style={[tardeAlerta ? s.tdAlert : s.td, { width: CV.tarde }]}>
                    {fmtPct(v.percTarde)} ({v.visitasTarde}/{v.visitasBrutasRaio})
                  </Text>
                  <Text style={[visAlerta ? s.tdAlert : s.td, { width: CV.vis }]}>
                    {fmtPct(v.percCobertura)} ({v.visitasUnicasRaio}/{v.totalCarteira})
                  </Text>
                  <Text style={[relampAlerta ? s.tdAlert : s.td, { width: CV.relamp }]}>
                    {fmtPct(v.percCurtas)} ({v.curtasCount}/{v.visitasUnicasRaio})
                  </Text>
                </View>
              );
            })}

            {/* Linha Geral */}
            <View style={s.tblResumoRow}>
              <Text style={[s.tdResumo, { width: CV.vend }]}>Geral</Text>
              <Text style={[s.tdResumo, { width: CV.ini }]}>{mediaHora(rows, "hrInicio")}</Text>
              <Text style={[s.tdResumo, { width: CV.fim }]}>{mediaHora(rows, "hrFim")}</Text>
              <Text style={[s.tdResumo, { width: CV.almoco }]}>
                {somaAlmoco > 0 ? String(somaAlmoco) : "-"}
              </Text>
              <Text style={[s.tdResumo, { width: CV.tarde }]}>
                {fmtPct(percTardeG)} ({somaTarde}/{somaTardeT})
              </Text>
              <Text style={[s.tdResumo, { width: CV.vis }]}>
                {fmtPct(percVisG)} ({somaVis}/{somaVisT})
              </Text>
              <Text style={[s.tdResumo, { width: CV.relamp }]}>
                {fmtPct(percRelampG)} ({somaRelamp}/{somaRelampT})
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>Sem dados de vendedores para esta data.</Text>
          </View>
        )}

        {/* Análise do gestor */}
        <Text style={s.sectionTitle}>Análise — Vendedores</Text>
        <View style={s.analysisBox}>
          {analise ? (
            <Text style={s.analysisText}>{analise}</Text>
          ) : (
            <Text style={s.analysisEmpty}></Text>
          )}
        </View>
      </View>

      <FooterBar data={d.data} revenda={d.revenda} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Página 2 — GAs / Rota Coaching
// ---------------------------------------------------------------------------

const PaginaGAs = ({ d }: { d: PDFReportData }) => {
  const { coachingKPIs: ck } = d;
  const analise = stripHtml(d.analiseGAs);

  // Linha Geral GAs
  const somaConf = ck.registros.reduce((a, r) => a + (r.conformidade_pct ?? 0), 0);
  const percConfG = ck.registros.length > 0 ? somaConf / ck.registros.length : 0;
  const somaPdvProg = ck.registros.reduce((a, r) => a + r.pdvsProg, 0);
  const somaGaVis = ck.registros.reduce((a, r) => a + r.gaVis, 0);
  const somaPdvVis = ck.registros.reduce((a, r) => a + r.pdvsVis, 0);

  return (
    <Page size="A4" style={s.page}>
      <View style={s.pageHeader}>
        <Text style={s.pageHeaderTitle}>Relatório de Rota Coaching — GAs</Text>
        <Text style={s.pageHeaderMeta}>
          Revenda: {d.revenda} · Data: {fmtDate(d.data)}
        </Text>
      </View>

      <View style={s.content}>
        {/* Tabela de GAs */}
        <Text style={s.sectionTitle}>Detalhamento por GA</Text>

        {ck.registros.length > 0 ? (
          <View>
            {/* Header */}
            <View style={s.tblHeaderRow}>
              <Text style={[s.th, { width: CG.ga }]}>GA</Text>
              <Text style={[s.th, { width: CG.atividade, textAlign: "left" }]}>Atividade</Text>
              <Text style={[s.th, { width: CG.codVend }]}>Cod.{"\n"}Vendedor</Text>
              <Text style={[s.th, { width: CG.status }]}>Status</Text>
              <Text style={[s.th, { width: CG.pdvProg }]}>PDVs Carteira</Text>
              <Text style={[s.th, { width: CG.gaVis }]}>Vis. GA</Text>
              <Text style={[s.th, { width: CG.pdvVis }]}>Vis. Vendedor</Text>
              <Text style={[s.th, { width: CG.conf }]}>Conformidade</Text>
            </View>

            {/* Linhas de GAs */}
            {ck.registros.map((r, i) => {
              const rowStyle = i % 2 === 1 ? s.tblRowAlt : s.tblRow;
              return (
                <View key={i} style={rowStyle}>
                  <Text style={[s.td, { width: CG.ga }]}>{r.gaId || r.ga}</Text>
                  <Text style={[s.td, { width: CG.atividade, textAlign: "left" }]}>{r.atividade || "—"}</Text>
                  <Text style={[s.td, { width: CG.codVend }]}>{r.codVendedor || "—"}</Text>
                  <Text style={[s.td, { width: CG.status, color: statusColor(r.status) }]}>
                    {statusLabel(r.status)}
                  </Text>
                  <Text style={[s.td, { width: CG.pdvProg }]}>{r.pdvsProg ?? "—"}</Text>
                  <Text style={[s.td, { width: CG.gaVis }]}>{r.gaVis ?? "—"}</Text>
                  <Text style={[s.td, { width: CG.pdvVis }]}>{r.pdvsVis ?? "—"}</Text>

                  // SE MENOR QUE 80% FUNDO AMARELO TEXTO BRANCO
                  // SE MAIOR OU IGUAL A 80% FUNDO VERDE TEXTO BRANCO
                  // ESTÁ FICANDO VERDE COM 52% DE CONFORMIDADE E NÃO PODE, SOMENTE ACIMA OU IGUAL A 80%
                  <Text style={[s.td, { width: CG.conf, backgroundColor: r.conformidade_pct < 80 ? "#ff0" : "#0f0", color: "#1f1f1f", fontWeight: "bold" }]}>
                    {r.conformidade_pct != null ? fmtPct(r.conformidade_pct, 1) : "—"}
                  </Text>
                </View>
              );
            })}

            {/* Linha Geral */}
            <View style={s.tblResumoRow}>
              <Text style={[s.tdResumo, { width: CG.ga }]}>Geral</Text>
              <Text style={[s.tdResumo, { width: CG.atividade }]}>—</Text>
              <Text style={[s.tdResumo, { width: CG.codVend }]}>—</Text>
              <Text style={[s.tdResumo, { width: CG.status }]}>
                —
              </Text>
              <Text style={[s.tdResumo, { width: CG.pdvProg }]}>{somaPdvProg}</Text>
              <Text style={[s.tdResumo, { width: CG.gaVis }]}>{somaGaVis}</Text>
              <Text style={[s.tdResumo, { width: CG.pdvVis }]}>{somaPdvVis}</Text>
              {/* <Text style={[s.tdResumo, { width: CG.conf }]}>{fmtPct(percConfG, 1)}</Text> */}
            </View>
          </View>
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>Sem dados de rota coaching para esta revenda / data.</Text>
          </View>
        )}

        {/* Análise do gestor */}
        <Text style={s.sectionTitle}>Análise — GAs</Text>
        <View style={s.analysisBox}>
          {analise ? (
            <Text style={s.analysisText}>{analise}</Text>
          ) : (
            <Text style={s.analysisEmpty}></Text>
          )}
        </View>
      </View>

      <FooterBar data={d.data} revenda={d.revenda} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Documento completo (2 páginas)
// ---------------------------------------------------------------------------

const RelatorioRevenda = ({ d }: { d: PDFReportData }) => (
  <Document
    title={`Relatório ${d.revenda} — ${fmtDate(d.data)}`}
    author="MetricFlow"
    creator="MetricFlow"
  >
    <PaginaVendedores d={d} />
    <PaginaGAs d={d} />
  </Document>
);

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Gera o buffer PDF para uma revenda específica.
 * O buffer pode ser enviado diretamente como resposta HTTP ou adicionado a um ZIP.
 */
export async function gerarPDFRevenda(data: PDFReportData): Promise<Buffer> {
  const element = React.createElement(
    RelatorioRevenda,
    { d: data }
  ) as React.ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
