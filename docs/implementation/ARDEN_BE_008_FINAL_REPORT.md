<!-- Milestone: ARDEN-BE-008 -->
# ARDEN-BE-008 — Relatório final do milestone

Integração do provider comercial Anthropic (`anthropic.direct@1`) em estado **não
produtivo, verificado offline**. Este relatório separa explicitamente os estados.

## IMPLEMENTED
Contratos Anthropic; catálogo allowlisted (3 modelos, IDs exatos, todos DISABLED);
model parameters; credential write-only; connector `system.anthropic`; connection
tenant-managed; SecretVault AES-256-GCM; rotation/revocation; validação local de
configuração; provider/model persistidos DISABLED; ModelConfiguration DRAFT; activation
block; SDK pinado `0.115.0`; transport boundary (fake + SDK); `AnthropicModelProvider`;
registry condicional; structured output + request/response/usage mapping; retry/timeout/
AbortSignal/UNKNOWN; tool definition mapping; `tool_use`; authority; approvals;
`ExternalToolExecutor`; tool result + continuation; frontend administrativo completo
(catálogo, connection, rotação, ModelConfiguration, AgentVersion, execução);
known-zero vs unknown cost; production block.

## OFFLINE VERIFIED
Todos os fluxos acima contra `FakeAnthropicTransport` + Postgres real: structured output
(válido/inválido/reparável/não-reparável/max-tokens/vazio), tool calling (allowlist,
alias reversível, authority server-side, approval real, authorization single-use,
sanitização, continuation, replay, UNKNOWN), multitenancy (cross-tenant 404), canário de
segredo (frontend DOM/storage + backend cofre/DB), vertical slices automático e
supervisionado, matriz de falhas. **1051 testes verdes; 0 falhas.**

## LIVE VERIFIED
**Nenhum.** Live smoke, live authentication, live structured output, live usage e live
tool calling permanecem **NOT EXECUTED**.

## NOT EXECUTED
Live smoke; live tool calling; qualquer chamada real à Anthropic (sem credencial oficial
de teste e sem autorização de operador).

## UNVERIFIED
Pricing; retention; training; Zero Data Retention; data residency; DPA; sub-processors.
Nenhum preço/rate card Anthropic foi projetado (custo Anthropic = `null` →
"Custo não disponível", nunca 0,00).

## PRODUCTION BLOCKED
Provider persistido **DISABLED**; `productionAllowed=false`; runtime recusa em production
mesmo com flags `true` (`MODEL_PROVIDER_DISABLED`); fixture `CONNECTOR_MASTER_KEY`
recusada em production.

## DEFERRED
Ver `ARDEN_BE_008_DEFERRED_PRODUCTION_GATES.md`. Próximo milestone: **ARDEN-PRD-001 —
Production Readiness** (não ampliar providers).

## Números
- Frontend unit+a11y: 271 · Backend unit: 512 · Backend integração: 264 · E2E: 4.
- Migrations: 11 (1 aditiva no milestone) · Seed idempotente · OpenAPI sem drift.
- SDK: `@anthropic-ai/sdk@0.115.0` (pin exato, backend-only, único import no boundary).

## Riscos
Bloqueantes: nenhum dentro do escopo aprovado. Não-bloqueantes: vida de segredo em JS é
best-effort; comportamento Anthropic não verificado ao vivo; circuit breaker de produção
em memória; governança oficial pendente.
