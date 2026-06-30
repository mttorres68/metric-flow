---
id: p1-001
title: Gerar dump atualizado do banco local
priority: p1
status: open
fase: 1-banco
---

## Descrição

O backup existente (`metricflow_backup_20260602_1435.sql`) é de 02/06/2026 e pode estar defasado. Gerar um dump novo antes de migrar para o Supabase.

## Checklist

- [ ] Verificar se há dados novos desde 02/06 no Postgres local
- [ ] Gerar dump novo:
  ```bash
  pg_dump "$DATABASE_URL" > metricflow_backup_$(date +%Y%m%d_%H%M).sql
  ```
- [ ] Guardar o arquivo fora do repositório (não commitar)

## Notas

O dump deve ser gerado a partir do `DATABASE_URL` local atual — não do Supabase.
