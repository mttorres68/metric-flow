---
id: p0-002
title: Criar projeto no Supabase e obter connection string
priority: p0
status: closed
fase: 1-banco
---

## Descrição

Criar o projeto Supabase que substituirá o Postgres local como banco de produção.

## Checklist

- [ ] Criar projeto em supabase.com
- [ ] Copiar **Connection String via Pooler** (porta `6543`, modo `transaction`, `?sslmode=require`)
- [ ] Guardar a string no `.env` de produção do VPS como `DATABASE_URL`

## Notas

Usar o **Connection Pooler** (não a connection direta) para evitar esgotar conexões no plano free.
