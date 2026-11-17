import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { dashboardRouter } from "./routers/dashboardRouter";
import { clientesRouter } from "./routers/clientesRouter";
import { ptRouter } from "./routers/ptRouter";
import { analiseRouter } from "./routers/analiseRouter";
import { analiseGestorRouter } from "./routers/analiseGestorRouter";
import { trelloRouter } from "./routers/trelloRouter";
import { evolutionRouter } from "./routers/evolutionRouter";
import { automacaoRouter } from "./routers/automacaoRouter";
import { assessmentRouter } from "./routers/assessmentRouter";
import { crmRouter } from "./routers/crmRouter";
import { configRouter } from "./routers/configRouter";
import { entregasRouter } from "./routers/entregasRouter";
import { pernoiteRouter } from "./routers/pernoiteRouter";
import { desvioRouter } from "./routers/desvioRouter";
import { produtividadeRouter } from "./routers/produtividadeRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  dashboard: dashboardRouter,
  clientes: clientesRouter,
  pt: ptRouter,
  analise: analiseRouter,
  analiseGestor: analiseGestorRouter,
  trello: trelloRouter,
  evolution: evolutionRouter,
  automacao: automacaoRouter,
  assessment: assessmentRouter,
  crm: crmRouter,
  config: configRouter,
  entregas: entregasRouter,
  pernoite: pernoiteRouter,
  desvio: desvioRouter,
  produtividade: produtividadeRouter,
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
