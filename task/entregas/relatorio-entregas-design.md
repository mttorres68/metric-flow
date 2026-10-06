# Relatório Gerencial de Entregas — CheckNow × Infleet

> Design aprovado em 2026-10-05. Módulo novo dentro do MetricFlow, no mesmo
> padrão do "Relatório Gerencial de Rotas e Visitas" (vendedores), mas para
> motoristas de entrega. Primeira versão **sem banco**: upload → cálculo → PDF.

---

## 1. Objetivo e escopo

**Pergunta operacional:** o motorista esteve de fato em cada cliente em que deu
baixa no CheckNow, por quanto tempo, e como foi a jornada do dia?

**Produto:** PDF diário com uma linha por **placa · motorista · dia** e uma
página de exceções (baixas que o GPS não confirma).

**Por que existe:** na amostra (6 rotas, 01–05/10/2026) a baixa do CheckNow não
comprova presença:
- `Tempo Cliente (Min)` = 0 em 311 de 358 entregas; chegada, início e saída da
  baixa ficam a segundos de distância uma da outra;
- 57 de 245 baixas foram feitas a mais de 500 m do cliente (mediana 92 m,
  máximo de 129 km);
- `Odômetro Real. Veículo` e `Distância Real. Veículo` estão sempre em 0, ou seja,
  o CheckNow não tem telemetria.

**Escopo travado:**
- Fontes: **CheckNow** (upload manual da planilha "Geracao_Dado_BI") e
  **Infleet** (API GraphQL).
- Cruzamento por **proximidade**: o caminhão não para exatamente na coordenada
  do cliente.
- **Não faz parte nesta versão:**
  - ERP de clientes: as coordenadas do CheckNow são idênticas às do ERP (0 m nos
    352 casos comparáveis);
  - persistência em banco e histórico;
  - aderência à sequência planejada;
  - limites editáveis na tela.

## 2. Dados (conferido 2026-10-05)

**CheckNow — `Geracao_Dado_BI.xlsx`** (amostra em `Projetos/rota/dados/`)
- 977 linhas, das quais 619 são duplicatas exatas. Sobram 358 notas
  (`RouteId`+`Documento`) e **348 entregas** (`RouteId`+`Código do Cliente`).
  A situação é sempre a mesma entre as notas de um mesmo cliente na rota.
- Colunas usadas:
  - rota e motorista: `RouteId`, `Placa`, `Motorista`;
  - cliente: `Código do Cliente`, `Descrição do Ponto`, `Latitude`, `Longitude`;
  - baixa: `Situação` (ENTREGUE / PROBLEMA / AGUARDANDO), `Data de Chegada`,
    `Hora de Chegada`;
  - janela da rota: `Data/Hora Rota Inicio Realizada`,
    `Data/Hora Rota Fim Realizada`;
  - odômetro: `Odometro Inicial/Final Real. Informado`.
- **As rotas duram vários dias** (viagem pelo interior, com pernoite fora). Uma
  rota pode estar aberta, sem fim realizado.
- O mesmo caminhão troca de motorista no mesmo dia. Exemplo: SOO-8D21, ANTONIO
  até 05/10 06:51 e FRANCISCO a partir de 05/10 06:52.
- `Distância Planejada (KM)` = 0 em todas as rotas, então não há km planejado.
- 6 clientes têm lat/lon = 0.
- Horários em BRT (-03:00).

**Infleet — `https://api.infleet.com.br/v1/graphql`** (Bearer `INFLEET_TOKEN`)
- `listVehicles { id plate }`: placa → `vehicleId`.
- `listVehiclePositions(filter: { vehicleId, fixTime: { startAt, endAt } })` →
  `Position { latitude longitude fixTime speed ignition valid driverId }`.
- `routeVehicleDetails(filter)`: `totalDistanceTraveled` na janela (mesma
  conversão de unidade do `resumoDiario`).
- **Sonda (2026-10-05, SOO-8D21, 06:00–12:00):** 509 posições em 6 h (sem
  sinal de truncamento; chegam em ordem decrescente de `fixTime`); `speed` em
  km/h (mediana da razão 1.00, 408 amostras) → `SPEED_PARA_KMH = 1`; `plate`
  no formato `SOL6B13` (sem hífen, por isso a normalização da placa); 10
  veículos na conta; `routeVehicleDetails.totalDistanceTraveled` = 124.68 (km).

