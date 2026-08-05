# Compensação (ARDEN-BE-005 §25)

Compensação semântica e básica para executores determinísticos que a suportam. Ao
falhar após etapas com efeito: `FAILED → COMPENSATING`, compensa as etapas `SUCCEEDED`
em **ordem inversa** (as que declaram `compensate()`), terminando em `COMPENSATED` ou
`COMPENSATION_FAILED`.

Não há afirmação de rollback universal: compensação depende do executor. Executores sem
`compensate()` são pulados (declaram explicitamente que não compensam). Cada passo de
compensação grava evidência `COMPENSATION` e eventos `execution_step.compensat*`.
