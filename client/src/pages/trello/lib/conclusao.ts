import { conclusaoColor, formatMesAno } from "./helpers";

export interface ConclusaoRevenda {
  revenda: string;
  total: number;
  concluidos: number;
  erro?: string;
}

// Desenha a tabela em um canvas nativo (2D) e baixa como PNG — sem dependências extras
export async function exportarConclusaoImagem(dados: ConclusaoRevenda[], mes: number, ano: number) {
  const nameW = 170;
  const statusW = 90;
  const rowH = 32;
  const headerH = 36;
  const width = nameW + statusW;
  const height = headerH + dados.length * rowH;
  const scale = 2; // retina

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#B4C6E7";
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 15px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(formatMesAno(mes, ano), width / 2, headerH / 2);

  dados.forEach((r, i) => {
    const y = headerH + i * rowH;
    const cor = conclusaoColor(r.concluidos, r.total);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, y, nameW, rowH);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText(r.revenda, 10, y + rowH / 2);

    ctx.fillStyle = cor.hex;
    ctx.fillRect(nameW, y, statusW, rowH);
    ctx.fillStyle = cor.text === "text-white" ? "#ffffff" : "#1e293b";
    ctx.textAlign = "center";
    ctx.font = "bold 11px Arial";
    ctx.fillText(r.erro ? "erro" : r.total === 0 ? "sem dados" : `${r.concluidos}/${r.total}`, nameW + statusW / 2, y + rowH / 2);

    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(0, y, nameW, rowH);
    ctx.strokeRect(nameW, y, statusW, rowH);
  });
  ctx.strokeRect(0, 0, width, headerH);

  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conclusao-agenda-${formatMesAno(mes, ano)}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
