---
id: p3-001
title: Migrar para Opção B — chamadas cross-origin diretas (sem proxy Vercel)
priority: p3
status: open
fase: melhoria-futura
---

## Descrição

A Opção A (rewrite via `vercel.json`) adiciona um hop de rede na borda da Vercel para cada chamada de API. Se no futuro isso gerar latência ou custo, migrar para chamadas diretas ao backend.

## O que envolve

1. Adicionar `VITE_API_URL` nas variáveis da Vercel apontando para `https://api.seudominio.com`
2. Atualizar `url: "/api/trpc"` → `url: \`${import.meta.env.VITE_API_URL}/api/trpc\`` em `client/src/main.tsx`
3. Prefixar com `VITE_API_URL` os ~12 `fetch("/api/...")` nos arquivos:
   - `pages/analise/Analise.tsx`
   - `pages/analise/lib/pdf.ts`
   - `pages/analise/views/RecorrenciaSemanal.tsx`
   - `pages/agenda-gv/components/UploadCard.tsx`
4. Adicionar CORS no Express (`server/_core/index.ts`) com `credentials: true`
5. Ajustar cookie de sessão para `SameSite=None; Secure`
6. Atualizar callback OAuth para o domínio do backend

## Notas

Não fazer antes de validar a Opção A em produção. O esforço de migração é significativo.
