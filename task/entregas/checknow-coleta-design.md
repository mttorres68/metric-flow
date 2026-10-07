# Coleta automática do CheckNow — Design

Data: 2026-10-07 · Branch: `entregas/relatorio-entregas` · Depende de: `relatorio-entregas-design.md`

## 1. Objetivo

Hoje o Relatório de Entregas só funciona com o upload da planilha do CheckNow, e
os dados se perdem a cada reload. Esta entrega:

- busca a planilha no portal do CheckNow sozinha (scraping HTTP, sem navegador),
  pelo botão na tela e por agendamento no servidor;
- guarda as entregas no Postgres, por revenda;
- atende várias revendas, cada uma com seu login do CheckNow e sua conta do
  Infleet, cadastrados na tela;
- tem redundância: falha de coleta nunca apaga dados, o servidor recupera o que
  perdeu parado e a tela mostra quando a coleta para.

**Sucesso:** abrir o relatório, escolher revenda e período e ver os dados sem
subir arquivo; coleta automática de hora em hora; uma falha aparece na tela com
o motivo.

**Fora do escopo:** persistir o resultado do cruzamento com o GPS (continua
calculado na hora); login no metric-flow; cópia do Excel bruto de cada coleta.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Onde roda | Dentro do metric-flow (TypeScript), não em Python na `automacao`. |
| O que persiste | Só as entregas do CheckNow; o GPS é buscado no Infleet ao abrir. |
| Quando coleta | Botão + agendamento automático no servidor. |
| Revendas | Várias, cada uma com login do CheckNow e token do Infleet próprios. |
| Credenciais | No banco, cifradas (AES-256-GCM, chave `CHECKNOW_CHAVE` no `.env`), editáveis no ⚙. |

## 3. Portal do CheckNow (JSF/PrimeFaces)

Base: `https://checknowsistema.com.br/checknow`. Sessão por cookies
(`JSESSIONID`, `AWSALB`, `AWSALBCORS`).

1. `GET /publico/login.jsf` — abre a sessão.
2. `POST /publico/j_spring_security_check` (form urlencoded) —
   `j_username`, `j_password`. Sucesso = redireciona para fora do login;
   voltar para `login.jsf` = login recusado.
3. `GET /relatorio/geracao_dado_bi_periodo_rel.jsf` — lê o
   `javax.faces.ViewState` (input hidden) e o nome da filial do topo
   (ex.: "3722-DUTTRA PI DISTRIBUIDORA (FLORIANO)").
4. `POST` na mesma URL, AJAX (`faces-request: partial/ajax`):
   `javax.faces.source=dtInicio`, evento `dateSelect`, com `formTemplate`,
   `dtInicio_input`, `dtFim_input` (`dd/mm/aaaa HH:MM:SS`) e `ViewState`.
5. `POST` AJAX: `javax.faces.source=tipoRelatorioId`, evento `valueChange`,
   `tipoRelatorioId=11` (Excel).
6. `POST` normal (não AJAX) — o clique em "Gerar Arquivo":
   `formTemplate=formTemplate`, `dtInicio_input`, `dtFim_input`,
   `tipoRelatorioId=11`, `commandLinkExporta=commandLinkExporta`,
   `javax.faces.ViewState`. A resposta é o Excel (zip, começa com `PK`).

"Agrupar por Pedido" fica desmarcado (padrão da tela). O filtro do portal é por
**data de início da rota**.

## 4. Dados

### `entregas_contas` — uma linha por revenda

| Coluna | Tipo | Nota |
|---|---|---|
| id | serial PK | |
| revendaId | integer, unique, FK `revendas.id` | |
| ativo | boolean, default true | inativa não coleta nem aparece na tela |
| checknowUsuario | varchar(120) | |
| checknowSenha | text | cifrada (`iv:tag:dados` em base64) |
| infleetToken | text, null | cifrado; null = usa `INFLEET_TOKEN` do `.env` |
| ultimaColetaEm | timestamp, null | |
| ultimaColetaOk | boolean, null | |
| ultimaColetaErro | text, null | |
| createdAt, updatedAt | timestamp | |

### `checknow_entregas` — uma linha por entrega

