---
id: p2-001
title: Apontar domínio definitivo na Vercel
priority: p2
status: open
fase: 4-amarracoes
dependencias: p1-004
---

## Descrição

Substituir a URL `*.vercel.app` pelo domínio definitivo da aplicação.

## Checklist

- [ ] Definir o domínio a usar (ex: `metricflow.seudominio.com`)
- [ ] Adicionar o domínio no painel Vercel → Project → Domains
- [ ] Configurar CNAME ou A record no DNS apontando para a Vercel
- [ ] Atualizar URLs OAuth para incluir o domínio definitivo (task `p1-003`)
- [ ] Confirmar certificado HTTPS ativo na Vercel

## Notas

A Vercel provisiona o certificado Let's Encrypt automaticamente após a validação do DNS.
