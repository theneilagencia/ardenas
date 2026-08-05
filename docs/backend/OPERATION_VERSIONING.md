# Arden.AS — Versionamento de Operações (ARDEN-BE-003)

> A operação é *lean*; o conteúdo de negócio vive na **versão**. Cada versão tem um ciclo
> de vida explícito e imutabilidade após publicação. O backend é dono das transições.

## Modelo

`OperationVersion` (`operation_versions`):

| Campo | Descrição |
| --- | --- |
| `id` | UUID. |
| `organizationId` | Tenant (toda query é escopada por ele). |
| `operationId` | FK → `operations` (`onDelete: Restrict`). |
| `versionNumber` | Inteiro sequencial por operação. `@@unique([operationId, versionNumber])`. |
| `status` | `draft` \| `published` \| `superseded` (default `draft`). |
| `definition` | `Json` — definição rica de negócio (objetivo, passos, ações, etc.). |
| `authorityProfile` | `Json` — gradiente de autoridade da versão (GAP-11). |
| `changeSummary` | Resumo da mudança (obrigatório **não vazio** na publicação). |
| `createdBy` / `publishedBy` / `publishedAt` | Autoria e marco de publicação. |
| `revision` | Inteiro (default 1) — concorrência otimista. |
| `createdAt` / `updatedAt` | `timestamptz`. |

Índice `[organizationId, status]`. Ponteiros na operação
(`currentDraftVersionId`, `publishedVersionId`) **não** têm FK — são geridos
transacionalmente e não há delete físico de versão (evita ciclo e cascata destrutiva).

## Ciclo de vida

```
        criar 1ª versão (POST /operations)         publicar
draft ───────────────────────────────────────────────────────▶ published
  ▲  (editável: PATCH, autoridade, revision++)                    │
  │                                                     nova publicação
  │  criar-a-partir-da-base (POST /versions)                      ▼
  └──────────────────────── novo draft                       superseded
```

- **draft** — único estado editável. `PATCH` altera apenas versões `draft`
  (imutabilidade no **service**: `published`/`superseded` → 409 `ALREADY_PUBLISHED`).
- **published** — imutável; é a versão publicada corrente da operação.
- **superseded** — antiga versão publicada, rebaixada quando outra é publicada.

## Regra do rascunho único ativo

A operação aponta **no máximo um** rascunho corrente via `currentDraftVersionId`. Na
criação da operação a 1ª versão vira esse rascunho. Ao publicar, `currentDraftVersionId`
é zerado (`null`) e `publishedVersionId` passa a apontar a versão publicada. Um novo
rascunho é obtido com **criar-a-partir-da-base** (`POST …/versions`).

## Unicidade de `versionNumber`

Garantida em banco por `@@unique([operationId, versionNumber])`. Cada nova versão recebe
o próximo número por operação. A unicidade é **por operação** — não global — e o escopo
de tenant vem de toda query incluir `organizationId`.

## Criar-a-partir-da-base

`POST …/operations/{id}/versions` cria um novo `draft` derivado (base = versão indicada
ou a publicada corrente), atribuindo o próximo `versionNumber`, `status = draft`,
`revision = 1`, e emite `operation_version.created`. É uma operação **idempotente por
`Idempotency-Key`** (ver `OPERATION_IDEMPOTENCY.md`).

## Defaults neutros (1ª versão)

A primeira versão criada junto com a operação recebe defaults **neutros e documentados**,
nunca substantivos:

```ts
NEUTRAL_DEFINITION       // objetivo/resultado esperado vazios, arrays vazios,
                         // environment null, evidencePolicy null
NEUTRAL_AUTHORITY_PROFILE // level 1 (observe), sem ações, sem aprovação
```

Nada é inventado; a versão nasce em branco e válida para edição.

## Comparação (compare)

`GET …/versions/{versionId}/compare/{otherVersionId}` produz `VersionComparisonResponse`
com `differences[]` por `path` (diff raso — **D-006**). A comparação **não** cruza
operações nem tenants: ambas as versões devem pertencer à mesma operação e organização,
senão 404 `RESOURCE_NOT_FOUND` (ver `OPERATION_MULTITENANCY.md`). Coberto por
`version-diff.spec` (unit) e pela suíte de lifecycle (integração).

Ver também: `OPERATION_PUBLICATION_TRANSACTION.md`, `OPERATION_CONCURRENCY.md`,
`AUTHORITY_PROFILE_MODEL_V1.md`.
