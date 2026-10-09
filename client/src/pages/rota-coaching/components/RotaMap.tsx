import React from "react";
import { MapaLeaflet, type PontoMapa } from "@/components/MapaLeaflet";
import { MapPonto } from "../lib/types";

const ICONE: Record<MapPonto["tipo"], [string, string]> = {
    pdv: ['#64748b', 'P'],
    ga: ['#6366f1', 'G'],
    vend: ['#0ea5e9', 'V'],
};

export function RotaMap({ pontos, gaId }: { pontos: MapPonto[]; gaId: string }) {
    const marcadores = React.useMemo<PontoMapa[]>(() => pontos.map(p => {
        const [cor, letra] = ICONE[p.tipo] ?? ['#94a3b8', '?'];
        return { lat: p.lat, lon: p.lon, cor, letra, titulo: p.label, info: p.info };
    }), [pontos]);

    if (pontos.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-[var(--border)] text-slate-400 dark:text-slate-500 text-xs">
                Nenhuma coordenada disponível para exibir no mapa
            </div>
        );
    }

    return (
        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-[var(--border)]" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center gap-4 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-[var(--border)] flex-wrap">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">Mapa da Rota — {gaId}</span>
                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span style={{ background: '#64748b' }} className="w-4 h-4 rounded-full inline-block" />PDV (cadastro)
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span style={{ background: '#6366f1' }} className="w-4 h-4 rounded-full inline-block" />GA (app)
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span style={{ background: '#0ea5e9' }} className="w-4 h-4 rounded-full inline-block" />Vendedor (GPS)
                </span>
            </div>
            <MapaLeaflet pontos={marcadores} />
        </div>
    );
}
