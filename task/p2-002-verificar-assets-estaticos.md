---
id: p2-002
title: Verificar assets estáticos em client/public/
priority: p2
status: open
fase: 3-frontend
---

## Descrição

Assets estáticos referenciados pelo frontend (JSONs do Assessment) precisam estar em `client/public/` para a Vercel servi-los corretamente.

## Checklist

- [ ] Confirmar que `assessment_indicadores.json` está em `client/public/`
- [ ] Confirmar que `assessment_clusters.json` está em `client/public/`
- [ ] Verificar se há outros assets referenciados por caminho absoluto (`/arquivo.json`) que precisam estar em `public/`
- [ ] Após deploy, acessar `https://seudominio.vercel.app/assessment_indicadores.json` e verificar que retorna o JSON

## Notas

Arquivos em `client/public/` são copiados para a raiz do output (`dist/public/`) e servidos como estáticos pela Vercel.
