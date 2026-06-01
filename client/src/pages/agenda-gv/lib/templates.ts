export interface AtividadeTemplate {
  codigo: string;
  nome: string;
  frequencia: "Semanal" | "Mensal";
  regra: string;
  participantes: string[];
  assessmentCode: string;
  duracao: number;
  descricao: string;
  evidencias: string;
}

export const ATIVIDADES_TEMPLATE: AtividadeTemplate[] = [
  // ── Semanais ────────────────────────────────────────────────────────────────
  {
    codigo: "S1", nome: "RPS #1", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente de Área", "Trade", "Analista de Vendas"],
    assessmentCode: "COM10", duracao: 120,
    descricao: "Realizar a RPS conforme orientação, avaliando resultados da semana, planos de ação e próximos passos com a equipe.",
    evidencias: "(1) Planilha RPS ANEXO\n(2) Foto/imagem da reunião (se for remota, print do Teams) ANEXO\n(3) Print do e-mail enviado para todos os participantes ANEXO",
  },
  {
    codigo: "S2", nome: "RPS #2", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente de Área", "Trade", "Analista de Vendas"],
    assessmentCode: "COM10", duracao: 120,
    descricao: "Realizar a RPS conforme orientação, avaliando resultados da semana, planos de ação e próximos passos com a equipe.",
    evidencias: "(1) Planilha RPS ANEXO\n(2) Foto/imagem da reunião (se for remota, print do Teams) ANEXO\n(3) Print do e-mail enviado para todos os participantes ANEXO",
  },
  {
    codigo: "S3", nome: "RPS #3", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente de Área", "Trade", "Analista de Vendas"],
    assessmentCode: "COM10", duracao: 120,
    descricao: "Realizar a RPS conforme orientação, avaliando resultados da semana, planos de ação e próximos passos com a equipe.",
    evidencias: "(1) Planilha RPS ANEXO\n(2) Foto/imagem da reunião (se for remota, print do Teams) ANEXO\n(3) Print do e-mail enviado para todos os participantes ANEXO",
  },
  {
    codigo: "S4", nome: "RPS #4", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente de Área", "Trade", "Analista de Vendas"],
    assessmentCode: "COM10", duracao: 120,
    descricao: "Realizar a RPS conforme orientação, avaliando resultados da semana, planos de ação e próximos passos com a equipe.",
    evidencias: "(1) Planilha RPS ANEXO\n(2) Foto/imagem da reunião (se for remota, print do Teams) ANEXO\n(3) Print do e-mail enviado para todos os participantes ANEXO",
  },
  {
    codigo: "S5", nome: "Status de rota #1", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente de Área"], assessmentCode: "", duracao: 30,
    descricao: "Realizar uma reunião com os Gerentes de Área para tratar das rotas da semana, verificar distorções, discutir planos de ação. Recomenda-se fazer junto da RPS.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams",
  },
  {
    codigo: "S6", nome: "Status de rota #2", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente de Área"], assessmentCode: "", duracao: 30,
    descricao: "Realizar uma reunião com os Gerentes de Área para tratar das rotas da semana, verificar distorções, discutir planos de ação. Recomenda-se fazer junto da RPS.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams",
  },
  {
    codigo: "S7", nome: "Status de rota #3", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente de Área"], assessmentCode: "", duracao: 30,
    descricao: "Realizar uma reunião com os Gerentes de Área para tratar das rotas da semana, verificar distorções, discutir planos de ação. Recomenda-se fazer junto da RPS.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams",
  },
  {
    codigo: "S8", nome: "Status de rota #4", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente de Área"], assessmentCode: "", duracao: 30,
    descricao: "Realizar uma reunião com os Gerentes de Área para tratar das rotas da semana, verificar distorções, discutir planos de ação. Recomenda-se fazer junto da RPS.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams",
  },
  {
    codigo: "S9", nome: "Estoque e puxada #1", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente Administrativo"], assessmentCode: "", duracao: 20,
    descricao: "Realizar reunião avaliando estoque: analisar itens com dias de estoque elevado, perto de validade, em ruptura e definir puxada da semana.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams\n(2) Plano de ação para itens com estoque elevado e perto de validade ANEXO",
  },
  {
    codigo: "S10", nome: "Estoque e puxada #2", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente Administrativo"], assessmentCode: "", duracao: 20,
    descricao: "Realizar reunião avaliando estoque: analisar itens com dias de estoque elevado, perto de validade, em ruptura e definir puxada da semana.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams\n(2) Plano de ação para itens com estoque elevado e perto de validade ANEXO",
  },
  {
    codigo: "S11", nome: "Estoque e puxada #3", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente Administrativo"], assessmentCode: "", duracao: 20,
    descricao: "Realizar reunião avaliando estoque: analisar itens com dias de estoque elevado, perto de validade, em ruptura e definir puxada da semana.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams\n(2) Plano de ação para itens com estoque elevado e perto de validade ANEXO",
  },
  {
    codigo: "S12", nome: "Estoque e puxada #4", frequencia: "Semanal", regra: "Todo sábado",
    participantes: ["Gerente Administrativo"], assessmentCode: "", duracao: 20,
    descricao: "Realizar reunião avaliando estoque: analisar itens com dias de estoque elevado, perto de validade, em ruptura e definir puxada da semana.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams\n(2) Plano de ação para itens com estoque elevado e perto de validade ANEXO",
  },
  // ── Mensais ──────────────────────────────────────────────────────────────────
  {
    codigo: "M1", nome: "Governança comercial #1", frequencia: "Mensal", regra: "Até o dia 10 do mês",
    participantes: ["Diretor", "Gerente de Área", "Trade", "Analista de Vendas"],
    assessmentCode: "ADM07", duracao: 60,
    descricao: "Realizar a governança comercial conforme assessment, apresentando resultados do mês, revisando planos de ação anteriores e definindo novos planos para KPIs fora da meta.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams\n(2) Print/comprovante do e-mail enviado conforme assessment ANEXO",
  },
  {
    codigo: "M2", nome: "Reunião COMPASS e Market Share #1", frequencia: "Mensal", regra: "Início do mês",
    participantes: ["Analista de Vendas", "Trade"], assessmentCode: "COM12 · COM07", duracao: 60,
    descricao: "Realizar reunião de análise da base COMPASS e market share com o time, avaliando posicionamento e oportunidades.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams",
  },
  {
    codigo: "M3", nome: "Reunião coberturas e mapa térmico #1", frequencia: "Mensal", regra: "Início do mês",
    participantes: ["Analista de Vendas"], assessmentCode: "COM18·19·20·21·22·23", duracao: 60,
    descricao: "Realizar reunião de análise de coberturas e mapa térmico, identificando gaps e oportunidades por cidade e segmento.",
    evidencias: "(1) Foto/imagem da reunião, se for remota, print do Teams",
  },
  {
    codigo: "M4", nome: "Treinamento: Rotina básica + EPIs #1", frequencia: "Mensal", regra: "1x por mês",
    participantes: ["Vendedor"], assessmentCode: "COM08", duracao: 30,
    descricao: "Realizar treinamento conforme orientação.",
    evidencias: "(1) Foto/imagem do treinamento, se for remota, print do Teams\n(2) Foto/imagem do print do e-mail enviado com a lista de participantes conforme Assessment",
  },
  {
    codigo: "M5", nome: "Treinamento: PDV simulado #1", frequencia: "Mensal", regra: "2x por mês",
    participantes: ["Vendedor"], assessmentCode: "COM08", duracao: 30,
    descricao: "Realizar treinamento conforme orientação.",
    evidencias: "(1) Foto/imagem do treinamento, se for remota, print do Teams\n(2) Foto/imagem do print do e-mail enviado com a lista de participantes conforme Assessment",
  },
  {
    codigo: "M6", nome: "Treinamento: PDV simulado #2", frequencia: "Mensal", regra: "2x por mês",
    participantes: ["Vendedor"], assessmentCode: "COM08", duracao: 30,
    descricao: "Realizar treinamento conforme orientação.",
    evidencias: "(1) Foto/imagem do treinamento, se for remota, print do Teams\n(2) Foto/imagem do print do e-mail enviado com a lista de participantes conforme Assessment",
  },
  {
    codigo: "M7", nome: "Treinamento: FDS — produto por canal #1", frequencia: "Mensal", regra: "1x por mês",
    participantes: ["Vendedor"], assessmentCode: "COM08", duracao: 30,
    descricao: "Realizar treinamento conforme orientação.",
    evidencias: "(1) Foto/imagem do treinamento, se for remota, print do Teams\n(2) Foto/imagem do print do e-mail enviado com a lista de participantes conforme Assessment",
  },
  {
    codigo: "M8", nome: "Treinamento: Cálculo de margem e mark up #1", frequencia: "Mensal", regra: "1x por mês",
    participantes: ["Vendedor"], assessmentCode: "COM08", duracao: 30,
    descricao: "Realizar treinamento conforme orientação.",
    evidencias: "(1) Foto/imagem do treinamento, se for remota, print do Teams\n(2) Foto/imagem do print do e-mail enviado com a lista de participantes conforme Assessment",
  },
  {
    codigo: "M9", nome: "Treinamento: Foco da operação #1", frequencia: "Mensal", regra: "1x por mês",
    participantes: ["Vendedor"], assessmentCode: "COM08", duracao: 30,
    descricao: "Realizar treinamento conforme orientação.",
    evidencias: "(1) Foto/imagem do treinamento, se for remota, print do Teams\n(2) Foto/imagem do print do e-mail enviado com a lista de participantes conforme Assessment",
  },
  {
    codigo: "M10", nome: "Treinamento promotor: Rotina básica + EPIs #1", frequencia: "Mensal", regra: "1x por mês",
    participantes: ["Promotor"], assessmentCode: "COM09", duracao: 30,
    descricao: "Realizar treinamento conforme orientação.",
    evidencias: "(1) Foto/imagem do treinamento, se for remota, print do Teams\n(2) Foto/imagem do print do e-mail enviado com a lista de participantes conforme Assessment",
  },
  {
    codigo: "M11", nome: "Treinamento promotor: Foco da operação #1", frequencia: "Mensal", regra: "1x por mês",
    participantes: ["Promotor"], assessmentCode: "COM09", duracao: 30,
    descricao: "Realizar treinamento conforme orientação.",
    evidencias: "(1) Foto/imagem do treinamento, se for remota, print do Teams\n(2) Foto/imagem do print do e-mail enviado com a lista de participantes conforme Assessment",
  },
];

// "Gerente de Vendas" é o responsável principal pelos cards — não aparece
// na coluna Participantes porque é quem conduz as atividades, não apenas quem participa.
export const TODOS_ROLES = [
  "Gerente de Vendas",
  ...new Set(ATIVIDADES_TEMPLATE.flatMap((a) => a.participantes)),
];
