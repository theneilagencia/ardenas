# Arden.AS — Mapa Frontend → Backend (v1)

Commit `aad61e5`. Telas, ações, contratos existentes e necessidade de backend.
Não define a API final — mapeia a necessidade e o contrato esperado.

## 1. Inventário de rotas

Fonte: `src/app/routes.tsx` (30 `path:` + index + `*`). Todas sob o layout
`AppShell`; guardas via `RequirePermission` (client-side).

| Rota | Módulo | Componente | Perfil/permissão (client) | Fonte de dados | Estado real |
|---|---|---|---|---|---|
| `/` | Visão geral | `DashboardPage` | `organization.view` | store escopado | funcional (local) |
| `/operations` | Operações | `OperationsPage` | `operation.view` | store | funcional (local) |
| `/operations/new` | Wizard | `WizardPage` | `operation.create` | store (draft) | parcialmente funcional |
| `/operations/:id` | Detalhe | `OperationDetailPage` | `operation.view` | store | funcional (local) |
| `/executions` | Execuções | `ExecutionsPage` | `execution.view` | store | funcional (local) |
| `/executions/:id` | Detalhe execução | `ExecutionDetailPage` | `execution.view` | store | funcional (local) |
| `/approvals` | Aprovações | `ApprovalsPage` | `approval.view` | store + seed | funcional (local) |
| `/results` | Resultados | `ResultsPage` | `operation.view` | seed estático | somente visual |
| `/evidence` | Evidências | `EvidencePage` | `audit.view` | store | funcional (local) |
| `/exceptions` | Exceções | `ExceptionsPage` | `execution.view` | store | funcional (local) |
| `/work-units` | Work Units | `WorkUnitsPage` | `budget.view` | store | funcional (local) |
| `/authority` | Gradientes | `AuthorityPage` | `risk.view` | seed estático | somente visual |
| `/governance` | Governança | `GovernancePage` | `policy.view` | store | funcional (local); aba Retenção placeholder |
| `/risk` | Matriz de risco | `RiskPage` | `risk.view` | store | funcional (local) |
| `/context` | Contexto | `ContextPage` | `context.view` | store | funcional (local) |
| `/integrations` | Integrações | `IntegrationsPage` | `integration.view` | store | simulada |
| `/files` | Arquivos | `FilesPage` | `file.view` | store | funcional (local) |
| `/assessment` | Assessment | `AssessmentPage` | `operation.view` | seed estático | somente visual |
| `/evaluator` | Avaliador | `EvaluatorPage` | `operation.view` | nenhuma (estado local do form) | somente visual |
| `/deployment` | Implantação | `DeploymentPage` | `onboarding.execute` | store | funcional (local) |
| `/people` | Pessoas | `PeoplePage` | `people.view` | store | funcional (local) |
| `/security` | Segurança | `SecurityPage` | `security.view` | store (audit) | funcional (local) |
| `/environments` | Ambientes | `EnvironmentsPage` | `operation.view` | store | funcional (local) |
| `/audit` | Auditoria | `AuditPage` | `audit.view` | store | funcional (local, mutável) |
| `/reports` | Relatórios | `ReportsPage` | `report.export` | store | simulada (só auditoria) |
| `/admin` | Administração | `AdminPage` | `organization.manage` | estático | somente visual |
| `/roles` | Papéis (deep link) | `RolesPage` | `role.view` | `ROLE_PERMISSIONS` | somente visual |
| `/budget` | Orçamento (deep link) | `BudgetPage` | `budget.view` | store | funcional (local) |
| `/policies` | — | `Navigate → /governance` | — | — | redirect |
| `/organizations` | — | `Navigate → /admin` | — | — | redirect |
| `*` | — | `Navigate → /` | — | — | catch-all |

**Rotas fora do menu (acessíveis por URL):** `/roles`, `/budget` existem como deep
links, mas não estão no `MODULES` de `app/modules.ts` (o menu do mockup dobra Papéis
em Pessoas e Orçamento em Work Units). Não há rotas quebradas nem links sem destino
detectados. Todas as rotas passam por `RequirePermission` (exceto index, que exige
`organization.view` implicitamente pelo dashboard) — **proteção somente no cliente**.

## 2. Inventário de ações (amostra representativa)

| Tela | Ação | Resultado esperado | Resultado real | Persistência | Classe |
|---|---|---|---|---|---|
| Wizard | Publicar | Cria operação server-side | `store.publishOperation` (memória) | IndexedDB local | F3 |
| Wizard | Salvar rascunho | Persistir rascunho retomável | `store.saveDraft` | IndexedDB local | F3 |
| Detalhe op. | Executar / Executar teste | Inicia execução assíncrona | `store.startExecution` **síncrono** | local | F2 |
| Detalhe op. | Duplicar | Cria rascunho | `store.duplicateOperation` | local | F3 |
| Detalhe op. | Comparar versões | Diff de versões | `VersionCompareDialog` (seed) | — | F3 |
| Aprovações | Aprovar/Rejeitar/Ajuste/Delegar | Decisão vinculada à versão | `store.resolveApproval` (sem vínculo à versão) | local | F3 |
| Arquivos | Solicitar+aprovar exclusão | Exige 2 aprovadores | `store.approveFileDeletion` (2 distintos) | local | F3 |
| Integrações | Conectar/Testar | Conexão real ao sistema | flip de estado local | local | F2 |
| Work Units | Solicitar/Aprovar excedente | Débito/crédito transacional | mutação local | local | F3 |
| Relatórios | Exportar | Gera arquivo | grava só evento de auditoria | local | F2 |
| Topbar | Trocar perfil | — | `switchProfile` (impersonation) | memória | F2 |
| Topbar | Trocar organização | Filtra por tenant validado | filtro client-side | memória | F2 |

