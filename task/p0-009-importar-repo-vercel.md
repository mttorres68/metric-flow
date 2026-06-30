---
id: p0-009
title: Importar repositório na Vercel
priority: p0
status: open
fase: 3-frontend
dependencias: p0-008
---

## Descrição

Conectar o repositório GitHub à Vercel para deploy automático do frontend.

## Checklist

- [ ] Acessar vercel.com → New Project → importar o repo do MetricFlow
- [ ] Configurar:
  - **Framework preset:** Vite
  - **Root Directory:** `.` (raiz do repo)
  - **Build Command:** `vite build` (NÃO `npm run build` — esse também builda o server)
  - **Output Directory:** `dist/public`
- [ ] Confirmar que o `.env` NÃO está no repositório (checagem final antes de conectar)

## Notas

A Vercel vai executar o build command no root — garantir que `vite.config.ts` está correto para buildar apenas o client.
