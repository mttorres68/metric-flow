import { relations } from "drizzle-orm";
import {
  assessmentItens,
  assessmentResponsabilidades,
  assessmentRespostas,
  colaboradores,
  pathtrackerClientes,
  pathtrackerHierarquia,
  pathtrackerVisitas,
  revendas,
} from "./schema";

export const revendasRelations = relations(revendas, ({ many }) => ({
  colaboradores: many(colaboradores),
  responsabilidades: many(assessmentResponsabilidades),
  pathtrackerHierarquia: many(pathtrackerHierarquia),
  pathtrackerVisitas: many(pathtrackerVisitas),
}));

export const colaboradoresRelations = relations(colaboradores, ({ one, many }) => ({
  revenda: one(revendas, {
    fields: [colaboradores.revendaId],
    references: [revendas.id],
  }),
  responsabilidadesComoResponsavel: many(assessmentResponsabilidades, {
    relationName: "responsavel",
  }),
  responsabilidadesComoApoio: many(assessmentResponsabilidades, {
    relationName: "apoio",
  }),
}));

export const assessmentItensRelations = relations(assessmentItens, ({ many }) => ({
  responsabilidades: many(assessmentResponsabilidades),
}));

export const assessmentResponsabilidadesRelations = relations(
  assessmentResponsabilidades,
  ({ one }) => ({
    revenda: one(revendas, {
      fields: [assessmentResponsabilidades.revendaId],
      references: [revendas.id],
    }),
    responsavel: one(colaboradores, {
      fields: [assessmentResponsabilidades.responsavelId],
      references: [colaboradores.id],
      relationName: "responsavel",
    }),
    apoio: one(colaboradores, {
      fields: [assessmentResponsabilidades.apoioId],
      references: [colaboradores.id],
      relationName: "apoio",
    }),
  }),
);

export const assessmentRespostasRelations = relations(assessmentRespostas, ({ one }) => ({
  itemCatalogo: one(assessmentItens, {
    fields: [assessmentRespostas.item],
    references: [assessmentItens.item],
  }),
}));

export const pathtrackerClientesRelations = relations(pathtrackerClientes, ({ many }) => ({
  visitas: many(pathtrackerVisitas),
}));

export const pathtrackerHierarquiaRelations = relations(pathtrackerHierarquia, ({ one, many }) => ({
  revenda: one(revendas, {
    fields: [pathtrackerHierarquia.revendaId],
    references: [revendas.id],
  }),
  visitasComoVendedor: many(pathtrackerVisitas, { relationName: "vendedor" }),
  visitasComoSupervisor: many(pathtrackerVisitas, { relationName: "supervisor" }),
  visitasComoGerente: many(pathtrackerVisitas, { relationName: "gerente" }),
}));

export const pathtrackerVisitasRelations = relations(pathtrackerVisitas, ({ one }) => ({
  revenda: one(revendas, {
    fields: [pathtrackerVisitas.revendaId],
    references: [revendas.id],
  }),
  cliente: one(pathtrackerClientes, {
    fields: [pathtrackerVisitas.clienteId],
    references: [pathtrackerClientes.id],
  }),
  vendedor: one(pathtrackerHierarquia, {
    fields: [pathtrackerVisitas.vendedorId],
    references: [pathtrackerHierarquia.id],
    relationName: "vendedor",
  }),
  supervisor: one(pathtrackerHierarquia, {
    fields: [pathtrackerVisitas.supervisorId],
    references: [pathtrackerHierarquia.id],
    relationName: "supervisor",
  }),
  gerente: one(pathtrackerHierarquia, {
    fields: [pathtrackerVisitas.gerenteId],
    references: [pathtrackerHierarquia.id],
    relationName: "gerente",
  }),
}));
