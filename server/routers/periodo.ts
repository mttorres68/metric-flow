/* MetricFlow — período { revendaId, de, ate } das rotas, com o limite de dias de cada uso. */
import { z } from "zod";
import { diasEntre } from "@shared/intervalos";

export const diaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const periodoAte = (maxDias: number) => z.object({ revendaId: z.number().int(), de: diaIso, ate: diaIso })
  .refine(p => p.de <= p.ate && diasEntre(p.de, p.ate) <= maxDias, `Período de no máximo ${maxDias} dias.`);
