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
