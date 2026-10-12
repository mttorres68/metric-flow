-- Detector de desvio de carga (spec task/entregas/desvio-design.md §4). Idempotente; sem drizzle-kit push.
CREATE TABLE IF NOT EXISTS "erp_pedidos" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "pedido" varchar(20) NOT NULL,
  "romaneio" varchar(20) NOT NULL DEFAULT '',
  "cliente" varchar(20) NOT NULL DEFAULT '',
  "vendedor" varchar(12) NOT NULL DEFAULT '',
  "canal" varchar(12) NOT NULL DEFAULT '',
  "origem" varchar(4) NOT NULL DEFAULT '',
  "placa" varchar(12) NOT NULL DEFAULT '',
  "motoristaCod" varchar(12) NOT NULL DEFAULT '',
  "dataPedido" date,
  "tipoCobranca" varchar(4) NOT NULL DEFAULT '',
  "condicaoPagamento" varchar(4) NOT NULL DEFAULT '',
  "banco" varchar(6) NOT NULL DEFAULT '',
  "vencimento1" date,
  "situacao" varchar(10) NOT NULL,
  "dataAcerto" date,
  "flagRomaneio" varchar(2) NOT NULL DEFAULT '',
  "valor" double precision NOT NULL DEFAULT 0,
  "valorRetorno" double precision NOT NULL DEFAULT 0,
  "itens" integer NOT NULL DEFAULT 0,
  "produtos" integer NOT NULL DEFAULT 0,
  "atualizadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_erp_pedidos" ON "erp_pedidos" ("revendaId", "pedido");
CREATE INDEX IF NOT EXISTS "ix_erp_pedidos_data" ON "erp_pedidos" ("revendaId", "dataPedido");
CREATE INDEX IF NOT EXISTS "ix_erp_pedidos_cliente" ON "erp_pedidos" ("revendaId", "cliente");
CREATE INDEX IF NOT EXISTS "ix_erp_pedidos_romaneio" ON "erp_pedidos" ("revendaId", "romaneio");

CREATE TABLE IF NOT EXISTS "entregas_evidencias" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "dia" date NOT NULL,
  "routeId" varchar(40) NOT NULL,
  "codCliente" varchar(40) NOT NULL,
  "placa" varchar(20) NOT NULL,
  "motorista" varchar(120) NOT NULL,
  "documentos" text[] NOT NULL DEFAULT '{}',
  "status" varchar(20) NOT NULL,
  "distParadaM" double precision,
  "paradaLat" double precision,
  "paradaLon" double precision,
  "paradaInicio" timestamptz,
  "paradaFim" timestamptz,
  "distAppM" double precision,
  "clienteLat" double precision,
  "clienteLon" double precision,
  "calculadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_entregas_evidencias" ON "entregas_evidencias" ("revendaId", "routeId", "codCliente", "dia");
CREATE INDEX IF NOT EXISTS "ix_entregas_evidencias_dia" ON "entregas_evidencias" ("revendaId", "dia");

CREATE TABLE IF NOT EXISTS "desvio_revisoes" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "pedido" varchar(20) NOT NULL,
  "situacao" varchar(12) NOT NULL,
  "observacao" text NOT NULL DEFAULT '',
  "revisadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_desvio_revisoes" ON "desvio_revisoes" ("revendaId", "pedido");
