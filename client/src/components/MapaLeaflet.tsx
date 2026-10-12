/*
 * Mapa Leaflet + OpenStreetMap (carregado do CDN na primeira vez), com marcadores redondos de letra,
 * linhas tracejadas e um círculo opcional. Usado na Rota Coaching e no Relatório de Entregas.
 */
import React from "react";

export interface PontoMapa { lat: number; lon: number; cor: string; letra: string; titulo: string; info?: string }
export interface LinhaMapa { de: [number, number]; ate: [number, number]; cor: string; rotulo?: string }
export interface CirculoMapa { lat: number; lon: number; raioM: number; cor: string }

function carregarLeaflet(): Promise<any> {
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
  }
  return new Promise(resolve => {
    if ((window as any).L) { resolve((window as any).L); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => resolve((window as any).L);
    document.head.appendChild(script);
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function MapaLeaflet({ pontos, linhas = [], circulo, altura = 420 }: {
  pontos: PontoMapa[]; linhas?: LinhaMapa[]; circulo?: CirculoMapa; altura?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current || !pontos.length) return;
    let map: any = null;
    let vivo = true;
    carregarLeaflet().then(L => {
      if (!vivo || !ref.current) return;
      map = L.map(ref.current, { zoomControl: true, scrollWheelZoom: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);

      const limites: [number, number][] = [];
      if (circulo) {
        L.circle([circulo.lat, circulo.lon], { radius: circulo.raioM, color: circulo.cor, weight: 1, fillOpacity: 0.08 }).addTo(map);
      }
      for (const l of linhas) {
        const linha = L.polyline([l.de, l.ate], { color: l.cor, weight: 2, dashArray: "6 6" }).addTo(map);
        if (l.rotulo) linha.bindTooltip(esc(l.rotulo), { permanent: true, direction: "center", className: "text-[11px]" });
      }
      for (const p of pontos) {
        limites.push([p.lat, p.lon]);
        const icone = L.divIcon({
          className: "",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${p.cor};border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:11px;color:white;font-family:monospace;">${esc(p.letra)}</div>`,
        });
        L.marker([p.lat, p.lon], { icon: icone }).bindPopup(`
          <div style="font-family:monospace;font-size:12px;min-width:160px">
            <div style="font-weight:700;margin-bottom:4px">${esc(p.titulo)}</div>
            <div style="color:#64748b;font-size:11px;white-space:pre-line">${esc(p.info ?? "")}</div>
            <div style="color:#94a3b8;font-size:10px;margin-top:2px">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</div>
          </div>`).addTo(map);
      }
      if (limites.length === 1) map.setView(limites[0], 16);
      else map.fitBounds(limites, { padding: [30, 30], maxZoom: 17 });
    });
    return () => { vivo = false; map?.remove(); };
  }, [pontos, linhas, circulo]);

  return <div ref={ref} style={{ height: `${altura}px`, width: "100%", background: "#f8fafc" }} />;
}
