/*
 * MetricFlow — uma coleta do CheckNow: trava → registro → download (com tentativas) → leitura → gravação.
 * Falha nunca apaga dados; arquivo vazio vira "sem_dados" (spec checknow-coleta §5, §7).
 */
import { parseCheckNow, type Entrega } from "../entregas/parseCheckNow";
import { diaBRT } from "@shared/entregas";
import { baixarCheckNow } from "./coletor";
import * as repo from "./repo";

export type ResultadoColeta = { status: "ok" | "sem_dados"; rotas: number; linhas: number };
const ESPERAS = { auto: [60_000, 300_000, 900_000], botao: [5_000] };
const curta = (e: unknown) => ((e as Error).message ?? String(e)).split("\n")[0].slice(0, 200);

/** Repete após cada espera; "login recusado" não repete (evita bloquear a conta). */
export async function comTentativas<T>(fn: () => Promise<T>, esperasMs: number[]): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= esperasMs.length || (e as Error).message === "login recusado") throw e;
      await new Promise(r => setTimeout(r, esperasMs[i]));
    }
  }
}

async function registrar(revendaId: number, origem: repo.Origem, de: string, ate: string, obter: () => Promise<Entrega[]>): Promise<ResultadoColeta> {
  const id = await repo.abrirColeta(revendaId, origem, de, ate);
  try {
    const entregas = await obter();
    const r = entregas.length ? await repo.gravarEntregas(revendaId, entregas) : { rotas: 0, linhas: 0 };
    const res: ResultadoColeta = { status: r.linhas ? "ok" : "sem_dados", ...r };
    await repo.fecharColeta(id, revendaId, res);
    return res;
  } catch (e) {
    await repo.fecharColeta(id, revendaId, { status: "erro", erro: curta(e) });
    throw e;
  }
}

/** Cada tentativa pega a trava, registra, baixa e grava; nas esperas entre tentativas a trava fica solta (upload e botão livres). */
export async function coletarRevenda(revendaId: number, de: string, ate: string, origem: "auto" | "botao", esperasMs = ESPERAS[origem]): Promise<ResultadoColeta> {
  const conta = await repo.contaComSegredos(revendaId);
  if (!conta) throw new repo.ColetaError("revenda sem conta do CheckNow");
  return comTentativas(() => repo.comTrava(revendaId, () =>
    registrar(revendaId, origem, de, ate, async () => (await baixarCheckNow(conta, de, ate)).flatMap(b => parseCheckNow(b)))), esperasMs);
}

/** Upload manual: mesma gravação, período = dias das rotas da planilha. Lança PlanilhaInvalidaError antes de registrar. */
export function importarPlanilha(revendaId: number, buffer: Buffer): Promise<ResultadoColeta> {
  const entregas = parseCheckNow(buffer);
  const dias = entregas.flatMap(e => (e.rotaInicio ? [diaBRT(e.rotaInicio)] : [])).sort();
  const hoje = diaBRT(new Date());
  return repo.comTrava(revendaId, () => registrar(revendaId, "upload", dias[0] ?? hoje, dias.at(-1) ?? hoje, async () => entregas));
}
