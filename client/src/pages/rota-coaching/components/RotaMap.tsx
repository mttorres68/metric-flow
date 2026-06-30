import React from "react";
import { MapPonto } from "../lib/types";

export function RotaMap({ pontos, gaId }: { pontos: MapPonto[]; gaId: string }) {
    const mapRef = React.useRef<HTMLDivElement>(null);
    const instanceRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (!mapRef.current || pontos.length === 0) return;

        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
            document.head.appendChild(link);
        }

        const loadLeaflet = () => new Promise<any>(resolve => {
            if ((window as any).L) { resolve((window as any).L); return; }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
            script.onload = () => resolve((window as any).L);
            document.head.appendChild(script);
        });

        loadLeaflet().then(L => {
            if (!mapRef.current) return;

            if (instanceRef.current) {
                instanceRef.current.remove();
                instanceRef.current = null;
            }

            const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
            instanceRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19,
            }).addTo(map);

            const bounds: [number, number][] = [];

            pontos.forEach(p => {
                bounds.push([p.lat, p.lon]);

                const svgIcon = (cor: string, letra: string) => L.divIcon({
                    className: '',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                    html: `<div style="width:28px;height:28px;border-radius:50%;background:${cor};border:2px solid white;
                        box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;
                        font-weight:700;font-size:11px;color:white;font-family:monospace;">${letra}</div>`,
                });

                const iconMap: Record<string, [string, string]> = {
                    pdv: ['#64748b', 'P'],
                    ga: ['#6366f1', 'G'],
                    vend: ['#0ea5e9', 'V'],
                };
                const [cor2, letra2] = iconMap[p.tipo] ?? ['#94a3b8', '?'];

                const marker = L.marker([p.lat, p.lon], { icon: svgIcon(cor2, letra2) });
                marker.bindPopup(`
                    <div style="font-family:monospace;font-size:12px;min-width:160px">
                        <div style="font-weight:700;margin-bottom:4px">${p.label}</div>
                        <div style="color:#64748b;font-size:11px">${p.info ?? ''}</div>
                        <div style="color:#94a3b8;font-size:10px;margin-top:2px">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</div>
                    </div>
                `);
                marker.addTo(map);
            });

            if (bounds.length === 1) {
                map.setView(bounds[0], 16);
            } else if (bounds.length > 1) {
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
            }
        });

        return () => {
            if (instanceRef.current) {
                instanceRef.current.remove();
                instanceRef.current = null;
            }
        };
    }, [pontos]);

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
            <div ref={mapRef} style={{ height: '420px', width: '100%', background: '#f8fafc' }} />
        </div>
    );
}
