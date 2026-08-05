<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Esgotamento de pool de conexões

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Erros de 'too many connections'; latência alta; jobs travados.

## Impacto
Degradação de API/worker (SEV-2).

## Diagnóstico
Comparar conexões reservadas vs limite × fator de segurança (`DATABASE_CONNECTION_BUDGET.md`).

## Comandos
- recomputar orçamento de conexões
- ajustar pool por réplica / réplicas; usar transaction pooling

## Decisões
Reduzir pool ou réplicas; nunca exceder o limite efetivo do banco.

## Rollback
Reduzir réplicas temporariamente.

## Escalonamento
Plataforma → DBA.

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
