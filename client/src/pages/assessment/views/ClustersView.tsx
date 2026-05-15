import { useState, useMemo } from "react";
import {
    CheckCircle2, GitBranch, Link2, Network, Sparkles, Waves, X,
} from "lucide-react";
import { classNames, corFamilia, FAMILIA_COR } from "../constants";
import type { ClustersData, ClusterUI, GrafoNode } from "../types";
import { KpiCard } from "../components/KpiCard";

// ─── Diagrama de Rede SVG (radial layout) ────────────────────────────────
function ClusterGraph({ data, clusterFocus, setClusterFocus, isDark }: {
    data: ClustersData;
    clusterFocus: number | null;
    setClusterFocus: (id: number | null) => void;
    isDark: boolean;
}) {
    const W = 1100, H = 620;
    const CX = W / 2, CY = H / 2;

    // Posicionar cada cluster em torno de uma elipse macro
    const clustersComMembros = data.clusters; // já vem ordenado por tamanho

    // Posição de cada cluster (centroide)
    const clusterPositions = useMemo(() => {
        const pos = new Map<number, { x: number; y: number; r: number }>();
        // Clusters significativos (>=2) ficam em ring interno; singletons em ring externo
        const grandes = clustersComMembros.filter(c => c.tamanho >= 2);
        const pequenos = clustersComMembros.filter(c => c.tamanho < 2);

        // Ring interno
        const RA = 200, RB = 130;
        grandes.forEach((c, idx) => {
            const ang = (2 * Math.PI * idx) / Math.max(1, grandes.length) - Math.PI / 2;
            pos.set(c.id, {
                x: CX + RA * Math.cos(ang),
                y: CY + RB * Math.sin(ang),
                r: 18 + Math.sqrt(c.tamanho) * 8,
            });
        });

        // Ring externo (singletons distribuídos)
        const RA2 = 480, RB2 = 270;
        pequenos.forEach((c, idx) => {
            const ang = (2 * Math.PI * idx) / Math.max(1, pequenos.length) + Math.PI / 6;
            pos.set(c.id, {
                x: CX + RA2 * Math.cos(ang),
                y: CY + RB2 * Math.sin(ang),
                r: 8,
            });
        });
        return pos;
    }, [clustersComMembros]);

    // Posição de cada nó dentro do cluster
    const nodePositions = useMemo(() => {
        const pos = new Map<string, { x: number; y: number; cluster: number; node: GrafoNode }>();
        clustersComMembros.forEach(c => {
            const cp = clusterPositions.get(c.id);
            if (!cp) return;
            const members = data.grafo.nodes.filter(n => n.cluster === c.id);
            if (members.length === 1) {
                pos.set(members[0].id, { x: cp.x, y: cp.y, cluster: c.id, node: members[0] });
            } else {
                const r = cp.r + 10;
                members.forEach((m, idx) => {
                    const ang = (2 * Math.PI * idx) / members.length - Math.PI / 2;
                    pos.set(m.id, {
                        x: cp.x + r * Math.cos(ang),
                        y: cp.y + r * Math.sin(ang),
                        cluster: c.id,
                        node: m,
                    });
                });
            }
        });
        return pos;
    }, [data.grafo.nodes, clustersComMembros, clusterPositions]);

    const focusActive = clusterFocus !== null;
    const isHighlighted = (clusterId: number) => !focusActive || clusterId === clusterFocus;

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 800, height: 620 }}>
                {/* Background subtle */}
                <defs>
                    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={isDark ? "#1e293b" : "#F8FAFC"} stopOpacity="0.5" />
                        <stop offset="100%" stopColor={isDark ? "#0f172a" : "#FFFFFF"} stopOpacity="0" />
                    </radialGradient>
                </defs>
                <rect x={0} y={0} width={W} height={H} fill="url(#bgGrad)" />

                {/* Edges */}
                {data.grafo.edges.map((e, idx) => {
                    const sp = nodePositions.get(e.source);
                    const tp = nodePositions.get(e.target);
                    if (!sp || !tp) return null;
                    const highlight = isHighlighted(sp.cluster) && isHighlighted(tp.cluster);
                    return (
                        <line
                            key={idx}
                            x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                            stroke={isDark ? "#475569" : "#CBD5E1"}
                            strokeOpacity={highlight ? Math.min(0.7, e.sim) : 0.08}
                            strokeWidth={Math.max(0.6, e.sim * 2.5)}
                        />
                    );
                })}

                {/* Cluster halos (only for significant clusters) */}
                {clustersComMembros.filter(c => c.tamanho >= 2).map(c => {
                    const cp = clusterPositions.get(c.id);
                    if (!cp) return null;
                    const isFocus = clusterFocus === c.id;
                    const dim = focusActive && !isFocus ? 0.15 : 0.4;
                    return (
                        <g key={`halo-${c.id}`} style={{ cursor: "pointer" }} onClick={() => setClusterFocus(isFocus ? null : c.id)}>
                            <circle
                                cx={cp.x} cy={cp.y}
                                r={cp.r + 22}
                                fill={corFamilia(c.familiaDom)}
                                fillOpacity={dim * 0.5}
                                stroke={corFamilia(c.familiaDom)}
                                strokeOpacity={dim}
                                strokeWidth={1.5}
                                strokeDasharray="3,4"
                            />
                            <text
                                x={cp.x} y={cp.y - cp.r - 28}
                                textAnchor="middle"
                                fontSize="11"
                                fill={isDark ? "#cbd5e1" : "#475569"}
                                style={{ fontWeight: 800, pointerEvents: "none" }}
                            >
                                C{c.id} · {c.microAreaDom}
                            </text>
                        </g>
                    );
                })}

                {/* Nodes */}
                {Array.from(nodePositions.values()).map(({ x, y, cluster, node }) => {
                    const familiaDom = node.familias[0] || "Documentos / Política / Carta";
                    const cor = corFamilia(familiaDom);
                    const highlight = isHighlighted(cluster);
                    const r = Math.max(4, Math.sqrt(node.pontos) * 1.6);
                    return (
                        <g key={node.id} style={{ cursor: "pointer" }}
                            onClick={() => setClusterFocus(clusterFocus === cluster ? null : cluster)}>
                            <title>
                                {`${node.id} · ${node.microArea} · ${node.piramide}\n` +
                                    `Pts: ${node.pontos} · ${node.periodicidade}\n` +
                                    `${node.descricao}`}
                            </title>
                            <circle
                                cx={x} cy={y} r={r}
                                fill={cor}
                                fillOpacity={highlight ? 0.95 : 0.18}
                                stroke={isDark ? "#0f172a" : "#FFFFFF"}
                                strokeWidth={highlight ? 1.2 : 0.6}
                            />
                            {highlight && r >= 6 && (
                                <text x={x} y={y + 3} textAnchor="middle"
                                    fontSize="8" fill={isDark ? "#0f172a" : "#1e293b"}
                                    style={{ fontWeight: 800, pointerEvents: "none" }}>
                                    {node.id.split(" - ")[0].replace(/\D/g, "").slice(-2)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
            {/* Legenda */}
            <div className="flex flex-wrap justify-center gap-3 mt-3 px-2">
                {Object.entries(FAMILIA_COR).map(([fam, cor]) => (
                    <span key={fam} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" style={{ fontWeight: 600 }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
                        {fam}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Card de cluster ──────────────────────────────────────────────────────
function ClusterCard({ cluster, indicadoresGrafo, highlight, onClick }: {
    cluster: ClusterUI;
    indicadoresGrafo: GrafoNode[];
    highlight?: boolean;
    onClick?: () => void;
}) {
    const cor = corFamilia(cluster.familiaDom);
    const membros = indicadoresGrafo.filter(n => n.cluster === cluster.id);

    return (
        <button
            onClick={onClick}
            className={classNames(
                "w-full text-left rounded-xl p-4 border transition-all",
                highlight
                    ? "border-indigo-300 dark:border-indigo-500/60 ring-2 ring-indigo-200 dark:ring-indigo-500/30"
                    : "border-slate-100 dark:border-[var(--sidebar-border)] hover:border-slate-200 dark:hover:border-slate-600",
            )}
            style={{ background: `${cor}10` }}
        >
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full mt-0.5" style={{ background: cor }} />
                    <div>
                        <p className="text-sm text-slate-800 dark:text-slate-100" style={{ fontWeight: 800 }}>
                            Cluster #{cluster.id} · {cluster.microAreaDom}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                            {cluster.familiaDom} · {cluster.piramideDom} · {cluster.periodicidadeDom}
                        </p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-2xl tabular-nums text-slate-800 dark:text-slate-100 leading-none" style={{ fontWeight: 900 }}>
                        {cluster.tamanho}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500" style={{ fontWeight: 600 }}>
                        {cluster.pontosTotais} pts
                    </p>
                </div>
            </div>
            <div className="space-y-1.5">
                {membros.slice(0, 6).map(m => (
                    <div key={m.id} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0 w-12" style={{ fontWeight: 700 }}>
                            {m.id.split(" - ")[0]}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 line-clamp-1" style={{ fontWeight: 500 }}>
                            {m.descricao}
                        </span>
                    </div>
                ))}
                {membros.length > 6 && (
                    <p className="text-xs text-slate-400 italic mt-1">+{membros.length - 6} indicadores</p>
                )}
            </div>
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW DE CLUSTERS
// ═══════════════════════════════════════════════════════════════════════════

export function ClustersView({ data, isDark, cardBorder, cardShadow }: {
    data: ClustersData | null;
    isDark: boolean;
    cardBorder: string;
    cardShadow: string;
}) {
    const [clusterFocus, setClusterFocus] = useState<number | null>(null);

    if (!data) {
        return (
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-10 text-center"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Análise de clusters não disponível. Gere o arquivo <code>/assessment_clusters.json</code> rodando <code>analise_clusters.py</code>.
                </p>
            </div>
        );
    }

    const clustersSignificativos = data.clusters.filter(c => c.tamanho >= 2);
    const ondasSignificativas = data.ondasColeta.filter(o => o.qtd >= 5);

    return (
        <div className="space-y-6">
            {/* ─── KPIs Cluster ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    titulo="Clusters Significativos"
                    valor={clustersSignificativos.length}
                    icone={Network}
                    cor="from-indigo-400 to-purple-400"
                    subtitulo={`De ${data.meta.totalClusters} clusters totais`}
                />
                <KpiCard
                    titulo="Pares de Alta Similaridade"
                    valor={data.paresAltaSimilaridade.length}
                    icone={Link2}
                    cor="from-rose-400 to-pink-400"
                    subtitulo={`Cosseno ≥ ${data.meta.pairThreshold}`}
                />
                <KpiCard
                    titulo="Ondas de Coleta"
                    valor={ondasSignificativas.length}
                    icone={Waves}
                    cor="from-amber-400 to-orange-400"
                    subtitulo="Periodicidade × Família, ≥ 5 ind"
                />
                <KpiCard
                    titulo="Famílias de Evidência"
                    valor={data.familias.length}
                    icone={Sparkles}
                    cor="from-emerald-400 to-teal-400"
                    subtitulo="Tipos recorrentes detectados"
                />
            </div>

            {/* ─── Diagrama de rede ───────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                            <Network className="w-4 h-4 text-indigo-500" /> Diagrama de Cluster
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Cada nó é um indicador. Linhas conectam pares com similaridade ≥ {data.meta.edgeThreshold}.
                            Cor = Família de evidência dominante. Clique em um cluster ao lado para destacar.
                        </p>
                    </div>
                    {clusterFocus !== null && (
                        <button onClick={() => setClusterFocus(null)}
                            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 px-2 py-1 rounded-lg"
                            style={{ fontWeight: 600 }}>
                            <X className="w-3 h-3" /> Limpar foco
                        </button>
                    )}
                </div>
                <ClusterGraph data={data} clusterFocus={clusterFocus} setClusterFocus={setClusterFocus} isDark={isDark} />
            </div>

            {/* ─── Famílias de Evidência ──────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <Sparkles className="w-4 h-4 text-emerald-500" /> Famílias de Evidência
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Tipos de evidência recorrentes — uma única coleta pode satisfazer múltiplos indicadores.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.familias.map(f => (
                        <div key={f.nome} className="rounded-xl p-4 border border-slate-100 dark:border-[var(--sidebar-border)]"
                            style={{ background: `${corFamilia(f.nome)}15` }}>
                            <div className="flex items-start gap-2 mb-2">
                                <span className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: corFamilia(f.nome) }} />
                                <p className="text-sm text-slate-800 dark:text-slate-100 flex-1" style={{ fontWeight: 700 }}>
                                    {f.nome}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                                <span><span style={{ fontWeight: 800 }}>{f.qtdIndicadores}</span> ind</span>
                                <span><span style={{ fontWeight: 800 }}>{f.pontosTotais}</span> pts</span>
                                <span><span style={{ fontWeight: 800 }}>{f.qtdMicroAreas}</span> áreas</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Clusters significativos ────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="mb-4">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <GitBranch className="w-4 h-4 text-purple-500" /> Clusters com Evidência Compartilhável
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Indicadores agrupados por similaridade de descrição/evidência. Atender o cluster geralmente cobre todos os membros.
                    </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {clustersSignificativos.map(c => (
                        <ClusterCard key={c.id} cluster={c} indicadoresGrafo={data.grafo.nodes} highlight={clusterFocus === c.id} onClick={() => setClusterFocus(clusterFocus === c.id ? null : c.id)} />
                    ))}
                </div>
            </div>

            {/* ─── Pares de alta similaridade ─────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <Link2 className="w-4 h-4 text-rose-500" /> Pares de Alta Similaridade
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Top {data.paresAltaSimilaridade.length} pares com sobreposição evidente. Quanto maior a similaridade,
                        mais provável que uma evidência cobre os dois indicadores.
                    </p>
                </div>
                <div className="overflow-x-auto max-h-[420px]">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-[var(--accent)] sticky top-0">
                            <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Par</th>
                                <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Similaridade</th>
                                <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Mesma µ-área</th>
                                <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Mesma Pirâmide</th>
                                <th className="px-4 py-3 text-center" style={{ fontWeight: 700 }}>Periodicidade</th>
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Famílias comuns</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                            {data.paresAltaSimilaridade.map((p, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[var(--accent)]">
                                    <td className="px-4 py-3 font-mono">
                                        <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                            {p.a.split(" - ")[0]}
                                        </span>
                                        <span className="text-slate-400 dark:text-slate-500 mx-1.5">⇄</span>
                                        <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                            {p.b.split(" - ")[0]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="inline-flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full"
                                                    style={{ width: `${p.sim * 100}%`, background: p.sim >= 0.7 ? "#F4A8A8" : p.sim >= 0.5 ? "#F4C5A8" : "#A8C5E8" }} />
                                            </div>
                                            <span className="tabular-nums text-slate-700 dark:text-slate-200" style={{ fontWeight: 700 }}>
                                                {(p.sim * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">{p.mesmaMicroArea ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                                    <td className="px-4 py-3 text-center">{p.mesmaPiramide ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                                    <td className="px-4 py-3 text-center">{p.mesmaPeriodicidade ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {p.familiasComuns.slice(0, 3).map(f => (
                                                <span key={f} className="px-1.5 py-0.5 rounded-md text-xs"
                                                    style={{ background: `${corFamilia(f)}33`, color: corFamilia(f), fontWeight: 600 }}>
                                                    {f.split(" / ")[0]}
                                                </span>
                                            ))}
                                            {p.familiasComuns.length > 3 && (
                                                <span className="text-xs text-slate-400">+{p.familiasComuns.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Ondas de coleta ────────────────────────────────────── */}
            <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden"
                style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[var(--sidebar-border)]">
                    <h3 className="text-slate-800 dark:text-slate-100 text-base flex items-center gap-2" style={{ fontWeight: 800 }}>
                        <Waves className="w-4 h-4 text-amber-500" /> Ondas de Coleta de Evidência
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Combinações <em>periodicidade × família</em> que englobam múltiplos indicadores —
                        oportunidade de organizar a coleta em "lotes".
                    </p>
                </div>
                <div className="overflow-x-auto max-h-[420px]">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-[var(--accent)] sticky top-0">
                            <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Periodicidade</th>
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Família</th>
                                <th className="px-4 py-3 text-right" style={{ fontWeight: 700 }}>Indicadores</th>
                                <th className="px-4 py-3 text-left" style={{ fontWeight: 700 }}>Membros (preview)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-[var(--sidebar-border)]">
                            {data.ondasColeta.map((o, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[var(--accent)]">
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded-md text-xs"
                                            style={{
                                                background: o.periodicidade === "MENSAL" ? "#A8F4C533" :
                                                    o.periodicidade === "TRIMESTRAL" ? "#F4E8A833" :
                                                        o.periodicidade === "SEMESTRAL" ? "#F4C5A833" :
                                                            o.periodicidade === "ANUAL" ? "#F4A8A833" : "#94A3B833",
                                                color: o.periodicidade === "MENSAL" ? "#22C55E" :
                                                    o.periodicidade === "TRIMESTRAL" ? "#CA8A04" :
                                                        o.periodicidade === "SEMESTRAL" ? "#EA580C" :
                                                            o.periodicidade === "ANUAL" ? "#DC2626" : "#64748B",
                                                fontWeight: 700,
                                            }}>
                                            {o.periodicidade}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ background: corFamilia(o.familia) }} />
                                            <span className="text-slate-700 dark:text-slate-200" style={{ fontWeight: 600 }}>
                                                {o.familia}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200" style={{ fontWeight: 800 }}>
                                        {o.qtd}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                                        {o.indicadores.slice(0, 8).map(id => id.split(" - ")[0]).join(", ")}
                                        {o.indicadores.length > 8 && " …"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-center py-2">
                <p className="text-xs text-slate-300 dark:text-slate-600" style={{ fontWeight: 500 }}>
                    Análise gerada via TF-IDF + clustering hierárquico (linkage avg, distância ≤ {data.meta.distThreshold})
                </p>
            </div>
        </div>
    );
}
