-- Limites dos gatilhos de desvio e trecho lento no modal ⚙ do Relatório de Entregas.
ALTER TABLE "entregas_config"
  ADD COLUMN IF NOT EXISTS "desvioFator" double precision NOT NULL DEFAULT 1.8,
  ADD COLUMN IF NOT EXISTS "desvioMinKm" double precision NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "lentoMinMin" integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "lentoMaxKmh" integer NOT NULL DEFAULT 15;
