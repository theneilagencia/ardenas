# Arden.AS — API v1 · Catálogo de Erros (ARDEN-FE-003)

> Resposta de erro **única e tipada**. Nunca expõe stack trace nem detalhes internos
> de banco. `correlationId` está **sempre presente**. Fonte: `src/contracts/common/api-error.ts`.

## Formato

```jsonc
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Revisão desatualizada.",
    "correlationId": "req_abc123",
    "details": { "resourceType": "OperationVersion", "resourceId": "ver_1",
                 "expectedRevision": 2, "currentRevision": 3 },
    "fieldErrors": [{ "field": "name", "code": "too_small", "message": "Obrigatório" }]
  }
}
```

## Códigos → HTTP

| Código | HTTP | Quando |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Corpo/entidade inválida (semântica). `fieldErrors` por campo. |
| `UNAUTHENTICATED` | 401 | Sem sessão/token. |
| `SESSION_EXPIRED` | 401 | Sessão expirada (renovar). |
| `FORBIDDEN` | 403 | Sem permissão para a ação. |
| `ORGANIZATION_REQUIRED` | 403 | Ação exige organização ativa. |
| `ORGANIZATION_SUSPENDED` | 403 | Organização suspensa. |
| `MEMBERSHIP_REQUIRED` | 403 | Sem membership na organização de destino. |
| `MEMBERSHIP_SUSPENDED` | 403 | Membership suspensa. |
| `RESOURCE_NOT_FOUND` | 404 | Recurso inexistente **ou de outro tenant** (não revelar). |
| `VERSION_CONFLICT` | 409 | Concorrência otimista: revisão desatualizada. |
| `RESOURCE_CONFLICT` | 409 | Conflito de estado do recurso (ex.: nome único). |
| `ALREADY_PUBLISHED` | 409 | Tentativa de alterar/publicar versão já publicada. |
| `INVALID_STATE_TRANSITION` | 409 | Transição de estado inválida (ex.: retomar arquivada). |
| `IDEMPOTENCY_CONFLICT` | 409 | Mesma Idempotency-Key com body diferente. |
| `RATE_LIMITED` | 429 | Limite de requisições. |
| `DEPENDENCY_UNAVAILABLE` | 503 | Dependência indisponível. |
| `INTERNAL_ERROR` | 500 | Erro interno (sem detalhes internos). |

## Quando usar 409 vs 412 vs 422

- **422 Unprocessable Entity** — o corpo é sintaticamente válido mas viola regra
  semântica/negócio (validação de campos, gradiente incoerente). Não usar 400 para isso.
- **409 Conflict** — conflito de **estado**: concorrência (`VERSION_CONFLICT` quando a
  revisão via `expectedRevision`/`If-Match` está desatualizada), `ALREADY_PUBLISHED`,
  `IDEMPOTENCY_CONFLICT`, `INVALID_STATE_TRANSITION`.
- **412 Precondition Failed** — reservado para pré-condição via header `If-Match` quando
  o backend optar por sinalizar a falha de pré-condição no nível do protocolo em vez de
  no corpo. Nesta v1, a concorrência é reportada preferencialmente como **409
  `VERSION_CONFLICT`** com `details` (revisão esperada/atual). DECISÃO PENDENTE (D-007):
  409 vs 412 para `If-Match`.

## Status HTTP padronizados (§24)

