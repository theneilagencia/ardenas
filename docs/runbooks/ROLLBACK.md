<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Rollback de deploy

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Regressão funcional/erro após deploy.

## Impacto
Degradação até reverter.

## Diagnóstico
Identificar a última revisão saudável (por SHA); confirmar compatibilidade de schema (expand/contract).

## Comandos
- `<provider: rollback para revisão por SHA anterior>`
- `npm run infrastructure -- deploy:verify`

## Decisões
Se a migration foi expand-only, rollback de app é seguro; se contract, avaliar forward-fix.

## Rollback
Reverter para a revisão anterior imutável.

## Escalonamento
Release owner → plataforma.

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
