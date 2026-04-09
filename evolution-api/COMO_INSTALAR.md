# Evolution API v2 — Guia de Instalação Local (Windows)

Tempo estimado: **15–20 minutos**

---

## Pré-requisitos

### 1. Instalar Docker Desktop

1. Acesse **https://www.docker.com/products/docker-desktop/**
2. Baixe a versão para Windows e instale
3. Reinicie o PC se solicitado
4. Abra o Docker Desktop e aguarde o ícone ficar verde na bandeja

> **Requisitos mínimos:** Windows 10/11 64-bit, 4 GB RAM, WSL2 habilitado.
> O instalador do Docker já habilita o WSL2 automaticamente.

---

## Instalação

### 2. Configurar as variáveis de ambiente

Abra o arquivo **`evolution-api/.env`** e preencha os campos:

```env
# Gere uma API Key forte (execute no terminal):
# python -c "import secrets; print(secrets.token_hex(32))"
AUTHENTICATION_API_KEY=cole-aqui-sua-chave-gerada

# Senha para o banco de dados (qualquer senha forte)
POSTGRES_PASSWORD=minhasenha123
```

Anote a `AUTHENTICATION_API_KEY` — você vai precisar dela depois.

### 3. Subir os contêineres

Abra o **Terminal** (PowerShell ou CMD) na pasta `evolution-api` e execute:

```bash
docker compose up -d
```

Aguarde o download das imagens (~500 MB na primeira vez). Ao terminar, você verá:

```
✔ Container evolution_postgres   Started
✔ Container evolution_redis      Started
✔ Container evolution_api        Started
✔ Container evolution_frontend   Started
```

**Verificar se está rodando:**

```bash
docker compose ps
```

---

## Configuração inicial

> **Nota:** As imagens oficiais do painel web (Evolution Manager) estão com bugs conhecidos.
> A configuração é feita via API REST diretamente. Use PowerShell ou o site **https://hoppscotch.io** para executar os comandos abaixo.

Substitua `SUA_API_KEY` pelo valor de `AUTHENTICATION_API_KEY` do seu `.env` em todos os comandos.

### 4. Criar a instância

```powershell
curl -X POST http://localhost:8080/instance/create `
  -H "apikey: SUA_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{"instanceName": "metricflow", "integration": "WHATSAPP-BAILEYS"}'
```

### 5. Conectar ao WhatsApp (obter QR Code)

```powershell
curl http://localhost:8080/instance/connect/metricflow `
  -H "apikey: SUA_API_KEY"
```

A resposta terá um campo `base64` com a imagem do QR Code. Para visualizá-lo facilmente:

1. Acesse **https://base64.guru/converter/decode/image**
2. Cole o valor do campo `base64` e clique em **Decode**
3. Escaneie o QR Code exibido pelo WhatsApp

No WhatsApp do celular que vai enviar as mensagens:

1. Vá em **Configurações → Aparelhos conectados**
2. Toque em **"Conectar um aparelho"**
3. Escaneie o QR Code

### 6. Verificar status da conexão

```powershell
curl http://localhost:8080/instance/connectionState/metricflow `
  -H "apikey: SUA_API_KEY"
```

Resposta esperada: `{"state": "open"}` ✅

---

## Configurar o MetricFlow para envio

Abra o **`metric-flow/.env`** e preencha:

```env
EVOLUTION_API_KEY=cole-aqui-a-mesma-chave-do-evolution-env
EVOLUTION_INSTANCE=metricflow
WHATSAPP_DESTINATARIOS=5544999990000,5544888880000
```

**Formato do número:** `55` + DDD + número, sem espaços ou `+`.
Exemplo: `5511987654321`

---

## Testar o envio

```bash
cd metric-flow
python gerar_relatorio_trello.py
```

Se tudo estiver certo, você receberá a mensagem + PDF no WhatsApp.

Para forçar envio mesmo sem atrasos (para testar):

```env
WHATSAPP_ENVIAR_SEMPRE=true
```

---

## Comandos úteis

```bash
# Ver logs da API em tempo real
docker compose logs -f evolution_api

# Parar tudo
docker compose down

# Subir novamente
docker compose up -d

# Ver status
docker compose ps

# Reiniciar apenas a API
docker compose restart evolution_api
```

---

## Manter rodando sempre

O Docker Compose está configurado com `restart: always`, então a Evolution API vai subir automaticamente quando o Windows inicializar — **desde que o Docker Desktop esteja configurado para iniciar com o Windows.**

Verifique em: Docker Desktop → Settings → General → **"Start Docker Desktop when you sign in"** ✅

---

## Arquitetura local

```
Seu PC
├── Docker Desktop
│   ├── evolution_api       :8080  ← API REST (usada pelo script Python e pelos comandos curl)
│   ├── evolution_postgres         ← Banco de dados (interno)
│   └── evolution_redis            ← Cache (interno)
│
├── metric-flow/
│   ├── gerar_relatorio_trello.py  ← chama a API em :8080
│   └── .env                       ← EVOLUTION_API_KEY, EVOLUTION_INSTANCE...
│
└── evolution-api/
    ├── docker-compose.yml
    └── .env                       ← configuração dos contêineres
```

---

## Problemas comuns

| Problema                      | Solução                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `docker: command not found`   | Instale o Docker Desktop e reinicie o terminal                                                      |
| Porta 8080 já em uso          | Troque para `"8081:8080"` no docker-compose.yml e atualize `EVOLUTION_API_URL`                  |
| QR Code expirou               | Rode novamente o comando `curl .../instance/connect/metricflow`                                     |
| Status `"connecting"` travado | `docker compose restart evolution_api` e reconecte                                                  |
| `401 Unauthorized`            | Verifique se `AUTHENTICATION_API_KEY` no `.env` do evolution-api bate com `EVOLUTION_API_KEY` no metric-flow |
| Imagem do manager com erro nginx / fs-extra | Já documentado — use os comandos curl acima em vez do painel |
