<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Falha de PITR

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Janela de PITR indisponível/incompleta.

## Impacto
Incapacidade de restaurar a um ponto no tempo (SEV-1).

## Diagnóstico
Verificar continuidade de WAL/logs, janela configurada, integridade dos backups.

## Comandos
- `<provider: status de PITR / logs de transação>`

## Decisões
Se PITR comprometido, priorizar backup completo mais recente; medir RPO real.

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
