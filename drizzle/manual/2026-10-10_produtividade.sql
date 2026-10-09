-- Produtividade em hL (spec task/entregas/produtividade-design.md §4). Idempotente; sem drizzle-kit push.
ALTER TABLE "checknow_entregas" ADD COLUMN IF NOT EXISTS "documentos" text[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS "produtos" (
  "codigo" varchar(20) PRIMARY KEY,
  "descricao" varchar(200) NOT NULL,
  "familia" varchar(120) NOT NULL DEFAULT '',
  "categoria" varchar(120) NOT NULL DEFAULT '',
  "marca" varchar(120) NOT NULL DEFAULT '',
  "embalagem" varchar(4) NOT NULL DEFAULT '',
  "tipo" varchar(12),
  "unPorEmb" integer NOT NULL DEFAULT 1,
  "litrosEmb" double precision,
  "litrosUn" double precision,
  "ativo" boolean NOT NULL DEFAULT true,
  "atualizadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "erp_pedido_itens" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "pedido" varchar(20) NOT NULL,
  "item" integer NOT NULL,
  "romaneio" varchar(20) NOT NULL DEFAULT '',
  "cliente" varchar(20) NOT NULL DEFAULT '',
  "placa" varchar(12) NOT NULL DEFAULT '',
  "motoristaCod" varchar(12) NOT NULL DEFAULT '',
  "dataPedido" date,
  "codProduto" varchar(20) NOT NULL,
  "qtdCx" double precision NOT NULL DEFAULT 0,
  "qtdUn" double precision NOT NULL DEFAULT 0,
  "retCx" double precision NOT NULL DEFAULT 0,
  "retUn" double precision NOT NULL DEFAULT 0,
  "liqCx" double precision NOT NULL DEFAULT 0,
  "liqUn" double precision NOT NULL DEFAULT 0,
  "motivoDev" varchar(10),
  "valor" double precision NOT NULL DEFAULT 0,
  "cancelado" boolean NOT NULL DEFAULT false,
  "importadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_erp_pedido_itens" ON "erp_pedido_itens" ("revendaId", "pedido", "item");
CREATE INDEX IF NOT EXISTS "ix_erp_pedido_itens_pedido" ON "erp_pedido_itens" ("revendaId", "pedido");
CREATE TABLE IF NOT EXISTS "produtividade_paradas" (
  "id" serial PRIMARY KEY,
  "revendaId" integer NOT NULL REFERENCES "revendas"("id"),
  "dia" date NOT NULL,
  "placa" varchar(20) NOT NULL,
  "motorista" varchar(120) NOT NULL,
  "routeId" varchar(40) NOT NULL,
  "codCliente" varchar(40) NOT NULL,
  "hl" double precision NOT NULL,
  "minDescarga" double precision NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_produtividade_paradas" ON "produtividade_paradas" ("revendaId", "routeId", "codCliente", "dia");
CREATE INDEX IF NOT EXISTS "ix_produtividade_paradas_motorista" ON "produtividade_paradas" ("revendaId", "motorista", "dia");
