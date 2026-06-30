# Plano de Deploy — MetricFlow

**Arquitetura escolhida:** Frontend na **Vercel (free)** · Backend no **VPS** (junto da Evolution API) · Banco no **Supabase (Postgres)**
**Módulos no ar nesta fase:** Rota Coaching · Análise · Trello Atraso · Agenda GV · WhatsApp · Assessment
**Data:** 30/06/2026

---

## 0. Backup do estado atual (feito)

Como você pediu para não perder nada, foram criados dois pontos de restauração:

- **Branch git:** `backup/estado-atual-20260630` (aponta para o último commit `fe871fe`).
- **Snapshot completo:** `snapshot_estado_atual_20260630.tar.gz` na raiz do projeto — inclui também as **~30 alterações ainda não commitadas** (o `.git/index.lock` estava travado por outro processo — provavelmente o VS Code aberto — então não consegui fazer o commit dessas mudanças via git).

> **Para completar o backup no git:** feche o VS Code / qualquer ferramenta git aberta, delete o arquivo `.git/index.lock`, e rode:
> ```bash
> git add -A && git commit -m "snapshot estado atual antes do deploy"
> git branch backup/estado-atual-20260630-completo
> ```

---

## 1. Resposta direta: dá pra colocar na Vercel free?

**Em partes.** A Vercel free é ótima para o **frontend** (React/Vite estático) e é onde ele deve ficar. Mas a Vercel é uma plataforma **serverless** (funções sem estado, sem disco persistente, timeout curto, sem processos de background), e o **backend atual não se encaixa nela** porque:

1. **Lê e grava arquivos no disco** — `PT_DATABASE_PATH`, `COACHING_DATA_PATH`, cache `xlsx → json` via `writeFileSync`. Em serverless o disco é efêmero/somente-leitura → quebraria.
2. **É um servidor persistente** — usa `server.listen`, `findAvailablePort`, e roda `initWATables()` em background no boot.
3. **WhatsApp depende da Evolution API** — serviço Docker com Postgres próprio + n8n, que **exige servidor persistente** (já está no seu VPS).

**Conclusão:** o desenho certo é **frontend na Vercel free + backend no VPS** (do lado da Evolution). Assim você **não precisa fazer o refactor para serverless** — todo o código que mexe em disco e a camada de dados continuam funcionando como estão.

---

## 2. Separar front (Vercel) e back (VPS): preciso reescrever algo?

**Não é um rewrite — são ajustes pontuais.** O que torna isso simples é manter o backend num VPS: a parte pesada (acesso a disco, SQL com JOIN/agregação, Evolution) fica intacta.

Hoje o frontend chama o backend por **caminho relativo** (`url: "/api/trpc"` no `main.tsx`, vários `fetch("/api/relatorio/...")`, `fetch("/api/crm/...")`) e **o backend não tem CORS configurado**. Quando front e back ficam em domínios diferentes, isso precisa ser resolvido. Há dois caminhos:

### Opção A — Proxy via `vercel.json` (recomendada, ~zero mudança de código)

A Vercel reescreve `/api/*` para o seu VPS. Para o navegador, tudo continua saindo do mesmo domínio (o da Vercel), então:

- **Não precisa mexer em nenhum `fetch("/api/...")` nem no tRPC** — continuam relativos.
- **Não precisa configurar CORS** nem cookies cross-site (o cookie de login do OAuth continua "first-party").

Cria-se um `vercel.json` na raiz:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://SEU-BACKEND.seudominio.com/api/$1" }
  ]
}
```

Custo: todo o tráfego de API passa pela borda da Vercel (um hop a mais). Para uma ferramenta interna, é irrelevante. **Esta é a opção que pede menos trabalho.**

### Opção B — Chamada cross-origin direta (VITE_API_URL + CORS)

O frontend chama o backend diretamente em `https://backend...`. Exige:

