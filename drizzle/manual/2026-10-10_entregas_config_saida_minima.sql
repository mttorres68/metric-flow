-- Relatório de Entregas: horário mínimo de saída (movimento de madrugada fora da base não é saída).
-- Idempotente; só adiciona a coluna (sem drizzle-kit push).
ALTER TABLE "entregas_config" ADD COLUMN IF NOT EXISTS "saidaMinima" varchar(5) NOT NULL DEFAULT '04:00';
