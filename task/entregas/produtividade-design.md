# Produtividade em hectolitros e aba "Por dia new" — Design

Data: 2026-10-09 · Branch: `entregas/relatorio-entregas` · Depende de: `relatorio-entregas-design.md`, `checknow-coleta-design.md`

## 1. Objetivo

Medir a produtividade da entrega em volume — quanto tempo leva para entregar X
hectolitros — e mostrar o dia de um jeito que se entenda de relance, numa aba
nova **"Por dia new"** (as abas "Por dia" e "Por rota" continuam iguais).

**Sucesso:** abrir o dia e ver, por caminhão, hL entregues, hL/h da jornada,
devolução em hL e alertas; abrir o cartão e ver onde o tempo foi gasto (cliente
a cliente, tempo fixo × por hL, retornável × descartável).

**Fora do escopo:** comparação com a média da revenda e tendência semanal
(sugestão 5); coleta `entrega_lote` do CheckNow (o CSV do ERP já traz tudo);
tabela de clientes do ERP; descrição dos motivos de devolução (fica o código).

## 2. Decisões

| Tema | Decisão |
|---|---|
| Quantidades | CSV de pedidos do ERP (itens com quantidade, retorno e líquido). |
| Volume | Cadastro de produtos do ERP: `Fat.Conv1` = hL por embalagem. |
| Ligação | **Documento** do CheckNow = **Pedido** do ERP. |
| Entrada | Upload na tela (⚙); CSV do mês reenviado todo dia. |
| Produtos | Uma tabela para todas as revendas (código = chave). |
| Medidas | hL/h da jornada, min/hL de descarga, hL/km, devolução em hL, hL por parada, tempo fixo × por hL, min/hL por embalagem. |
| Tela | Cartões por caminhão com linha do dia em miniatura; clique abre o detalhe. |

## 3. Fontes

### Cadastro de produtos (`PRODUTOS.xlsx`, aba PRODUTOS)

| Coluna | Uso |
|---|---|
| Reduzido | código (`0000903482`) — o mesmo do CSV (`Cod Red`) e do CheckNow |
| Descricao, Familia, Categoria, Marca | descrição e agrupamentos |
| Un | embalagem: CX, EB, BR, UN |
| Qtd/Un | unidades por embalagem |
| Fat.Conv1 | **hL por embalagem** (0,144 = 24 × 0,6 L); 0 = sem volume (palete, mesa, caixa plástica…) |
| Ativo | 1/0 |

Tipo de embalagem: **retornável** se a Categoria contém "RETORNAVEL"; **barril**
se `Un = BR` ou a Categoria contém "LITROS"/"BARRIL"; senão **descartável**.
Litros por embalagem = Fat.Conv1 × 100; litros por unidade = litros por
embalagem ÷ Qtd/Un.

### Pedidos do ERP (`PEDIDOS <MÊS><AA>.CSV`)

`;`, latin1, decimais com vírgula; uma linha por item. O cabeçalho repete
`Desc` e traz `||Item` (com o prefixo `||`).

| Coluna | Uso |
|---|---|
| Pedido | = Documento do CheckNow (12 dígitos) |
| Romaneio, Cliente, Placa, Mot, Dt.Pedido | contexto |
| Canc | `009` = cancelado/não saiu (romaneio `00000000000`) → fora das contas |
| `||Item` | número do item no pedido |
| Cod Red | código do produto |
| Quant CX / Quant UN | saiu |
| Retorno CX / Retorno UN | voltou |
| Qtd.CX Liq. / Qtd.Un Liq. | ficou com o cliente |
| Mot Dev | motivo da devolução (Z11, Z12…) |
| Vlr Total | valor do item |

## 4. Dados

- **`produtos`** (global): `codigo` (PK), descricao, familia, categoria, marca,
  embalagem (CX/EB/BR/UN), tipo (`retornavel` | `descartavel` | `barril` |
  null), unPorEmb, litrosEmb (null sem volume), litrosUn, ativo, atualizadoEm.
- **`erp_pedido_itens`**: id, revendaId, pedido, item, romaneio, cliente,
  placa, motoristaCod, dataPedido, codProduto, qtdCx, qtdUn, retCx, retUn,
  liqCx, liqUn, motivoDev, valor, cancelado (Canc = 009), importadoEm. Única:
  (revendaId, pedido, item). Índice (revendaId, pedido).
- **`checknow_entregas.documentos`** `text[]`: documentos da entrega (a planilha
  repete a linha por documento). Entregas coletadas antes ficam com `[]` até a
  próxima coleta.
- **`produtividade_paradas`** (cache para o "4 semanas"): revendaId, dia, placa,
  motorista, routeId, codCliente, hL, minDescarga. Única: (revendaId, routeId,
  codCliente, dia). Gravada ao processar um dia; o "4 semanas" usa os dias já
  abertos e diz quantos.

SQL manual em `drizzle/manual/` (nada de `db:push`).

## 5. Importação (modal ⚙, aba Contas → seção "ERP")

