<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Incidente de segurança

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Indício de comprometimento, vazamento ou acesso indevido (SEV-1).

## Impacto
Potencial exposição de dados/credenciais.

## Diagnóstico
Preservar evidências; escopo do impacto; identidade envolvida; timeline.

## Comandos
- rotacionar segredos afetados (secret manager)
- `master-key:*` conforme necessário; revogar credenciais

## Decisões
Contenção primeiro; erradicação; recuperação; lições aprendidas.

## Rollback
Reverter/rotacionar conforme o vetor.

## Escalonamento
Segurança (owner) → liderança → jurídico/DPO.

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
