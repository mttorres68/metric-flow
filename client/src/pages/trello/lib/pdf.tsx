import { formatDate, parseEmojis } from "./helpers";

export async function exportarPDF(data: any[], dataAtual: string) {
  const { pdf, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");

  const styles = StyleSheet.create({
    page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
    header: { marginBottom: 16, borderBottom: "1 solid #e2e8f0", paddingBottom: 10 },
    title: { fontSize: 18, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
    subtitle: { fontSize: 10, color: "#64748b" },
    revendaBlock: { marginBottom: 16 },
    revendaHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      backgroundColor: "#f1f5f9", padding: "6 8", borderRadius: 4, marginBottom: 6,
    },
    revendaTitle: { fontSize: 11, fontWeight: "bold", color: "#334155" },
    revendaBadge: { fontSize: 9, color: "#ef4444", fontWeight: "bold" },
    card: {
      border: "1 solid #e2e8f0", borderRadius: 4, padding: "6 8",
      marginBottom: 6, backgroundColor: "#fff",
    },
    cardTitle: { fontSize: 9, fontWeight: "bold", color: "#1e293b", marginBottom: 3 },
    cardMeta: { flexDirection: "row", gap: 12, marginBottom: 2 },
    metaLabel: { fontSize: 8, color: "#64748b" },
    metaValue: { fontSize: 8, color: "#334155" },
    alertRed: { color: "#ef4444", fontWeight: "bold" },
    comentariosHeader: { fontSize: 7.5, color: "#6366f1", fontWeight: "bold", marginTop: 5, marginBottom: 3 },
    comentarioBox: {
      backgroundColor: "#f8fafc", border: "1 solid #e2e8f0",
      borderRadius: 3, padding: "4 6", marginBottom: 3,
    },
    comentarioAutor: { fontSize: 7.5, fontWeight: "bold", color: "#334155" },
    comentarioData: { fontSize: 7, color: "#94a3b8" },
    comentarioTexto: { fontSize: 7.5, color: "#475569", marginTop: 2, lineHeight: 1.4 },
    footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTop: "1 solid #e2e8f0", paddingTop: 6 },
    footerText: { fontSize: 7, color: "#94a3b8", textAlign: "center" },
    noCards: { fontSize: 8, color: "#22c55e", fontStyle: "italic", padding: "4 0" },
    erroBlock: { fontSize: 8, color: "#ef4444", fontStyle: "italic", padding: "4 0" },
  });

  const totalAtraso = data.reduce((s, r) => s + r.totalAtraso, 0);

  const doc = (
    <Document title={`Relatório Trello — Cards em Atraso — ${dataAtual}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Relatório — Cards em Atraso no Trello</Text>
          <Text style={styles.subtitle}>
            Data de geração: {dataAtual}   |   Total de cards em atraso: {totalAtraso}
          </Text>
        </View>

        {data.map((revenda) => (
          <View key={revenda.revenda} style={styles.revendaBlock} wrap={false}>
            <View style={styles.revendaHeader}>
              <Text style={styles.revendaTitle}>{revenda.revenda}</Text>
              <Text style={styles.revendaBadge}>
                {revenda.erro
                  ? "⚠ Erro ao carregar"
                  : revenda.totalAtraso === 0
                    ? "✓ Em dia"
                    : `${revenda.totalAtraso} em atraso`}
              </Text>
            </View>

            {revenda.erro && <Text style={styles.erroBlock}>{revenda.erro}</Text>}
            {!revenda.erro && revenda.cards.length === 0 && (
              <Text style={styles.noCards}>Nenhum card em atraso. Revenda em dia!</Text>
            )}
            {!revenda.erro &&
              revenda.cards.map((card: any) => (
                <View key={card.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{card.nome}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={styles.metaLabel}>Prazo: <Text style={styles.metaValue}>{formatDate(card.due)}</Text></Text>
                    <Text style={styles.metaLabel}>
                      Atraso: <Text style={[styles.metaValue, card.diasAtraso >= 7 ? styles.alertRed : {}]}>{card.diasAtraso} dia(s)</Text>
                    </Text>
                    <Text style={styles.metaLabel}>Lista: <Text style={styles.metaValue}>{card.lista}</Text></Text>
                  </View>
                  {card.membros.length > 0 && (
                    <Text style={styles.metaLabel}>Responsáveis: <Text style={styles.metaValue}>{card.membros.join(", ")}</Text></Text>
                  )}
                  {card.etiquetas.length > 0 && (
                    <Text style={styles.metaLabel}>Etiquetas: <Text style={styles.metaValue}>{card.etiquetas.map((e: any) => e.nome || e.cor).join(", ")}</Text></Text>
                  )}
                  {card.comentarios?.length > 0 && (
                    <View>
                      <Text style={styles.comentariosHeader}>
                        Comentários ({card.comentarios.length})
                      </Text>
                      {card.comentarios.map((c: any) => (
                        <View key={c.id} style={styles.comentarioBox}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={styles.comentarioAutor}>{c.autor}</Text>
                            <Text style={styles.comentarioData}>
                              {new Date(c.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                          <Text style={styles.comentarioTexto}>{parseEmojis(c.texto)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
          </View>
        ))}
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-trello-atraso-${dataAtual.replace(/\//g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
