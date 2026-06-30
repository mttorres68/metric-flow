# Tasks — Deploy MetricFlow

**Arquitetura:** Frontend Vercel (free) · Backend VPS · Banco Supabase  
**Última atualização:** 30/06/2026

---

## Prioridades

| Label | Significado |
|---|---|
| **p0** | Bloqueante — sem isso o deploy não funciona |
| **p1** | Necessário — deploy funciona, mas incompleto/inseguro |
| **p2** | Polimento — melhoria pós-deploy |
| **p3** | Futuro — melhoria não urgente |

---

## P0 — Bloqueantes

| ID | Task | Status |
|---|---|---|
| [p0-001](p0-001-rotacionar-segredos.md) | Rotacionar segredos expostos no repositório | open |
| [p0-002](p0-002-criar-projeto-supabase.md) | Criar projeto no Supabase e obter connection string | closed |
| [p0-003](p0-003-importar-dump-supabase.md) | Importar dump do banco no Supabase | closed |
| [p0-004](p0-004-validar-conexao-supabase.md) | Validar conexão e dados no Supabase | closed |
| [p0-005](p0-005-deploy-backend-vps.md) | Subir o backend no VPS | closed |
| [p0-006](p0-006-configurar-env-producao.md) | Preencher .env de produção no VPS | open |
| [p0-007](p0-007-https-traefik-backend.md) | Configurar HTTPS no backend via Traefik | open |
| [p0-008](p0-008-testar-endpoint-backend.md) | Testar endpoint do backend no VPS | open |
| [p0-009](p0-009-importar-repo-vercel.md) | Importar repositório na Vercel | open |
| [p0-010](p0-010-criar-vercel-json.md) | Criar vercel.json com rewrite de /api/* para o VPS | closed |
| [p0-011](p0-011-configurar-variaveis-vercel.md) | Configurar variáveis VITE_* no painel da Vercel | open |
| [p0-012](p0-012-deploy-frontend-vercel.md) | Executar deploy do frontend na Vercel | open |

## P1 — Importantes

| ID | Task | Status |
|---|---|---|
| [p1-001](p1-001-gerar-dump-atualizado.md) | Gerar dump atualizado do banco local | closed |
| [p1-002](p1-002-verificar-automacoes-vps.md) | Verificar automações Python/n8n que alimentam arquivos no VPS | open |
| [p1-003](p1-003-atualizar-urls-oauth.md) | Atualizar URLs de redirect/callback do OAuth | open |
| [p1-004](p1-004-testar-modulos-ponta-a-ponta.md) | Testar os 6 módulos ponta a ponta em produção | open |

## P2 — Polimento

| ID | Task | Status |
|---|---|---|
| [p2-001](p2-001-apontar-dominio-definitivo.md) | Apontar domínio definitivo na Vercel | open |
| [p2-002](p2-002-verificar-assets-estaticos.md) | Verificar assets estáticos em client/public/ | closed |

## P3 — Futuro

| ID | Task | Status |
|---|---|---|
| [p3-001](p3-001-migrar-opcao-b-cross-origin.md) | Migrar para Opção B — chamadas cross-origin diretas | open |
