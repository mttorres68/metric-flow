---
id: p0-008
title: Testar endpoint do backend no VPS
priority: p0
status: open
fase: 2-backend
dependencias: p0-007
---

## Descrição

Validar que o backend está respondendo corretamente em produção antes de conectar o frontend.

## Checklist

- [ ] `GET https://api.seudominio.com/api/trpc/analise.listar` → retorna JSON
- [ ] `GET https://api.seudominio.com/api/relatorio/...` → retorna resposta válida
- [ ] Verificar logs do pm2/Docker por erros de conexão com Supabase
- [ ] Confirmar que `initWATables()` rodou sem erros no boot

## Notas

Se houver erro SSL na conexão com Supabase, adicionar `ssl: { rejectUnauthorized: false }` em `server/db.ts` (ver task `p0-004`).