Os campos de `Entrega` (`parseCheckNow`): routeId, placa, motorista,
codCliente, cliente, lat, lon, situacao, baixaEm, saidaApp, rotaInicio,
rotaFim, odoIniInformado, odoFimInformado, ordemPlanejada, valor, pesoKg,
notas, motivoProblema, capacidadeKg, cidade — mais `revendaId`, `dia` (data BRT
do início da rota, indexada com revendaId) e `coletadoEm`.
Única: (revendaId, routeId, codCliente).

### `checknow_coletas` — registro de cada coleta

id, revendaId, origem (`auto` | `botao` | `upload`), periodoDe, periodoAte,
iniciadoEm, terminadoEm, status (`rodando` | `ok` | `sem_dados` | `erro`),
rotas, linhas, erro. Índice (revendaId, iniciadoEm).

SQL manual em `drizzle/manual/` (nada de `db:push`).

## 5. Servidor

Pasta `server/services/checknow/`.

- **`cofre.ts`** — `cifrar(texto)`, `decifrar(cifrado)` com AES-256-GCM e
  `CHECKNOW_CHAVE` (32 bytes em base64). Sem chave: erro "CHECKNOW_CHAVE não
  configurada" e o cadastro de contas fica bloqueado.
- **`coletor.ts`** — `fetch` do Node com pote de cookies próprio.
  - `baixarCheckNow({ usuario, senha }, de, ate): Promise<Buffer>` — passos 1–6;
    período acima de 7 dias vira blocos de 7 dias (os arquivos são lidos
    separados e as entregas juntadas).
  - `testarLogin({ usuario, senha }): Promise<{ filial: string }>` — passos 1–3.
  - Erros (`ColetaError`) com mensagem própria: "login recusado", "tela do
    relatório mudou (ViewState não encontrado)", "resposta não é Excel",
    "CheckNow não respondeu (HTTP n)". Timeout de 2 min por chamada. A senha
    nunca entra em log nem em mensagem.
- **`sincronizar.ts`** — `coletarRevenda(conta, de, ate, origem)`:
  1. trava `pg_try_advisory_lock` por revenda; ocupada → "coleta já em
     andamento";
  2. registra a coleta como `rodando`;
  3. baixa (tentativas: botão = 1 + 1 após 5 s; auto = após 1, 5 e 15 min) e lê
     com `parseCheckNow`;
  4. `gravarEntregas(revendaId, entregas)` numa transação: apaga só os
     `routeId` presentes no arquivo e insere; zero entregas → `sem_dados`, nada
     apagado;
  5. fecha a coleta e atualiza `ultimaColeta*` da conta.
  O upload manual usa os passos 2, 4 e 5 com origem `upload`.
- **`agendador.ts`** — liga só com `CHECKNOW_COLETA_AUTO=1`; `setTimeout`
  simples (uma instância em produção). Revendas ativas, uma de cada vez:
  - aos :05, das 06h às 22h (BRT): ontem e hoje;
  - às 23:30: últimos 3 dias;
  - 1 min após subir: da data final da última coleta `ok` até hoje, no máximo
    7 dias.
  Funções puras testáveis: `proximaExecucao(agora)` e
  `periodoRecuperacao(ultimoOk, hoje)`.
- **Infleet por revenda** — `infleetEntregas.consultar` e `buscarGpsLinha`
  recebem o token (`conta.infleetToken ?? INFLEET_TOKEN`); `listarCercas`
  aceita revendaId.
- **Processamento** — `processarPlanilha` vira `processarEntregas(entregas,
  agora, { token, cercaId, config })`; o parse fica fora. Leitura:
  `entregasDoPeriodo(revendaId, de, ate)`.

### API (tRPC)

- `entregas.processar({ revendaId, de, ate, cercaId? })` — lê do banco e cruza.
- `entregas.importar({ revendaId, xlsxBase64 })` — upload que grava.
- `entregas.coletar({ revendaId, de, ate })` — botão.
- `entregas.coletas({ revendaId })` — últimas 10.
- `entregas.contas.listar` (nunca devolve senha/token, só "definido"),
  `salvar` (senha/token vazios = mantém), `ativar`, `testarCheckNow`,
  `testarInfleet` (quantos veículos), `revendasSemConta`.
- PDF: `POST /api/relatorio-entregas/gerar` passa a receber
  `{ revendaId, de, ate, data?, analise?, cercaId? }`.

