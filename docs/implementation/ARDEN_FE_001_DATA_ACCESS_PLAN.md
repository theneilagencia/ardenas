# ARDEN-FE-001 — Plano de Acesso a Dados

> **Nome do resultado:** ARDEN-FE-001 — Fundação da camada de dados e migração do
> agregado Operações. **Escopo desta entrega:** Operações + Auditoria. Esta entrega
> **não** migra todos os módulos do frontend; os demais agregados continuam usando a
> store como fonte da verdade (ver §3).

Branch: `claude/arden-fe-001-data-access` · base `c82ff23` · 2026-07-30.
Objetivo: estabelecer a **fronteira única de acesso a dados** do frontend e provar seu
uso no **agregado Operações** (mais Auditoria), de modo que essas telas deixem de
acessar/persistir entidades de domínio direto na store e passem a usar exclusivamente
contratos de repositório via uma camada de aplicação e hooks. Sem backend, sem auth
real, sem banco remoto, sem mudança visual.

## 1. Problema (confirmado pela auditoria)

`docs/audit/FRONTEND_AUDIT_EVIDENCE_v1.md §4.1/4.4`: nenhum componente usa a camada de
contrato; a store (`useAppStore`) é a fonte da verdade e persiste o snapshot inteiro
via provider; em modo `api` o `persist()` é no-op e o bootstrap usa snapshot vazio.
Não há uma fronteira única de acesso a dados.

## 2. Mapa de acesso atual → alvo

| Tela/feature | Acesso atual | Store atual | Contrato existente | Ajuste necessário |
|---|---|---|---|---|
| OperationsPage | `useScopedData().operations` | leitura direta | `OperationsRepository` (parcial, não usado) | usar `useOperations()` |
| OperationDetailPage | leitura + `startExecution`/`pause`/`resume`/`duplicate`/`archive` | leitura+escrita | parcial | ler via `useOperation(id)`; escrever via hooks/casos de uso |
| WizardPage | `saveDraft`/`publishOperation` + leitura | escrita | parcial | `useCreateOperation`/`useUpdateOperationDraft`/`usePublishOperationVersion` |
| DashboardPage | `useScopedData().operations` | leitura | — | `useOperations()` |
| ExecutionsPage (x2) | operations p/ nome | leitura | — | `useOperations()` (lookup) |
| ApprovalsPage | operations p/ nome | leitura | — | `useOperations()` (lookup) |
| EvidencePage | operations p/ nome | leitura | — | `useOperations()` (lookup) |
| ExceptionsPage | operations p/ nome | leitura | — | `useOperations()` (lookup) |
| EnvironmentsPage | operations + promote/rollback | leitura + escrita (ambiente) | — | ler via `useOperations()`; ambiente permanece store (P4) |
| AssessmentPage | `createOperationFromAssessment` | escrita | — | `useCreateOperationFromAssessment` (caso de uso de operações) |
| AuditPage | `useScopedData().auditEvents` | leitura | — | `useAuditEvents()` |
| SecurityPage | `auditEvents` (negados) | leitura | — | `useAuditEvents()` |
| recordAudit (store/AccessDenied/Topbar) | grava em `store.data.auditEvents` | escrita | — | `AuditRepository.append` |

### Chamadas diretas / mutações / persistência direta encontradas
- Mutação de operações via store: `saveDraft`, `publishOperation`, `duplicateOperation`,
  `pauseOperation`, `resumeOperation`, `archiveOperation`, `createOperationFromAssessment`
  (`src/store/app-store.ts`).
- `startExecution` lê `store.data.operations` para montar a execução.
- Auditoria: `recordAudit` faz `set(auditEvents)` na store.
- Acesso ao IndexedDB: encapsulado em `services/db.ts` + `IndexedDbDataProvider`
  (nenhum componente acessa Dexie diretamente — já OK).
- Uso de mocks em componentes: nenhum (mock só em `services/providers.ts` e testes).
- Contratos existentes não utilizados: `OperationsRepository`, `ApprovalsRepository`,
  `FilesRepository` e `getOperationsRepository()` — nunca importados por `features/`.

