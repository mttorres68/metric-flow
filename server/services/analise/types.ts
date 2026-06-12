export interface AnaliseVendedor {
    revenda: string;
    vendedor: number;
    data: string;
    inicio: string | null;
    fim: string | null;
    almoco: number;
    apos14h: number;
    apos14h_pct: number;
    apos14h_total: number;
    visitas: number;
    visitas_total: number;
    visitas_total_dentro_raio: number;
    visitas_pct: number;
    relampago: number;
    relampago_pct: number;
    pdvs_total: number;
    pdvs_visitados: number;
    pdvs_sem_visita: number;
    pedido_sfa: number;
    pedido_heishop: number;
    heishop_verif: number;
    iv: number;
    iav: number;
    atend_maior35: number;
    soma_maior35: number;
    soma_maior35_fmt: string;
    tempo_menor: number | null;
    tempo_maior: number | null;
    tempo_medio: number | null;
    tempo_total: number | null;
    tempo_menor_fmt: string;
    tempo_maior_fmt: string;
    tempo_medio_fmt: string;
    tempo_total_fmt: string;
    maior_percurso: number | null;
    percurso_ini: string | null;
    percurso_fim: string | null;
    pdvs_apos_gap: number;
    total_percurso: number | null;
    total_percurso_fmt: string;
    tempo_nao_atend: number | null;
    tempo_nao_atend_fmt: string;
    ranking_critico: number;
}

export const FLAGS_RECORRENCIA = [
    { id: "relampagoAlto",     label: "Relâmpago alto" },
    { id: "inicioTardio",      label: "Início tardio" },
    { id: "coberturaBaixa",    label: "Cobertura/IV baixa" },
    { id: "ociosidadeAlta",    label: "Ociosidade / percurso alto" },
    { id: "almocoExcesso",     label: "Almoço acima do limite" },
    { id: "tardeInsuficiente", label: "Pouca visita após 14h" },
    { id: "tempoAtendBaixo",   label: "Σ atendimento < 2h" },
    { id: "fimCedo",           label: "Finaliza cedo" },
] as const;

export type FlagId = typeof FLAGS_RECORRENCIA[number]["id"];

export interface MetricaRecorrencia {
    dias: number;
    datas: string[];
    recorrente: boolean;
}

export interface RecorrenciaVendedor {
    revenda: string;
    vendedor: number;
    diasAtivos: number;
    metricas: Record<FlagId, MetricaRecorrencia>;
    scoreCritico: number;
}