`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `412`, `422`, `429`, `503`.
Não usar sempre 400: validação semântica → **422**; conflitos → **409**.

## Regra de isolamento

Recurso de **outro tenant** retorna `RESOURCE_NOT_FOUND` (404) — **nunca** 403 com
detalhes que revelem existência. Testes de contrato garantem variedade de status
(não apenas 400) e presença obrigatória de `correlationId`.

## Códigos de governança e enforcement (ARDEN-BE-004)

| Código | HTTP | Quando |
|---|---|---|
| `APPROVAL_REQUIRED` | 403 | a ação exige aprovação humana antes de autorizar |
| `ACTION_DENIED` | 403 | ação bloqueada pela avaliação de autoridade |
| `ACTION_NOT_DECLARED` | 409 | ação não declarada no Gradiente da operação |
| `APPROVAL_NOT_PENDING` | 409 | solicitação já decidida/cancelada/expirada |
| `APPROVAL_NOT_ELIGIBLE` | 403 | aprovador não elegível para a etapa |
| `SELF_APPROVAL_FORBIDDEN` | 403 | solicitante não pode aprovar a própria ação |
| `APPROVAL_EXPIRED` | 409 | solicitação expirada não autoriza |
| `APPROVAL_INVALIDATED` | 409 | solicitação invalidada por mudança material |
| `APPROVAL_ALREADY_DECIDED` | 409 | mesmo aprovador já decidiu a etapa |
| `QUORUM_NOT_REACHED` | 409 | quórum da etapa ainda não atingido |
| `POLICY_CONFLICT` | 409 | conflito entre políticas aplicáveis |
| `POLICY_NOT_ACTIVE` | 409 | política/fluxo referido não está ativo |
| `AUTHORIZATION_EXPIRED` | 409 | autorização de ação expirada |
| `AUTHORIZATION_INVALIDATED` | 409 | autorização de ação invalidada |
| `AUTHORIZATION_PAYLOAD_MISMATCH` | 409 | payload difere do autorizado |

## Códigos de execução (ARDEN-BE-005)

| Código | HTTP | Quando |
|---|---|---|
| `EXECUTION_NOT_ALLOWED` | 403 | operação inativa/sem versão publicada/rascunho |
| `EXECUTION_ALREADY_STARTED` | 409 | execução já iniciada |
| `EXECUTION_NOT_PAUSABLE` | 409 | estado incompatível com pausa |
| `EXECUTION_NOT_RESUMABLE` | 409 | estado incompatível com retomada |
| `EXECUTION_NOT_CANCELLABLE` | 409 | estado incompatível com cancelamento |
| `EXECUTION_NOT_RETRYABLE` | 409 | estado incompatível com retry |
| `EXECUTION_TERMINAL` | 409 | execução em estado terminal |
| `EXECUTION_TIMED_OUT` | 409 | execução excedeu o timeout |
| `EXECUTION_RETRY_EXHAUSTED` | 409 | tentativas esgotadas |
| `STEP_EXECUTOR_NOT_AVAILABLE` | 409 | executor de etapa não registrado |
| `STEP_INPUT_INVALID` | 422 | entrada de etapa inválida |
| `STEP_FAILED` | 409 | etapa falhou |
| `STEP_TIMED_OUT` | 409 | etapa excedeu o timeout |
| `AUTHORIZATION_REQUIRED` | 403 | ação exige autorização de ação |
| `AUTHORIZATION_ALREADY_USED` | 409 | autorização de uso único já consumida |
| `JOB_LEASE_CONFLICT` | 409 | conflito de lease de job |
| `JOB_NOT_RECOVERABLE` | 409 | job não recuperável |

## Códigos de conectores e ferramentas externas (ARDEN-BE-006)

> **Contratados** nesta fase (006.2). A aplicação funcional (persistência, cofre,
> cliente HTTP seguro, webhooks) chega nas fases seguintes. Erros públicos de webhook
> são **mínimos** (não revelam host interno, segredo ou política). Erros internos
> sempre carregam `correlationId`.

| Código | HTTP | Público? | Retryable | Quando |
|---|---|---|---|---|
| `CONNECTOR_NOT_AVAILABLE` | 404 | sim | não | conector inexistente/DISABLED |
| `CONNECTOR_DEPRECATED` | 409 | sim | não | uso de conector DEPRECATED |
| `CONNECTION_NOT_ACTIVE` | 409 | sim | não | conexão não ACTIVE |
| `CONNECTION_SUSPENDED` | 409 | sim | não | conexão SUSPENDED |
| `CONNECTION_REVOKED` | 409 | sim | não | conexão REVOKED (terminal) |
| `CONNECTION_TEST_FAILED` | 502 | sim (sanitizado) | condicional | teste de conexão falhou |
| `CREDENTIAL_REQUIRED` | 409 | sim | não | conexão sem credencial ACTIVE |
| `CREDENTIAL_INVALID` | 422 | sim | não | segredo não casa com `credentialSchema` |
| `CREDENTIAL_REVOKED` | 409 | sim | não | resolução de credencial revogada |
| `CREDENTIAL_RESOLUTION_FAILED` | 500 | interno | não | falha ao decifrar (correlationId) |
| `CREDENTIAL_ROTATION_CONFLICT` | 409 | sim | não | rotação concorrente perdeu |
| `TOOL_NOT_AVAILABLE` | 404 | sim | não | ferramenta inexistente/inativa |
| `TOOL_BINDING_NOT_FOUND` | 404 | sim | não | binding inexistente |
| `TOOL_INPUT_INVALID` | 422 | sim | não | input não casa com `inputSchema` |
| `TOOL_OUTPUT_INVALID` | 502 | sim (sanitizado) | não | output externo inválido |
| `TOOL_EXECUTION_DENIED` | 403 | sim | não | risco/autoridade incompatível |
| `NETWORK_POLICY_DENIED` | 403 | sim | não | violação de política de rede |
| `HOST_NOT_ALLOWED` | 403 | sim | não | host fora da allowlist |
| `PROTOCOL_NOT_ALLOWED` | 403 | sim | não | protocolo ≠ https / porta negada |
| `PRIVATE_NETWORK_DENIED` | 403 | sim | não | destino em rede privada |
| `SSRF_BLOCKED` | 403 | sim (genérico) | não | bloqueio SSRF |
| `REDIRECT_DENIED` | 403 | sim | não | redirect para destino proibido |
| `REQUEST_TOO_LARGE` | 413 | sim | não | payload de request excede limite |
| `RESPONSE_TOO_LARGE` | 502 | sim | não | resposta externa excede limite |
| `EXTERNAL_TIMEOUT` | 504 | sim | condicional | timeout da chamada externa |
| `EXTERNAL_RATE_LIMITED` | 429 | sim | condicional (Retry-After) | 429 do provedor |
| `EXTERNAL_PROVIDER_ERROR` | 502 | sim (sanitizado) | condicional | 5xx do provedor |
| `EXTERNAL_RESULT_UNKNOWN` | 502 | sim | **não auto** | efeito externo possivelmente aplicado |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | mínimo | não | assinatura inválida |
| `WEBHOOK_TIMESTAMP_INVALID` | 401 | mínimo | não | timestamp fora da janela |
| `WEBHOOK_REPLAYED` | 409 | mínimo | não | replay detectado |
| `WEBHOOK_EVENT_NOT_ALLOWED` | 422 | mínimo | não | event type não permitido |
| `WEBHOOK_ENDPOINT_REVOKED` | 404 | mínimo | não | endpoint suspenso/revogado |
