# Arden.AS — Idempotência de Comandos de Operação (ARDEN-BE-003)

> Comandos que criam ou mudam estado material exigem `Idempotency-Key`. Mesma
> chave+corpo → **replay** da resposta; mesma chave+corpo diferente → **409**. O registro
> de idempotência participa da transação do comando. Alinha-se a
> `API_V1_IDEMPOTENCY_AND_CONCURRENCY.md` (D-008).

## Cabeçalho

`Idempotency-Key` é **obrigatório** em: `POST /operations` (create),
`POST …/duplicate`, `POST …/archive`, `POST …/versions` (version-create) e
`POST …/publish`. Ausência → `422` (validação).

> **Pause/resume não usam `Idempotency-Key`** (por contrato). São idempotentes **por
> estado**: re-pausar uma operação já pausada é um no-op de sucesso; a proteção contra
> corrida é a concorrência otimista (`OPERATION_CONCURRENCY.md`).

## Escopo da chave

O escopo cobre **usuário + org + método + rota + chave + hash do corpo**:

```
escopo = (method, caminho-org-escopado, `userId:key`) + hash(corpo)
```

Como o caminho contém o `organizationId`, as chaves **nunca colidem entre tenants** nem
entre usuários. O hash do corpo distingue requisições com a mesma chave mas payload
diferente.

## Replay vs conflito

| Situação | Resultado |
| --- | --- |
| Mesma chave + mesmo corpo | **Replay**: devolve a resposta armazenada, sem reexecutar. |
| Mesma chave + corpo diferente | `409 IDEMPOTENCY_CONFLICT`. |
| Chave nova | Executa o comando (prepare → transação). |

## Ordenação: idempotência primeiro, prepare depois

A checagem de idempotência roda **antes de tudo**: um replay **curto-circuita** antes de
qualquer pré-checagem de estado. As pré-checagens (existência, estado, permissões
adicionais) acontecem em um **prepare step** executado **apenas** para requisições novas.
Assim, um retry legítimo nunca reexecuta efeitos colaterais.

```
request → check(idempotency)
            ├─ hit  → replay resposta armazenada (fim)
            └─ miss → prepare (pré-checagens) → BEGIN … comando … remember(dentro da tx) … COMMIT
```

## Participação na transação

O registro de idempotência é escrito **dentro** da transação do comando
(`command.helpers.ts`). Consequência: se o comando sofre rollback (ex.: falha na
publicação — ver `OPERATION_PUBLICATION_TRANSACTION.md`), **não** fica registro de
sucesso; um retry é tratado como requisição nova. Para isso,
`IdempotencyService.check/remember` (`src/modules/idempotency/idempotency.service.ts`)
foram estendidos para aceitar um **cliente de transação** (parâmetro opcional,
retrocompatível).

## Comandos e cabeçalhos

| Comando | `Idempotency-Key` | `If-Match`/`expectedRevision` |
| --- | --- | --- |
| create operation | obrigatório | — |
| update operation | — | sim |
| pause / resume | não (idempotente por estado) | sim |
| archive | obrigatório | sim |
| duplicate | obrigatório | — |
| version create | obrigatório | — |
| version update / authority update | — | sim |
| publish | obrigatório | sim |

Ver também: `OPERATION_CONCURRENCY.md`, `OPERATIONS_ARCHITECTURE.md`.
