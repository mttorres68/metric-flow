import { Router } from "express";
import * as XLSX from "xlsx";

export const crmUploadRouter = Router();

// Converte serial Excel para { year, month, day }
function excelSerialToYMD(serial: number): { year: number; month: number; day: number } {
  // Fórmula padrão: serial 25569 = 1970-01-01 UTC
  const utcMs = (serial - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// Converte decimal/string de horário para "HH:MM"
function parseHorario(raw: unknown): string {
  if (typeof raw === "string") {
    return raw.replace(";", ":").replace(",", ":").trim();
  }
  if (typeof raw === "number" && raw > 0 && raw < 1) {
    const totalMin = Math.round(raw * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return "";
}

// Combina data serial + horário → ISO 8601 string (trata hora como UTC-3 / horário de Brasília)
function buildDue(dataSerial: unknown, horarioRaw: unknown): string | null {
  if (!dataSerial || typeof dataSerial !== "number") return null;
  const { year, month, day } = excelSerialToYMD(dataSerial);
  const horario = parseHorario(horarioRaw);
  const [hStr, mStr] = horario.split(":");
  const hour = parseInt(hStr) || 0;
  const minute = parseInt(mStr) || 0;
  // Converte horário local (Brasília UTC-3) para UTC somando 3 horas
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour + 3, minute));
  return utcDate.toISOString();
}

crmUploadRouter.post("/parse-xlsx", (req, res) => {
  try {
    const { xlsxBase64 } = req.body as { xlsxBase64: string };
    if (!xlsxBase64) {
      return res.status(400).json({ error: "Campo xlsxBase64 obrigatório" });
    }

    const buffer = Buffer.from(xlsxBase64, "base64");
    const wb = XLSX.read(buffer, { type: "buffer" });

    const wsAgenda = wb.Sheets["Agenda"];
    if (!wsAgenda) {
      return res.status(400).json({ error: "Sheet 'Agenda' não encontrada no arquivo" });
    }

    // Lê como array de arrays (raw para preservar serials de data)
    const rows = XLSX.utils.sheet_to_json(wsAgenda, { header: 1, raw: true }) as unknown[][];

    // Lê descrições e evidências da aba Trello (se existir)
    const descMap: Record<string, { descricao: string; checklist: string[] }> = {};
    const wsTrello = wb.Sheets["Trello"];
    if (wsTrello) {
      const trelloRows = XLSX.utils.sheet_to_json(wsTrello, { header: 1, raw: true }) as unknown[][];
      for (let i = 4; i < trelloRows.length; i++) {
        const r = trelloRows[i] as string[];
        if (r[0]) {
          // Coluna 3: evidências → transforma em array de itens de checklist
          const evidenciasRaw = String(r[2] || "").trim();
          const checklist = evidenciasRaw
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          descMap[String(r[0]).trim()] = {
            descricao: String(r[1] || "").trim(),
            checklist,
          };
        }
      }
    }

    const atividades: {
      codigo: string;
      nome: string;
      frequencia: string;
      regra: string;
      participantes: string[];
      assessmentCode: string;
      due: string | null;
      horario: string;
      duracao: number;
      status: string;
      descricao: string;
      checklist: string[];
    }[] = [];

    for (const row of rows) {
      const r = row as unknown[];
      const codigo = String(r[0] || "").trim();
      // Só processa linhas com código S# ou M#
      if (!/^[SM]\d+/.test(codigo)) continue;

      const nome = String(r[1] || "").trim();
      const frequencia = String(r[2] || "").trim();
      const regra = String(r[3] || "").trim();
      const participantesRaw = String(r[4] || "").trim();
      const assessmentCode = String(r[5] || "").replace("—", "").trim();
      const dataSerial = r[6];
      const horarioRaw = r[7];
      const duracao = typeof r[8] === "number" ? r[8] : 30;
      const status = String(r[9] || "").trim();

      const participantes = participantesRaw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      const due = buildDue(dataSerial, horarioRaw);
      const horario = parseHorario(horarioRaw);

      const trelloInfo = descMap[nome] ?? { descricao: "", checklist: [] };

      atividades.push({
        codigo, nome, frequencia, regra, participantes,
        assessmentCode, due, horario, duracao, status,
        descricao: trelloInfo.descricao,
        checklist: trelloInfo.checklist,
      });
    }

    return res.json({ atividades, total: atividades.length });
  } catch (err: any) {
    console.error("[CRM Upload] Erro ao parsear xlsx:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao processar arquivo" });
  }
});
