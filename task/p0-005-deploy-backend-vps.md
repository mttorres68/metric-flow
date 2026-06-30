---
id: p0-005
title: Subir o backend no VPS
priority: p0
status: closed
fase: 2-backend
dependencias: p0-004
---

## Descrição

Fazer o deploy do servidor Express no VPS (junto da Evolution API).

## Checklist

- [ ] Clonar o repositório no VPS (ou sincronizar via git pull)
- [ ] Instalar dependências: `npm install`
- [ ] Build do servidor: `npm run build` (apenas a parte do server)
- [ ] Configurar processo persistente com **pm2** ou **systemd**:
  ```bash
  pm2 start dist/server/index.js --name metricflow-api
  pm2 save && pm2 startup
  ```
- [ ] Alternativa: containerizar com Docker e subir junto do stack da Evolution

## Notas

O build atual (`npm run build`) empacota front e back juntos. Com o front na Vercel, o VPS só precisa buildar e rodar o server. Verificar se o script de build precisa de ajuste.
