# Projeção do catálogo de conectores — ARDEN-BE-006.3

Alternativa **híbrida**: fonte canônica em código (`@arden/contracts`
`projectConnectorCatalog()`) projetada no banco por função PURA
`runCatalogProjection(db)` (`apps/api/src/connectors/catalog/project-catalog.ts`),
reutilizada pelo **seed** (PrismaClient) e pelo **projector Nest** (transação).

## Hash determinístico
`stableHash(obj)` (sha256 de JSON com chaves ordenadas) identifica cada
definição/ferramenta. Mesma definição com ordem de propriedades diferente → mesmo
hash (testado). O `catalog_hash` persistido detecta mudanças.

## Idempotência
- Ausente → **create**.
- `catalog_hash` igual + status/active igual → **unchanged** (nenhuma escrita).
- `catalog_hash` diferente → **update** só de campos system-managed (id/created estáveis).
- Definição system-managed removida do canônico → **DEPRECATED** (não apagada).
- Ferramenta removida do canônico → **disabled** (não apagada).

Retorna contadores (`connectorsCreated/Updated/Unchanged/Deprecated`,
`toolsCreated/Updated/Unchanged/Disabled`). Segunda execução: tudo `unchanged`.

## Seed
`prisma/seed.ts` projeta o catálogo **depois** das permissões. Idempotente, sem
resetar dados tenant-scoped, sem internet, sem segredo. `internal.test` é persistido
com `productionAllowed=false` (filtros de runtime ficam para fases futuras).

## Sistema, não tenant
A projeção é operação de sistema: **não** escreve no `audit_events` (tenant-scoped);
registra por log estruturado + resultado.
