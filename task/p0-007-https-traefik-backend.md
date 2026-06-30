---
id: p0-007
title: Configurar HTTPS no backend via Traefik
priority: p0
status: open
fase: 2-backend
dependencias: p0-005
---

## Descrição

Expor o backend com HTTPS usando o Traefik já presente no stack da Evolution, criando um subdomínio `api.seudominio.com`.

## Checklist

- [ ] Definir subdomínio (ex: `api.metricflow.seudominio.com`)
- [ ] Adicionar entrada DNS apontando para o IP do VPS
- [ ] Configurar rota no Traefik com certificado Let's Encrypt automático
- [ ] Testar: `curl https://api.seudominio.com/api/trpc/analise.listar` retorna resposta

## Notas

O Traefik já está no stack da Evolution — basta adicionar um novo `router` e `service` no `docker-compose.yml` ou nas labels do container.
