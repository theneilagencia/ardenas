<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Suspeita de acesso cross-tenant

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Sinal de acesso cruzado entre organizações (SEV-1).

## Impacto
Potencial violação de isolamento multi-tenant.

## Diagnóstico
Correlacionar logs por organizationId; revisar guards de escopo; checar auditoria.

## Comandos
- inspecionar auditoria (sanitizada) por correlationId
- confirmar 404 cross-tenant esperado

## Decisões
Se confirmado, tratar como incidente de segurança (SECURITY_INCIDENT.md).

## Rollback
N/A.

## Escalonamento
Segurança (owner) → plataforma → jurídico (se dado exposto).

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
