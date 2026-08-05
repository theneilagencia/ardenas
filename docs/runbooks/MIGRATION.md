<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Migration de banco

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Necessidade de aplicar migrations pendentes em produção.

## Impacto
Falha de migration bloqueia release (SEV-1).

## Diagnóstico
`prisma migrate status` via conexão DIRETA; confirmar migrations pendentes e banco alvo.

## Comandos
- `npm run production:migrate` (FAIL-CLOSED sem decision manifest aprovado)
- usa DIRECT_URL (conexão direta), nunca o pooler

## Decisões
Expand/contract: nunca dropar coluna em uso; separar deploy de leitura/escrita.

## Rollback
Se falhar no meio, avaliar restore/forward-fix; migrations são idempotentes (deploy).

## Escalonamento
Release owner → plataforma → DBA.

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
