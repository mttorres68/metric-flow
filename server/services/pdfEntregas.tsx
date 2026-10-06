/**
 * MetricFlow — Relatório Gerencial de Entregas (PDF, A4 paisagem)
 *   - Página 1: uma linha por placa · motorista · dia + linha Geral + análise + avisos
 *   - Página 2: exceções (baixas que o GPS não confirma)
 * Mesmo visual do relatório de vendas: estilos importados de pdfService.
 */
import React from "react";
import { Document, Page, Text, View, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { s, FooterBar, VERDE_TITULO, VERMELHO, fmtDate, fmtPct, stripHtml, renderAnalise } from "./pdfService";
import { excecoes, type ResultadoLinha, type Status } from "./entregas/cruzar";
import { LIMITES, horaBRT, minParaHM } from "@shared/entregas";

export interface PDFEntregasData {
  data: string; // "aaaa-mm-dd"
  linhas: ResultadoLinha[];
  analise: string; // texto ou HTML
  avisos: string[];
}

// Larguras — A4 paisagem (842pt − 2×28 de padding ≈ 786pt)
const C = { placa: 155, saida: 45, retorno: 45, entregas: 55, tarde: 75, raio: 75, semParada: 55, relamp: 75, semCliente: 80, km: 45, pend: 80 } as const;
const CE = { placa: 150, cliente: 220, cod: 60, baixa: 50, status: 100, dist: 80, perm: 70 } as const;

const LEGENDA = [
  { desc: `Entregas confirmadas por parada do GPS a até ${LIMITES.raioM}m do cliente` },
  { label: "Saída", desc: `Primeiro movimento do dia (vermelho se > ${LIMITES.saidaAte})` },
  { label: "Retorno", desc: "Último movimento do dia" },
  { label: "Entregas", desc: "Entregues no dia / total de clientes da rota" },
  { label: "Após às 14h", desc: `% das entregas do dia com baixa após as 14h (vermelho se < ${LIMITES.apos14hMinPct}%)` },
  // Sem "≥": a Helvetica padrão do PDF não tem o glifo.
  { label: "No raio", desc: `Baixas com parada de ${LIMITES.relampagoMin} min ou mais no raio / baixas do dia (vermelho se < 100%)` },
  { label: "Sem parada", desc: "Baixas sem nenhuma parada do GPS no raio (vermelho se > 0)" },
  { label: "Relâmpago", desc: `% de paradas no raio com menos de ${LIMITES.relampagoMin} min (vermelho se > ${LIMITES.relampagoMaxPct}%)` },
  { label: "Paradas s/ cliente", desc: `Paradas de ${LIMITES.paradaSemClienteMin} min ou mais longe de todo cliente, entre a saída e o retorno` },
  { label: "Pendentes · Km inf.", desc: "Clientes não atendidos e km do odômetro informado — só no dia em que a rota fecha" },
];

const STATUS_LABEL: Record<Status, string> = {
  no_raio: "No raio", relampago: "Relâmpago", sem_parada: "Baixa sem parada", sem_coordenada: "Sem coordenada",
};

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const hora = (d: Date | null) => (d ? horaBRT(d) : "—");

const PaginaLinhas = ({ d }: { d: PDFEntregasData }) => {
  const ls = d.linhas;
  const gpsOk = ls.filter(r => !r.semGps);
  const soma = (rs: ResultadoLinha[], f: (r: ResultadoLinha) => number) => rs.reduce((a, r) => a + f(r), 0);
  const g = {
    entregas: soma(ls, r => r.entregasDia),
    apos: soma(ls, r => r.apos14h),
    raio: soma(gpsOk, r => r.noRaio),
    baixas: soma(gpsOk, r => r.baixasComCoord),
    semParada: soma(gpsOk, r => r.semParada),
    relamp: soma(gpsOk, r => r.relampago),
    semCliQtd: soma(gpsOk, r => r.paradasSemCliente.qtd),
    semCliMin: soma(gpsOk, r => r.paradasSemCliente.min),
    km: soma(gpsOk, r => r.kmGps ?? 0),
    pend: soma(ls, r => r.pendentes ?? 0),
  };
  const analise = stripHtml(d.analise);

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.pageHeader}>
        <Text style={s.pageHeaderTitle}>Relatório Gerencial de Entregas</Text>
        <Text style={s.pageHeaderMeta}>Data: {fmtDate(d.data)} · Raio: {LIMITES.raioM}m · Fonte: CheckNow × GPS Infleet</Text>
      </View>

      <View style={s.content}>
        <Text style={s.sectionTitle}>Legenda</Text>
        {LEGENDA.map((item, i) => (
          <View key={i} style={s.legendRow}>
            <Text style={s.legendLabel}>{item.label}</Text>
            <Text style={s.legendDesc}>{item.desc}</Text>
          </View>
        ))}

        <Text style={s.sectionTitle}>Detalhamento por Placa / Motorista</Text>
        {ls.length > 0 ? (
          <View>
            <View style={s.tblHeaderRow}>
              <Text style={[s.th, { width: C.placa, textAlign: "left" }]}>Placa · Motorista</Text>
              <Text style={[s.th, { width: C.saida }]}>Saída</Text>
              <Text style={[s.th, { width: C.retorno }]}>Retorno</Text>
              <Text style={[s.th, { width: C.entregas }]}>Entregas</Text>
              <Text style={[s.th, { width: C.tarde }]}>Após às 14h</Text>
              <Text style={[s.th, { width: C.raio }]}>No raio</Text>
              <Text style={[s.th, { width: C.semParada }]}>Sem parada</Text>
              <Text style={[s.th, { width: C.relamp }]}>Relâmpago</Text>
              <Text style={[s.th, { width: C.semCliente }]}>Paradas s/ cliente</Text>
              <Text style={[s.th, { width: C.km }]}>Km GPS</Text>
              <Text style={[s.th, { width: C.pend }]}>Pendentes · Km inf.</Text>
            </View>

            {ls.map((r, i) => {
              const gps = !r.semGps;
              const pTarde = pct(r.apos14h, r.entregasDia);
              const pRaio = pct(r.noRaio, r.baixasComCoord);
              const relBase = r.noRaio + r.relampago;
              const pRel = pct(r.relampago, relBase);
              const saidaAlerta = !!r.saida && horaBRT(r.saida) > LIMITES.saidaAte;
              return (
                <View key={i} style={i % 2 === 1 ? s.tblRowAlt : s.tblRow}>
                  <Text style={[s.td, { width: C.placa, textAlign: "left" }]}>{r.linha.placa} · {r.linha.motorista}</Text>
                  <Text style={[saidaAlerta ? s.tdAlert : s.td, { width: C.saida }]}>{gps ? hora(r.saida) : "—"}</Text>
                  <Text style={[s.td, { width: C.retorno }]}>{gps ? hora(r.retorno) : "—"}</Text>
                  <Text style={[s.td, { width: C.entregas }]}>{r.entregasDia}/{r.totalRota}</Text>
                  <Text style={[r.entregasDia > 0 && pTarde < LIMITES.apos14hMinPct ? s.tdAlert : s.td, { width: C.tarde }]}>
                    {r.entregasDia > 0 ? `${fmtPct(pTarde)} (${r.apos14h}/${r.entregasDia})` : "—"}
                  </Text>
                  <Text style={[gps && r.baixasComCoord > 0 && pRaio < 100 ? s.tdAlert : s.td, { width: C.raio }]}>
                    {gps && r.baixasComCoord > 0 ? `${fmtPct(pRaio)} (${r.noRaio}/${r.baixasComCoord})` : "—"}
                  </Text>
                  <Text style={[gps && r.semParada > 0 ? s.tdAlert : s.td, { width: C.semParada }]}>{gps ? String(r.semParada) : "—"}</Text>
                  <Text style={[gps && pRel > LIMITES.relampagoMaxPct ? s.tdAlert : s.td, { width: C.relamp }]}>
                    {gps && relBase > 0 ? `${fmtPct(pRel)} (${r.relampago}/${relBase})` : "—"}
                  </Text>
                  <Text style={[s.td, { width: C.semCliente }]}>
                    {gps ? `${r.paradasSemCliente.qtd} · ${minParaHM(r.paradasSemCliente.min)}` : "—"}
                  </Text>
                  <Text style={[s.td, { width: C.km }]}>{gps && r.kmGps !== null ? r.kmGps.toFixed(0) : "—"}</Text>
                  <Text style={[r.pendentes ? s.tdAlert : s.td, { width: C.pend }]}>
                    {r.pendentes === null ? "—" : `${r.pendentes} · ${r.kmInformado ?? "—"} km`}
                  </Text>
                </View>
              );
            })}

            <View style={s.tblResumoRow}>
              <Text style={[s.tdResumo, { width: C.placa, textAlign: "left" }]}>Geral</Text>
              <Text style={[s.tdResumo, { width: C.saida }]}>—</Text>
              <Text style={[s.tdResumo, { width: C.retorno }]}>—</Text>
              <Text style={[s.tdResumo, { width: C.entregas }]}>{g.entregas}</Text>
              <Text style={[s.tdResumo, { width: C.tarde }]}>{fmtPct(pct(g.apos, g.entregas))} ({g.apos}/{g.entregas})</Text>
              <Text style={[s.tdResumo, { width: C.raio }]}>{fmtPct(pct(g.raio, g.baixas))} ({g.raio}/{g.baixas})</Text>
              <Text style={[s.tdResumo, { width: C.semParada }]}>{g.semParada}</Text>
              <Text style={[s.tdResumo, { width: C.relamp }]}>{fmtPct(pct(g.relamp, g.raio + g.relamp))} ({g.relamp}/{g.raio + g.relamp})</Text>
              <Text style={[s.tdResumo, { width: C.semCliente }]}>{g.semCliQtd} · {minParaHM(g.semCliMin)}</Text>
              <Text style={[s.tdResumo, { width: C.km }]}>{g.km.toFixed(0)}</Text>
              <Text style={[s.tdResumo, { width: C.pend }]}>{g.pend}</Text>
            </View>
          </View>
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>Sem rotas para esta data.</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Análise — Entregas</Text>
        <View style={s.analysisBox}>
          {analise ? renderAnalise(analise) : <Text style={s.analysisEmpty}></Text>}
        </View>

        {d.avisos.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Avisos</Text>
            {d.avisos.map((a, i) => (
              <Text key={i} style={[s.legendDesc, { color: VERMELHO }]}>{a}</Text>
            ))}
          </View>
        )}
      </View>

      <FooterBar data={d.data} revenda="Entregas" />
    </Page>
  );
};

