import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { dashboardRouter } from "./routers/dashboardRouter";
import { vendedoresRouter } from "./routers/vendedoresRouter";
import { complianceRouter } from "./routers/complianceRouter ";
import { clientesRouter } from "./routers/clientesRouter";
import { infleetRouter } from "./routers/infleetRouter";
import { ptRouter } from "./routers/ptRouter";
import { analiseRouter } from "./routers/analiseRouter";
import { analiseGestorRouter } from "./routers/analiseGestorRouter";
import { rotaCoachingRouter } from "./routers/rotaCoachingRouter";
import { trelloRouter } from "./routers/trelloRouter";
import { evolutionRouter } from "./routers/evolutionRouter";
import { automacaoRouter } from "./routers/automacaoRouter";
import { assessmentRouter } from "./routers/assessmentRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  dashboard: dashboardRouter,
  vendedores: vendedoresRouter,
  compliance: complianceRouter,
  clientes: clientesRouter,
  infleet: infleetRouter,
  pt: ptRouter,
  analise: analiseRouter,
  analiseGestor: analiseGestorRouter,
  rotaCoaching: rotaCoachingRouter,
  trello: trelloRouter,
  evolution: evolutionRouter,
  automacao: automacaoRouter,
  assessment: assessmentRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
