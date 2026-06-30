---
id: p0-003
title: Importar dump do banco no Supabase
priority: p0
status: closed
fase: 1-banco
dependencias: p0-002, p1-001
---

## Descrição

Migrar os dados e schema do Postgres local para o Supabase.

## Checklist

- [ ] Gerar dump atualizado (ver task `p1-001` — o backup atual é de 02/06)
- [ ] Importar via psql:
  ```bash
  psql "postgresql://postgres.[ref]:[senha]@aws-...pooler.supabase.com:6543/postgres" -f metricflow_backup_novo.sql
  ```
- [ ] Alternativa: rodar `drizzle-kit push` para garantir o schema das 19 tabelas
- [ ] Verificar que as tabelas `analises`, `rota_coaching`, `assessment_*`, `agendaGa` existem

## Notas

O dump existente (`metricflow_backup_20260602_1435.sql`) está defasado. Gerar um novo antes de migrar se houver dados recentes.