## 6. Tela

- **Topo:** Revenda (contas ativas; última escolhida lembrada no navegador),
  Período de/até (abre em hoje, máx. 31 dias). Trocar revenda ou período carrega
  sozinho (lê do banco + GPS). Botão **Buscar do CheckNow** (coleta e recarrega;
  toast "12 rotas, 148 entregas atualizadas" ou o erro). **Importar planilha**
  vira botão secundário.
- **Situação da coleta:** "Última coleta: hoje 10:05 ✓"; vermelho se a última
  falhou ("Falhou às 11:05: login recusado") ou se passaram 3 h sem sucesso
  dentro de 06h–22h. Clique → últimas 10 coletas (hora, origem, período,
  resultado, linhas).
- **Período vazio:** "Nenhuma entrega de Duttra FL entre 01/10 e 07/10" + botão
  Buscar do CheckNow.
- **Resto igual:** abas Por dia / Por rota, dia, detalhe, cerca (lista da conta
  Infleet da revenda; padrão "Sede"), PDF pela revenda e período.
- **Modal ⚙** com abas **Limites** (atual) e **Contas**: por revenda, ativo,
  usuário, senha ("definida" + campo para trocar), token Infleet ("definido" ou
  "vazio — usa o padrão do servidor"), Testar CheckNow (mostra a filial),
  Testar Infleet (quantos veículos), última coleta. "Adicionar conta" escolhe
  revenda sem conta. Sem excluir, só desativar.

## 7. Redundância

| Risco | Proteção |
|---|---|
| CheckNow fora / login recusado / tela mudou | Tentativas (§5); falha nunca apaga dados. |
| Planilha vazia ou inválida | `parseCheckNow` antes de gravar; inválida não grava. |
| Gravação pela metade | Transação única. |
| Servidor parado | Recuperação ao subir, até 7 dias. |
| Botão + automático juntos | Advisory lock por revenda. |
| Baixa registrada tarde | Hoje+ontem de hora em hora; 3 dias às 23:30. |
| Coleta quebrada de vez | Upload manual continua e grava no banco. |
| Ninguém percebe | Situação da coleta na tela, vermelho após 3 h. |
| Dev coletando junto | Só com `CHECKNOW_COLETA_AUTO=1`. |

**Limitação aceita:** rota apagada no CheckNow depois de coletada continua no
banco (a coleta só substitui as rotas que vieram no arquivo).

## 8. Segurança

- Senha e token cifrados no banco; nunca voltam para a tela nem para log.
- `CHECKNOW_CHAVE` só no `.env` / `.env.prod`. Perder a chave = recadastrar as
  senhas.
- O metric-flow não exige login: quem tiver o endereço pode trocar ou desativar
  contas (não ler senhas). Proteger o app é trabalho à parte.
- As credenciais do docx de referência não vão para código, testes nem fixtures.

## 9. Testes

- `coletor.test.ts` — `fetch` simulado com HTML de exemplo e um xlsx pequeno:
  caminho feliz (corpo do passo 6 com datas, `tipoRelatorioId=11`,
  `commandLinkExporta` e ViewState), login recusado, ViewState ausente, HTML no
  lugar do Excel, período de 10 dias vira 2 blocos.
- `cofre.test.ts` — ida e volta; chave errada falha; cifras diferentes para o
  mesmo texto.
- `agendador.test.ts` — `proximaExecucao` (05:50 → 06:05, 22:10 → 23:30,
  23:40 → 06:05 do dia seguinte) e `periodoRecuperacao` (limite de 7 dias).
- `sincronizar.test.ts` — com banco simulado: rotas fora do arquivo intactas,
  arquivo vazio não apaga, erro registra a coleta, trava ocupada.
- Testes atuais de `processar` adaptados a `processarEntregas`.

## 10. Implantação

1. Rodar o SQL de `drizzle/manual/` (local com confirmação; produção no deploy).
2. Gerar a chave: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   e pôr `CHECKNOW_CHAVE` no `.env` e no `.env.prod`.
3. `CHECKNOW_COLETA_AUTO=1` só no `.env.prod`.
4. Cadastrar as contas no ⚙ e usar "Testar CheckNow".