**Padrões de risco observados:** ações destrutivas com proteção real apenas em
Arquivos (2 aprovadores) e ausência de proteção de concorrência/duplo-clique em
Aprovações e Work Units; nenhuma ação envia requisição a um backend.

## 3. Contratos existentes (o que já está pronto para API)

Fonte: `src/services/contracts.ts`, `api-client.ts`, `repositories/*`.

| Contrato | Métodos | Impl. Mock | Impl. IndexedDB | Impl. API | Usado pela UI |
|---|---|---|---|---|---|
| `DataProvider` (snapshot load/persist/clear) | 3 | ✅ `MockDataProvider` | ✅ `IndexedDbDataProvider` | ✅ `ApiDataProvider` (load real; persist/clear lançam) | via `store` (mock/idb); **api não no bootstrap** |
| `OperationsRepository` | 9 | — | ✅ `StoreOperationsRepository` | ✅ `ApiOperationsRepository` | **não** |
| `ApprovalsRepository` | 5 | — | — | ✅ `ApiApprovalsRepository` | **não** |
| `FilesRepository` | 5 | — | — | ✅ `ApiFilesRepository` | **não** |
| `ApiClient` (get/post/patch + mapa de erro 400–503) | — | — | — | ✅ `api-client.ts` | só pelos repos/provider |

Envelope de resposta (`ApiResponse<T> = { data, meta? }`) e erro
(`ApiError { code, message, fieldErrors?, correlationId?, details? }`) definidos em
`contracts.ts`. `ApiClient` envia header `X-Arden-Organization`. **AbortSignal**
suportado em `OperationsRepository`/`ApiClient`.

**Incoerências/lacunas de contrato:**
- Repositórios de escrita cobrem apenas 3 domínios (Operações, Aprovações, Arquivos);
  os demais 20+ domínios mutam **direto na store**, sem contrato de escrita.
- `ApiDataProvider.persist/clear` **lançam** — não há caminho de escrita por snapshot
  no modo api (correto), mas a store não roteia mutações para os repositórios.
- Sem paginação/ordenação/filtro server-side além de `OperationQuery` (list de op.).
- Sem `Idempotency-Key`, sem `If-Match`/ETag (optimistic locking), sem correlation-id
  de saída, sem retry/timeout no cliente.

## 4. Mapa de necessidade de backend (por ação de negócio)

| Ação | Contrato atual | Envia hoje | Recebe hoje | Precisa backend | Autorização |
|---|---|---|---|---|---|
| Criar organização | — | nada (não há tela) | — | **Sim** | corporate_admin |
| Convidar usuário | store `invitePerson` | — | — | **Sim** | people.create |
| Alterar papel | store `updatePersonRoles` | — | — | **Sim** (fonte da verdade) | role.manage |
| Criar/editar operação | store `saveDraft` | — | — | **Sim** | operation.create/edit |
| Criar/publicar versão | store `publishOperation` | — | — | **Sim** (imutabilidade) | operation.publish |
| Arquivar operação | store `archiveOperation` | — | — | Sim | operation.pause |
| Iniciar/pausar/retomar/cancelar execução | store `startExecution`/… | — | — | **Sim** (assíncrono) | execution.* |
| Reprocessar/escalar exceção | store `reprocessException` | — | — | **Sim** | execution.resume |
| Aprovar/rejeitar/delegar | store `resolveApproval` | — | — | **Sim** (vínculo à versão, anti-fraude) | approval.resolve |
| Conectar/testar integração | store flip | — | — | **Sim** (credenciais, OAuth) | integration.manage |
| Registrar contexto / upload | store `addContextSource` | — | — | **Sim** (URL pré-assinada) | context.manage |
| Registrar evidência | store (auto na execução) | — | — | **Sim** (imutável) | — |
| Consultar auditoria | store (memória) | — | — | **Sim** (append-only) | audit.view |
| Configurar orçamento | store `setBudget` | — | — | Sim | budget.manage |
| Consumir WU / aprovar excedente | store | — | — | **Sim** (transacional) | budget.overage.approve |
| Promover ambiente | store `promoteEnvironment` | — | — | Sim | operation.edit |

**Conclusão do mapa:** os contratos de leitura estão parcialmente prontos (snapshot
load via API testado) e três domínios têm escrita HTTP pronta, porém **nenhuma tela
consome a camada de contrato** — toda escrita hoje ocorre na store local. A ligação
UI→container e a implementação server-side são o trabalho central do backend v1.
