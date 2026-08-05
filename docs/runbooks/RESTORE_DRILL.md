<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Restore drill (banco + master key)

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Execução de ensaio de restauração (gate BLOCKING).

## Impacto
Nenhum em produção (roda em recovery-drill isolado).

## Diagnóstico
Seguir `docs/production/DATABASE_RESTORE_DRILL_PLAN.md`; ambiente recovery-drill isolado.

## Comandos
- `npm run infrastructure -- database:restore:drill` (BLOCKED sem provider)
- `master-key:restore:verify`; preflight; decrypt de credencial canário

## Decisões
Drill PASS exige banco + master key + decrypt canário + ownership intacto + sem plaintext.

## Rollback
Destruir o cluster de drill ao final; nunca escrever em produção.

## Escalonamento
Plataforma → segurança.

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
