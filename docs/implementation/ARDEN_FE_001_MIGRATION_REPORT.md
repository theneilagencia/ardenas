# ARDEN-FE-001 — Fundação da camada de dados e migração do agregado Operações

Branch `claude/arden-fe-001-data-access` · base `c82ff23` · 2026-07-30.
Objetivo: estabelecer a **fronteira de acesso a dados** do frontend e provar seu uso
no **agregado Operações** (mais Auditoria), preparando a futura conexão com uma API
real. Esta entrega **não** migra todos os módulos do frontend — apenas Operações e
Auditoria (ver §Entregue e §Pendentes).

## Entregue (escopo efetivamente concluído)

- Fundação da arquitetura de acesso a dados (gateway `SnapshotStore`).
- Composição centralizada dos providers (`getServices()`, seleção em um só lugar).
- Contratos específicos de repositório por agregado (`OperationsRepository`,
  `AuditRepository`).
- Camada de aplicação (casos de uso em `src/application/**`).
- Hooks de integração (`use-operations`, `use-audit`, TanStack Query).
- Migração **integral** do agregado **Operações**.
- Migração da **Auditoria** (leitura por hook; escrita pela fronteira única `append`).
- Fluxo de prova **criar → editar → versionar → publicar → recarregar** (persistente).
- Validação dos providers **mock** e **IndexedDB**.
- Preparação **estrutural** do provider **API** (sem API real).
- Tratamento padronizado de erros (`ArdenRepositoryError`).
- Testes arquiteturais, unitários, de caso de uso e E2E.

## Pendentes (fora do escopo concluído nesta entrega)

Os agregados abaixo **continuam usando a store como fonte da verdade** e serão
migrados em issues seguintes (Fases 2–4), reusando esta mesma arquitetura:

- Aprovações
- Exceções
- Arquivos
- Work Units
- Orçamento
- Execuções
- Implantação
- Políticas
- Riscos
- Integrações
- Pessoas
- Contexto

## Arquitetura implementada

```
UI (features/components) → hooks (use-operations, use-audit)
  → aplicação (src/application/*) → contratos (services/contracts)
  → repositórios (services/repositories/*-snapshot | *-api)
  → gateway (services/data/snapshot-store) | ApiClient
```

Composição única em `services/service-container.ts` (`getServices()` /
`getSnapshotStore()`), selecionando a implementação por `VITE_DATA_PROVIDER` **em um
só lugar**. Nenhum componente conhece implementações concretas (garantido por teste
arquitetural).

## Componentes migrados (Fase 1: Operações + Auditoria)

| Componente | Antes | Depois |
|---|---|---|
| OperationsPage | `useScopedData().operations` | `useOperations()` (+ loading/erro/retry) |
| OperationDetailPage | store `operations` + `pause/resume/duplicate/startExecution` | `useOperation(id)`, `usePauseOperation`, `useResumeOperation`, `useDuplicateOperation`; execução recebe a Operação carregada |
| WizardPage | store `saveDraft`/`publishOperation` | `useSaveOperationDraft`, `useCreateOperation`, `useCreateOperationVersion`, `usePublishOperationVersion`; rascunho retomável via `useOperation(DRAFT_ID)` |
| DashboardPage | store `operations` | `useOperations()` |
| AssistantPanel | store `operations` | `useOperations()` |
| ApprovalsPage, EvidencePage, ExceptionsPage, ExecutionsPage (x2), FilesPage | store `operations` (lookup) | `useOperations()` |
| EnvironmentsPage | store `operations` + `promoteEnvironment`/`rollbackEnvironment` | `useOperations`, `usePromoteEnvironment`, `useRollbackEnvironment` (casos de uso) |
| AssessmentPage | store `createOperationFromAssessment` | `useCreateOperationFromAssessment` |
| AuditPage, SecurityPage | `useScopedData().auditEvents` | `useAuditEvents()` |

## Stores alteradas

`src/store/app-store.ts`:
- **Removidas** as ações de domínio de operações: `saveDraft`, `publishOperation`,
  `duplicateOperation`, `createOperationFromAssessment`, `pauseOperation`,
  `resumeOperation`, `archiveOperation`, `promoteEnvironment`, `rollbackEnvironment`.
