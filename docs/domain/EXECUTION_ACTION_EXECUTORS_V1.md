# Executores de Ação — v1 (ARDEN-BE-005 §15/§16)

Catálogo FECHADO de executores determinísticos internos (`executors.ts`). Sem chamadas
externas, sem IA, sem mocks aleatórios. Uma `actionKey` de etapa fora do catálogo →
`STEP_EXECUTOR_NOT_AVAILABLE`.

| actionKey | Efeito | Compensa | Uso em teste |
| --- | --- | --- | --- |
| `system.noop` | nenhum | não | sucesso trivial |
| `data.transform.static` | transforma input | não | output verificável |
| `data.validate.schema` | valida `requiredFields` | não | falha não-retryable |
| `record.create.internal` | cria registro (id estável) | sim | efeito + compensação |
| `record.update.internal` | atualiza registro | sim | efeito + compensação |
| `decision.evaluate.static` | decide a partir do input | não | ramo de decisão |
| `evidence.record` | registra evidência | não | evidência |
| `delay.simulated` | atraso simulado (não bloqueia) | não | — |
| `failure.deterministic` | falha controlada por input | não | retry/falha |

**Mapeamento default** (sem `stepExecutors`): etapa com `producesEvidence` →
`evidence.record`; caso contrário → `system.noop`. O request pode sobrepor por etapa via
`stepExecutors: { <definitionStepKey>: <actionKey> }` (validado contra o registry).

Determinismo garante idempotência: `record.create.internal` deriva um id estável da
etapa, então um retry não duplica o efeito.
