import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getRotaCoachingData } from "../services/dataCache";

export const rotaCoachingRouter = router({
    /** Lista registros de rota coaching, opcionalmente filtrados por período (YYYY-MM-DD). */
    getAll: publicProcedure
        .input(
            z.object({
                dateStart: z.string().optional(),
                dateEnd: z.string().optional(),
            }).optional()
        )
        .query(async ({ input }) => {
            return await getRotaCoachingData(input?.dateStart, input?.dateEnd);
        }),
});
