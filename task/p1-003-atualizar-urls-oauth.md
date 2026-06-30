---
id: p1-003
title: Atualizar URLs de redirect/callback do OAuth
priority: p1
status: open
fase: 4-amarracoes
dependencias: p0-012
---

## Descrição

Após o frontend estar na Vercel, as URLs de redirect/callback do OAuth precisam ser atualizadas para o domínio da Vercel.

## Checklist

- [ ] Identificar o provedor OAuth em uso (`OAUTH_SERVER_URL`)
- [ ] Adicionar `https://*.vercel.app/auth/callback` como URL permitida no painel do provedor
- [ ] Adicionar o domínio definitivo (quando definido) como URL permitida
- [ ] Atualizar `OAUTH_SERVER_URL` no `.env` do VPS se necessário
- [ ] Testar fluxo de login completo

## Notas

Com a Opção A (vercel.json rewrite), o cookie de login continua "first-party" (sai do domínio da Vercel) — facilita este passo pois não há problema de `SameSite`.
