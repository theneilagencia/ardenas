# Arden.AS — API v1 · Idempotência e Concorrência (ARDEN-FE-003)

> Contrato de headers e comportamento. Sem backend nesta issue — define o que o
> backend deverá implementar. Fonte: `src/contracts/common/request-context.ts`.

## Headers do protocolo

| Header | Direção | Uso |
|---|---|---|
| `Authorization` | cliente → servidor | Bearer token **ou** sessão equivalente (não amarrado a fornecedor). |
| `X-Correlation-Id` | ambos | Cliente **pode** enviar; servidor **gera** quando ausente e **ecoa** na resposta e nos eventos de auditoria. |
| `Idempotency-Key` | cliente → servidor | **Obrigatório** em comandos críticos. |
| `If-Match` | cliente → servidor | Concorrência otimista (revisão esperada). |

## Concorrência otimista

Todo recurso mutável possui **`revision`** (inteiro) e **`updatedAt`** (ISO UTC).

- Mutações aceitam a revisão esperada via **`If-Match`** (header) **e/ou**
  **`expectedRevision`** (no corpo do comando, quando aplicável — ex.:
  `updateOperation`, `publishOperationVersion`, `archiveOperation`, `pause/resume`).
- Em conflito: **HTTP 409 `VERSION_CONFLICT`**, com `details`:

```jsonc
{ "resourceType": "OperationVersion", "resourceId": "ver_1",
  "expectedRevision": 2, "currentRevision": 3 }
```

Endpoints com concorrência otimista: `operations.update`, `operations.archive`,
`operations.pause`, `operations.resume`, `operationVersions.update`,
`operationVersions.publish`, `authority.update`.

## Idempotência

Comandos críticos **exigem** `Idempotency-Key` (string opaca, ≥ 8 chars):

- `operations.create`
- `operations.duplicate`
- `operations.archive`
- `operationVersions.create`
- `operationVersions.publish`

O backend deverá armazenar temporariamente, por chave: **organização, usuário,
endpoint, idempotency key, hash da requisição e resposta produzida**.

- **Mesma chave + mesmo body** → retorna a **mesma resposta** (não reexecuta).
- **Mesma chave + body diferente** → **409 `IDEMPOTENCY_CONFLICT`**.

DECISÃO PENDENTE (D-008): janela de retenção da chave de idempotência (ex.: 24h) e
escopo (por organização + usuário).

## Imutabilidade de versão publicada

Uma versão `published` **não pode** ser alterada. `PATCH` só aceita `draft`;
alteração de publicada → **409 `ALREADY_PUBLISHED`**. Nova versão copia
explicitamente outra via `basedOnVersionId`. Publicar exige `expectedRevision` e
`changeSummary`. Republicar → `ALREADY_PUBLISHED`.

## Publicação — validações do backend (§17)

Na publicação, o backend deverá validar: a versão **pertence** à operação e à
organização; está em **rascunho**; o usuário tem **permissão** (`operation.publish`);
o **Gradiente de Autoridade** é válido (regras mínimas — ver authority); campos
obrigatórios completos; **revisão** atual (`expectedRevision`); **idempotência**;
publicação anterior. A resposta inclui a **versão publicada**, a **operação
atualizada** e os **eventos de auditoria** relevantes.