## 3. Arquitetura

```
client: página "Relatório de Entregas"
  └─ upload xlsx (base64 em JSON, padrão do crmUpload) + análise do gestor (texto)
        ↓ POST /api/relatorio-entregas/gerar
server/routes/relatorioEntregas.ts
  1. parseCheckNow(buffer)      → Entrega[] (deduplicada, datas BRT)
  2. montarLinhas(entregas)     → Linha[] (placa · motorista · dia + janela GPS)
  3. Infleet por linha (até 3 em paralelo):
       placa → vehicleId; posições na janela; routeVehicleDetails na janela
  4. detectarParadas(posições)  → Parada[]
  5. cruzar(linha, entregas, paradas, LIMITES) → KPIs da linha + exceções
  6. gerarPDFEntregas(dia, linhas, exceções, análise) → 1 PDF por dia (zip se > 1 dia)
```

| Arquivo | Papel |
|---|---|
| `server/services/entregas/parseCheckNow.ts` | lê o xlsx, valida colunas, deduplica e converte datas |
| `server/services/entregas/detectarParadas.ts` | **puro**: posições → paradas |
| `server/services/entregas/cruzar.ts` | **puro**: linhas, janelas, status, KPIs, exceções; contém `LIMITES` |
| `server/services/entregas/infleetEntregas.ts` | placa → `vehicleId`; posições em blocos de 6 h; km; converte para `GpsLinha` |
| `server/services/pdfEntregas.tsx` | as duas páginas do PDF (`@react-pdf/renderer`) |
| `server/routes/relatorioEntregas.ts` | rota express; orquestra parse → Infleet → cruzar → PDF; registrada em `server/_core/index.ts` |
| `script/sondaInfleet.ts` | sonda da §9 (descartável, fica como referência) |
| `server/routers/infleetRouter.ts` | só passa a **exportar** `infleetQuery` |
| `server/services/pdfService.tsx` | só passa a **exportar** cores, estilos e `FooterBar` para reuso |
| `client/src/pages/relatorio-entregas/` + `Sidebar.tsx` + `App.tsx` | tela e rota |

```ts
// cruzar.ts — único lugar dos limites (v1: constantes; v2: configService)
export const LIMITES = {
  raioM: 300,               // parada conta para o cliente se o centro estiver a ≤ 300 m
  relampagoMin: 3,          // permanência abaixo disso = relâmpago
  paradaSemClienteMin: 10,  // parada longa longe de todo cliente
  saidaAte: "08:00",
  apos14h: "14:00",
  apos14hMinPct: 25,        // vermelho abaixo disso
  relampagoMaxPct: 10,      // vermelho acima disso
};
```

## 4. Linha do relatório e janela de GPS

- **Linha = placa · motorista · dia.** Uma rota de 3 dias gera 3 linhas.
- O dia de uma entrega é a `Data de Chegada` da baixa. Entregas AGUARDANDO não
  têm dia; só entram em "Pendentes".
- **Janela de GPS da linha** = o dia inteiro (00:00–23:59:59; para o dia de
  hoje, até o momento da geração), mesmo antes do início ou depois do fim da
  rota no app. Assim a saída real e o retorno à base entram, mesmo que o
  motorista inicie a rota no app atrasado (caso real: SOL-6B13 em 05/10 saiu às
  07:26, mas iniciou a rota no app às 08:44). A janela só é cortada quando o
  mesmo caminhão troca de motorista no dia: no fim da rota anterior, ou no
  início da seguinte se a anterior não tiver fim (vale o menor dos dois).
- Os dias da linha vão do início da rota até o fim dela (ou até o dia da última
  baixa, se aberta). Dia sem baixa, mas dentro da rota, também gera linha.

## 5. Detecção de parada (`detectarParadas`)

1. Descarta posições com `valid = false` e ordena pelo `fixTime`.
2. Posição parada = `speed` < 5 km/h, convertendo a unidade conforme a sonda.
3. Uma sequência contínua de posições paradas forma uma parada:
   - início = `fixTime` da primeira;
   - fim = `fixTime` da primeira posição em movimento seguinte (ou da última
     posição, se a janela acabar parada);
   - centro = média de lat/lon.
   Isso cobre o rastreador que manda poucas posições com o motor desligado.
