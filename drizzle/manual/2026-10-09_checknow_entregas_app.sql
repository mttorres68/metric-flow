-- Relatório de Entregas: onde o motorista registrou a entrega no app (Latitude/Longitude Final da planilha).
-- Idempotente; só adiciona colunas (sem drizzle-kit push).
ALTER TABLE "checknow_entregas"
  ADD COLUMN IF NOT EXISTS "latApp" double precision,
  ADD COLUMN IF NOT EXISTS "lonApp" double precision;
