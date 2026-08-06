# Flag `recorrente` — de onde vem a bolinha vermelha

> Doc focado: só explica a decisão de `m.recorrente` usada em
> `views/RecorrenciaSemanal.tsx`. Para fórmulas de todas as métricas
> (`relampago_pct`, `visitas_pct`, etc.) e o resto do módulo Análise, ver
> `docs/analise-semanal-metricas.md` (fonte completa).

## Onde é renderizado

`views/RecorrenciaSemanal.tsx:341-356` — para cada vendedor/flag, lê
`v.metricas[f.id]` e decide o visual:

| Condição              | Visual                             |
| ---------------------- | ----------------------------------- |
| `m.dias === 0`       | `—` cinza (sem ocorrência)        |
| `m.recorrente`       | Badge vermelho `dias/diasAtivos`  |
| `!m.recorrente` (dias > 0) | Texto âmbar `dias/diasAtivos` |

A flag `recorrente` **não é decidida no componente** — chega pronta da API
(`trpc.analise.getRecorrenciaSemanal`). Toda a lógica está em
`server/services/analise/recorrencia.ts`.

## Onde é decidido (backend)

1. **`avaliarFlag(id, r, cfg)`** (`recorrencia.ts:18-38`) — testa, dia a dia,
   se aquela métrica específica passou do limite configurado. Cada `FlagId`
   tem sua própria regra (ex.: `relampagoAlto` → `r.relampago_pct >
   cfg.alertaCurtasPerc`).

2. **`computarRecorrenciaPeriodo()`** (`recorrencia.ts:41-81`) — agrupa os
   **dias ativos** do vendedor (`visitas_total_dentro_raio > 0`) e conta em
   quantos deles `avaliarFlag()` retornou `true` → gera `dias` e `datas`.

3. **`isRecorrente(dias, diasAtivos, cfg)`** (`recorrencia.ts:11-15`) — é
   aqui que `m.recorrente` é definido:

   ```ts
   diasAtivos > 0 && (
       dias >= cfg.recorrenciaMinDias || dias / diasAtivos >= cfg.recorrenciaMinPerc
   )
   ```

   Ou seja: **recorrente = ocorreu em pelo menos N dias absolutos
   (`recorrenciaMinDias`) OU em pelo menos X% dos dias ativos
   (`recorrenciaMinPerc`)** — o que disparar primeiro.

## De onde vem o `cfg`

`cfg: ConfigMetricasRecorrencia` vem de `CONFIG_METRICAS_DEFAULT.recorrencia`
(`shared/const.ts`) como fallback, mas em runtime é lido do banco via
`getConfigMetricas()` (`server/services/configService.ts`, cache de 60s).
O usuário ajusta esses thresholds pelo botão **"Configurar métricas"**
(`AnaliseSemanal.tsx:53-60` → `ConfigMetricasModal`).

## Referência rápida dos thresholds atuais

| Chave                | Default | Efeito                                            |
| --------------------- | ------- | -------------------------------------------------- |
| `recorrenciaMinDias` | 2 dias  | >= 2 dias com problema já marca recorrente        |
| `recorrenciaMinPerc` | 0.40    | OU >= 40% dos dias ativos com problema             |

Valores completos de cada flag (`alertaCurtasPerc`, `limiteInicioTardio`,
etc.) estão na seção 3 e 6 de `docs/analise-semanal-metricas.md`.
