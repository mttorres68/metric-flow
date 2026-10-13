-- Produtividade da rota por dia (spec task/entregas/rota-produtividade-design.md §3). Idempotente; sem drizzle-kit push.
CREATE TABLE IF NOT EXISTS "rotas_dia" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "routeId" varchar(40) NOT NULL,
  "dia" date NOT NULL,
  "placa" varchar(20) NOT NULL,
  "motorista" varchar(120) NOT NULL,
  "saida" timestamptz,
  "retorno" timestamptz,
  "jornadaMin" integer,
  "rodandoMin" integer,
  "emClienteMin" integer,
  "paradoSemClienteMin" integer,
  "idaMin" integer,
  "voltaMin" integer,
  "entregas" integer NOT NULL DEFAULT 0,
  "aEntregar" integer NOT NULL DEFAULT 0,
  "totalRota" integer NOT NULL DEFAULT 0,
  "hl" double precision NOT NULL DEFAULT 0,
  "hlPorHora" double precision,
  "devPct" double precision,
  "kmGps" double precision,
  "semGps" varchar(80),
  "parcial" boolean NOT NULL DEFAULT false,
  "incompleto" boolean NOT NULL DEFAULT false,
  "rotaInicio" timestamptz NOT NULL,
  "rotaFim" timestamptz,
  "calculadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_rotas_dia" ON "rotas_dia" ("revendaId", "routeId", "dia");
CREATE INDEX IF NOT EXISTS "ix_rotas_dia_dia" ON "rotas_dia" ("revendaId", "dia");
CREATE INDEX IF NOT EXISTS "ix_rotas_dia_inicio" ON "rotas_dia" ("revendaId", "rotaInicio");
