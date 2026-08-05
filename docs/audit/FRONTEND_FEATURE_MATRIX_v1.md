# Arden.AS — Matriz de Funcionalidades F0–F5 (v1)

Commit `aad61e5`. Classificação por evidência de código, não por tela.

Níveis: **F0** Ausente · **F1** Visual · **F2** Simulada · **F3** Local
(store/IndexedDB) · **F4** Integrável (contrato/adapter pronto, sem API real) ·
**F5** Produção (backend real + auth + persistência + segregação + auditoria).

> Nenhum item é **F5**: não há backend, autenticação, autorização server-side nem
> persistência remota em ponto algum do repositório.

## Núcleo / plataforma

| ID | Módulo | Funcionalidade | Classe | Evidência | Dependência p/ avançar |
|---|---|---|---|---|---|
| C1 | Shell | Navegação por grupos, escopo por permissão | F3 | `components/layout/Sidebar.tsx`, `app/modules.ts` | — |
| C2 | Org selector | Trocar organização ativa | F3 | `Sidebar.tsx` `switchOrganization`; `store` linha ~230 | Backend valida tenant (GAP-F) |
| C3 | Profile switcher | Trocar papel (impersonation) | F2 | `store.switchProfile` (l.220), `Topbar.tsx:34,132` | Remover em prod; auth real |
| C4 | Tema | Claro/escuro | F3 | `store.toggleTheme`, `styles/tokens.css` | — |
| C5 | Idioma | pt-BR/en-US | F3 | `i18n/index.ts` (localStorage), 2 locales completos | — |
| C6 | Command palette | ⌘K busca módulos/ações | F3 | `components/CommandPalette.tsx`; `e2e/command-palette.spec.ts` | — |
| C7 | Tour | Modo demonstração | F1 | `components/TourOverlay.tsx` (passos estáticos, sem persistência) | Decisão de produto |
| C8 | Assistente contextual | Fatos/próximo passo determinístico | F3 | `components/layout/AssistantPanel.tsx` (lê store) | — |
| C9 | Notificações | Lista + marcar lida | F2 | `Topbar.tsx` `markNotificationsRead`; seed `notifications` | Feed real (backend) |
| C10 | Busca global | Campo de busca | F1 | `Topbar.tsx` — abre a ⌘K; sem busca textual real | Índice/back |

## Operações

| ID | Módulo | Funcionalidade | Classe | Evidência | Dependência p/ avançar |
|---|---|---|---|---|---|
| O1 | Visão geral | KPIs + operações recentes | F3 | `features/dashboard/DashboardPage.tsx` (store escopado) | — |
| O2 | Catálogo | Lista + filtros por estado | F3 | `features/operations/OperationsPage.tsx` | — |
| O3 | Detalhe | Ver etapas/resultado/controle | F3 | `features/operations/OperationDetailPage.tsx` | — |
| O4 | Wizard (20 etapas) | Bloqueadores + publicação | F3 | `wizard/WizardPage.tsx`, `domain/operation-blockers.ts`; `e2e/wizard.spec.ts` | Ver §wizard: maioria das etapas é F1 |
| O5 | Wizard — campos das etapas | Configurar objetivo/gatilhos/etc. | F1 | `WizardPage.tsx` `StepBody` — só ~7 de 20 etapas têm campos funcionais | Domínio+contrato por etapa (GAP-A) |
| O6 | Publicação | Cria operação v1.0, auditoria | F3 | `store.publishOperation`; `app-store.test.ts` | Persistência+regra server (GAP-C) |
| O7 | Duplicar | Rascunho a partir dos dados | F3 | `store.duplicateOperation`; teste | — |
| O8 | Versões | Listar + comparar lado a lado | F3 | `OperationDetailPage.tsx`, `VersionCompareDialog.tsx`; seed `versions` | Imutabilidade não garantida (GAP-A) |
| O9 | Pausar/Retomar/Arquivar | Transições de estado | F3 | `store.pauseOperation/resumeOperation/archiveOperation` | Server-side (GAP-C) |

