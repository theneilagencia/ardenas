# ARDEN-BE-008.4 — evidência do smoke test real (classificação e gates)

Evidência da infraestrutura de smoke test real e da habilitação restrita não produtiva
(008.4B/D). **Nenhuma chamada real foi executada** (008.4C): sem credencial oficial de teste,
sem documentos oficiais (008.4A = UNVERIFIED), sem confirmação de operador. Todos os testes são
**offline** (fake transport + guarda de rede). O resumo dos quatro gates está em
`ARDEN_BE_008_LIVE_SMOKE_REPORT.md` (não recriado aqui).

## 1. Classificação de verificação

- **OFFLINE VERIFIED** (fake transport): confirmação-obrigatória do smoke; org-fora-allowlist →
  `MODEL_PROVIDER_DISABLED`; `PASSED` marca a versão de credencial (canário de segredo ausente);
  auth-failure → `FAILED` (não marca); timeout-após-envio → `UNKNOWN`; bloqueio de produção →
  `MODEL_PROVIDER_DISABLED` (transporte não chamado); rotação invalida smoke; non-prod gate
  (bloqueio de produção, org allowlist, gate externo, quota, concorrência, circuit breaker).
- **LIVE VERIFIED**: **nenhum** (sem credencial/documentos oficiais).
- **NOT EXECUTED**: a **chamada real** (008.4C) — caminho implementado, provado só offline.
- **UNVERIFIED**: **pricing** e **governança de dados** (todas as páginas 403; 0 documentos).
- **BLOCKED BY POLICY**: produção; `productionAllowed=true`; rate cards comerciais.

## 2. Testes offline novos

`apps/api/src/agents/providers/anthropic/anthropic-non-prod-gate.spec.ts` — **6 testes**
: bloqueio de produção; org allowlist server-side; gate de chamadas externas; quota (cap
  diário); concorrência; circuit breaker.

`apps/api/test/anthropic-smoke-test.integration.spec.ts` — **7 testes** (E2E offline)

| Cenário | Esperado |
| --- | --- |
| sem confirmação explícita | `SMOKE_TEST_CONFIRMATION_REQUIRED` |
| org não allowlistada | `MODEL_PROVIDER_DISABLED` |
| smoke `PASSED` | versão de credencial marcada; canário de segredo ausente |
| falha de autenticação | `FAILED` — versão **não** marcada |
| timeout após envio | `UNKNOWN` |
| bloqueio de produção | `MODEL_PROVIDER_DISABLED` — transporte **não** chamado |
| rotação de credencial | smoke anterior invalidado |

As specs de provider/E2E do 008.3 seguem **verdes**. **Nenhuma rede** em qualquer suíte normal.

## 3. Matriz de gates

| Gate | Comando | Resultado |
| --- | --- | --- |
| Typecheck (root) | `npm run typecheck` | PASS |
| Lint (root) | `npm run lint` | PASS |
| Test (frontend) | `npm run test` | PASS |
| Test a11y | `npm run test:a11y` | PASS |
| Build (frontend) | `npm run build` | PASS |
| OpenAPI (diff-free) | `npm run contracts:openapi` | PASS — sem diff |
| Typecheck (API) | `npm run typecheck:api` | PASS |
| Lint (API) | `npm run lint:api` | PASS |
| Test (API unit) | `npm run test:api` | PASS |
| Test (API integração, offline) | `npm run test:api:integration` | PASS |
| Build (API) | `npm run build:api` | PASS |
| DB migrate status (11 migrations, sem nova) | `npm run db:migrate:status` | PASS |
| DB seed (idempotente) ×2 | `npm run db:seed` ×2 | PASS — 2ª execução +0, provider `DISABLED` |

## 4. Notas dos gates

- **contracts:openapi** — **diff-free**: nenhum endpoint novo de geração; a CLI é admin-only.
- **db:migrate:status** — **11 migrations, nenhuma nova**: a verificação smoke vive nos metadados
  da versão de credencial (sem tabela/migração nova).
- **db:seed ×2** — idempotente; provider `anthropic.direct` permanece `DISABLED`.
- **test:api:integration** — 100% offline: fake transport + guarda de rede.

## 5. Smoke test real — NOT EXECUTED (instruções ao operador)

A chamada real fica para o operador com credencial legítima. Pré-condições (ver
`ANTHROPIC_LIVE_SMOKE_TEST.md`): ambiente não produtivo; todos os flags ligados
(`ANTHROPIC_PROVIDER_RUNTIME_ENABLED`, `..._EXTERNAL_CALLS_ENABLED`, `ANTHROPIC_SMOKE_TEST_ENABLED`,
`ANTHROPIC_SMOKE_TEST_ACKNOWLEDGED`); organização na allowlist
(`ANTHROPIC_NON_PROD_ALLOWED_ORGANIZATION_IDS`); credencial ativa no cofre. Rodar:

```
ARDEN_CLI=anthropic-smoke npm run smoke:anthropic -- \
  --confirm-live-anthropic-call \
  --organizationId <org> --connectionId <conn> --modelConfigurationId <cfg>
```

O resultado sanitizado (`AnthropicSmokeTestResult`) não contém key/prompt/raw/headers/request ID
bruto; custo permanece `null`. Em `PASSED`, a versão de credencial é marcada. **Não** afirmar
verificação ao vivo até esta execução ocorrer com credencial e documentos oficiais.
