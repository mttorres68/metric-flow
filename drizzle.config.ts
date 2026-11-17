import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  // Tabelas que existem no banco mas foram desconectadas da aplicação (fora do schema).
  // O filtro impede o drizzle-kit de gerar DROP para elas. Os dados ficam preservados.
  //  - crm_config: tabela legada de config
  //  - rota_coaching, agenda_ga, gas_code: módulo Rota Coaching / Agenda GA (removido em 2026-11)
  tablesFilter: ["!crm_config", "!rota_coaching", "!agenda_ga", "!gas_code"],
});
