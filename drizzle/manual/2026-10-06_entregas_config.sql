-- Relatório de Entregas: configuração single-row (raio do cliente).
-- Espelha `entregasConfig` em drizzle/schema.ts. Idempotente: só cria a tabela nova,
-- não altera nenhuma outra (aplicado à parte em vez de `drizzle-kit push`, que sincroniza
-- o schema inteiro e pode apagar tabelas de outras branches).
CREATE TABLE IF NOT EXISTS "entregas_config" (
  "id"        serial PRIMARY KEY,
  "raioM"     integer NOT NULL DEFAULT 300,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
