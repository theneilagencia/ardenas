# Arden.AS — Publicação Transacional de Versões (ARDEN-BE-003)

> Publicar uma versão é uma **única transação atômica**: valida, promove o rascunho,
> rebaixa a versão anterior, atualiza a operação, audita e grava idempotência. Qualquer
> falha reverte **tudo**. Não existe publicação em múltiplas transações.

## Endpoint

`POST …/operations/{id}/versions/{versionId}/publish` — permissão `operation.publish`,
`Idempotency-Key` **obrigatório**, concorrência otimista (`expectedRevision`/`If-Match`).
Retorna `{ version, operation, auditEvents }` (`PublishOperationVersionResponse`).

## Validação (antes da transação)

`OperationPublicationValidator.validate(operation, version, ctx)`
(`src/operations/publication.validator.ts`) → `{ valid, errors[], warnings[] }`.
Roda **fora** da transação. Verifica:

| Checagem | Bloqueia (erro)? |
| --- | --- |
| A versão pertence ao tenant de `ctx` | Sim |
| A versão pertence à operação | Sim |
| A versão está `draft` | Sim (senão `ALREADY_PUBLISHED`) |
| A operação não está `archived` | Sim |
| `operation.name` presente | Sim |
| Definição minimamente válida (`objective` + `expectedResult` não vazios) | Sim |
| `authorityProfile` presente e passa as regras de nível (1–5) | Sim |
| Permissão `operation.publish` | Sim |
| Nível declarado < nível máximo das ações permitidas | Não (**warning**) |

- **Erros** bloqueiam: `422 VALIDATION_ERROR` com `fieldErrors`. Antes de lançar, grava
  **best-effort** `operation_version.publication_failed` (outcome `FAILURE`).
- **Warnings** não bloqueiam. Ver as regras de autoridade em
  `AUTHORITY_PROFILE_MODEL_V1.md` e `authority.rules.ts`.

## Sequência transacional (válido → uma transação)

```
BEGIN
  1. audit  operation_version.publication_validated
  2. draft → published        (publishedBy, publishedAt, changeSummary NÃO vazio,
                               guarda WHERE revision = expected, revision++)
  3. se havia publicada:  published → superseded    (audit operation_version.superseded)
  4. operação: publishedVersionId = esta; currentDraftVersionId = null;
               status → active (se era draft); revision++   (guarda WHERE revision=exp)
  5. audit  operation_version.published + operation.updated
  6. escreve registro de idempotência (DENTRO da transação)
COMMIT → { version, operation, auditEvents }
```

O passo 2 e o passo 4 usam `updateMany WHERE revision = expected`; contagem 0 → 409
`VERSION_CONFLICT` e **rollback** (ver `OPERATION_CONCURRENCY.md`). `changeSummary` é
obrigatório e não pode ser vazio na publicação.

## Substituição (supersede)

Se a operação já tinha uma versão publicada, ela é rebaixada a `superseded` **dentro da
mesma transação** (passo 3), garantindo que nunca existam duas versões `published`
simultâneas. Não há delete físico: o histórico permanece.

## Garantia de rollback (atomicidade)

Toda a sequência roda em **uma** transação Prisma. Qualquer falha (validação de guarda,
erro de banco, falha injetada) reverte o comando inteiro:

- a versão continua `draft`;
- a operação permanece inalterada;
- **nenhum** evento de sucesso é gravado;
- **nenhum** registro de idempotência é escrito (logo, um retry é uma requisição nova).

Isso é comprovado por um **teste de rollback obrigatório**
(`test/operations-rollback…`, ver `ARDEN_BE_003_TEST_EVIDENCE.md`): injeta-se uma falha
no meio da publicação e verifica-se que o estado final é exatamente o inicial.

## Imutabilidade após publicação

Versões `published`/`superseded` são imutáveis. `PATCH` de definição ou autoridade sobre
elas retorna `409 ALREADY_PUBLISHED` — imposto no **service**, não apenas no controller.
Para mudar algo publicado, cria-se uma nova versão a partir da base (ver
`OPERATION_VERSIONING.md`).

## Idempotência

O `Idempotency-Key` é obrigatório. A checagem de idempotência ocorre **primeiro**
(replay curto-circuita antes de qualquer pré-checagem de estado); o registro é gravado
**dentro** da transação. Ver `OPERATION_IDEMPOTENCY.md`.

Ver também: `OPERATIONS_ARCHITECTURE.md`, `OPERATION_AUDIT_EVENTS.md`.
