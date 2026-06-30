---
id: p0-006
title: Preencher .env de produção no VPS
priority: p0
status: closed
fase: 2-backend
dependencias: p0-001, p0-002
---

## Descrição

Criar o arquivo `.env` no VPS com todas as variáveis de produção (nunca commitar no git).

## Variáveis do backend (VPS)

```env
# Banco principal
DATABASE_URL=postgresql://postgres.[ref]:[senha]@aws-...pooler.supabase.com:6543/postgres?sslmode=require

# Banco WhatsApp (Evolution - permanece no VPS)
WA_DB_HOST=
WA_DB_PORT=
WA_DB_NAME=
WA_DB_USER=
WA_DB_PASSWORD=

# Evolution API
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=

# Trello
TRELLO_API_KEY=
TRELLO_TOKEN=
TRELLO_BOARDS=
TRELLO_REPORT_OUTPUT_PATH=

# Arquivos locais
COACHING_DATA_PATH=
PT_DATABASE_PATH=
PT_BASE_URL=
PT_REVENDAS=

# Auth
JWT_SECRET=
OWNER_OPEN_ID=
OAUTH_SERVER_URL=

# Outros
ANTHROPIC_API_KEY=
APPS_SCRIPT_URL=
AUTOMATION_API_URL=
SHEET_ID=
GID=
INFLEET_TOKEN=
WHATSAPP_DESTINATARIOS=
```

## Checklist

- [ ] Criar `.env` no VPS com todas as variáveis acima preenchidas
- [ ] Confirmar que `DATABASE_URL` aponta para o Supabase (não o Postgres local)
- [ ] Usar as chaves rotacionadas (task `p0-001`)
