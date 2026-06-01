import { type WaTemplate } from "@/hooks/useWaTemplate";

export const VARIAVEIS: Record<keyof WaTemplate, { label: string; vars: string[] }> = {
  cabecalho:    { label: "Cabeçalho",     vars: ["{revenda}", "{data}"] },
  tituloHoje:   { label: "Título Hoje",   vars: ["{data}", "{data_hoje}"] },
  tituloAmanha: { label: "Título Amanhã", vars: ["{data}", "{data_amanha}"] },
  linhaCard:    { label: "Linha de card", vars: ["{nome}", "{lista}", "{hora}", "{membros}"] },
  rodape:       { label: "Rodapé",        vars: [] },
};

export const SAMPLE = {
  revenda: "Duttra FL",
  hoje: [
    { nome: "Reunião de alinhamento", due: new Date().toISOString(), lista: "Em andamento", membros: ["João", "Maria"], etiquetas: [] },
  ],
  amanha: [
    { nome: "Visita ao cliente", due: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString(); })(), lista: "Planejado", membros: ["Carlos"], etiquetas: [] },
  ],
};

export function aplicarVars(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function gerarMensagemWhatsApp(
  revenda: string,
  hoje: any[],
  amanha: any[],
  template: WaTemplate,
): string {
  const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dataAmanha = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  })();

  let msg = aplicarVars(template.cabecalho, { revenda, data: dataHoje }) + "\n";

  if (hoje.length > 0) {
    msg += "\n" + aplicarVars(template.tituloHoje, { data: dataHoje, data_hoje: dataHoje }) + "\n";
    for (const card of hoje) {
      const hora = new Date(card.due).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const membros = card.membros.length > 0 ? ` | ${card.membros.join(", ")}` : "";
      msg += aplicarVars(template.linhaCard, { nome: card.nome, lista: card.lista, hora, membros }) + "\n";
    }
  }

  if (amanha.length > 0) {
    msg += "\n" + aplicarVars(template.tituloAmanha, { data: dataAmanha, data_amanha: dataAmanha }) + "\n";
    for (const card of amanha) {
      const hora = new Date(card.due).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const membros = card.membros.length > 0 ? ` | ${card.membros.join(", ")}` : "";
      msg += aplicarVars(template.linhaCard, { nome: card.nome, lista: card.lista, hora, membros }) + "\n";
    }
  }

  if (hoje.length === 0 && amanha.length === 0) {
    msg += "\nNenhuma atividade programada para hoje ou amanhã.";
  }

  msg += "\n" + template.rodape;
  return msg;
}
