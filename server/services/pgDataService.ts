/**
 * Substitui xlsxService.loadGoogleSheetsData() lendo do PostgreSQL.
 * Retorna ProcessedVisita[] — mesma interface esperada por dataCache.ts e
 * todos os routers existentes, sem nenhuma mudança necessária neles.
 */
import { alias } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
    pathtrackerVisitas,
    pathtrackerClientes,
    pathtrackerHierarquia,
    revendas,
} from "../../drizzle/schema";
import { ProcessedVisita, classificarVisita } from "./xlsxService";

const vendedorAlias = alias(pathtrackerHierarquia, "vendedorH");
const gerenteAlias  = alias(pathtrackerHierarquia, "gerenteH");

export async function loadFromDatabase(): Promise<ProcessedVisita[]> {
    const db = await getDb();
    if (!db) throw new Error("[pgDataService] Banco não disponível — verifique DATABASE_URL");

    console.log("[pgDataService] Carregando visitas do PostgreSQL...");
    const t0 = Date.now();

    const rows = await db
        .select({
            id:            pathtrackerVisitas.id,
            revenda:       revendas.nome,
            data:          pathtrackerVisitas.data,
            codVendedor:   vendedorAlias.codigo,
            codGerente:    gerenteAlias.codigo,
            codCliente:    pathtrackerClientes.codigoCliente,
            razaoSocial:   pathtrackerClientes.razaoSocial,
            sequenciaErp:  pathtrackerVisitas.sequenciaErp,
            sequenciaPt:   pathtrackerVisitas.sequenciaPt,
            valorPedido:   pathtrackerVisitas.valorPedido,
            obsPedido:     pathtrackerVisitas.obsPedido,
            tipoCobranca:  pathtrackerVisitas.tipoCobranca,
            horaInicio:    pathtrackerVisitas.horaInicio,
            horaFim:       pathtrackerVisitas.horaFim,
            tempoVisita:   pathtrackerVisitas.tempoVisita,
            distanciaPdv:  pathtrackerVisitas.distanciaPdv,
            distanciaRota: pathtrackerVisitas.distanciaRota,
        })
        .from(pathtrackerVisitas)
        .innerJoin(revendas,            eq(pathtrackerVisitas.revendaId,  revendas.id))
        .innerJoin(pathtrackerClientes, eq(pathtrackerVisitas.clienteId,  pathtrackerClientes.id))
        .innerJoin(vendedorAlias,       eq(pathtrackerVisitas.vendedorId, vendedorAlias.id))
        .leftJoin(gerenteAlias,         eq(pathtrackerVisitas.gerenteId,  gerenteAlias.id));

    console.log(`[pgDataService] ✓ ${rows.length} registros em ${Date.now() - t0}ms`);

    return rows.map((row) => {
        const valorNumerico = row.valorPedido != null ? parseFloat(String(row.valorPedido)) : 0;

        // Reconstrói o texto original do campo Valor Ped. para reutilizar
        // a lógica de classificarVisita() sem duplicar o mapeamento de motivos.
        const valorPedidoStr = row.obsPedido
            ?? (valorNumerico > 0 ? String(valorNumerico).replace(".", ",") : "0,00");

        const { status, motivo } = classificarVisita(
            { "Ini. Hour": row.horaInicio ?? "ND", "Valor Ped.": valorPedidoStr } as any,
            null,
        );

        // Converte numeric(8,2) de volta para string no formato "30,38" (vírgula)
        const fmtDist = (v: unknown) =>
            v != null ? String(v).replace(".", ",") : "ND";

        return {
            id:           row.id,
            vendedor:     row.codVendedor,
            gerente:      row.codGerente ?? 0,
            revenda:      row.revenda,
            data:         row.data,          // DATE → "YYYY-MM-DD"
            cliente:      row.razaoSocial ?? "",
            codCliente:   row.codCliente,
            seqERP:       row.sequenciaErp ?? 0,
            seqPT:        row.sequenciaPt ?? 0,
            valorPedido:  valorPedidoStr,
            valorNumerico,
            tipoCobr:     row.tipoCobranca ?? "",
            horaInicio:   row.horaInicio ?? "ND",
            horaFim:      row.horaFim ?? "ND",
            tempoVisita:  row.tempoVisita ?? "ND",
            distR:        fmtDist(row.distanciaRota),
            distPV:       fmtDist(row.distanciaPdv),
            status,
            motivo,
        } satisfies ProcessedVisita;
    });
}