const PaginaExcecoes = ({ d }: { d: PDFEntregasData }) => {
  const itens = d.linhas.flatMap(r => excecoes(r).map(x => ({ r, x })));
  const semParada = itens.filter(i => i.x.status === "sem_parada").length;

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={{ backgroundColor: VERDE_TITULO, paddingHorizontal: 28, paddingVertical: 13 }}>
        <Text style={s.pageHeaderTitle}>Exceções — Baixas não confirmadas pelo GPS</Text>
        <Text style={s.pageHeaderMeta}>Data: {fmtDate(d.data)} · Raio: {LIMITES.raioM}m</Text>
      </View>

      <View style={s.content}>
        <View style={s.summaryRow}>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Total de exceções</Text>
            <Text style={s.summaryValue}>{itens.length}</Text>
          </View>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Baixas sem parada</Text>
            <Text style={s.summaryValue}>{semParada}</Text>
          </View>
        </View>

        {itens.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>Todas as baixas foram confirmadas pelo GPS nesta data.</Text>
          </View>
        ) : (
          <View>
            <View style={s.tblHeaderRow}>
              <Text style={[s.th, { width: CE.placa, textAlign: "left" }]}>Placa · Motorista</Text>
              <Text style={[s.th, { width: CE.cliente, textAlign: "left" }]}>Cliente</Text>
              <Text style={[s.th, { width: CE.cod }]}>Código</Text>
              <Text style={[s.th, { width: CE.baixa }]}>Baixa</Text>
              <Text style={[s.th, { width: CE.status }]}>Status</Text>
              <Text style={[s.th, { width: CE.dist }]}>Parada mais próxima</Text>
              <Text style={[s.th, { width: CE.perm }]}>Permanência</Text>
            </View>
            {itens.map(({ r, x }, i) => (
              <View key={i} style={i % 2 === 1 ? s.tblRowAlt : s.tblRow}>
                <Text style={[s.td, { width: CE.placa, textAlign: "left" }]}>{r.linha.placa} · {r.linha.motorista}</Text>
                <Text style={[s.td, { width: CE.cliente, textAlign: "left" }]}>{x.entrega.cliente}</Text>
                <Text style={[s.td, { width: CE.cod }]}>{x.entrega.codCliente}</Text>
                <Text style={[s.td, { width: CE.baixa }]}>{hora(x.entrega.baixaEm)}</Text>
                <Text style={[s.tdAlert, { width: CE.status }]}>{STATUS_LABEL[x.status]}</Text>
                <Text style={[s.td, { width: CE.dist }]}>
                  {x.distMaisProximaM === null ? "—" : `${Math.round(x.distMaisProximaM)}m`}
                </Text>
                <Text style={[s.td, { width: CE.perm }]}>{minParaHM(x.permanenciaMin)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <FooterBar data={d.data} revenda="Entregas" />
    </Page>
  );
};

const RelatorioEntregas = ({ d }: { d: PDFEntregasData }) => (
  <Document title={`Entregas — ${fmtDate(d.data)}`} author="MetricFlow" creator="MetricFlow">
    <PaginaLinhas d={d} />
    <PaginaExcecoes d={d} />
  </Document>
);

export async function gerarPDFEntregas(d: PDFEntregasData): Promise<Buffer> {
  const element = React.createElement(RelatorioEntregas, { d }) as React.ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
