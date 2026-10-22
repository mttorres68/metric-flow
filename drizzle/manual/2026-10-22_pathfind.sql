-- Pathfind: hora prevista por cliente (spec pathfind-previsto §4). Idempotente.
ALTER TABLE entregas_contas ADD COLUMN IF NOT EXISTS "pathfindBase" varchar(200);
ALTER TABLE entregas_contas ADD COLUMN IF NOT EXISTS "pathfindUsuario" varchar(120);
ALTER TABLE entregas_contas ADD COLUMN IF NOT EXISTS "pathfindSenha" text;
ALTER TABLE entregas_contas ADD COLUMN IF NOT EXISTS "pathfindUltimaColetaEm" timestamptz;
ALTER TABLE entregas_contas ADD COLUMN IF NOT EXISTS "pathfindUltimaColetaOk" boolean;
ALTER TABLE entregas_contas ADD COLUMN IF NOT EXISTS "pathfindUltimaColetaErro" text;

ALTER TABLE entregas_config ADD COLUMN IF NOT EXISTS "previstoToleranciaMin" integer NOT NULL DEFAULT 15;

CREATE TABLE IF NOT EXISTS pathfind_rotas (
  id serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES revendas(id),
  "dataSimulacao" date NOT NULL,
  simulacao varchar(20) NOT NULL,
  rota varchar(20) NOT NULL,
  placa varchar(20) NOT NULL,
  motorista varchar(120) NOT NULL,
  "tempoMin" integer,
  km double precision,
  "coletadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pathfind_rotas ON pathfind_rotas ("revendaId", simulacao, rota);
CREATE INDEX IF NOT EXISTS ix_pathfind_rotas_data ON pathfind_rotas ("revendaId", "dataSimulacao");

CREATE TABLE IF NOT EXISTS pathfind_paradas (
  id serial PRIMARY KEY,
  "rotaId" integer NOT NULL REFERENCES pathfind_rotas(id) ON DELETE CASCADE,
  sequencia integer NOT NULL,
  pedido varchar(20) NOT NULL,
  "codCliente" varchar(40) NOT NULL,
  cliente varchar(200) NOT NULL,
  cidade varchar(120) NOT NULL,
  "chegadaPrevista" varchar(5) NOT NULL,
  "saidaPrevista" varchar(5) NOT NULL,
  km double precision
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pathfind_paradas ON pathfind_paradas ("rotaId", sequencia, pedido);
