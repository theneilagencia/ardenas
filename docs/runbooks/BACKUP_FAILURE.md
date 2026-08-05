<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Falha de backup

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Job de backup automatizado falhou (SEV-1).

## Impacto
Risco de RPO não atendido.

## Diagnóstico
Checar política de backup do provider, retenção, permissões do backup-operator.

## Comandos
- `npm run infrastructure -- database:backup:verify` (FAIL-CLOSED sem provider)
- `<provider: status do job de backup>`

## Decisões
Reexecutar backup; validar retenção; não apagar backups que sustentam PITR.

## Rollback
N/A.

## Escalonamento
Plataforma → DBA → fornecedor.

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
