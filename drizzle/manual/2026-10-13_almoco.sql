-- Intervalo de almoço (informativo): limites no ⚙ e entregas no almoço por rota e dia. Idempotente; sem drizzle-kit push.
ALTER TABLE "entregas_config"
  ADD COLUMN IF NOT EXISTS "almocoDe" varchar(5) NOT NULL DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS "almocoAte" varchar(5) NOT NULL DEFAULT '13:45';
ALTER TABLE "rotas_dia"
  ADD COLUMN IF NOT EXISTS "entregasAlmoco" integer NOT NULL DEFAULT 0;