## Execução

| ID | Módulo | Funcionalidade | Classe | Evidência | Dependência p/ avançar |
|---|---|---|---|---|---|
| E1 | Execução de teste/real | Percorre `steps[]`, gera evidência, consome WU, debita orçamento, cria aprovação | F2 | `store.startExecution`; `app-store.test.ts` — **síncrono e instantâneo**, sem fila/async/retry/timeout | Engine assíncrona no backend (GAP-A/C) |
| E2 | Lista/detalhe execução | Ver etapas e consumo | F3 | `features/executions/ExecutionsPage.tsx` | — |
| E3 | Fila / máquina de estados assíncrona | queue, retry, cancel, pausa em execução | F0 | não existe; `ExecutionState` definido em `types.ts` mas transições não implementadas | Backend (GAP-A) |

## Governança / controle / autoridade

| ID | Módulo | Funcionalidade | Classe | Evidência | Dependência p/ avançar |
|---|---|---|---|---|---|
| G1 | Aprovações | Master-detail + aprovar/rejeitar/ajuste/delegar | F3 | `features/approvals/ApprovalsPage.tsx`; `store.resolveApproval` | Sem anti-self-approval, sem concorrência (GAP-F) |
| G2 | Gradientes de Autoridade | Matriz ação/sistema/condição/autoridade | F1 | `features/authority/AuthorityPage.tsx` — **display estático** do seed; "clique para alterar" não funcional; **não altera comportamento** | Ligar autoridade à execução/aprovação (GAP-A) |
| G3 | Governança/Políticas | CRUD estados + herança/versões/retenção | F3 | `features/governance/GovernancePage.tsx` (aba Retenção = placeholder F1) | Server (GAP-C) |
| G4 | Matriz de risco | Por ação + drawer | F3 | `features/risk/RiskPage.tsx`; `e2e/detail-drawer.spec.ts` | Informational; sem cálculo real |
| G5 | Exceções | Resolver/reprocessar | F3 | `features/exceptions/ExceptionsPage.tsx` | Reprocessamento é backend (GAP-A) |
| G6 | Auditoria | Central estado anterior/novo | F3 | `features/audit/AuditPage.tsx`; `store.recordAudit` | **Mutável/fabricável** no cliente (GAP-F) |
| G7 | Segurança | Tentativas negadas | F3 | `features/security/SecurityPage.tsx` (lê audit denied) | — |

## Recursos / integrações

| ID | Módulo | Funcionalidade | Classe | Evidência | Dependência p/ avançar |
|---|---|---|---|---|---|
| R1 | Work Units | Ledger + solicitar/aprovar excedente | F3 | `features/work-units/WorkUnitsPage.tsx`; `store.requestWorkUnits/approveWorkUnitRequest` | Transacional no backend (GAP-A) |
| R2 | Orçamento | Teto + consumo + editar | F3 | `features/budget/BudgetPage.tsx`; `store.setBudget` | `number` sem moeda/decimal seguro (GAP-A) |
| R3 | Ambientes | Promover/reverter | F3 | `features/environments/EnvironmentsPage.tsx` | Server (GAP-C) |
| R4 | Integrações | Conectar/testar/desconectar | F2 | `features/integrations/IntegrationsPage.tsx` — flip de estado local, **sem conexão real** | Conector real (GAP-B) |
| R5 | Contexto | Adicionar fonte/versionar | F3 | `features/context/ContextPage.tsx` | Upload/URL pré-assinada (GAP-B) |
| R6 | Arquivos/quarentena | Quarentena + 2 aprovadores | F3 | `features/files/FilesPage.tsx`; teste 2 aprovadores | Retenção/expurgo backend (GAP-B) |
| R7 | Evidências | Lista + drawer | F3 | `features/evidence/EvidencePage.tsx` | Imutabilidade backend (GAP-F) |
| R8 | Agentes | Cadastro/config/execução de agentes | **F0** | **não existe** módulo, rota, entidade nem tipo `Agent` | Definir domínio (GAP-D) |