4. Funde paradas consecutivas cujos centros estão a < 50 m e que estão separadas
   por < 2 min de movimento (manobra para descarregar).
5. Descarta paradas com menos de 1 min (semáforo, trânsito). A fusão vem antes
   do descarte.

Distância: haversine (raio da Terra de 6.371 km).

## 6. Casamento e status (`cruzar`)

Para cada entrega com baixa (ENTREGUE ou PROBLEMA) no dia da linha:
- **Paradas candidatas** = paradas da janela cujo centro está a ≤ `raioM` do
  cliente. Permanência = soma das durações delas.
- Uma mesma parada pode atender clientes vizinhos. Isso é permitido.
- **Status**, nesta ordem:

| Status | Regra | Entra nos %? |
|---|---|---|
| `sem_coordenada` | lat/lon do cliente = 0 | não (só exceção) |
| `no_raio` | permanência ≥ `relampagoMin` | sim |
| `relampago` | 0 < permanência < `relampagoMin` | sim |
| `sem_parada` | nenhuma parada candidata | sim |

- Para as exceções, guardo também a **distância da parada mais próxima** (de
  qualquer distância) do cliente.
- **Linha sem GPS** (sem rastreador, sem posições ou falha do Infleet): não
  calcula status por entrega. As colunas de GPS ficam "—", a linha não gera
  exceções e o motivo vai para o rodapé de avisos.

**Saída / retorno do dia** (revisado em 2026-10-06):
- trechos em movimento = intervalos entre as paradas (e antes da 1ª / depois
  da última); só contam os de **3 min ou mais**, para ignorar manobra de pátio;
- saída = início do 1º trecho assim; retorno = fim do último (início da
  última parada);
- **opção cerca**: com uma cerca da base escolhida na tela (padrão: a cerca
  "Sede", se existir), a saída é o 1º evento `geofenceExit` ("Saiu da cerca")
  dessa cerca na janela. Sem esse evento, vale o GPS. A origem fica marcada
  (ícone na tela, `*` no PDF).

**Paradas sem cliente:** paradas com duração ≥ `paradaSemClienteMin`, que
começam depois da saída e antes do retorno, cujo centro fica a > `raioM` de
**todos** os clientes da rota com coordenada. O pernoite e o pátio ficam de
fora por construção; o almoço entra.

## 7. Saída (PDF)

Mesmo visual do relatório de vendas: cabeçalho, legenda com os limites, tabela,
análise do gestor e rodapé "MetricFlow · data · Gerado em".

**Página 1 — Detalhamento por placa/motorista** (linha "Geral" ao final)

| Coluna | Cálculo | Vermelho quando |
|---|---|---|
| Placa · Motorista | — | — |
| Saída | primeiro movimento do dia (GPS) | > `saidaAte` |
| Retorno | início da última parada do dia (GPS) | — |
| Entregas | ENTREGUE com baixa no dia / total de clientes da rota | — |
| Após 14h | ENTREGUE com hora da baixa (CheckNow) ≥ 14:00 / ENTREGUE do dia | < `apos14hMinPct` |
| No raio | `no_raio` / baixas do dia com coordenada | < 100% |
| Baixa sem parada | quantidade de `sem_parada` | > 0 |
| Relâmpago | `relampago` / (`no_raio` + `relampago`) | > `relampagoMaxPct` |
| Paradas sem cliente | quantidade · tempo total | — |
| Km GPS | `routeVehicleDetails` na janela | — |
| Pendentes · Km informado | só no dia em que a rota fecha: AGUARDANDO da rota · (odômetro final − inicial informado) | pendentes > 0 |

**Página 2 — Exceções:** uma linha para cada baixa do dia com status diferente
de `no_raio` (linhas sem GPS não entram; ver §6). Colunas: placa, motorista, cliente, código, hora da baixa, status,
distância da parada mais próxima (m) e permanência no raio.

Rodapé de avisos: placas sem rastreador e falhas do Infleet por linha.

