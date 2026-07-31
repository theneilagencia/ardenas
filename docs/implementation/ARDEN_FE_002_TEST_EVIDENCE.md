# ARDEN-FE-002 — Evidência de Testes

> **Nome do resultado:** ARDEN-FE-002 — Fronteiras de sessão e contexto de tenant.
> Branch `claude/arden-fe-002-session-tenant`. Scripts reais de `package.json`.

## Comandos (§21)

| Comando | Status | Testes | Falhas | Observação |
|---|---|---|---|---|
| `npm run typecheck` (`tsc -b --noEmit`) | PASS | — | 0 | sem erros de tipo |
| `npm run lint` (`eslint . --max-warnings=0`) | PASS | — | 0 | zero warnings |
| `npm run test` (`vitest run`) | PASS | 78 | 0 | 11 arquivos |
| `npm run test:a11y` (`vitest run --project a11y`) | PASS | 1 | 0 | axe na tela de acesso negado |
| `npm run build` (`tsc -b && vite build`) | PASS | — | 0 | PWA gerado; warning de chunk (pré-existente) |
| `npm run test:e2e` (`playwright test`) | PASS | 9 | 0 | inclui os 3 fluxos de sessão/tenant |

## Testes obrigatórios (§17) e onde estão

| Requisito | Arquivo |
|---|---|
| Carregar sessão autenticada | `src/services/session/session.test.ts` |
| Sessão ausente (sign-out) | `src/services/session/session.test.ts` |
| Sessão expirada | `session.test.ts` (snapshot + cenário mock) |
| Usuário suspenso | `session.test.ts` (cenário) |
| Usuário sem organização | `session.test.ts` (cenário) |
| Usuário com uma organização | `session.test.ts` (cenário) |
| Usuário com várias organizações | `session.test.ts` (memberships por e-mail) |
| Troca válida de organização | `session.test.ts` + E2E Fluxo 1 |
| Trocar para organização sem membership | `session.test.ts` (`FORBIDDEN`) |
| Falha na troca mantém a anterior | `src/app/tenant.integration.test.tsx` |
| Limpeza de cache após troca | `tenant.integration.test.tsx` |
| Limpeza de dados após sign-out | `session.test.ts` (sessão nula) + provider limpa cache |
| Rota protegida sem sessão | `tenant.integration.test.tsx` (SessionBoundary) |
| Rota protegida sem organização | `tenant.integration.test.tsx` (OrganizationBoundary) |
| Rota protegida sem permissão | `tenant.integration.test.tsx` (PermissionBoundary) + E2E Fluxo 3 |
| `can()` baseado em permissões | `tenant.integration.test.tsx`, `request-context.test.ts` |
| Operação recebe contexto da organização ativa | `src/application/operations.test.ts` (tenant do ctx) |
| Auditoria recebe contexto da organização ativa | `operations.test.ts` (eventos com org do ctx) |
| Provider api não faz fallback silencioso | `session.test.ts` (`UNAVAILABLE`) |
| Nenhuma UI importa provider concreto de sessão | `src/test/architecture.test.ts` |

## Testes arquiteturais (§17)

`src/test/architecture.test.ts`:
- features/components **não** importam implementações concretas de dados/sessão
  (`@/services/repositories|providers|data|db|service-container|session/*`, exceto
  `active-context`).
- features/components **não** fixam organização/tenant em código (`org_arden`/`org_horizon`).
- features/components **não** persistem domínio de operações direto na store.

## E2E (§18)

`e2e/session-tenant.spec.ts`:
- **Fluxo 1** — cria operação na Org A, troca para a Org B (vazia), confirma que a
  operação da Org A **não** aparece, volta para a Org A e confirma que reaparece
  (isolamento de tenant + limpeza entre organizações).
- **Fluxo 2** — `?sim=expired`: rota protegida mostra o estado **expirado** distinto e
  **não** monta a casca (sem dados organizacionais).
- **Fluxo 3** — `?sim=role:operation_owner` (sem `operation.publish`): a ação de
  publicar fica **indisponível** (chip de "sem permissão" + botão desabilitado). A
  checagem direta do caso de uso (erro de autorização local `FORBIDDEN`) está em
  `src/application/operations.test.ts`.

## Reproduzir o E2E neste ambiente

```
ARDEN_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

## Afordância de simulação (demonstração)

Toda a sessão é simulada nesta etapa. Para exercitar os estados, o provedor local lê
um cenário de `?sim=` (ou `sessionStorage`): `expired`, `suspended`, `no_org`,
`unauthenticated`, `role:<papel>`. **Em produção**, estes estados serão originados/
validados pelo backend.