## Pessoas / avaliação / admin

| ID | Módulo | Funcionalidade | Classe | Evidência | Dependência p/ avançar |
|---|---|---|---|---|---|
| P1 | Pessoas e equipes | Convidar/suspender/trocar papel | F3 | `features/people/PeoplePage.tsx`; ações na store | Equipes só no seed; sem tela de equipe |
| P2 | Papéis | Matriz de permissões | F1 | `features/roles/RolesPage.tsx` — display de `ROLE_PERMISSIONS`, somente leitura | Gestão real de papéis (GAP-D) |
| P3 | Resultados | Portfólio de indicadores | F1 | `features/results/ResultsPage.tsx` — 14 indicadores **estáticos** do seed; filtro de período não altera dados | Medição real (GAP-B) |
| P4 | Assessment | Lista de avaliações | F1 | `features/assessment/AssessmentPage.tsx` — seed estático | — |
| P5 | Assessment→Operação | Criar rascunho | F3 | `store.createOperationFromAssessment`; teste | — |
| P6 | Avaliador (12 etapas) | Wizard de avaliação | F1 | `features/assessment/EvaluatorPage.tsx` — UI sem persistência; recomendação hardcoded | Domínio+persistência (GAP-D) |
| P7 | Relatórios | Exportar | F2 | `features/reports/ReportsPage.tsx` — `store.exportReport` grava só auditoria; **não gera arquivo** | Geração/exportação backend (GAP-B) |
| P8 | Administração | Grade de 16 áreas | F1 | `features/admin/AdminPage.tsx` — cards estáticos com links | — |
| P9 | Organizações/Config | Tela de administração de org | F0/F1 | rota `/organizations` **redireciona** a `/admin`; sem tela própria | Definir (GAP-D) |

## Camada de dados / segurança

| ID | Componente | Classe | Evidência | Dependência p/ avançar |
|---|---|---|---|---|
| D1 | MockDataProvider | F3 | `services/providers.ts` (memória) | — |
| D2 | IndexedDbDataProvider (Dexie) | F3 | `services/providers.ts`, `services/db.ts` | — |
| D3 | ApiDataProvider.load | F4 | `services/providers.ts`; `providers.test.ts` — **não chamado no bootstrap** (store usa `emptySnapshot` em modo api) | Ligar ao bootstrap + backend |
| D4 | ApiOperationsRepository / Approvals / Files | F4 | `services/repositories/*`; `repositories.test.ts` — **nenhum componente os usa** | Ligar UI ao container + backend |
| D5 | StoreOperationsRepository | F3 | `services/repositories/operations-store.ts` — não usado pela UI | — |
| D6 | Motor de permissões `can()` | F3 | `domain/permissions.ts`; `permissions.test.ts` — **somente cliente** | Reavaliar no servidor (GAP-F) |
| D7 | Trilha de auditoria | F3 | `store.recordAudit` — array em memória, mutável | Append-only server (GAP-F) |
| D8 | Autenticação / sessão / MFA | **F0** | inexistente (grep sem `login`/`getSession`/`jwt`) | Backend (GAP-A) |
| D9 | Multitenancy | F2 | `hooks/use-session.ts` `useScopedData` filtra por `organizationId` **no cliente** | Isolamento no servidor (GAP-F) |

## Contagem

| Classe | Qtde (itens desta matriz) |
|---|---|
| F0 — Ausente | 4 (E3, R8, D8, e P9 parcial) |
| F1 — Visual | 12 |
| F2 — Simulada | 6 |
| F3 — Local | 22 |
| F4 — Integrável | 2 grupos (D3, D4) |
| F5 — Produção | 0 |

Observação: os totais consolidados por *funcionalidade de negócio* (não por linha
desta tabela) constam no resumo final. A leitura essencial é: **o produto é hoje um
frontend local (F3) com contratos integráveis (F4) e sem nenhuma camada de produção
(F5=0)**.
