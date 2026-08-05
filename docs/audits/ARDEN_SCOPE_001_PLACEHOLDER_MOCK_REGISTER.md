<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Registro de placeholders, mocks e sinais

Busca em `src/` + `apps/api/src/` (excluindo testes). Classificação: HARMLESS · TEST_ONLY ·
DOCUMENTATION · INTENTIONAL_FAIL_CLOSED · FUNCTIONAL_GAP · PRODUCTION_GAP · SECURITY_RISK.

## Sinais textuais
| Sinal | Ocorrências | Classificação |
| --- | --- | --- |
| TODO | 2 | DOCUMENTATION (comentários em `ssrf-guard.ts` descrevendo "TODOS os IPs") — HARMLESS |
| FIXME / HACK / STUB / PLACEHOLDER / NOT_IMPLEMENTED / DEFERRED | 0 | — |
| XXX | 1 | DOCUMENTATION — HARMLESS |
| `NOT_SUPPORTED` | 3 | INTENTIONAL_FAIL_CLOSED (`SOURCE_NOT_SUPPORTED` — documentos vinculados fora de fase no contexto de agente) |
| `throw new …` | 123 | majoritariamente INTENTIONAL_FAIL_CLOSED / validação de domínio (erros tipados, guardas) |
| `return null` | 35 | HARMLESS (lookups opcionais, ex.: getOptionalSecret) |
| `console.log` | 1 | HARMLESS (logging estruturado é via Pino; ocorrência isolada) |
| `REQUIRES_` | 25 | INTENTIONAL (sentinelas do manifesto de decisão de infra — ARDEN-PRD-001.2A.2) |

## Mocks/placeholders que AFETAM escopo (FUNCTIONAL_GAP)
| Item | Local | Classificação |
| --- | --- | --- |
| Provedor de dados padrão = IndexedDB + seed | `service-container.ts:37` | FUNCTIONAL_GAP (experiência padrão é demonstração) |
| ~15 rotas lêem `useScopedData` (snapshot) | `hooks/use-session.ts` + páginas | FUNCTIONAL_GAP (GAP-001) |
| `ApiApprovalsRepository` / `ApiFilesRepository` órfãos | `repositories/approvals-api.ts`, `files-api.ts` | FUNCTIONAL_GAP (dead wiring, GAP-002) |
| `createFromAssessment` lança em api | `v1-operations-repository.ts:291` | FUNCTIONAL_GAP (GAP-005) |
| `/roles` = constante estática | `features/roles/RolesPage.tsx` | FUNCTIONAL_GAP (GAP-006) |
| `agents-unavailable` / `connectors-unavailable` | `repositories/*-unavailable.ts` | INTENTIONAL_FAIL_CLOSED (fallback correto em demo) |

## Fail-closed intencionais (NÃO são defeitos)
- Readiness 503 sem keyring; worker não consome job; SSRF nega destinos privados; vault
  fail-closed em auth tag inválido; Anthropic gates default false; deploy/migração de
  produção fail-closed sem manifesto aprovado.

**Nenhum SECURITY_RISK aberto** identificado.
