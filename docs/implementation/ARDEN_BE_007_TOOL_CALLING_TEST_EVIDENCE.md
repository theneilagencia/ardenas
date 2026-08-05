# ARDEN-BE-007.5 — Evidência de testes (tool calling funcional)

## Ambiente
PostgreSQL 16 real (cluster local) + fila durável + worker real + servidor. `AUTH_PROVIDER=fake`.
Sem internet, sem SDK comercial. As tools são `internal.test` DETERMINÍSTICAS
(`connector.test.*`) — nenhuma chamada externa real. Aprovação processada pela API existente.

## Testes unitários (`npm run test:api`) — 390 passed, exit 0
Novos: `agents/runtime/tools/tool-units.spec.ts` (13) cobrindo o `AgentToolCallValidator`
(válido; alias não permitido/indisponível; id ausente; props de controle — organizationId,
connectionId aninhado, authorization; URL absoluta; não serializável; tamanho; teto total; teto
por alias; schema da ferramenta). Provider (`internal-test-model.provider.spec.ts`, +cenários
de tool na allowlist). Runtime (`agent-runtime.spec.ts`) migrado — repair/limites/erros
continuam verdes.

## Testes de integração — `agent-tool-calling.integration.spec.ts` (7), PostgreSQL + worker real

| Cobertura | Resultado |
| --- | --- |
| **§37** READ: provider pede tool → executa → resultado isolado → output final → step SUCCEEDED; uma única execução externa; evidência sanitizada | ✓ |
| **§38** WRITE com aprovação: suspende sem executar (step/run PAUSED, ApprovalRequest PENDING); aprovação humana emite `ActionAuthorization`; `/resume` retoma; tool executa UMA vez; autorização single-use USED | ✓ |
| **§39** DENY: `allowWrite=false` + WRITE → resultado DENIED; tool não executa; modelo finaliza; auditoria sem detalhe de política | ✓ |
| **§40** UNKNOWN: `connector.test.unknown` → step FAILED `MODEL_RESULT_UNKNOWN`; não repete; nunca vira sucesso; evento `agent.tool_execution_unknown` | ✓ |
| **§41** injeção via resultado: `authorization`+injeção no output → redigido, ISOLADO, sinal; canário ausente de eventos/evidência/audit; uma única tool executada; agente não chama `admin.delete` | ✓ |
| **§42** cross-tenant: alias de Beta não resolve em Alpha → step FAILED `AGENT_TOOL_NOT_ALLOWED` | ✓ |
| **§44** canário de segredo: canário no input não vaza para job/eventos/evidência/audit/checkpoint/output | ✓ |

Testes críticos §37 (READ), §38 (approval E2E supervisionado), §39 (deny), §40 (unknown),
§41 (injection), §42 (cross-tenant), §44 (canário) cobertos e verdes.

## Suíte completa (`npm run test:api:integration`) — 30 arquivos, 227 testes, exit 0
As suítes anteriores (identidade/operações/versões/políticas/aprovações/enforcement/execução/
conectores/webhooks/agentes-persistência/runtime/contexto v2) continuam verdes com o tool
calling + a pausa/retomada cooperativa integrados. Sem regressão (a contagem do catálogo foi
ajustada para as 3 tools de teste determinísticas adicionadas).

## Outros gates
typecheck (fe+api+contracts) ✓ · lint (fe+api) ✓ · test:api (390) ✓ · test:api:integration
(227) ✓ · test fe (214) ✓ · a11y (2) ✓ · build (fe+api) ✓ · contracts:openapi determinístico
(apenas as 3 novas action keys `connector.test.*`) ✓ · migrate deploy/status sem drift
(9 migrations; 1 migration corretiva aditiva `agent_runtime_checkpoints`) · seed idempotente
(2×) · nenhum SDK de LLM · nenhuma chamada de rede real · worker/processor com pausa/retomada
cooperativa (sem nova fila).
