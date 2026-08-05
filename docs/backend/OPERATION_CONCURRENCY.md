# Arden.AS — Concorrência Otimista (ARDEN-BE-003)

> Toda mutação de estado usa **concorrência otimista** por `revision`. O primeiro escritor
> vence; o segundo recebe `409 VERSION_CONFLICT`. Não há *lost update*. Alinha-se a
> `API_V1_IDEMPOTENCY_AND_CONCURRENCY.md` (D-007: 409, não 412).

## Revisão como token de versão

`Operation.revision` e `OperationVersion.revision` (ambos `Int`, default 1) são o token
de concorrência. Cada mutação bem-sucedida **incrementa** a revisão.

## `expectedRevision` / `If-Match`

O cliente informa a revisão que espera alterar:

- no **corpo** via `expectedRevision`; ou
- no cabeçalho **`If-Match`** (parseado por `parseIfMatch`).

## Guarda por `updateMany WHERE revision = expected`

A atualização é feita com uma guarda atômica:

```ts
const { count } = await tx.operationVersion.updateMany({
  where: { id, organizationId: ctx.organizationId, revision: expectedRevision },
  data: { /* … */, revision: { increment: 1 } },
});
if (count === 0) throw ApiException.versionConflict({ /* details */ });
```

`count === 0` significa que a revisão mudou (ou o recurso não existe no tenant) → `409
VERSION_CONFLICT`. Dentro de uma transação, isso provoca **rollback** do comando inteiro.

## Detalhes do `VERSION_CONFLICT`

O erro carrega `details` para o cliente reconciliar:

```json
{
  "code": "VERSION_CONFLICT",
  "details": {
    "resourceType": "operation_version",
    "resourceId": "…",
    "expectedRevision": 3,
    "currentRevision": 4
  }
}
```

Como todo erro do catálogo, inclui `correlationId`.

## Endpoints com concorrência

| Endpoint | Guarda por revisão |
| --- | --- |
| `PATCH /operations/{id}` | sim |
| `POST …/pause` \| `/resume` | sim |
| `POST …/archive` | sim |
| `PATCH …/versions/{versionId}` | sim |
| `PATCH …/versions/{versionId}/authority` | sim |
| `POST …/versions/{versionId}/publish` | sim (versão **e** operação, na mesma transação) |

## Primeiro escritor vence (first-writer-wins)

Duas atualizações concorrentes sobre a mesma revisão: a primeira comita e incrementa; a
segunda encontra `count === 0` e recebe `409` — **sem sobrescrever** a mudança da
primeira. Comprovado por `operations-concurrency-idempotency` (integração): dois updates
simultâneos, o segundo falha, nenhum *lost update*.

Ver também: `OPERATION_IDEMPOTENCY.md`, `OPERATION_PUBLICATION_TRANSACTION.md`.
