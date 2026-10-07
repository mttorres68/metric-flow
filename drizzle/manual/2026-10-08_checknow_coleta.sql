-- Coleta automática do CheckNow (spec task/entregas/checknow-coleta-design.md §4).
-- Idempotente; só cria tabelas novas (sem drizzle-kit push).
CREATE TABLE IF NOT EXISTS "entregas_contas" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL UNIQUE REFERENCES "revendas"("id"),
  "ativo" boolean NOT NULL DEFAULT true,
  "checknowUsuario" varchar(120) NOT NULL,
  "checknowSenha" text NOT NULL,
  "infleetToken" text,
  "ultimaColetaEm" timestamptz,
  "ultimaColetaOk" boolean,
  "ultimaColetaErro" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "checknow_entregas" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "dia" date NOT NULL,
  "routeId" varchar(40) NOT NULL,
  "placa" varchar(20) NOT NULL,
  "motorista" varchar(120) NOT NULL,
  "codCliente" varchar(40) NOT NULL,
  "cliente" varchar(200) NOT NULL,
  "lat" double precision,
  "lon" double precision,
  "situacao" varchar(20) NOT NULL,
  "baixaEm" timestamptz,
  "saidaApp" timestamptz,
  "rotaInicio" timestamptz NOT NULL,
  "rotaFim" timestamptz,
  "odoIniInformado" double precision,
  "odoFimInformado" double precision,
  "ordemPlanejada" integer,
  "valor" double precision NOT NULL DEFAULT 0,
  "pesoKg" double precision NOT NULL DEFAULT 0,
  "notas" integer NOT NULL DEFAULT 0,
  "motivoProblema" text,
  "capacidadeKg" double precision,
  "cidade" varchar(120) NOT NULL DEFAULT '',
  "coletadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_checknow_entregas" ON "checknow_entregas" ("revendaId", "routeId", "codCliente");
CREATE INDEX IF NOT EXISTS "ix_checknow_entregas_dia" ON "checknow_entregas" ("revendaId", "dia");
CREATE TABLE IF NOT EXISTS "checknow_coletas" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "origem" varchar(10) NOT NULL,
  "periodoDe" date NOT NULL,
  "periodoAte" date NOT NULL,
  "iniciadoEm" timestamptz NOT NULL DEFAULT now(),
  "terminadoEm" timestamptz,
  "status" varchar(10) NOT NULL,
  "rotas" integer,
  "linhas" integer,
  "erro" text
);
CREATE INDEX IF NOT EXISTS "ix_checknow_coletas" ON "checknow_coletas" ("revendaId", "iniciadoEm");
