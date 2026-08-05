<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Banco indisponível

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
`/readyz` 503; erros de conexão; pool esgotado.

## Impacto
API/worker sem readiness (SEV-1).

## Diagnóstico
Checar status do banco gerenciado, conectividade privada, limite de conexões, failover HA.

## Comandos
- `<provider: status da instância / failover>`
- checar connection budget (`DATABASE_CONNECTION_BUDGET.md`)

## Decisões
Se failover automático não ocorreu, acionar failover manual conforme provider.

## Rollback
N/A (infra); reduzir réplicas para aliviar conexões se necessário.

## Escalonamento
Plataforma → DBA → fornecedor (suporte).

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
