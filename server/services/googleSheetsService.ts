/*
 * MetricFlow — Google Sheets Service
 * Carrega dados do Google Sheets e aplica transformações
 */

import { GOOGLE_SHEETS_CONFIG } from "../config";
import axios from "axios";
import { parse } from "csv-parse/sync";

export interface RawVisita {
  Revenda: string;
  User: string;
  data: string;
  data_coleta: string;
  Cod_Gerente: number;
  Cod_Supervisor: number;
  Cod_Vendedor: number;
  "Cód. Cli.": number;
  "Razão Social": string;
  "Seq. ERP": number;
  "Seq. PT": number;
  "Dist. P": string;
  "Dist. R": string;
  "Dif. PxR": string;
  "Vel. Méd.": string;
  "Tempo Perc.": string;
  "Ini. Hour": string;
  "Hora Fin.": string;
  "Tempo Vis.": string;
  "Valor Ped.": string;
  "Tipo Cobr.": string;
  "Dist. PV": string; // Distância ao Ponto de Venda — base do filtro de raio (Python: Dist_PV_Numeric)
  "F/R"?: string;
}

export interface ProcessedVisita {
  id: number;
  vendedor: number;
  gerente: number;
  revenda: string;
  data: string;         // YYYY-MM-DD
  cliente: string;
  codCliente: number;
  seqERP: number;
  seqPT: number;
  valorPedido: string;
  valorNumerico: number;
  tipoCobr: string | number;
  horaInicio: string;   // "HH:MM:SS" ou "ND"
  horaFim: string;
  tempoVisita: string;  // "HH:MM:SS" ou "ND" — duração da visita
  distR: string;        // Dist. R — distância percorrida (não usada no filtro de raio)
  distPV: string;       // Dist. PV — distância ao PDV (usada no filtro de raio, igual ao Python)
  status: "convertido" | "nao_convertido" | "sem_visita";
  motivo: string;
}

export async function loadGoogleSheetsData(): Promise<RawVisita[]> {
  try {
    console.log("[Google Sheets] Carregando dados...");
    const response = await axios.get(GOOGLE_SHEETS_CONFIG.CSV_URL, {
      timeout: 30000,
    });

    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
    }) as RawVisita[];

    console.log(`[Google Sheets] ✓ ${records.length} registros carregados`);
    return records;
  } catch (error) {
    console.error("[Google Sheets] Erro ao carregar dados:", error);
    throw new Error("Falha ao carregar dados do Google Sheets");
  }
}

export function converterValorPedido(valor: string): number {
  try {
    let cleaned = String(valor).trim();
    cleaned = cleaned.replace(/[^0-9,.]/g, "");

    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned = cleaned.replace(".", "").replace(",", ".");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0;
  }
}

export function classificarVisita(
  visita: RawVisita,
  _tempoVisitaMinutos: number | null
): { status: "convertido" | "nao_convertido" | "sem_visita"; motivo: string } {
  const valor = converterValorPedido(visita["Valor Ped."]);

  if (visita["Ini. Hour"] === "ND" || !visita["Ini. Hour"]) {
    return { status: "sem_visita", motivo: "Sem visita registrada" };
  }

  if (valor > 0) {
    return { status: "convertido", motivo: "Pedido realizado" };
  }

  const valorPedidoStr = String(visita["Valor Ped."]).trim();
  const motivos: Record<string, string> = {
    "SEM DINHEIRO": "Sem dinheiro",
    "RECUSOU A COMPRA": "Recusou a compra",
    "ESTOQUE CHEIO": "Estoque cheio",
    "COMPROU EM ADEGA": "Comprou em adega",
    "PEDIDO FEITO VIA HEISHOP": "Pedido via HeiShop",
    "FECHADO NO MOMENTO DA VISTA": "Fechado no momento da visita",
    "FECHADO NO DIA DA VISITA": "Fechado no dia da visita",
    "FECHADO (ENCERROU ATIVIDADE)": "Encerrou atividade",
    INADIMPLENTE: "Inadimplente",
    "0,00": "Sem registro",
  };

  for (const [key, label] of Object.entries(motivos)) {
    if (valorPedidoStr.includes(key)) {
      return { status: "nao_convertido", motivo: label };
    }
  }

  return { status: "nao_convertido", motivo: "Motivo não identificado" };
}

export function processarVisitas(rawVisitas: RawVisita[]): ProcessedVisita[] {
  return rawVisitas.map((v, idx) => {
    const valor = converterValorPedido(v["Valor Ped."]);
    const { status, motivo } = classificarVisita(v, null);

    let dataFormatada = "";
    if (v.data) {
      const partes = v.data.split("/");
      if (partes.length === 3) {
        dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
      } else {
        dataFormatada = v.data;
      }
    }

    return {
      id: idx + 1,
      vendedor: Number(v.Cod_Vendedor),
      gerente: Number(v.Cod_Gerente),
      revenda: v.Revenda,
      data: dataFormatada,
      cliente: v["Razão Social"],
      codCliente: Number(v["Cód. Cli."]),
      seqERP: Number(v["Seq. ERP"]),
      seqPT: Number(v["Seq. PT"]),
      valorPedido: v["Valor Ped."],
      valorNumerico: valor,
      tipoCobr: v["Tipo Cobr."],
      horaInicio: v["Ini. Hour"],
      horaFim: v["Hora Fin."],
      tempoVisita: v["Tempo Vis."],
      distR: v["Dist. R"],
      distPV: v["Dist. PV"] ?? "",   // campo adicionado — usado no filtro de raio
      status,
      motivo,
    };
  });
}