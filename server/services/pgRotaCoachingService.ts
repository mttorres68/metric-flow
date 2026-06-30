/**
 * Lê dados de Rota Coaching do PostgreSQL.
 * Retorna o mesmo shape que o rota_coaching_all.json esperava,
 * preservando compatibilidade com RotaCoaching.tsx sem mudanças no frontend.
 */
import { and, desc, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { rotaCoaching } from "../../drizzle/schema";

export async function loadRotaCoachingFromDatabase(dateStart?: string, dateEnd?: string): Promise<any[]> {
    const db = await getDb();
    if (!db) throw new Error("[pgRotaCoachingService] Banco não disponível");

    const conds = [
        dateStart ? gte(rotaCoaching.data, dateStart) : undefined,
        dateEnd ? lte(rotaCoaching.data, dateEnd) : undefined,
    ].filter(Boolean) as any[];

    const rows = await db
        .select()
        .from(rotaCoaching)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(rotaCoaching.data));

    // Mapeia de volta ao shape que o frontend espera (campos do JSON original)
    return rows.map((r) => ({
        // Campos duplos (frontend usa os curtos: rev, gaId, vendId)
        revenda: r.revenda,
        rev: r.revenda,
        ga: r.gaId,
        gaId: r.gaId,
        vendedor_agenda: r.vendedorAgenda ?? r.vendedorId,
        vendId: r.vendedorId,
        data: (() => { const d = r.data as unknown; return d instanceof Date ? d.toISOString().substring(0, 10) : String(d ?? "").substring(0, 10); })(),
        atividade: r.atividade,
        tipo_atividade: r.tipoAtividade,
        fonte: r.fonte,
        agendado: r.agendado,
        // KPIs — nome longo (script original) e curto (frontend)
        qtd_carteira: r.pdvsProgramados,
        pdvsProg: r.pdvsProgramados,
        qtd_visitados: r.pdvsVisitados,
        pdvsVis: r.pdvsVisitados,
        visitas_ga: r.visitasGa,
        gaVis: r.visitasGa,
        conformidade_pct: r.pctConformidade != null ? parseFloat(String(r.pctConformidade)) : null,
        pctGA: r.pctConformidade != null ? parseFloat(String(r.pctConformidade)) : null,
        pctV: r.pctVisitados != null ? parseFloat(String(r.pctVisitados)) : null,
        pctCob: r.pctCobertura != null ? parseFloat(String(r.pctCobertura)) : null,
        setor_agendado: r.setorAgendado ?? "",
        setores_app: r.setoresApp ?? [],
        pct_geo_confirmado: r.pctGeoConfirmado != null ? parseFloat(String(r.pctGeoConfirmado)) : null,
        // Status
        status: r.status,
        status_py: r.statusPy,
        ga_fez_coaching: r.gaFezCoaching,
        mesmo_vendedor: r.mesmoVendedor,
        vendedor_no_app: r.vendedorNoApp,
        // Arrays de clientes (JSONB → array JS)
        clientes_vendedor: r.clientesVendedor ?? [],
        clientes_ga: r.clientesGa ?? [],
        clientes_comuns: r.clientesComuns ?? [],
        clientes_so_vend: r.clientesSoVend ?? [],
        clientes_so_ga: r.clientesSoGa ?? [],
        clientes_dentro_raio: r.clientesDentroRaio ?? [],
        clientes_fora_raio: r.clientesForaRaio ?? [],
        clientes_sem_coords: r.clientesSemCoords ?? [],
        // Detalhes geográficos
        geo_detalhes: r.geoDetalhes ?? [],
    }));
}
