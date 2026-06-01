export interface AtividadeParsed {
  codigo: string;
  nome: string;
  frequencia: string;
  regra: string;
  participantes: string[];
  assessmentCode: string;
  due: string | null;       // ISO string (UTC)
  horario: string;          // "HH:MM" para exibição
  duracao: number;
  status: string;
  descricao: string;
  checklist: string[];      // itens de evidência → checklist no Trello
}

export function formatDue(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // Retorna no formato YYYY-MM-DDTHH:MM para input datetime-local
  const sp = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = sp.getFullYear();
  const mo = String(sp.getMonth() + 1).padStart(2, "0");
  const da = String(sp.getDate()).padStart(2, "0");
  const h = String(sp.getHours()).padStart(2, "0");
  const mi = String(sp.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${da}T${h}:${mi}`;
}

// Converte string "YYYY-MM-DDTHH:MM" (horário local SP) para ISO UTC
export function localToIso(localStr: string): string | null {
  if (!localStr) return null;
  // Trata como horário de Brasília (UTC-3) e converte para UTC
  const [datePart, timePart] = localStr.split("T");
  if (!datePart) return null;
  const [y, mo, da] = datePart.split("-").map(Number);
  const [h, mi] = (timePart || "00:00").split(":").map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, da, (h || 0) + 3, mi || 0));
  return utc.toISOString();
}

// Lê um File como base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:...;base64,"
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
