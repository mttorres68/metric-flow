export const FILTER_KEY = "metricflow:analises-filters";
export const ANALISES_REVENDA_KEY = "metricflow:analises-revenda";
export const COLS_KEY = "metricflow:analise-cols";
export const SCROLL_TO_REVENDA_KEY = "metricflow:analise-scroll-revenda";
export const WA_SEL_KEY = "metricflow:wa-selecoes";

export const ALL_COLS = [
    { id: "data", label: "Data" },
    { id: "inicio", label: "Início" },
    { id: "fim", label: "Fim" },
    { id: "almoco", label: "Almoço" },
    { id: "apos14h", label: "Após 14h" },
    { id: "visitas", label: "Visitas" },
    { id: "pdv_sem_visita", label: "PDV S/Visita" },
    { id: "relampago", label: "Relâmpago" },
    { id: "sfa", label: "SFA" },
    { id: "heishop", label: "Heishop" },
    { id: "heishop_verif", label: "H. Verif." },
    { id: "iv", label: "IV" },
    { id: "iav", label: "IAV" },
    { id: "atend_35", label: "Atend. >35" },
    { id: "soma_35", label: "Σ >35min" },
    { id: "t_menor", label: "T. Menor" },
    { id: "t_maior", label: "T. Maior" },
    { id: "t_medio", label: "T. Médio" },
    { id: "t_total", label: "Σ TEMPO" },
    { id: "soma_percurso", label: "Σ Percurso" },
    { id: "percurso", label: "Maior Percurso" },
    { id: "ini_percurso", label: "Ini. Percurso" },
    { id: "fim_percurso", label: "Fim Percurso" },
    { id: "pdvs_percurso", label: "PDVs p/ Percurso" },
    { id: "t_nao_atend", label: "T. Ñ Atend." },
] as const;

export const REVENDA_ALIASES: Record<string, string> = {
    "duttra floriano": "Duttra FL",
    "duttra fl": "Duttra FL",
    "Duttra FL": "Duttra FL",
    "duttra ma": "Duttra MA",
    "duttra srn": "Duttra SR",
    "duttra sr": "Duttra SR",
    "forte aracati": "FORTE AR",
    "forte ar": "FORTE AR",
    "forte quixada": "FORTE QX",
    "forte qx": "FORTE QX",
};

export const REVENDA_COACHING_MAP: Record<string, string> = {
    "duttra floriano": "duttra fl",
    "duttra fl": "duttra fl",
    "duttra ma": "duttra ma",
    "duttra srn": "duttra srn",
    "duttra sr": "duttra srn",
    "forte aracati": "forte ar",
    "forte ar": "forte ar",
    "forte quixada": "forte qx",
    "forte qx": "forte qx",
};

export const FLAG_SHORT: Record<string, string> = {
    relampagoAlto: "Relâmp.",
    inicioTardio: "Início tardio",
    coberturaBaixa: "Cobert. baixa",
    ociosidadeAlta: "Ociosid.",
    almocoExcesso: "Almoço",
    tardeInsuficiente: "Pós-14h",
    tempoAtendBaixo: "Σ Atend.",
    fimCedo: "Fim cedo",
};
