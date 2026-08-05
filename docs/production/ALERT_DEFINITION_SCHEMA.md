<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Schema de definição de alertas

Definições machine-readable: `config/infrastructure/alert-definitions.json` (19 alertas).
Schema/validador: `tooling/infrastructure/alert-definitions.ts`. Comando:
`npm run infrastructure:alerts:validate`.

## Campos por alerta
`id` · `severity` (SEV-1/2/3) · `signal` · `condition` · `window` · `ownerRole` · `runbook`
· `notificationPolicy` (page/ticket/silent) · `productionBlocking`.

## Regras
- `id` único (kebab-case); `window` no formato `\d+[smhd]`.
- `ownerRole` é **papel** (platform/security/release/product), nunca nome pessoal; pode ser
  `TBD` quando depender de decisão humana.
- Sem backend específico. Cobre os 19 alertas de `ALERT_CATALOG.md`.
