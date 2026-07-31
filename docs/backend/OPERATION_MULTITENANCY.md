# Arden.AS — Multitenancy nas Operações (ARDEN-BE-003)

> Todo dado de operação, versão e auditoria é **isolado por tenant**. O path localiza a
> organização; o membership (BE-002) autoriza. Nenhuma query busca por `id` isolado.
> Recurso de outro tenant → **404** (anti-enumeração). Estende
> `MULTITENANCY_ENFORCEMENT.md` de BE-002.

## Escopo obrigatório por `organizationId`

O `organizationId` vem do **contexto validado** (`@CurrentContext`, resolvido pelo
`OrganizationGuard` a partir do path e do membership). **Toda** consulta em
`OperationsRepository`, `OperationVersionsRepository`, `AuditRecorder` e `AuditService`
inclui `organizationId`. Nunca há `findUnique` por `id` sozinho:

```ts
// SEMPRE (tenant-scoped)
this.tx.operation.findFirst({ where: { id, organizationId: ctx.organizationId } });

// NUNCA
this.tx.operation.findUnique({ where: { id } });
```

A operação também referencia `organizations` com `onDelete: Restrict` — sem cascata
destrutiva. O corpo da requisição **não** carrega `organizationId` (apenas o path define
o tenant); tentar defini-lo no body não tem efeito.

## Path localiza, não autoriza

`organizations/:organizationId/…` apenas **localiza** o tenant. A autorização é
server-side: o `OrganizationGuard` exige membership válido e o `PermissionGuard` exige a
permissão. Conhecer um `organizationId` no path não concede acesso — igual a BE-002.

## Anti-enumeração (404)

Um `operationId`/`versionId` **conhecido de outro tenant**, acessado pelo path da sua
própria organização, retorna `404 RESOURCE_NOT_FOUND` — nunca 403 — para não revelar a
existência do recurso. O mesmo vale para:

- **Auditoria**: eventos nunca vazam entre tenants; um `eventId` de outra org → 404.
- **Compare**: não cruza operações nem organizações; versões de operações/tenants
  distintos → 404.
- **Idempotência**: as chaves não colidem entre orgs (o path escopado faz parte do
  escopo da chave — ver `OPERATION_IDEMPOTENCY.md`).

## Cenário crítico A/B/C

O teste `operations-multitenancy` (integração, Postgres real) monta:

| Ator/Org | Papel |
| --- | --- |
| **A** em **Alpha** | admin em Alpha |
| **B** em **Beta** | auditor em Beta |
| **C** em ambas | admin em Alpha, auditor em Beta |

Verifica que:

- listagens só mostram operações da organização ativa;
- um id de operação/versão de outra org (via path próprio) → **404**;
- as permissões de **C mudam conforme a organização ativa** (admin em Alpha vs auditor
  em Beta);
- auditoria não vaza entre tenants;
- chaves de idempotência não colidem entre orgs.

Ver também: `OPERATIONS_ARCHITECTURE.md`, `OPERATION_AUDIT_EVENTS.md`,
`MULTITENANCY_ENFORCEMENT.md`.
