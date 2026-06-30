---
id: p0-001
title: Rotacionar segredos expostos no repositório
priority: p0
status: closed
fase: pré-deploy
---

## Descrição

O `.env` atual continha segredos versionados (chaves Trello, Anthropic, Evolution). Antes de tornar o repo acessível à Vercel, é necessário rotacionar todas as chaves sensíveis.

## Checklist

- [ ] Revogar e gerar nova chave `ANTHROPIC_API_KEY`
- [ ] Revogar e gerar novas chaves `TRELLO_API_KEY` / `TRELLO_TOKEN`
- [ ] Revogar e gerar nova `EVOLUTION_API_KEY`
- [ ] Revogar e gerar novo `JWT_SECRET`
- [ ] Confirmar que `.env` está no `.gitignore` (já feito no commit 270aa0d)
- [ ] Verificar no histórico git se há outros commits com `.env` exposto (`git log --all --full-history -- .env`)

## Notas

Segredos versionados em git são considerados comprometidos mesmo após remoção — rotacionar é obrigatório.
