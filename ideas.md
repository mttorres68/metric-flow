# MetricFlow — Ideias de Design

## Abordagem 1: Soft Data Studio
<response>
<text>
**Design Movement:** Soft Modernism — Minimalismo com calor humano

**Core Principles:**
- Superfícies brancas e off-white como base, com acentos em pastel suave (verde-menta, azul-pó, lilás claro)
- Hierarquia visual construída por peso tipográfico e espaçamento, não por bordas ou divisores
- Dados como protagonistas: gráficos e KPIs ocupam 80% do espaço visual
- Sidebar fixa e estreita com ícones + labels, sem ruído visual

**Color Philosophy:**
- Background: #FAFBFC (quase branco, levemente acinzentado)
- Cards: #FFFFFF com sombra suave (box-shadow: 0 1px 3px rgba(0,0,0,0.06))
- Accent primário: #6BBFB5 (verde-teal pastel) — transmite confiança e crescimento
- Accent secundário: #A8C5E8 (azul-pó) — para gráficos de linha
- Accent terciário: #C9B8E8 (lilás claro) — para KPI de conversão
- Texto: #1A1F2E (quase preto) e #6B7280 (cinza médio) para labels

**Layout Paradigm:**
- Sidebar fixa de 240px à esquerda
- Área de conteúdo com padding generoso (32px)
- Grid de KPIs em linha horizontal (4 cards)
- Gráficos lado a lado (linha + barras) em grid 60/40
- Tabela de largura total na parte inferior

**Signature Elements:**
- Números de KPI com fonte display bold (DM Sans 700, tamanho 2.5rem)
- Micro-badge de variação percentual (verde/vermelho) ao lado de cada KPI
- Linha divisória sutil entre sidebar e conteúdo (1px, #E5E7EB)

**Interaction Philosophy:**
- Hover em cards eleva sombra suavemente
- Filtros com transição de 200ms
- Linhas da tabela com highlight ao hover

**Animation:**
- Entrada dos KPIs com counter animado (0 → valor final, 800ms)
- Gráficos aparecem com fade-in + slide-up (400ms, ease-out)
- Sidebar items com hover transition de cor

**Typography System:**
- Display/KPI: DM Sans 700 (números grandes)
- Headings: DM Sans 600
- Body: DM Sans 400
- Labels/captions: DM Sans 400, #6B7280, 0.75rem
</text>
<probability>0.08</probability>
</response>

## Abordagem 2: Neo-Editorial Dashboard
<response>
<text>
**Design Movement:** Editorial Minimalismo — Inspirado em relatórios financeiros modernos

**Core Principles:**
- Contraste tipográfico extremo: números enormes vs. labels pequenas
- Layout assimétrico com sidebar estreita e área de dados dominante
- Paleta restrita: branco + 1 cor de acento forte (coral suave)
- Dados apresentados como narrativa, não apenas como tabelas

**Color Philosophy:**
- Background: #F8F9FA
- Accent: #F4A261 (coral/laranja pastel) — energia e urgência positiva
- Texto principal: #212529
- Texto secundário: #868E96
- Sucesso: #51CF66 (verde menta)

**Layout Paradigm:**
- Sidebar de 64px (apenas ícones, sem labels)
- KPIs em coluna vertical no lado esquerdo do conteúdo
- Gráficos ocupam 70% da largura central
- Tabela em painel deslizante inferior

**Signature Elements:**
- Números KPI com fonte Playfair Display (serifada, bold)
- Linhas de separação horizontais finas como em jornais
- Gráficos sem bordas, apenas com área preenchida suavemente

**Interaction Philosophy:**
- Click nos KPIs filtra os gráficos
- Tabela com ordenação por coluna
- Tooltip rico nos gráficos

**Animation:**
- Números KPI com flip animation ao carregar
- Gráficos com draw animation (linha se desenha da esquerda para direita)

**Typography System:**
- KPI números: Playfair Display 700
- Headings: Syne 600
- Body: IBM Plex Sans 400
</text>
<probability>0.07</probability>
</response>

## Abordagem 3: Pastel Command Center ✅ ESCOLHIDA
<response>
<text>
**Design Movement:** Soft Dashboard — Painel de controle com estética pastel e cantos arredondados

**Core Principles:**
- Branco puro como base com cards pastéis diferenciados por KPI
- Sidebar com gradiente suave e ícones coloridos
- Tipografia geométrica limpa (Nunito) para transmitir modernidade e leveza
- Gráficos com cores pastel coordenadas com os KPIs

**Color Philosophy:**
- Background geral: #F0F4F8 (azul-cinza muito claro)
- Sidebar: #FFFFFF com borda direita sutil
- Card Receita: fundo #EEF9F4 (verde-menta claro), acento #34C78A
- Card Clientes: fundo #EEF4FF (azul-lavanda claro), acento #6C8EF5
- Card Conversão: fundo #FFF4EE (pêssego claro), acento #F5956C
- Card Tempo Médio: fundo #F5F0FF (lilás claro), acento #A78BFA
- Texto: #1E293B (slate escuro) e #64748B (slate médio)

**Layout Paradigm:**
- Sidebar fixa 240px com logo, nav items e avatar do usuário na base
- Header com barra de filtros (data + segmento)
- Grid 4 colunas para KPIs
- Gráfico de linha (largura 60%) + gráfico de barras (largura 40%) lado a lado
- Tabela full-width na base

**Signature Elements:**
- Ícone colorido em círculo pastel no canto de cada KPI card
- Indicador de tendência (seta + %) com cor semântica
- Gráficos com área preenchida semi-transparente (fill opacity 0.15)

**Interaction Philosophy:**
- Filtros alteram os dados dos gráficos e tabela em tempo real
- Hover nos cards de KPI mostra tooltip com detalhes
- Linhas da tabela com highlight suave ao hover

**Animation:**
- KPIs com counter animado ao montar (0 → valor, 1s ease-out)
- Cards entram com stagger animation (50ms delay entre cada)
- Gráficos com animação de entrada (recharts built-in)

**Typography System:**
- Fonte principal: Nunito (Google Fonts)
- KPI números: Nunito 800, 2rem
- Headings: Nunito 700, 1.125rem
- Body/labels: Nunito 400-500, 0.875rem
- Sidebar labels: Nunito 600, 0.875rem
</text>
<probability>0.09</probability>
</response>

---
**Design escolhido: Abordagem 3 — Pastel Command Center**
