---
id: p0-004
title: Validar conexão e dados no Supabase
priority: p0
status: open
fase: 1-banco
dependencias: p0-003
---

## Descrição

Confirmar que o banco no Supabase está acessível e com os dados corretos antes de apontar o backend.

## Checklist

- [ ] Conectar via `psql` e rodar query de validação:
  ```sql
  SELECT COUNT(*) FROM analises;
  SELECT COUNT(*) FROM rota_coaching;
  SELECT COUNT(*) FROM assessment_respostas;
  ```
- [ ] Verificar se o `pg.Pool` em `server/db.ts` precisa de `ssl: { rejectUnauthorized: false }`
- [ ] Testar `drizzle-kit studio` apontando para o Supabase

## Notas

Se a conexão recusar com erro SSL, adicionar `ssl: { rejectUnauthorized: false }` no pool do `server/db.ts`.
