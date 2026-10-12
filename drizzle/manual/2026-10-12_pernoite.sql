-- Pernoite "na malícia" e "cozinhando o galo" (spec task/entregas/pernoite-design.md §6). Idempotente; sem drizzle-kit push.
ALTER TABLE "entregas_config"
  ADD COLUMN IF NOT EXISTS "pernoiteMaxKm" double precision NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS "pernoiteChegarAte" varchar(5) NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS "pernoiteFatorEstrada" double precision NOT NULL DEFAULT 1.3,
  ADD COLUMN IF NOT EXISTS "pernoiteVelKmh" double precision NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "pernoiteParouCedo" varchar(5) NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS "pernoiteFinalLentoX" double precision NOT NULL DEFAULT 2;
CREATE TABLE IF NOT EXISTS "pernoites" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "placa" varchar(20) NOT NULL,
  "motorista" varchar(120) NOT NULL,
  "dia" date NOT NULL,
  "lat" double precision,
  "lon" double precision,
  "endereco" text,
  "cidade" varchar(120),
  "distSedeKm" double precision,
  "chegada" timestamptz,
  "saidaManha" timestamptz,
  "descansoMin" integer,
  "ultimoClienteSaida" timestamptz,
  "chaveLigadaMin" integer,
  "madrugadaEventos" integer NOT NULL DEFAULT 0,
  "classificacao" varchar(12) NOT NULL,
  "sinais" jsonb NOT NULL,
  "galo" integer NOT NULL DEFAULT 0,
  "calculadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pernoites" ON "pernoites" ("revendaId", "placa", "dia");
CREATE INDEX IF NOT EXISTS "ix_pernoites_dia" ON "pernoites" ("revendaId", "dia");
CREATE INDEX IF NOT EXISTS "ix_pernoites_motorista" ON "pernoites" ("revendaId", "motorista", "dia");
