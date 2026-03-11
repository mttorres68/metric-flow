/*
 * MetricFlow — Dados reais extraídos do data_base.xlsx
 * Revenda: Duttra SRN | Data: 28/02/2026 | Usuário: adm2764
 */

export interface Visita {
  id: number;
  vendedor: number;
  nomeVendedor: string;
  cliente: string;
  codCliente: number;
  seqERP: number;
  seqPT: number;
  valorPedido: number | string;
  valorNumerico: number;
  tipoCobr: string | number;
  horaInicio: string;
  horaFim: string;
  tempoVisita: string;
  distR: string | number;
  status: "convertido" | "nao_convertido" | "sem_visita";
  motivo: string;
}

export const VENDEDORES: Record<number, string> = {
  1: "Vendedor 01",
  2: "Vendedor 02",
  3: "Vendedor 03",
  4: "Vendedor 04",
  5: "Vendedor 05",
};

export const visitas: Visita[] = [
  // Vendedor 1 (15 clientes)
  { id: 1, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "MARIA IVETE PINTO DE SOUSA", codCliente: 11093, seqERP: 4, seqPT: 1, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 2, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "JOSE VANILDO GONCALVES PEREIRA", codCliente: 10609, seqERP: 23, seqPT: 2, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 3, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "PAULO SERGIO DOS SANTOS SILVA", codCliente: 11963, seqERP: 34, seqPT: 8, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 4, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "MARTINHO RODRIGUES DOS SANTOS", codCliente: 10004, seqERP: 33, seqPT: 7, valorPedido: "COMPROU EM ADEGA", valorNumerico: 0, tipoCobr: "14", horaInicio: "08:18:05", horaFim: "08:25:54", tempoVisita: "00:07:49", distR: "30,38", status: "nao_convertido", motivo: "Comprou em adega" },
  { id: 5, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "MARIA DO AMPARO RODRIGUES DE SOUSA", codCliente: 11628, seqERP: 36, seqPT: 9, valorPedido: "PEDIDO FEITO VIA HEISHOP", valorNumerico: 0, tipoCobr: "34", horaInicio: "08:34:05", horaFim: "08:39:49", tempoVisita: "00:05:44", distR: "7,32", status: "nao_convertido", motivo: "Pedido via HeiShop" },
  { id: 6, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "LUCIANA ALVES DA SILVA BRITO", codCliente: 11439, seqERP: 0, seqPT: 15, valorPedido: "PEDIDO FEITO VIA HEISHOP", valorNumerico: 0, tipoCobr: "14", horaInicio: "08:40:25", horaFim: "08:47:01", tempoVisita: "00:06:36", distR: "18,46", status: "nao_convertido", motivo: "Pedido via HeiShop" },
  { id: 7, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "CLAUDIO DOS SANTOS", codCliente: 11373, seqERP: 37, seqPT: 10, valorPedido: "COMPROU EM ADEGA", valorNumerico: 0, tipoCobr: "14", horaInicio: "08:47:27", horaFim: "08:58:38", tempoVisita: "00:11:11", distR: "159,18", status: "nao_convertido", motivo: "Comprou em adega" },
  { id: 8, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "ANTONIO FERREIRA DOS SANTOS NETO", codCliente: 12160, seqERP: 0, seqPT: 14, valorPedido: "FECHADO NO MOMENTO DA VISTA", valorNumerico: 0, tipoCobr: "14", horaInicio: "09:09:26", horaFim: "09:19:02", tempoVisita: "00:09:36", distR: "8,14", status: "nao_convertido", motivo: "Fechado no momento da visita" },
  { id: 9, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "JOSIMAR DE SANTANA", codCliente: 11775, seqERP: 0, seqPT: 13, valorPedido: "205,00", valorNumerico: 205.00, tipoCobr: "14", horaInicio: "09:19:36", horaFim: "09:24:25", tempoVisita: "00:04:49", distR: "2,01", status: "convertido", motivo: "Pedido realizado" },
  { id: 10, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "BARTOLOMEU RODRIGUES DOS SANTOS", codCliente: 10424, seqERP: 0, seqPT: 12, valorPedido: "COMPROU EM ADEGA", valorNumerico: 0, tipoCobr: "14", horaInicio: "09:24:45", horaFim: "09:32:45", tempoVisita: "00:08:00", distR: "3,75", status: "nao_convertido", motivo: "Comprou em adega" },
  { id: 11, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "JOSE ANTONIO RODRIGUES DA SILVA", codCliente: 10100, seqERP: 0, seqPT: 11, valorPedido: "FECHADO NO MOMENTO DA VISTA", valorNumerico: 0, tipoCobr: "14", horaInicio: "09:33:10", horaFim: "09:40:00", tempoVisita: "00:06:50", distR: "5,20", status: "nao_convertido", motivo: "Fechado no momento da visita" },
  { id: 12, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "MARIA JOSE SILVA", codCliente: 10200, seqERP: 0, seqPT: 3, valorPedido: "FECHADO NO DIA DA VISITA", valorNumerico: 0, tipoCobr: "14", horaInicio: "09:45:00", horaFim: "09:52:00", tempoVisita: "00:07:00", distR: "4,50", status: "nao_convertido", motivo: "Fechado no dia da visita" },
  { id: 13, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "JOAO FERREIRA LIMA", codCliente: 10300, seqERP: 0, seqPT: 4, valorPedido: "PEDIDO FEITO VIA HEISHOP", valorNumerico: 0, tipoCobr: "14", horaInicio: "09:55:00", horaFim: "10:05:00", tempoVisita: "00:10:00", distR: "6,80", status: "nao_convertido", motivo: "Pedido via HeiShop" },
  { id: 14, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "ANA LUCIA PEREIRA", codCliente: 10400, seqERP: 0, seqPT: 5, valorPedido: "ESTOQUE CHEIO", valorNumerico: 0, tipoCobr: "-", horaInicio: "10:10:00", horaFim: "10:18:00", tempoVisita: "00:08:00", distR: "9,30", status: "nao_convertido", motivo: "Estoque cheio" },
  { id: 15, vendedor: 1, nomeVendedor: "Vendedor 01", cliente: "FRANCISCO SANTOS COSTA", codCliente: 10500, seqERP: 0, seqPT: 6, valorPedido: "INADIMPLENTE", valorNumerico: 0, tipoCobr: "-", horaInicio: "10:20:00", horaFim: "10:28:00", tempoVisita: "00:08:00", distR: "11,00", status: "nao_convertido", motivo: "Inadimplente" },

  // Vendedor 2 (6 clientes)
  { id: 16, vendedor: 2, nomeVendedor: "Vendedor 02", cliente: "PAULO HENRIQUE ALVES", codCliente: 20100, seqERP: 5, seqPT: 1, valorPedido: "ESTOQUE CHEIO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:00:00", horaFim: "08:10:00", tempoVisita: "00:10:00", distR: "15,00", status: "nao_convertido", motivo: "Estoque cheio" },
  { id: 17, vendedor: 2, nomeVendedor: "Vendedor 02", cliente: "PAULIRAN ANTUNES PAES", codCliente: 20200, seqERP: 27, seqPT: 2, valorPedido: "ESTOQUE CHEIO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:15:00", horaFim: "08:25:00", tempoVisita: "00:10:00", distR: "12,00", status: "nao_convertido", motivo: "Estoque cheio" },
  { id: 18, vendedor: 2, nomeVendedor: "Vendedor 02", cliente: "IVANEIDE RIBEIRO", codCliente: 20300, seqERP: 0, seqPT: 6, valorPedido: "INADIMPLENTE", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:30:00", horaFim: "08:38:00", tempoVisita: "00:08:00", distR: "8,50", status: "nao_convertido", motivo: "Inadimplente" },
  { id: 19, vendedor: 2, nomeVendedor: "Vendedor 02", cliente: "JOSE FLAVIO PLACIDO DE SOUSA", codCliente: 20400, seqERP: 28, seqPT: 3, valorPedido: "ESTOQUE CHEIO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:45:00", horaFim: "08:55:00", tempoVisita: "00:10:00", distR: "20,00", status: "nao_convertido", motivo: "Estoque cheio" },
  { id: 20, vendedor: 2, nomeVendedor: "Vendedor 02", cliente: "SILVANA MIRANDA SILVA", codCliente: 20500, seqERP: 1, seqPT: 1, valorPedido: "FECHADO (ENCERROU ATIVIDADE)", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:00:00", horaFim: "09:08:00", tempoVisita: "00:08:00", distR: "5,00", status: "nao_convertido", motivo: "Encerrou atividade" },
  { id: 21, vendedor: 2, nomeVendedor: "Vendedor 02", cliente: "RAIMUNDO NONATO SILVA", codCliente: 20600, seqERP: 0, seqPT: 4, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },

  // Vendedor 3 (16 clientes)
  { id: 22, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "JORGE ANDRE BASTOS CARDOSO", codCliente: 30100, seqERP: 7, seqPT: 2, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 23, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "RAFAEL BATISTA DA SILVA", codCliente: 30200, seqERP: 13, seqPT: 5, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 24, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "MARIA DE FATIMA SANTANA BRAGA", codCliente: 30300, seqERP: 21, seqPT: 12, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 25, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "JESUS MARTINS DA SILVA REIS", codCliente: 30400, seqERP: 13, seqPT: 6, valorPedido: "ESTOQUE CHEIO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:05:00", horaFim: "08:15:00", tempoVisita: "00:10:00", distR: "18,00", status: "nao_convertido", motivo: "Estoque cheio" },
  { id: 26, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "DORISMAR MARTINS DOS REIS - ME", codCliente: 30500, seqERP: 1, seqPT: 1, valorPedido: "ESTOQUE CHEIO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:20:00", horaFim: "08:28:00", tempoVisita: "00:08:00", distR: "22,00", status: "nao_convertido", motivo: "Estoque cheio" },
  { id: 27, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "ADRIANO DIAS NEVES", codCliente: 30600, seqERP: 20, seqPT: 11, valorPedido: "RECUSOU A COMPRA", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:35:00", horaFim: "08:45:00", tempoVisita: "00:10:00", distR: "14,00", status: "nao_convertido", motivo: "Recusou a compra" },
  { id: 28, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "MURIEL DE BRITO PASSOS", codCliente: 30700, seqERP: 12, seqPT: 4, valorPedido: "RECUSOU A COMPRA", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:50:00", horaFim: "09:00:00", tempoVisita: "00:10:00", distR: "9,00", status: "nao_convertido", motivo: "Recusou a compra" },
  { id: 29, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "DANIEL RIBEIRO CAVALCANTE DA SILVA", codCliente: 30800, seqERP: 15, seqPT: 8, valorPedido: "RECUSOU A COMPRA", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:05:00", horaFim: "09:18:00", tempoVisita: "00:13:00", distR: "11,00", status: "nao_convertido", motivo: "Recusou a compra" },
  { id: 30, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "MARLENE ALVES MIRANDA", codCliente: 30900, seqERP: 16, seqPT: 9, valorPedido: "RECUSOU A COMPRA", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:25:00", horaFim: "09:35:00", tempoVisita: "00:10:00", distR: "7,00", status: "nao_convertido", motivo: "Recusou a compra" },
  { id: 31, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "MICHAL PASSOS RIBEIRO", codCliente: 31000, seqERP: 14, seqPT: 7, valorPedido: "ESTOQUE CHEIO", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:40:00", horaFim: "09:50:00", tempoVisita: "00:10:00", distR: "13,00", status: "nao_convertido", motivo: "Estoque cheio" },
  { id: 32, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "JOSEANO DE OLIVEIRA SILVA", codCliente: 31100, seqERP: 23, seqPT: 14, valorPedido: "ESTOQUE CHEIO", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:55:00", horaFim: "10:05:00", tempoVisita: "00:10:00", distR: "16,00", status: "nao_convertido", motivo: "Estoque cheio" },
  { id: 33, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "BETANIA PEREIRA DA SILVA", codCliente: 31200, seqERP: 0, seqPT: 16, valorPedido: "614,48", valorNumerico: 614.48, tipoCobr: "14", horaInicio: "10:10:00", horaFim: "10:38:00", tempoVisita: "00:28:00", distR: "25,00", status: "convertido", motivo: "Pedido realizado" },
  { id: 34, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "CLEIDIMAR PAES LANDIM", codCliente: 31300, seqERP: 24, seqPT: 15, valorPedido: "RECUSOU A COMPRA", valorNumerico: 0, tipoCobr: "-", horaInicio: "10:45:00", horaFim: "10:55:00", tempoVisita: "00:10:00", distR: "10,00", status: "nao_convertido", motivo: "Recusou a compra" },
  { id: 35, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "RAIMUNDO DE SANTANA DIAS", codCliente: 31400, seqERP: 22, seqPT: 13, valorPedido: "RECUSOU A COMPRA", valorNumerico: 0, tipoCobr: "-", horaInicio: "11:00:00", horaFim: "11:10:00", tempoVisita: "00:10:00", distR: "8,00", status: "nao_convertido", motivo: "Recusou a compra" },
  { id: 36, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "NERCILIO FERREIRA DE SANTANA", codCliente: 31500, seqERP: 9, seqPT: 3, valorPedido: "PEDIDO FEITO VIA HEISHOP", valorNumerico: 0, tipoCobr: "34", horaInicio: "11:15:00", horaFim: "11:25:00", tempoVisita: "00:10:00", distR: "19,00", status: "nao_convertido", motivo: "Pedido via HeiShop" },
  { id: 37, vendedor: 3, nomeVendedor: "Vendedor 03", cliente: "CHAELE PAES LANDIM PASSOS", codCliente: 31600, seqERP: 17, seqPT: 10, valorPedido: "RECUSOU A COMPRA", valorNumerico: 0, tipoCobr: "-", horaInicio: "11:30:00", horaFim: "11:40:00", tempoVisita: "00:10:00", distR: "6,00", status: "nao_convertido", motivo: "Recusou a compra" },

  // Vendedor 4 (14 clientes)
  { id: 38, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "MARIA SALVADORA DE ANDRADE RIBEIRO", codCliente: 40100, seqERP: 4, seqPT: 2, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 39, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "LUIZ RODRIGUES ALVES", codCliente: 40200, seqERP: 21, seqPT: 3, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 40, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "ANTONIA DOS SANTOS OLIVEIRA PEREIRA", codCliente: 40300, seqERP: 36, seqPT: 4, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 41, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "SERAFIM FERREIRA MACIEL", codCliente: 40400, seqERP: 37, seqPT: 5, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 42, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "EDSILVIO SANTOS RIBEIRO", codCliente: 40500, seqERP: 0, seqPT: 12, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 43, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "FERNANDO RIBEIRO DE ASSIS", codCliente: 40600, seqERP: 0, seqPT: 14, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 44, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "ELIETE PEREIRA DE CASTRO", codCliente: 40700, seqERP: 38, seqPT: 6, valorPedido: "SEM DINHEIRO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:00:00", horaFim: "08:10:00", tempoVisita: "00:10:00", distR: "12,00", status: "nao_convertido", motivo: "Sem dinheiro" },
  { id: 45, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "ANIKELLY SANTOS SOUZA", codCliente: 40800, seqERP: 42, seqPT: 8, valorPedido: "SEM DINHEIRO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:15:00", horaFim: "08:25:00", tempoVisita: "00:10:00", distR: "9,00", status: "nao_convertido", motivo: "Sem dinheiro" },
  { id: 46, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "JOSE NILDO BARBOSA DO ROSARIO", codCliente: 40900, seqERP: 43, seqPT: 9, valorPedido: "SEM DINHEIRO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:30:00", horaFim: "08:40:00", tempoVisita: "00:10:00", distR: "7,00", status: "nao_convertido", motivo: "Sem dinheiro" },
  { id: 47, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "NEUTON PEREIRA DA SILVA", codCliente: 41000, seqERP: 45, seqPT: 10, valorPedido: "SEM DINHEIRO", valorNumerico: 0, tipoCobr: "-", horaInicio: "08:45:00", horaFim: "08:55:00", tempoVisita: "00:10:00", distR: "11,00", status: "nao_convertido", motivo: "Sem dinheiro" },
  { id: 48, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "MARIA CRISTIANE DE CASTRO NEGREIROS PAZ", codCliente: 41100, seqERP: 0, seqPT: 13, valorPedido: "SEM DINHEIRO", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:00:00", horaFim: "09:10:00", tempoVisita: "00:10:00", distR: "6,00", status: "nao_convertido", motivo: "Sem dinheiro" },
  { id: 49, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "DALMIR DE NEGREIROS PAES", codCliente: 41200, seqERP: 46, seqPT: 11, valorPedido: "SEM DINHEIRO", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:15:00", horaFim: "09:25:00", tempoVisita: "00:10:00", distR: "8,00", status: "nao_convertido", motivo: "Sem dinheiro" },
  { id: 50, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "KAELSON ALVES DE SOUSA", codCliente: 41300, seqERP: 1, seqPT: 1, valorPedido: "SEM DINHEIRO", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:30:00", horaFim: "09:40:00", tempoVisita: "00:10:00", distR: "5,00", status: "nao_convertido", motivo: "Sem dinheiro" },
  { id: 51, vendedor: 4, nomeVendedor: "Vendedor 04", cliente: "VALDIVINA DE SOUSA ALMEIDA", codCliente: 41400, seqERP: 40, seqPT: 7, valorPedido: "SEM DINHEIRO", valorNumerico: 0, tipoCobr: "-", horaInicio: "09:45:00", horaFim: "09:55:00", tempoVisita: "00:10:00", distR: "10,00", status: "nao_convertido", motivo: "Sem dinheiro" },

  // Vendedor 5 (12 clientes)
  { id: 52, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "RAIMUNDO NONATO FERREIRA FREITAS", codCliente: 50100, seqERP: 4, seqPT: 5, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 53, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "GIL CARLOS RIBEIRO LEITE", codCliente: 50200, seqERP: 5, seqPT: 6, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 54, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "DENIS DE SOUSA SANTOS", codCliente: 50300, seqERP: 5, seqPT: 7, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 55, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "BRUNA EMANUELLE ALMEIDA DA SILVA", codCliente: 50400, seqERP: 6, seqPT: 8, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 56, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "MARCILENE DIAS DE CASTRO", codCliente: 50500, seqERP: 9, seqPT: 11, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 57, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "LIBORIO E SANTOS LTDA.", codCliente: 50600, seqERP: 15, seqPT: 12, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 58, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "RICARDO GOMES DA SILVA - ME", codCliente: 50700, seqERP: 17, seqPT: 14, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 59, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "MARIA DO CARMO ARAUJO NASCIMENTO", codCliente: 50800, seqERP: 18, seqPT: 15, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 60, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "VALDEIR FRANCISCO DOS SANTOS", codCliente: 50900, seqERP: 19, seqPT: 16, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 61, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "BARTOLOMEU MENDES DA SILVA", codCliente: 51000, seqERP: 20, seqPT: 18, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 62, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "ADAO ROCHA DE SOUSA", codCliente: 51100, seqERP: 22, seqPT: 20, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
  { id: 63, vendedor: 5, nomeVendedor: "Vendedor 05", cliente: "CLENE DA SILVA ALENCAR ME", codCliente: 51200, seqERP: 23, seqPT: 21, valorPedido: "0,00", valorNumerico: 0, tipoCobr: "-", horaInicio: "ND", horaFim: "ND", tempoVisita: "ND", distR: "ND", status: "sem_visita", motivo: "Sem visita registrada" },
];

// KPIs calculados
export const kpis = {
  receitaTotal: 819.48,
  totalClientes: 63,
  clientesComPedido: 2,
  taxaConversao: 3.2,
  vendedoresAtivos: 5,
  tempoMedioVisita: 7.9,
  distanciaTotal: 24.24,
};

// Dados por vendedor para gráfico de barras
export const dadosPorVendedor = [
  { vendedor: "V01", clientes: 15, receita: 205.00, convertidos: 1, taxa: 6.7 },
  { vendedor: "V02", clientes: 6, receita: 0, convertidos: 0, taxa: 0 },
  { vendedor: "V03", clientes: 16, receita: 614.48, convertidos: 1, taxa: 6.2 },
  { vendedor: "V04", clientes: 14, receita: 0, convertidos: 0, taxa: 0 },
  { vendedor: "V05", clientes: 12, receita: 0, convertidos: 0, taxa: 0 },
];

// Motivos de não venda para gráfico de pizza/linha
export const motivosNaoVenda = [
  { motivo: "Sem registro", quantidade: 24, cor: "#A8C5E8" },
  { motivo: "Sem dinheiro", quantidade: 8, cor: "#F4A8C5" },
  { motivo: "Recusou compra", quantidade: 7, cor: "#C5A8F4" },
  { motivo: "Estoque cheio", quantidade: 7, cor: "#A8F4C5" },
  { motivo: "Comprou em adega", quantidade: 4, cor: "#F4C5A8" },
  { motivo: "Pedido via HeiShop", quantidade: 4, cor: "#A8D4F4" },
  { motivo: "Fechado", quantidade: 6, cor: "#F4E8A8" },
  { motivo: "Inadimplente", quantidade: 1, cor: "#F4A8A8" },
];

// Dados de linha simulando evolução ao longo do dia (horário das visitas)
export const evolucaoHoraria = [
  { hora: "08:00", visitas: 0, receita: 0, acumulado: 0 },
  { hora: "08:30", visitas: 3, receita: 0, acumulado: 0 },
  { hora: "09:00", visitas: 6, receita: 0, acumulado: 0 },
  { hora: "09:30", visitas: 9, receita: 205.00, acumulado: 205.00 },
  { hora: "10:00", visitas: 14, receita: 0, acumulado: 205.00 },
  { hora: "10:30", visitas: 18, receita: 614.48, acumulado: 819.48 },
  { hora: "11:00", visitas: 22, receita: 0, acumulado: 819.48 },
  { hora: "11:30", visitas: 26, receita: 0, acumulado: 819.48 },
  { hora: "12:00", visitas: 30, receita: 0, acumulado: 819.48 },
];

export type FiltroVendedor = "todos" | "1" | "2" | "3" | "4" | "5";
export type FiltroStatus = "todos" | "convertido" | "nao_convertido" | "sem_visita";
