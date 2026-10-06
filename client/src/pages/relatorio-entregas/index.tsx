/*
 * MetricFlow — Relatório Gerencial de Entregas
 * Upload da planilha do CheckNow → PDF com o cruzamento das baixas com o GPS (Infleet).
 */
import Sidebar from "@/components/Sidebar";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { blobToBase64 } from "@/pages/analise/lib/pdf";
import { useState } from "react";
import { toast } from "sonner";

export default function RelatorioEntregas() {
  const { isCollapsed } = useSidebarCollapse();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState("");
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    if (!arquivo) return;
    setGerando(true);
    try {
      const resp = await fetch("/api/relatorio-entregas/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xlsxBase64: await blobToBase64(arquivo), analise }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao gerar o relatório");
      }
      const blob = await resp.blob();
      const nome = resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "entregas.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Relatório gerado: ${nome}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activePage="relatorio_entregas" onNavigate={() => {}} />

      <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-60"}`}>
        <header
          className="sticky top-0 z-20 bg-white/90 dark:bg-background/90 backdrop-blur-sm px-8 py-4 border-b border-border"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <h1 className="text-xl text-foreground" style={{ fontWeight: 900 }}>Relatório de Entregas</h1>
          <p className="text-xs text-muted-foreground">
            Cruza as baixas do CheckNow com as paradas do GPS (Infleet), por placa · motorista · dia.
          </p>
        </header>

        <section className="px-8 py-6 max-w-2xl space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-foreground">Planilha do CheckNow (Geracao_Dado_BI.xlsx)</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              className="block text-sm text-foreground"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-foreground">Análise do gestor (opcional)</span>
            <Textarea value={analise} onChange={e => setAnalise(e.target.value)} rows={6} />
          </label>

          <Button onClick={gerar} disabled={!arquivo || gerando}>
            {gerando ? "Gerando…" : "Gerar PDF"}
          </Button>
        </section>
      </main>
    </div>
  );
}