## 3. Escopo desta issue (migração incremental)

**Fase 1 (esta entrega): Operações + Auditoria** — são acopladas (toda mutação de
operação grava auditoria), por isso migram juntas.
- Operações: `list`, `getById`, `create`, `updateDraft`, `createVersion`,
  `publishVersion`, `archive`, `duplicate`, `createFromAssessment`.
- Auditoria: `list` (por organização) + `append` (fronteira única de escrita de
  eventos, usada também pelas ações ainda-na-store das demais fases).

**Fases 2–4 (staged, documentadas, fora desta entrega):** aprovações, arquivos, Work
Units, orçamento, implantação, políticas, riscos, integrações, pessoas — permanecem
na store como **fonte única** (sem dupla persistência). Seus contratos de repositório
serão adicionados e a UI migrada nas issues seguintes, reusando a mesma arquitetura.

> Justificativa de trazer Auditoria já na Fase 1: as mutações de operação precisam
> gravar eventos; unificar a escrita de auditoria em `AuditRepository.append` evita
> dupla fonte de verdade para `auditEvents`. As demais ações da store passam a gravar
> auditoria pela mesma fronteira.

## 4. Arquitetura alvo

```
UI (features/*, components/*)
        │  (apenas hooks + tipos de domínio)
        ▼
hooks (src/hooks/use-operations.ts, use-audit.ts)   ← TanStack Query (já no projeto)
        ▼
aplicação (src/application/operations/*, audit/*)   ← validação, erro, sem React/Zustand/IndexedDB
        ▼
contratos (src/services/contracts.ts)               ← OperationsRepository, AuditRepository, …
        ▼
implementações (src/services/repositories/*-snapshot.ts | *-api.ts)
        ▼
gateway físico (src/services/data/snapshot-store.ts) ← MemorySnapshotStore | IndexedDbSnapshotStore
                                                        ApiClient (modo api)
```

- **Composição única:** `src/services/service-container.ts` → `getServices(): ArdenServices`
  escolhe a implementação por `VITE_DATA_PROVIDER` **em um só lugar**.
- **SnapshotStore** é o gateway físico compartilhado; repositórios fazem
  read-modify-write da sua fatia; nenhum componente o conhece.
- **Store (Zustand)** deixa de ser fonte de verdade de `operations` e `auditEvents`;
  o `persist()` passa a ser *slice-aware* (mantém `operations`/`auditEvents` do
  snapshot corrente, sobrescrevendo só as fatias que ainda gerencia).

## 5. Erros

`src/services/errors.ts`: `ArdenRepositoryError` com código
`NOT_FOUND | VALIDATION_ERROR | CONFLICT | UNAUTHORIZED | FORBIDDEN | NETWORK_ERROR | UNAVAILABLE | UNKNOWN`.
Mapeadores: de `ArdenApiError` (HTTP) e de erro desconhecido. Hooks expõem
`isLoading`/`error`/`isEmpty`; a UI trata vazio, erro recuperável (retry), conflito e
indisponibilidade.

## 6. Concorrência

Contratos carregam `updatedAt`/`version` (já no domínio) e a publicação é **comando
explícito** (`publishVersion`), não atualização de campo. Idempotência e optimistic
locking ficam preparados no contrato (não implementados remotamente aqui).

## 7. Regra arquitetural

Teste que falha se `src/features/**` ou `src/components/**` importarem
`services/repositories/*`, `services/db`, `services/providers`, `services/data/*` ou
`store` para persistência de domínio de operações. A UI só importa `hooks/*`,
`application/*` (tipos) e `domain/*`.

## 8. Itens fora de escopo encontrados (backlog, não corrigir aqui)

- Auditoria imutável (GAP-05), versão publicada editável (GAP-06), autoridade efetiva
  (GAP-11), execução assíncrona (GAP-04), auth/tenant server (GAP-01/02/03) —
  permanecem como estão; apenas a fronteira de acesso é corrigida.
