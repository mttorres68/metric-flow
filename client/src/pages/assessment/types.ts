export interface Indicador {
    idIndicador: string;
    idOperacao: number | string;
    nomeOperacao: string;
    ano: number;
    mes: string;
    macroArea: string;
    microArea: string;
    piramide: string;
    descricaoItem: string;
    detalhamentoItem: string;
    informacaoItem: string;
    evidenciaObrigatoria: string;
    detalhesEvidencia: string;
    planoAcao: string;
    tipoResposta: string;
    pontoPossivel: number;
}

export interface ClusterUI {
    id: number;
    tamanho: number;
    pontosTotais: number;
    microAreaDom: string | null;
    piramideDom: string | null;
    familiaDom: string | null;
    periodicidadeDom: string | null;
    indicadores: string[];
    descricoes: { id: string; descricao: string }[];
    breakdownFamilias: Record<string, number>;
    breakdownPiramide: Record<string, number>;
}

export interface ParAlta {
    a: string;
    b: string;
    sim: number;
    mesmaMicroArea: boolean;
    mesmaPiramide: boolean;
    mesmaPeriodicidade: boolean;
    familiasComuns: string[];
}

export interface OndaColeta {
    periodicidade: string;
    familia: string;
    qtd: number;
    indicadores: string[];
}

export interface FamiliaEvidencia {
    nome: string;
    qtdIndicadores: number;
    pontosTotais: number;
    qtdMicroAreas: number;
    microAreas: string[];
    indicadores: string[];
}

export interface GrafoNode {
    id: string;
    label: string;
    macroArea: string;
    microArea: string;
    piramide: string;
    descricao: string;
    pontos: number;
    cluster: number;
    familias: string[];
    periodicidade: string;
}

export interface GrafoEdge { source: string; target: string; sim: number; }

export interface ClustersData {
    meta: { totalIndicadores: number; totalClusters: number; distThreshold: number; edgeThreshold: number; pairThreshold: number };
    familias: FamiliaEvidencia[];
    clusters: ClusterUI[];
    ondasColeta: OndaColeta[];
    paresAltaSimilaridade: ParAlta[];
    grafo: { nodes: GrafoNode[]; edges: GrafoEdge[] };
}

export interface RespostaResultado {
    data: string;
    operacao: number;
    revenda: string;
    shortId: string;
    item: string;
    autoavaliacao: "Sim" | "Não" | string;
    evidencia: "Sim" | "Não" | string;
    padrinho: string;
    hora: string | null;
    macroArea: string;
    microArea: string;
    piramide: string;
    descricao: string;
    tipoResposta: string;
    pontoPossivel: number;
    pontosEvidencia: number;
    pontosAutoavaliacao: number;
}

export interface ResultadosData {
    meta: { totalRespostas: number; totalRevendas: number; totalIndicadores: number; mes: string; ano: number; fonte: string };
    revendas: string[];
    padrinhos: string[];
    respostas: RespostaResultado[];
}
