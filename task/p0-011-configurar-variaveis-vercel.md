---
id: p0-011
title: Configurar variáveis VITE_* no painel da Vercel
priority: p0
status: open
fase: 3-frontend
dependencias: p0-009
---

## Descrição

Adicionar as variáveis de ambiente do frontend no painel da Vercel (Settings → Environment Variables).

## Variáveis necessárias

| Variável | Descrição |
|---|---|
| `VITE_APP_ID` | ID da aplicação OAuth |
| `VITE_OAUTH_PORTAL_URL` | URL do portal OAuth |
| `VITE_FRONTEND_FORGE_API_KEY` | Chave da API de mapas |
| `VITE_FRONTEND_FORGE_API_URL` | URL da API de mapas |
| `VITE_ANALYTICS_ENDPOINT` | Endpoint do analytics |
| `VITE_ANALYTICS_WEBSITE_ID` | ID do site no analytics |

## Checklist

- [ ] Acessar Vercel → Project → Settings → Environment Variables
- [ ] Adicionar cada `VITE_*` acima com os valores de produção
- [ ] Confirmar que nenhuma variável de backend (sem prefixo `VITE_`) está sendo exposta aqui

## Notas

Variáveis `VITE_*` são embutidas no bundle do client em build time — nunca colocar segredos sem o prefixo `VITE_` aqui, pois ficam expostos no browser.
