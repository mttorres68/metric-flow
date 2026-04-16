/*
 * MetricFlow — Hook: useWaTemplate
 * Gerencia o template de mensagem WhatsApp para atividades do dia.
 * Persiste no localStorage e opcionalmente sincroniza com o servidor (PostgreSQL).
 */

import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";

export interface WaTemplate {
  cabecalho:    string;
  tituloHoje:   string;
  tituloAmanha: string;
  linhaCard:    string;
  rodape:       string;
}

export const DEFAULT_TEMPLATE: WaTemplate = {
  cabecalho:    "📋 *Atividades — {revenda}*\n📅 {data}",
  tituloHoje:   "*Hoje ({data_hoje}):*",
  tituloAmanha: "*Amanhã ({data_amanha}):*",
  linhaCard:    "• {nome} | {lista} | {hora}{membros}",
  rodape:       "Farol Processos",
};

const LS_KEY = "mf:wa_template";

function loadFromStorage(): WaTemplate {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_TEMPLATE;
    return { ...DEFAULT_TEMPLATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function useWaTemplate() {
  const [template, setTemplate] = useState<WaTemplate>(loadFromStorage);

  // Sincroniza com o servidor (não-bloqueante; se falhar, usa localStorage)
  const { data: serverTemplate } = trpc.evolution.getWaTemplate.useQuery(undefined, {
    retry: false,
    staleTime: Infinity,
  });

  const saveMutation = trpc.evolution.setWaTemplate.useMutation();

  // Quando o servidor retornar um template, ele tem precedência
  useEffect(() => {
    if (serverTemplate) {
      const merged = { ...DEFAULT_TEMPLATE, ...serverTemplate };
      setTemplate(merged);
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    }
  }, [serverTemplate]);

  /** Salva apenas no localStorage (imediato, offline) */
  function saveLocal(t: WaTemplate) {
    setTemplate(t);
    localStorage.setItem(LS_KEY, JSON.stringify(t));
  }

  /** Salva no localStorage E persiste no servidor */
  async function saveToServer(t: WaTemplate) {
    saveLocal(t);
    await saveMutation.mutateAsync(t);
  }

  return {
    template,
    saveLocal,
    saveToServer,
    isSaving: saveMutation.isPending,
    serverSynced: !!serverTemplate,
  };
}
