/*
 * Mapa de uma entrega: cliente (cadastro), onde o motorista registrou no app e a parada do caminhão
 * mais próxima (Infleet), com o raio em volta do cliente e a distância de cada ponto até ele.
 */
import { useMemo } from "react";
import { MapaLeaflet, type CirculoMapa, type LinhaMapa, type PontoMapa } from "@/components/MapaLeaflet";
import { horaBRT } from "@shared/entregas";

const COR = { cliente: "#475569", app: "#eb6834", parada: "#2a78d6" };

/** Distância em metros (haversine) — a mesma conta do servidor (detectarParadas.distM). */
function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}
const metros = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`);

export interface EntregaNoMapa {
  entrega: { cliente: string; codCliente: string; lat: number | null; lon: number | null; latApp: number | null; lonApp: number | null; baixaEm: Date | null };
  maisProxima: { lat: number; lon: number; inicio: Date; fim: Date; distM: number } | null;
}

export function MapaEntrega({ b, raioM }: { b: EntregaNoMapa; raioM: number }) {
  const { entrega: e, maisProxima: p } = b;
  const dados = useMemo(() => {
    if (e.lat === null || e.lon === null) return null;
    const pontos: PontoMapa[] = [{ lat: e.lat, lon: e.lon, cor: COR.cliente, letra: "C", titulo: `Cliente ${e.codCliente}`, info: e.cliente }];
    const linhas: LinhaMapa[] = [];
    const circulo: CirculoMapa = { lat: e.lat, lon: e.lon, raioM, cor: COR.cliente };
    let app: number | null = null;
    if (e.latApp !== null && e.lonApp !== null) {
      app = distM(e.lat, e.lon, e.latApp, e.lonApp);
      pontos.push({ lat: e.latApp, lon: e.lonApp, cor: COR.app, letra: "M", titulo: "Motorista (app)", info: `Registrou a entrega${e.baixaEm ? ` às ${horaBRT(e.baixaEm)}` : ""} a ${metros(app)} do cliente` });
      linhas.push({ de: [e.lat, e.lon], ate: [e.latApp, e.lonApp], cor: COR.app, rotulo: metros(app) });
    }
    if (p) {
      pontos.push({ lat: p.lat, lon: p.lon, cor: COR.parada, letra: "P", titulo: "Parada do caminhão (GPS)", info: `${horaBRT(p.inicio)}–${horaBRT(p.fim)} a ${metros(p.distM)} do cliente` });
      linhas.push({ de: [e.lat, e.lon], ate: [p.lat, p.lon], cor: COR.parada, rotulo: metros(p.distM) });
    }
    return { pontos, linhas, circulo, app };
  }, [e, p, raioM]);

  if (!dados) return <p className="text-xs text-slate-400 dark:text-slate-500 py-2">Cliente sem coordenada no cadastro — não há como mostrar no mapa.</p>;

  const item = (cor: string, texto: string) => (
    <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
      <span style={{ background: cor }} className="w-3.5 h-3.5 rounded-full inline-block" />{texto}
    </span>
  );
  return (
    <div className="my-2 rounded-xl overflow-hidden border border-slate-200 dark:border-[var(--border)] max-w-[900px]">
      <div className="flex items-center gap-4 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-[var(--border)] flex-wrap">
        {item(COR.cliente, `C · Cliente (cadastro) · raio ${raioM} m`)}
        {item(COR.app, dados.app !== null ? `M · Motorista no app a ${metros(dados.app)}` : "M · sem coordenada do app")}
        {item(COR.parada, p ? `P · Parada do caminhão a ${metros(p.distM)}` : "P · sem parada no GPS")}
      </div>
      <MapaLeaflet pontos={dados.pontos} linhas={dados.linhas} circulo={dados.circulo} altura={320} />
    </div>
  );
}
