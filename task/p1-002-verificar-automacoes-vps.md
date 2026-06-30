---
id: p1-002
title: Verificar automações Python/n8n que alimentam arquivos no VPS
priority: p1
status: open
fase: 2-backend
---

## Descrição

Rota Coaching, Trello e PathTracker leem arquivos gerados por automações externas. Essas automações precisam rodar no mesmo VPS e gravar nos caminhos que o backend lê.

## Checklist

- [ ] Confirmar que a automação que grava `COACHING_DATA_PATH` está rodando no VPS
- [ ] Confirmar que a automação que grava `PT_DATABASE_PATH` está rodando no VPS
- [ ] Confirmar que n8n está gravando `TRELLO_REPORT_OUTPUT_PATH` no VPS
- [ ] Testar leitura dos arquivos após o backend subir: módulo Rota Coaching deve carregar dados

## Notas

Se as automações rodam em outra máquina, precisam ser migradas para o VPS ou os arquivos precisam ser sincronizados (rsync, NFS, etc.).
