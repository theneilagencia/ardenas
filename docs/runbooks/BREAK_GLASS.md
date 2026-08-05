<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Break-glass (acesso de emergência)

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Necessidade de acesso elevado temporário em incidente.

## Impacto
Acesso privilegiado excepcional, auditado.

## Diagnóstico
Confirmar justificativa, MFA, duas aprovações e janela limitada (`docs/production/BREAK_GLASS_PROCEDURE.md`).

## Comandos
- ativar identidade break-glass (temporária, MFA, 2 aprovações)
- revogação automática ao expirar

## Decisões
Uso apenas em emergência; nunca rotineiro; toda ação registrada.

## Rollback
Revogar acesso imediatamente após a intervenção.

## Escalonamento
Segurança (owner) → liderança.

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