- `startExecution` agora recebe a `Operation` já carregada (executions permanece na
  store — Fase futura) em vez de buscar em `data.operations`.
- `recordAudit` deixou de gravar em `data.auditEvents`; agora grava pela **fronteira
  única** `AuditRepository.append` e persiste as fatias que a store ainda gerencia.
- `persist()` tornou-se **slice-aware**: mantém `operations` e `auditEvents` do
  snapshot corrente (fatias dos repositórios) e sobrescreve apenas as fatias
  transitórias — **elimina a dupla fonte de verdade**.
- `useScopedData` não expõe mais `operations` nem `auditEvents`.

A store mantém: estado de UI (tema, drawer, cmd, tour, sessão, organização ativa) e as
fatias de domínio ainda não migradas (aprovações, arquivos, WU, orçamento, execuções,
implantação, políticas, riscos, integrações, contexto, pessoas), como fonte única
dessas fatias até as Fases 2–4.

## Contratos e repositórios

- `OperationsRepository` (contrato do agregado): `list`, `getById`, `create`,
  `updateDraft`, `createVersion`, `publishVersion` (comando explícito), `pause`,
  `resume`, `archive`, `duplicate`, `createFromAssessment`.
- `AuditRepository`: `list`, `append`.
- `ApprovalsRepository`, `FilesRepository` (mantidos; UI ainda na store — Fases 2/3).
- Implementações: `*-snapshot.ts` (mock/indexeddb via `SnapshotStore`) e `*-api.ts`
  (HTTP via `ApiClient`, erros normalizados para `ArdenRepositoryError`).
- `ArdenServices` = { operations, audit, approvals, files } resolvido no container.

## Providers validados

| Provider | Como | Resultado |
|---|---|---|
| mock | `MemorySnapshotStore` (testes de aplicação e store) | ✅ |
| indexeddb | `IndexedDbSnapshotStore` (padrão; E2E `operations-flow`) | ✅ criar→publicar→recarregar→recuperar |
| api | `ApiOperationsRepository`/`ApiAuditRepository` (testes com fetch mockado) | ✅ estruturalmente utilizável (sem backend) |

## Erros e concorrência

- `ArdenRepositoryError` com códigos `NOT_FOUND | VALIDATION_ERROR | CONFLICT |
  UNAUTHORIZED | FORBIDDEN | NETWORK_ERROR | UNAVAILABLE | UNKNOWN`; `recoverable`
  para retry. Mapeadores de `ArdenApiError` e de erro cru.
- UI de Operações trata loading, vazio, erro recuperável (botão “tentar novamente”).
- Contratos carregam `updatedAt`/`version`; publicação é comando explícito
  (`publishVersion`) — não atualização de campo. Idempotência/optimistic-locking ficam
  preparados no contrato (não implementados remotamente aqui).

## Sem dupla persistência

Teste `src/application/operations.test.ts` prova: após publicar uma operação pela
camada de aplicação, uma mutação da store (que persiste slice-aware) **não sobrescreve**
a operação do repositório. E2E `operations-flow` prova a recuperação após recarga.

## Regressões

Nenhuma regressão visual ou funcional identificada. Todos os fluxos-assinatura
continuam verdes (wizard com bloqueio, implantação com trava, drawer, ⌘K, execução).

## Itens pendentes (fora do escopo desta issue)

- **Fase 2**: migrar UI de Aprovações (repositório já existe) e Exceções.
- **Fase 3**: Arquivos, Work Units, Orçamento.
- **Fase 4**: Implantação, Políticas, Riscos, Integrações, Pessoas, Contexto,
  Ambientes (parcialmente já via operações).
- `services/providers.ts` (ApiDataProvider bulk-load) permanece como utilitário
  testado, não usado pela store; pode ser removido quando a hidratação em modo api for
  definida por domínio.
- Gaps de produto/segurança da auditoria (GAP-01..11) permanecem — esta issue trata
  apenas da fronteira de acesso a dados.

## Riscos restantes

- Store ainda é fonte única das fatias não migradas (transitório e documentado).
- Em modo `api`, as fatias não migradas ficam vazias (sem backend) — esperado.
- `recordAudit` é assíncrono (append no repositório); leituras de auditoria revalidam
  por contador (`auditVersion`) e invalidação de query — coberto por testes.