1. Trocar `url: "/api/trpc"` por `url: ${import.meta.env.VITE_API_URL}/api/trpc` no `client/src/main.tsx`.
2. Prefixar com `VITE_API_URL` os ~12 `fetch("/api/...")` (relatório, crm). Arquivos: `pages/analise/Analise.tsx`, `pages/analise/lib/pdf.ts`, `pages/analise/views/RecorrenciaSemanal.tsx`, `pages/agenda-gv/components/UploadCard.tsx`.
3. **Adicionar CORS no Express** (`server/_core/index.ts`) permitindo o domínio da Vercel com `credentials: true`.
4. **Cookies cross-site:** como o login usa cookie (OAuth), ele teria que virar `SameSite=None; Secure` e o domínio do OAuth callback precisa ser o do backend.

> **Recomendação:** comece com a **Opção A**. Ela coloca tudo no ar sem tocar no código do client. Migra para a B só se quiser tirar o tráfego da Vercel depois.

### Ajuste comum às duas opções (no backend, no VPS)

- Em produção o Express hoje serve o client (`serveStatic`). Com o front na Vercel, o backend passa a servir **só a API**. Não precisa remover nada (fica inofensivo), mas o **build do VPS roda só o servidor** e o **build da Vercel roda só o client**.
- Assets estáticos que o front busca (`/assessment_indicadores.json`, `/assessment_clusters.json`) devem estar em `client/public/` para a Vercel servi-los. Confirmar que estão lá.

---

## 3. Banco: PostgreSQL → Supabase

O Supabase **é Postgres**, então a migração é quase trivial — o Drizzle e todas as queries continuam iguais. Só muda a string de conexão.

**Passos:**

1. Criar projeto no Supabase → copiar a **connection string** (use o **Connection Pooler**, porta `6543`, modo `transaction`, com `?sslmode=require`).
2. Importar o dump existente `metricflow_backup_20260602_1435.sql` no Supabase:
   ```bash
   psql "postgresql://postgres.[ref]:[senha]@aws-...pooler.supabase.com:6543/postgres" -f metricflow_backup_20260602_1435.sql
   ```
   (ou via SQL Editor para a estrutura + `drizzle-kit push` para garantir o schema das 19 tabelas).
3. No `.env` do backend (VPS), apontar `DATABASE_URL` para o Supabase.
4. **SSL:** o `pg.Pool` em `server/db.ts` pode precisar de `ssl: { rejectUnauthorized: false }` para conectar no Supabase. Ajuste pequeno se a conexão recusar.
5. **Banco do WhatsApp** (`WA_DB_HOST`, etc.) — esse é o Postgres da **Evolution**, continua no VPS como está. Não migra para o Supabase agora.

> O backup `.sql` é de **02/06**. Se houver dados mais novos no Postgres local, gere um novo dump antes de migrar: `pg_dump "$DATABASE_URL_LOCAL" > metricflow_backup_novo.sql`.

---

## 4. Mapa de dependências por módulo

| Módulo | Depende de | Onde roda |
|---|---|---|
| **Rota Coaching** | Postgres (`rotaCoaching`) + arquivo `COACHING_DATA_PATH` | Backend/VPS (precisa do disco) |
| **Análise** | Postgres pesado (JOIN/GROUP BY/recorrência) | Backend/VPS + Supabase |
| **Trello Atraso** | API do Trello + n8n + `TRELLO_REPORT_OUTPUT_PATH` | Backend/VPS |
| **Agenda GV** | Postgres (`agendaGa`, `crmAgendaCiclo`) + upload xlsx | Backend/VPS + Supabase |
| **WhatsApp** | Evolution API (Docker) + `WA_DB` Postgres | VPS (já hospedado) |
| **Assessment** | Postgres (`assessment_*`) + JSONs estáticos | Backend/VPS + Supabase + assets na Vercel |

Todos os módulos têm um pé no backend; nenhum é "só frontend". Por isso o backend no VPS é o que viabiliza essa fase sem refatoração.

---

## 5. Passo a passo do deploy

### Fase 1 — Banco (Supabase)
1. Criar projeto Supabase.
2. Importar dump / `drizzle-kit push`.
3. Validar conexão (`psql` + uma query nas tabelas `analises`, `rota_coaching`).

