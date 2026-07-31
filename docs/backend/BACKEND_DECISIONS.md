# Arden.AS — Decisões do Backend (ARDEN-BE-001)

> Decisões tomadas nesta fundação. Preferências NÃO são registradas como fato
> universal — cada linha traz motivo, alternativas e consequência.

| ID | Decisão | Motivo | Alternativas | Consequência |
|---|---|---|---|---|
| BE-D-001 | Monólito modular | Simplicidade operacional; escopo de fundação | Microsserviços; serverless | Sem microsserviços/K8s nesta fase (proibidos pelo escopo) |
| BE-D-002 | Frontend permanece na raiz (não movido para `apps/web`) | Evita risco aos PRs encadeados (#1–#4) e mudança excessiva | Mover para `apps/web` | Estrutura mista (frontend na raiz + `apps/api`); migração futura documentada |
| BE-D-003 | NestJS + Fastify | Exigido pelo escopo; Fastify por performance, sem incompatibilidade | NestJS + Express | Adapter Fastify; helmet/cors via plugins Fastify |
| BE-D-004 | Prisma Migrate (não `db push`) | Migrations versionadas e reproduzíveis; produção segura | `db push`; SQL manual | `_prisma_migrations` cumpre o papel de `schema_migrations` |
| BE-D-005 | `packages/contracts` reexporta `src/contracts` | Contratos compartilhados sem duplicação (§18) | Copiar tipos; mover `src/contracts` | Backend importa `@arden/contracts`; build compõe o pacote |
| BE-D-006 | `packages/database` adiado; Prisma em `apps/api/prisma` | Coerente para um único app; menos fragmentação | Criar `packages/database` já | Extração futura documentada (estrutura equivalente permitida no §8) |
| BE-D-007 | Vitest + SWC (metadata de decorators) | Consistência com o frontend; SWC emite `design:type` (DI do Nest) | Jest + ts-jest | Config SWC em `apps/api/vitest.config.ts` |
| BE-D-008 | `@fastify/helmet` v11 | Compatível com Fastify 4 (NestJS 10); v12 exige Fastify 5 | Fastify 5 + Nest 11 | Fixado helmet ^11; alinhado ao ecossistema Nest 10 |
| BE-D-009 | Zod para config e DTOs | Reusa os schemas do contrato; sem duplicar validação | class-validator/class-transformer | `ZodValidationPipe`; sem redefinição de contrato |
| BE-D-010 | OpenAPI servida do arquivo comitado | Não gerar uma segunda spec divergente (§12) | `@nestjs/swagger` por decorators | `/api/docs` serve `docs/api/openapi-v1.yaml`; sincronia testada |
| BE-D-011 | `observability/config/testing` consolidados em `apps/api` | Evita fragmentação prematura de packages | Packages separados | Extração futura documentada |

## Decisões pendentes (NÃO DEFINIDO)

- **Provedor de autenticação** (BE-D-001 do contrato): NÃO DEFINIDO — será tratado no
  ARDEN-BE-002. O contrato assume Bearer/sessão equivalente.
- **Janela/escopo de retenção da `Idempotency-Key`**: recomendação inicial 24h por
  (método, rota, chave); confirmação de produto pendente.
- **`packages/database` e `apps/web`**: extração/movimentação futuras, quando os PRs
  encadeados estiverem integrados.
