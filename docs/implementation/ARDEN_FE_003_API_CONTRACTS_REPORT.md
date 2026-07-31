# ARDEN-FE-003 — Relatório dos Contratos da API v1

> Branch `claude/arden-fe-003-api-contracts` · base `07791c5` (PR #3). **Sem backend,
> sem banco, sem autenticação real, sem endpoints reais, sem migrar módulos.**

## Entregue

- **Pacote de contratos independente do frontend** em `src/contracts/` (schemas Zod
  executáveis + tipos derivados por `z.infer`): `common`, `session`, `operations`,
  `operation-versions`, `authority`, `audit`, `openapi`, `endpoint`, `registry`.
- **22 operações** em **17 paths**; **34 schemas** nomeados.
- **OpenAPI 3.0.3** gerado da fonte única (`docs/api/openapi-v1.yaml`) via
  `npm run contracts:openapi`; **validado** estruturalmente e em **sincronia** com os
  contratos (teste).
- **Padrão de resposta** (`{data, meta?}`) e **paginação por cursor** para listas/auditoria.
- **Catálogo de erros único e tipado** (17 códigos → HTTP), sempre com `correlationId`.
- **Headers**: `Authorization`, `X-Correlation-Id`, `Idempotency-Key`, `If-Match`.
- **Tenant no path** org-scoped; **fora dos bodies** (exceto o comando de sessão
  `switch-organization`), validado pela sessão no backend.
- **Concorrência otimista** (`revision`/`expectedRevision`/`If-Match` → 409
  `VERSION_CONFLICT`) e **idempotência** (5 comandos críticos → `Idempotency-Key`).
- **Imutabilidade de versão publicada** (`ALREADY_PUBLISHED`; PATCH só em rascunho).
- **Gradiente de Autoridade** formal (`AuthorityProfile`) com regras mínimas
  executáveis para publicação.
- **Cliente TypeScript** (`src/services/api/generated/api-v1-client.ts`) e **prova de
  compatibilidade** com `SessionRepository`/`AuditRepository`/`OperationsRepository`
  (`repository-compat.ts` + `client-compat.test.ts`).
- **Testes de contrato** (`contracts.test.ts`, `openapi.test.ts`, `client-compat.test.ts`).
- **Documentação**: `API_V1_SCOPE`, `API_V1_CONTRACTS`, `API_V1_AUTHORIZATION_MATRIX`,
  `API_V1_ERROR_CATALOG`, `API_V1_IDEMPOTENCY_AND_CONCURRENCY`, `FRONTEND_TO_API_V1_MAP`,
  `API_V1_OPEN_DECISIONS`, `openapi-v1.yaml`.

## Compatibilizações (contrato v1 ↔ frontend)

- `Operation.status`: v1 `draft|active|paused|archived` (mapeado de/para o enum do
  domínio; execução fora do v1) — D-002.
- Operação **lean** (metadados) + **definição rica** na versão; campos ricos não
  cobertos recebem defaults na leitura (GAP-12) — D-005.
- Gradiente de nível de versão (`AuthorityProfile`) formaliza autoridade hoje por
  passo/ação + matriz de exibição (GAP-11) — D-003/D-004.
- `AuditEvent`: `objectType→resourceType`, `objectId→resourceId`, `previousValue→before`,
  `newValue→after`, `timestamp→occurredAt` (+ `actor/source/correlationId/metadata`).
- Permissões: catálogo estável do ARDEN-FE-002 (o §21 usa `operation.update/archive`,
  reconciliados para `operation.edit`). Verificado por teste.

## Não incluído

Nenhum backend/handler/servidor; sem banco/Prisma/migrations/seed de backend; sem
JWT/login; sem filas/workers; sem Supabase; sem migração de módulos adicionais; sem
alteração de UX. Módulos fora do v1 (agentes, execução, integrações, work units,
orçamento, arquivos, aprovações complexas, políticas, riscos, pessoas, relatórios,
notificações, etc.) documentados como futuros, **fora** do contrato v1.

## Riscos remanescentes

- **Nada aqui é segurança/multitenancy real** — é o **contrato**; o backend será a
  autoridade (deriva sessão/tenant/permissões e revalida cada ação).
- Decisões em aberto (D-001..D-010) documentadas com **NÃO DEFINIDO** onde não há
  decisão de produto; **não** bloqueiam o primeiro fluxo.
- A adaptação de leitura de Operação preenche campos ricos com defaults (documentado);
  o wiring das mutações versão-cêntricas fica para marco posterior.
- A OpenAPI é validada estruturalmente (invariantes essenciais + `$refs` resolvidos);
  não há validador externo pesado adicionado.