### Fase 2 — Backend no VPS
4. Subir o código no VPS (junto da Evolution). Recomendado: container Docker ou `pm2`/systemd com `npm run build` + `npm start`.
5. Preencher o `.env` de produção (ver seção 6) com `DATABASE_URL` do Supabase.
6. Garantir HTTPS no backend (Traefik já está no seu stack da Evolution — adicionar um subdomínio, ex. `api.seudominio.com`, com certificado).
7. Confirmar que os caminhos de arquivo (`COACHING_DATA_PATH`, `PT_DATABASE_PATH`, `TRELLO_REPORT_OUTPUT_PATH`) existem no VPS e que os arquivos/automações que os alimentam rodam lá.
8. Testar: `https://api.seudominio.com/api/trpc/...` responde.

### Fase 3 — Frontend na Vercel
9. Importar o repositório na Vercel.
10. Configurar o projeto:
    - **Framework preset:** Vite
    - **Root Directory:** raiz do repo
    - **Build Command:** `vite build` (só o client — **não** o `npm run build`, que também empacota o server)
    - **Output Directory:** `dist/public`
11. Criar `vercel.json` (Opção A) com o rewrite de `/api/*` para o VPS.
12. Configurar as variáveis `VITE_*` no painel da Vercel (ver seção 6).
13. Deploy.

### Fase 4 — Amarrações finais
14. **OAuth:** atualizar as URLs de redirect/callback para o domínio da Vercel (e `OAUTH_SERVER_URL` conforme o provedor).
15. Testar login + cada um dos 6 módulos ponta a ponta.
16. Apontar o domínio definitivo (se houver) na Vercel.

---

## 6. Variáveis de ambiente — divisão

### Backend (VPS) — `.env`
Praticamente o `.env` atual, trocando o banco:
- `DATABASE_URL` → **Supabase** (pooler + sslmode)
- `WA_DB_HOST/PORT/NAME/USER/PASSWORD` → Postgres da **Evolution** (VPS)
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`
- `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_BOARDS`, `TRELLO_REPORT_OUTPUT_PATH`
- `COACHING_DATA_PATH`, `PT_DATABASE_PATH`, `PT_BASE_URL`, `PT_REVENDAS`
- `ANTHROPIC_API_KEY`, `JWT_SECRET`, `OWNER_OPEN_ID`, `OAUTH_SERVER_URL`
- `APPS_SCRIPT_URL`, `AUTOMATION_API_URL`, `SHEET_ID`, `GID`, `INFLEET_TOKEN`, `WHATSAPP_DESTINATARIOS`, etc.

### Frontend (Vercel) — variáveis `VITE_`
- `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`
- `VITE_FRONTEND_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL` (Maps)
- `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID`
- `VITE_API_URL` → **só se usar a Opção B**

> **Segurança:** o `.env` atual está versionado e contém segredos (chaves Trello, Anthropic, Evolution). Antes de tornar o repo acessível à Vercel, **rotacione as chaves expostas** e garanta que `.env` está no `.gitignore` (definir os segredos só nos painéis da Vercel/VPS).

---

## 7. Riscos e pontos de atenção

- **Disco no VPS:** Rota Coaching, Trello e PathTracker leem arquivos gerados por automações Python/n8n. Essas automações precisam rodar **no mesmo VPS** (ou gravar nos caminhos que o backend lê). Verificar.
- **Cookies/OAuth cross-domain:** evitado na Opção A; é o ponto mais delicado da Opção B.
- **Vercel free — limites:** com a Opção A, as invocações de proxy contam no plano free (100 GB-bandwidth/mês). Para uso interno, sobra folga.
- **Backup `.sql` defasado (02/06):** gerar dump novo antes de migrar se houver dados recentes.
- **Segredos versionados:** rotacionar antes de expor o repo.

---

## 8. Resumo executivo

| Pergunta | Resposta |
|---|---|
| Vercel free serve? | **Sim, para o frontend.** Backend vai no VPS. |
| Preciso reescrever? | **Não** (com a Opção A `vercel.json`). Só config: build separado + 1 arquivo de rewrite. |
| Firebase como banco? | Trocado por **Supabase (Postgres)** — mantém o código; Firestore exigiria reescrever a camada de dados. |
| WhatsApp/Evolution | Continua no **VPS** (já hospedado). |
| Refactor serverless? | **Evitado** ao manter o backend no VPS. |
