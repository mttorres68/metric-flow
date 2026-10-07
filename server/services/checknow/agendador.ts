/*
 * MetricFlow — coleta automática do CheckNow (só com CHECKNOW_COLETA_AUTO=1).
 * :05 de 06h a 22h e 23:30 → últimos 7 dias (o portal filtra pelo início da rota: rota de vários dias
 * só continua sendo atualizada se o início dela estiver no período); ao subir → desde o último ok (máx. 7 dias).
 * ponytail: setTimeout em processo único (produção = 1 réplica); com várias réplicas a trava por revenda evita coleta dupla.
 */
import { diaBRT } from "@shared/entregas";
import { contasParaColeta, ultimoPeriodoOk } from "./repo";
import { coletarRevenda } from "./sincronizar";

type Tipo = "hora" | "noite";
const DIA_MS = 86_400_000;
const menosDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) - n * DIA_MS).toISOString().slice(0, 10);
const em = (dia: string, hm: string) => new Date(`${dia}T${hm}:00-03:00`);

export function proximaExecucao(agora: Date): { em: Date; tipo: Tipo } {
  const hoje = diaBRT(agora);
  for (const dia of [hoje, menosDias(hoje, -1)]) {
    const slots: { em: Date; tipo: Tipo }[] = [
      ...Array.from({ length: 17 }, (_, i) => ({ em: em(dia, `${String(6 + i).padStart(2, "0")}:05`), tipo: "hora" as const })),
      { em: em(dia, "23:30"), tipo: "noite" },
    ];
    const prox = slots.find(s => s.em > agora);
    if (prox) return prox;
  }
  throw new Error("inalcançável");
}

export const periodoAuto = (hoje: string) => ({ de: menosDias(hoje, 6), ate: hoje });

export function periodoRecuperacao(ultimoOk: string | null, hoje: string): { de: string; ate: string } {
  const limite = menosDias(hoje, 7);
  return { de: ultimoOk && ultimoOk > limite ? ultimoOk : limite, ate: hoje };
}

async function rodar(periodo: (revendaId: number) => Promise<{ de: string; ate: string }>) {
  for (const revendaId of await contasParaColeta().catch(() => [] as number[])) {
    try {
      const { de, ate } = await periodo(revendaId);
      const r = await coletarRevenda(revendaId, de, ate, "auto");
      console.log(`[CheckNow] revenda ${revendaId} ${de}..${ate}: ${r.status} (${r.linhas} linhas)`);
    } catch (e) {
      console.warn(`[CheckNow] revenda ${revendaId}: ${(e as Error).message}`);
    }
  }
}

export function iniciarAgendador(): void {
  if (process.env.CHECKNOW_COLETA_AUTO !== "1") return;
  console.log("[CheckNow] coleta automática ligada");
  setTimeout(() => rodar(async id => periodoRecuperacao(await ultimoPeriodoOk(id), diaBRT(new Date()))), 60_000);
  const agendar = () => {
    const p = proximaExecucao(new Date());
    setTimeout(async () => {
      await rodar(async () => periodoAuto(diaBRT(new Date())));
      agendar();
    }, p.em.getTime() - Date.now());
  };
  agendar();
}
