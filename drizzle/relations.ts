import { relations } from "drizzle-orm";
import {
  assessmentItens,
  assessmentResponsabilidades,
  assessmentRespostas,
  colaboradores,
  revendas,
} from "./schema";

export const revendasRelations = relations(revendas, ({ many }) => ({
  colaboradores: many(colaboradores),
  responsabilidades: many(assessmentResponsabilidades),
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
