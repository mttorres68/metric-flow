import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Save, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const TRELLO_COLORS = [
  { value: "green",  label: "Verde",    hex: "#61BD4F" },
  { value: "yellow", label: "Amarelo",  hex: "#F2D600" },
  { value: "orange", label: "Laranja",  hex: "#FF9F1A" },
  { value: "red",    label: "Vermelho", hex: "#EB5A46" },
  { value: "purple", label: "Roxo",     hex: "#C377E0" },
  { value: "blue",   label: "Azul",     hex: "#0079BF" },
  { value: "sky",    label: "Céu",      hex: "#00C2E0" },
  { value: "lime",   label: "Lima",     hex: "#51E898" },
  { value: "pink",   label: "Rosa",     hex: "#FF78CB" },
  { value: "black",  label: "Preto",    hex: "#344563" },
];

export function LabelConfig() {
  const { data, refetch } = trpc.crm.getLabelConfig.useQuery(undefined, { staleTime: 60_000 });
  const setMut = trpc.crm.setLabelConfig.useMutation();

  const [nome, setNome] = useState("Agenda");
  const [cor, setCor] = useState("green");
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (data) {
      setNome(data.name);
      setCor(data.color);
    }
  }, [data]);

  async function handleSalvar() {
    try {
      await setMut.mutateAsync({ name: nome.trim(), color: cor });
      await refetch();
      setSalvo(true);
      toast.success("Configuração de etiqueta salva!");
      setTimeout(() => setSalvo(false), 3000);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    }
  }

  const corAtual = TRELLO_COLORS.find((c) => c.value === cor);

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <Tag className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
          Etiqueta dos cards
        </h3>
        {corAtual && (
          <span
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-white text-xs font-medium"
            style={{ backgroundColor: corAtual.hex }}
          >
            {nome || "Agenda"}
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Nome */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Nome da etiqueta
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={50}
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Agenda"
          />
        </div>

        {/* Cor */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Cor
          </label>
          <div className="flex flex-wrap gap-2">
            {TRELLO_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCor(c.value)}
                title={c.label}
                className={`w-8 h-8 rounded-lg transition-all ${
                  cor === c.value
                    ? "ring-2 ring-offset-2 ring-indigo-400 scale-110"
                    : "hover:scale-105 opacity-80 hover:opacity-100"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          {corAtual && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{corAtual.label} selecionado</p>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Esta etiqueta será aplicada a todos os cards criados em todas as revendas.
          Se ela não existir no board, será criada automaticamente.
        </p>

        <button
          onClick={handleSalvar}
          disabled={setMut.isPending || !nome.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
        >
          {setMut.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : salvo
              ? <CheckCircle2 className="w-4 h-4" />
              : <Save className="w-4 h-4" />}
          {salvo ? "Salvo!" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
