---
id: p1-004
title: Testar os 6 módulos ponta a ponta em produção
priority: p1
status: open
fase: 4-amarracoes
dependencias: p1-003
---

## Descrição

Validar que todos os módulos funcionam corretamente no ambiente de produção após o deploy completo.

## Checklist

- [ ] **Login** — fluxo OAuth completo, cookie persistido
- [ ] **Rota Coaching** — carrega dados, filtros funcionam, mapa renderiza
- [ ] **Análise** — consultas SQL pesadas respondem, gráficos carregam
- [ ] **Trello Atraso** — relatório gerado e exibido
- [ ] **Agenda GV** — listagem e upload xlsx funcionam
- [ ] **WhatsApp** — envio via Evolution API funciona
- [ ] **Assessment** — formulário, checkboxes e exportação Excel funcionam

## Notas

Testar com usuário real, não apenas verificar se a página carrega. Monitorar o console do browser e os logs do pm2 em paralelo.
