import { publicProcedure, router } from "../_core/trpc";
import { getRotaCoachingData } from "../services/dataCache";

export const rotaCoachingRouter = router({
    getAll: publicProcedure.query(async () => {
        return await getRotaCoachingData();
    }),
});
