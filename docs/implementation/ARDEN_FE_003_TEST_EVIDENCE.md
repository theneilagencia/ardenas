# ARDEN-FE-003 — Evidência de Testes

> Branch `claude/arden-fe-003-api-contracts`. Scripts reais de `package.json`.

## Comandos (§32)

| Comando | Status | Testes | Falhas | Observação |
|---|---|---|---|---|
| `npm run typecheck` (`tsc -b --noEmit`) | PASS | — | 0 | contratos + cliente + adaptadores tipam |
| `npm run lint` (`eslint . --max-warnings=0`) | PASS | — | 0 | zero warnings |
| `npm run test` (`vitest run`) | PASS | 103 | 0 | 14 arquivos (inclui contratos) |
| `npm run test:a11y` (`vitest run --project a11y`) | PASS | 1 | 0 | axe |
| `npm run build` (`tsc -b && vite build`) | PASS | — | 0 | PWA gerado; warning de chunk (pré-existente) |
| `npm run test:e2e` (`playwright test`) | PASS | 9 | 0 | fluxos de sessão/tenant intactos |
| `npm run contracts:openapi` (gerador) | PASS | — | 0 | OpenAPI válido; 17 paths |

## Testes de contrato (§27) e onde estão

| Requisito | Arquivo |
|---|---|
| Schemas aceitam exemplos válidos | `src/contracts/contracts.test.ts` |
| Schemas rejeitam exemplos inválidos | `contracts.test.ts` |
| OpenAPI é válida | `src/contracts/openapi/openapi.test.ts` |
| OpenAPI comitada em sincronia com a fonte | `openapi.test.ts` |
| Erros seguem o padrão (correlationId, variedade de status) | `contracts.test.ts` |
| Paginação segue o padrão (cursor) | `contracts.test.ts` |
| Operação criada possui primeira versão (documentado no contrato) | `contracts.test.ts` |
| Versão publicada é imutável (ALREADY_PUBLISHED; sem DELETE) | `contracts.test.ts` |
| Publicação exige revisão (`expectedRevision`) | `contracts.test.ts` |
| Tenant não vem do body (exceto switch-organization) | `contracts.test.ts` |
| Endpoints exigem permissão documentada (catálogo estável) | `contracts.test.ts` |
| Auditoria sem endpoint público de alteração | `contracts.test.ts` |
| Idempotência documentada (5 comandos críticos) | `contracts.test.ts` |
| Concorrência documentada (expectedRevision/If-Match) | `contracts.test.ts` |
| Cliente TS compatível com repositórios do frontend | `src/services/api/generated/client-compat.test.ts` |
| Nenhum DTO importa React/Zustand/componentes | `contracts.test.ts` |

## Prova de compatibilidade do cliente (§26/§31)

`client-compat.test.ts` constrói um cliente falso tipado (`ArdenApiV1Client`) e prova,
em runtime, que os adaptadores implementam:
- `SessionRepository` — mapeando `SessionContext` do contrato → domínio (descarta `status`);
- `AuditRepository` (leitura) — mapeando `AuditEvent` do contrato → domínio;
- `OperationsRepository` (listagem) — mapeando `Operation` lean → rica (`active → running`).

As mutações ricas de operação usam o fluxo versão-cêntrico do v1 e são conectadas em
marco posterior (sinalizadas como indisponíveis, sem quebrar tipos).

## Reproduzir a geração/validação do OpenAPI

```
npm run contracts:openapi   # gera docs/api/openapi-v1.yaml e valida
npx vitest run src/contracts # valida contratos + OpenAPI + sincronia
```
