---
id: p0-012
title: Executar deploy do frontend na Vercel
priority: p0
status: open
fase: 3-frontend
dependencias: p0-009, p0-010, p0-011
---

## Descrição

Disparar o deploy e validar que o frontend está no ar acessando o backend via rewrite.

## Checklist

- [ ] Fazer push do `vercel.json` para a branch main
- [ ] Aguardar build automático na Vercel (ou disparar manualmente)
- [ ] Acessar a URL gerada pela Vercel (`*.vercel.app`)
- [ ] Verificar que a tela de login carrega
- [ ] Verificar no Network tab do browser que as chamadas `/api/trpc` estão respondendo (passando pelo rewrite)

## Notas

Se o build falhar, verificar o log da Vercel — o erro mais comum é o build command tentar buildar o server junto.
