<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Runbook — Deploy (staging/produção)

> Provider-neutro. Comandos específicos de fornecedor aparecem como PLACEHOLDERS explícitos
> (`<provider: …>`) até a seleção em 001.2B. Nenhuma ação de nuvem é executada nesta fase.

## Sintomas
Necessidade de promover uma release por artefato imutável (commit SHA).

## Impacto
Indisponibilidade se o deploy falhar; nenhuma se abortado antes de aplicar.

## Diagnóstico
Verificar decision manifest PASS; artifact:verify; imagem por SHA presente no registro.

## Comandos
- `npm run infrastructure:decision:validate` (deve PASS antes de produção)
- `npm run artifact:verify`
- `<provider: deploy da revisão por SHA>`
- `npm run infrastructure -- deploy:verify`

## Decisões
Promover a MESMA imagem de staging→produção; nunca rebuild; nunca tag latest.

## Rollback
`<provider: rollback para revisão anterior>` — ver ROLLBACK.md.

## Escalonamento
Release owner → plataforma → segurança (se suspeita de exposição).

## Evidência
- Coletar: timestamps (UTC), correlationId, saída sanitizada dos comandos, quem executou
  (workload identity), e o resultado. Nunca registrar segredo/plaintext.

## Encerramento
- Confirmar sinal normalizado, alertas resolvidos, evidência anexada ao incidente e
  follow-ups registrados no risk register.