**Painel na tela** (adicionado em 2026-10-06; mesmo padrão visual de Análise →
Diária). Upload → tRPC `entregas.processar` (pipeline em
`server/services/entregas/processar.ts`, compartilhado com o PDF) →:
- seletor de dia (só os dias da planilha);
- KPIs do dia (placas · motoristas, entregas, % no raio, baixas sem parada, %
  relâmpago);
- tabela com as mesmas colunas e regras de vermelho do PDF. Clicar na placa ·
  motorista abre todas as baixas daquele dia com o status de cada uma;
- botão "Exceções" com a lista do dia;
- editor de análise e "Baixar PDF do dia" (`POST /gerar` com `data`) ou
  "Baixar todos (ZIP)".

Limites e formatação ficam em `shared/entregas.ts`, usados pelo servidor e pela
tela. Percentual com denominador zero aparece como "—" (tela e PDF).

## 8. Erros

| Situação | Comportamento |
|---|---|
| Planilha sem as colunas da §2 | HTTP 400 com a lista das colunas faltantes; nada é gerado |
| Placa ausente no Infleet (comparada em maiúsculas, sem `-` e espaços) | linha `sem_gps` com aviso "sem rastreador"; Entregas e Após 14h são calculados normalmente |
| Erro ou timeout do Infleet numa linha | linha `sem_gps` + aviso no rodapé; as demais seguem |
| Janela sem posições | linha `sem_gps` ("sem sinal GPS") |
| Possível truncamento de posições (limite não documentado) | a janela é sempre buscada em blocos de 6 h, concatenados |
| `INFLEET_TOKEN` ausente | HTTP 500 com a mensagem do `infleetQuery` |

O body JSON já aceita 50 MB (`server/_core/index.ts`); a planilha tem cerca de
300 KB.

## 9. Validação

**Sonda (primeira tarefa, antes do código definitivo):** um script com uma
chamada real ao Infleet para SOO-8D21 em 05/10, para confirmar:
- a unidade do `speed`;
- quantas posições vêm por janela e se existe limite;
- o formato de `plate`;
- que `routeVehicleDetails` aceita a mesma janela.

**Testes (vitest, só com dados sintéticos; nenhum dado real de cliente no repo):**
- `detectarParadas`: parada simples; descarte abaixo de 1 min; fusão abaixo de
  50 m / 2 min; intervalo longo com o motor desligado; janela que termina parada.
- `cruzar`:
  - status `no_raio`, `relampago`, `sem_parada`, `sem_coordenada` e linha sem GPS;
  - clientes vizinhos atendidos pela mesma parada;
  - parada sem cliente fora do intervalo entre saída e retorno não conta;
  - troca de motorista no mesmo caminhão no mesmo dia (janelas separadas);
  - rota de vários dias (Pendentes só no dia de fechamento);
  - Após 14h.
- `parseCheckNow`: xlsx montado no teste com `XLSX.utils`; deduplicação por
  `RouteId`+`Código do Cliente`; colunas faltantes → erro com a lista.

**Validação com dados reais:** gerar o relatório com a planilha de
`Projetos/rota/dados/` e cruzar o status do GPS com a distância da baixa
informada pelo próprio CheckNow (`Distância do Ponto (MT)`). Uma baixa longe do
cliente pode ter parada GPS no raio (baixa em lote feita depois). Isso é
justamente o que o relatório revela, então não existe resultado "esperado"
fixo. A tabela cruzada é revisada junto com o gestor para calibrar os limites.

## 10. Ordem de construção

1. Sonda do Infleet (§9). Ajustar a §5 conforme o resultado.
2. `parseCheckNow` + testes.
3. `detectarParadas` + testes.
4. `cruzar` + testes.
5. Exportar `infleetQuery` e os estilos do PDF; `pdfEntregas.tsx`.
6. Rota `relatorioEntregas.ts`.
7. Tela + Sidebar.
8. Validação com a planilha real.

## 11. Depois desta versão (fora do escopo)

- Persistir entregas e paradas no Postgres (histórico por motorista e semana),
  com deduplicação de upload por `RouteId`.
- Levar `LIMITES` para o `configService`, editável na tela.
- Aderência à sequência (`Ordem Planejada` × ordem real pelo GPS).
- ERP: paradas em clientes fora do romaneio; qualidade do cadastro de
  coordenadas.
- Confirmar o motorista pelo `listVehicleDriverHistories` do Infleet.
