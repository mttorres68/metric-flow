/*
 * Contas do CheckNow e do Infleet por revenda (aba Contas do modal ⚙).
 * Senha/token só entram: o servidor nunca devolve os valores, só "definido".
 */
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Form = { revendaId: number; nova: boolean; checknowUsuario: string; checknowSenha: string; infleetToken: string; limparInfleet: boolean };
const campo = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-[var(--background)] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600";
const botaoSec = "text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50";

export function ContasEntregas({ onMudou }: { onMudou: () => void }) {
  const utils = trpc.useUtils();
  const cofre = trpc.entregas.contas.cofre.useQuery();
  const contas = trpc.entregas.contas.listar.useQuery();
  const livres = trpc.entregas.contas.revendasSemConta.useQuery();
  const salvar = trpc.entregas.contas.salvar.useMutation();
  const ativar = trpc.entregas.contas.ativar.useMutation();
  const testarCN = trpc.entregas.contas.testarCheckNow.useMutation();
  const testarIF = trpc.entregas.contas.testarInfleet.useMutation();
  const [form, setForm] = useState<Form | null>(null);

  async function recarregar() {
    await Promise.all([utils.entregas.contas.listar.invalidate(), utils.entregas.contas.revendasSemConta.invalidate()]);
    onMudou();
  }

  async function gravar() {
    if (!form) return;
    try {
      await salvar.mutateAsync({
        revendaId: form.revendaId, checknowUsuario: form.checknowUsuario,
        checknowSenha: form.checknowSenha || undefined,
        infleetToken: form.limparInfleet ? null : form.infleetToken || undefined,
      });
      toast.success("Conta salva.");
      setForm(null);
      await recarregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function testar(tipo: "cn" | "if", revendaId: number) {
    try {
      if (tipo === "cn") toast.success(`CheckNow ok — ${(await testarCN.mutateAsync({ revendaId })).filial}`);
      else toast.success(`Infleet ok — ${(await testarIF.mutateAsync({ revendaId })).veiculos} veículos`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (cofre.data && !cofre.data.disponivel) {
    return <p className="text-xs text-red-500">Cadastro bloqueado: falta a CHECKNOW_CHAVE no .env do servidor (32 bytes em base64).</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {contas.isLoading && <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Carregando contas…</p>}
      {contas.data?.length === 0 && !form && <p className="text-xs text-slate-400">Nenhuma conta cadastrada.</p>}

      {(contas.data ?? []).map(c => (
        <div key={c.revendaId} className="rounded-xl border border-slate-100 dark:border-[var(--border)] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.revenda}</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={c.ativo}
                onChange={async e => { await ativar.mutateAsync({ revendaId: c.revendaId, ativo: e.target.checked }); await recarregar(); }} /> Ativa
            </label>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            CheckNow: <b className="text-slate-700 dark:text-slate-200">{c.checknowUsuario}</b> · senha definida · Infleet: {c.infleetDefinido ? "token definido" : "vazio — usa o padrão do servidor"}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            {c.ultimaColetaEm
              ? `Última coleta: ${new Date(c.ultimaColetaEm).toLocaleString("pt-BR")} ${c.ultimaColetaOk ? "✓" : `— erro: ${c.ultimaColetaErro}`}`
              : "Sem coleta ainda"}
          </div>
          <div className="flex gap-2">
            <button className={botaoSec} onClick={() => setForm({ revendaId: c.revendaId, nova: false, checknowUsuario: c.checknowUsuario, checknowSenha: "", infleetToken: "", limparInfleet: false })}>Editar</button>
            <button className={botaoSec} disabled={testarCN.isPending} onClick={() => testar("cn", c.revendaId)}>Testar CheckNow</button>
            <button className={botaoSec} disabled={testarIF.isPending} onClick={() => testar("if", c.revendaId)}>Testar Infleet</button>
          </div>
        </div>
      ))}

      {!form && !!livres.data?.length && (
        <button className="self-start flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold"
          onClick={() => setForm({ revendaId: livres.data![0].id, nova: true, checknowUsuario: "", checknowSenha: "", infleetToken: "", limparInfleet: false })}>
          <Plus size={12} /> Adicionar conta
        </button>
      )}

      {form && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 p-3 flex flex-col gap-2">
          {form.nova ? (
            <select className={campo} value={form.revendaId} aria-label="Revenda" onChange={e => setForm({ ...form, revendaId: Number(e.target.value) })}>
              {(livres.data ?? []).map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          ) : (
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{contas.data?.find(c => c.revendaId === form.revendaId)?.revenda}</span>
          )}
          <input className={campo} placeholder="Usuário do CheckNow" aria-label="Usuário do CheckNow" value={form.checknowUsuario}
            onChange={e => setForm({ ...form, checknowUsuario: e.target.value })} autoComplete="off" />
          <input className={campo} type="password" aria-label="Senha do CheckNow" placeholder={form.nova ? "Senha do CheckNow" : "Nova senha (vazio = mantém a atual)"}
            value={form.checknowSenha} onChange={e => setForm({ ...form, checknowSenha: e.target.value })} autoComplete="new-password" />
          <input className={campo} type="password" aria-label="Token do Infleet" placeholder="Token do Infleet (vazio = mantém / usa o padrão do servidor)"
            value={form.infleetToken} disabled={form.limparInfleet} onChange={e => setForm({ ...form, infleetToken: e.target.value })} autoComplete="off" />
          {!form.nova && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={form.limparInfleet} onChange={e => setForm({ ...form, limparInfleet: e.target.checked })} /> Remover o token (usar o padrão do servidor)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button className={botaoSec} onClick={() => setForm(null)}>Cancelar</button>
            <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold disabled:opacity-50"
              disabled={salvar.isPending || !form.checknowUsuario.trim() || (form.nova && !form.checknowSenha)} onClick={gravar}>
              {salvar.isPending && <Loader2 size={12} className="animate-spin" />} Salvar conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
