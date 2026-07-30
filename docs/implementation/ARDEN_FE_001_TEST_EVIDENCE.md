# ARDEN-FE-001 — Evidência de Testes

Branch `claude/arden-fe-001-data-access` · 2026-07-30. Scripts reais de `package.json`.

## Comandos

| Comando | Status | Testes | Falhas | Observação |
|---|---|---|---|---|
| `npm run typecheck` (`tsc -b --noEmit`) | PASS | — | 0 | sem erros de tipo |
| `npm run lint` (`eslint . --max-warnings=0`) | PASS | — | 0 | zero warnings |
| `npm run test` (`vitest run`) | PASS | 49 | 0 | 8 arquivos |
| `npm run test:a11y` (`vitest run --project a11y`) | PASS | 1 | 0 | axe na tela de acesso negado |
| `npm run build` (`tsc -b && vite build`) | PASS | — | 0 | PWA gerado; warning de tamanho de chunk (pré-existente) |
| `npm run test:e2e` (`playwright test`) | PASS | 6 | 0 | inclui o fluxo de prova de operações |

## Testes que comprovam os critérios da issue

| Critério (§13/§17) | Teste | Arquivo |
|---|---|---|
| Componente não acessa IndexedDB/mock/provider concreto | regra arquitetural (varredura de imports) | `src/test/architecture.test.ts` |
| Componente não persiste operações direto na store | regra arquitetural (padrão de uso) | `src/test/architecture.test.ts` |
| Criação de operação usa o contrato | `createOperation` via caso de uso → repositório | `src/application/operations.test.ts` |
| Edição de rascunho usa contrato (upsert) | `saveOperationDraft` sem duplicidade | `src/application/operations.test.ts` |
| Publicação usa comando próprio | `createOperationVersion` + `publishOperationVersion` | `src/application/operations.test.ts` |
| Mock provider funciona | `MemorySnapshotStore` nos testes de aplicação/store | `operations.test.ts`, `app-store.test.ts` |
| IndexedDB provider funciona | E2E cria→publica→**recarrega**→recupera | `e2e/operations-flow.spec.ts` |
| API provider é invocado quando configurado | `ApiOperationsRepository` (fetch mockado) | `src/services/repositories/repositories.test.ts` |
| Erro do repositório aparece na UI | mapeamento 409→CONFLICT; OperationsPage com estado de erro/retry | `repositories.test.ts` + `OperationsPage.tsx` |
| Recarregamento recupera os dados | reload no E2E de fluxo | `e2e/operations-flow.spec.ts` |
| Sem dupla persistência store↔repositório | mutação da store não sobrescreve operação publicada | `src/application/operations.test.ts` |
| Contrato HTTP mapeia envelope/meta | `list` → PaginatedResult | `repositories.test.ts` |

## Arquivos de teste (8)

- `src/domain/permissions.test.ts` (11)
- `src/domain/operation-blockers.test.ts` (9)
- `src/services/providers.test.ts` (4) — ApiDataProvider + mapa de erro do ApiClient
- `src/services/repositories/repositories.test.ts` (7) — Snapshot/Api Operations, fluxo de prova
- `src/application/operations.test.ts` (6) — casos de uso, sem-dupla-persistência, erro
- `src/store/app-store.test.ts` (9) — execução, implantação, admin, arquivos (fatias da store)
- `src/test/architecture.test.ts` (2) — regra de imports/uso
- `src/features/access-denied.a11y.test.tsx` (1) — axe

## E2E (6)

`e2e/wizard.spec.ts` (bloqueio de publicação), `e2e/deployment.spec.ts` (trava),
`e2e/command-palette.spec.ts` (x2), `e2e/detail-drawer.spec.ts`,
`e2e/operations-flow.spec.ts` (**fluxo de prova**: criar → publicar → recarregar →
recuperar no IndexedDB).

## Comando para reproduzir o E2E neste ambiente

```
ARDEN_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```
