---
id: p0-010
title: Criar vercel.json com rewrite de /api/* para o VPS
priority: p0
status: open
fase: 3-frontend
dependencias: p0-007
---

## Descrição

Criar o arquivo `vercel.json` para que todas as chamadas `/api/*` do frontend sejam redirecionadas para o backend no VPS (Opção A do plano — sem alterar nenhum `fetch` no código).

## Implementação

Criar `vercel.json` na raiz do projeto:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://api.seudominio.com/api/$1" }
  ]
}
```

## Checklist

- [ ] Substituir `api.seudominio.com` pelo subdomínio real do VPS
- [ ] Criar o arquivo `vercel.json` na raiz
- [ ] Commitar e fazer push
- [ ] Verificar no painel da Vercel que o rewrite está ativo

## Notas

Esta abordagem elimina a necessidade de configurar CORS no backend e de alterar qualquer `fetch("/api/...")` no client.