- **Importar produtos (ERP)** — global; upsert por código; códigos ausentes no
  arquivo ficam como estão. Aviso: "997 produtos (322 com volume)".
- **Importar pedidos (ERP)** — na revenda selecionada; troca, numa transação,
  todos os itens dos pedidos presentes no arquivo; os outros ficam. Reenviar o
  mesmo arquivo não duplica. Aviso: "11.027 itens · 3.677 pedidos · 3 produtos
  sem cadastro: 0000905603, …".
- A importação de pedidos aparece em `checknow_coletas` com origem `erp`
  (período = datas dos pedidos do arquivo). A de produtos, que é global, só
  mostra o aviso.
- Arquivo com colunas faltando → erro que lista as colunas (como o CheckNow).

## 6. Medidas

Por item: hL = liqCx × litrosEmb/100 + liqUn × litrosUn/100; devolvido =
retCx × litrosEmb/100 + retUn × litrosUn/100. Item cancelado, produto sem
cadastro ou sem volume não soma (produto sem cadastro é listado).

**Por entrega** (soma dos itens dos `documentos`):
- hL entregue, hL devolvido (+ motivos), hL por tipo de embalagem;
- tempo de descarga = permanência no raio pelo GPS (já existe);
- **min/hL** = descarga ÷ hL (só com parada no raio e hL > 0);
- tipo dominante = tipo com ≥ 70% do hL, senão `misto`;
- sem documento casado no ERP → "sem volume".

**Por motorista · dia:**
- **hL/h da jornada** = hL ÷ horas (saída → retorno); sem retorno ainda: até a
  última saída de cliente, marcado "parcial";
- hL entregues, hL devolvidos, **% devolução** = dev ÷ (entregue + dev);
- **hL/km** = hL ÷ km GPS do dia;
- **hL por parada** = hL ÷ clientes com hL > 0; e a menor entrega do dia;
- **tempo fixo × por hL**: mínimos quadrados `min = fixo + porHl × hL` sobre as
  entregas do dia com descarga e hL; precisa de ≥ 6 pontos e hL variando; reta
  com fixo < 0 ou porHl < 0 → "poucas entregas para calcular". Mesmo cálculo
  com os pontos de `produtividade_paradas` do motorista nos últimos 28 dias;
- **min/hL por embalagem** = soma da descarga ÷ soma do hL, por tipo dominante.

**Resumo do dia:** hL entregues, hL/h (hL total ÷ horas somadas), % devolução,
hL por parada.

## 7. Tela "Por dia new"

- Mesmos controles (revenda, dia visto, cerca); mesma chamada `processar`,
  estendida com o volume.
- Resumo: 4 números do dia.
- Cartões em grade, ordenados do menor hL/h para o maior. Cada cartão: placa ·
  motorista, cidades, **hL/h** em destaque (neutro), hL · hL dev. · hL/km ·
  entregues/total, linha do dia em miniatura (rodando / parado no cliente /
  parado sem cliente) e etiquetas de alerta.
- **Etiquetas:** saída tardia; devolução alta (> 10% do hL); paradas sem
  cliente; desvios; trechos lentos; sem GPS; N entregas sem pedido no ERP;
  **app X min depois** (1º registro no app > 30 min após a chegada ao 1º
  cliente pelo GPS); **registro longe do cliente** (alguma entrega registrada
  no app fora do raio).
- Clique no cartão abre o detalhe abaixo da linha de cartões:
  - linha do dia grande com marcas dos registros no app;
  - clientes na ordem de visita: barra = hL, cor = min/hL (verde ≤ mediana do
    dia, âmbar ≤ 2×, vermelho > 2×); clique no nome abre o mapa da entrega;
  - dispersão hL × minutos com a reta, "fixo X min · Y min por hL" do dia e
    das 4 semanas (n dias);
  - min/hL por embalagem (retornável, descartável, barril, misto).
- Cores das categorias de tempo: as do relatório (rodando #2a78d6, no cliente
  #eb6834, sem cliente #1baf7a; escuro #3987e5, #d95926, #199e70).

## 8. Testes

- `parseProdutos` — volume, tipo de embalagem, sem volume, colunas faltando.
- `parsePedidosErp` — latin1, `;`, cabeçalho com `Desc` repetido e `||Item`,
  números com vírgula, Canc 009, colunas faltando.
- `parseCheckNow` — `documentos` distintos por entrega.
- `volume` (puro) — hL e devolvido por item; soma por entrega; sem cadastro.
- `produtividade` (puro) — hL/h (com e sem retorno), hL/km, hL por parada,
  reta (caso bom; < 6 pontos; inclinação negativa), tipo dominante e min/hL por
  tipo, etiquetas novas.
- Gravação dos pedidos: só os pedidos do arquivo são trocados (script local,
  como `validarRepoCheckNow`).

## 9. Implantação

SQL manual (local com confirmação; produção no deploy); importar produtos uma
vez; importar o CSV do mês todo dia; buscar os últimos 7 dias do CheckNow para
preencher `documentos`.
