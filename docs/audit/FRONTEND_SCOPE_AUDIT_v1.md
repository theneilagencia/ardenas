# Arden.AS — Auditoria de Escopo do Frontend (v1)

Relatório técnico. Commit `aad61e5`, branch `claude/spec-functional-reference-5wxll1`,
2026-07-30T11:35:57Z. Base: leitura de código + execução de comandos (ver
`FRONTEND_AUDIT_EVIDENCE_v1.md`). O README **não** foi usado como prova.

## 1. Visão geral do que o frontend faz hoje

O frontend é uma **SPA React 19 + TypeScript + Vite** que reconstrói o protótipo
corporativo do Arden.AS: 23 módulos de navegação, sistema de design fiel, i18n
pt-BR/en-US e PWA. **Toda a lógica de negócio roda no cliente** e a persistência é
**local** (Zustand + IndexedDB via Dexie). Existe uma camada de contratos de dados
(`services/`) pronta para HTTP, porém **não conectada à interface**. Não há
autenticação, autorização de servidor, execução assíncrona real nem isolamento de
tenant server-side.

Classificação global: **F3 (local) com contratos F4 (integráveis) e F5 (produção) = 0**.

## 2. Rotas e navegação

Ver tabela completa em `FRONTEND_BACKEND_CONTRACT_MAP_v1.md §1`. 30 rotas + index +
catch-all; 23 no menu (`app/modules.ts`), agrupadas em Operação/Resultado/Controle/
Avaliação/Empresa. `/roles` e `/budget` são deep links fora do menu; `/policies` e
`/organizations` redirecionam. Nenhuma rota quebrada; todas atrás de
`RequirePermission` — **proteção apenas de interface**.

## 3. Auditoria por módulo (resumo; detalhe/evidência na matriz)

Para cada módulo: propósito → estado real → fonte de dados → dependência de backend.
Detalhamento por funcionalidade em `FRONTEND_FEATURE_MATRIX_v1.md`.

- **Visão geral** — KPIs reais da store escopada. F3. Fonte: store. Backend: leitura agregada.
- **Operações (catálogo/detalhe)** — CRUD/estados locais. F3. Backend: persistência+regra.
- **Wizard** — ver §4. Parcial. Backend: definição executável + validação server.
- **Execuções** — ver §5. F2 (síncrono). Backend: engine assíncrona (obrigatório).
- **Aprovações** — master-detail + decisão local; sem anti-fraude. F3. Backend: regra+vínculo à versão.
- **Resultados** — indicadores estáticos do seed; filtro de período inócuo. F1. Backend: medição.
- **Evidências** — lista/drawer a partir da store. F3. Backend: imutabilidade/retenção.
- **Exceções** — resolver/reprocessar local. F3. Backend: reprocessamento real.
- **Work Units** — ledger + excedente local. F3. Backend: transacional.
- **Gradientes de Autoridade** — ver §6. F1 (não altera comportamento).
- **Governança/Políticas** — CRUD estados + herança/versões; Retenção placeholder. F3. Backend: fonte da verdade.
- **Matriz de risco** — por ação, drawer. F3 informativo.
- **Contexto** — adicionar/versionar local. F3. Backend: upload/versionamento.
- **Integrações** — conectar/testar = flip local. F2. Backend: conectores reais.
- **Arquivos/quarentena** — quarentena + 2 aprovadores (real, local). F3. Backend: retenção/expurgo.
- **Assessment/Avaliador** — lista estática + wizard sem persistência. F1. Backend/produto.
- **Implantação** — 16 etapas com trava sequencial (real, local, testada). F3.
- **Pessoas e equipes** — convidar/suspender/papel local; equipes só no seed. F3.
- **Papéis** — matriz read-only de `ROLE_PERMISSIONS`. F1.
- **Segurança** — tentativas negadas da auditoria. F3.
- **Ambientes** — promover/reverter local. F3.
- **Auditoria** — central estado anterior/novo; **mutável**. F3.
- **Relatórios** — exportar = só evento de auditoria. F2.
- **Administração** — grade estática de 16 áreas. F1.
- **Assistente contextual** — determinístico, lê store. F3.
- **Notificações** — seed + marcar lida. F2.
- **Agentes** — **ausente (F0)**. Sem entidade, tipo ou tela.

## 4. Auditoria do Wizard de Operações

Fonte: `features/operations/wizard/new-operation.ts` (define `WIZARD_STEPS`, 20) e
`WizardPage.tsx` (`StepBody`).

**Etapas (20):** identity, classification, problem, objective, expectedResult,
recipients, deliverables, frequency, indicators, completion, owners, triggers,
context, integrations, steps, actions, approval, limits, review, publish.

| Grupo de etapas | Campos funcionais? | Persistência |
|---|---|---|
| identity, expectedResult, owners, integrations, actions, approval, limits (7) | **Sim** — inputs reais que alimentam os bloqueadores | rascunho na store (`DRAFT_ID`) |
| review, publish (2) | Lógica (lista bloqueadores / publica) | — |
| classification, problem, objective, recipients, deliverables, frequency, indicators, completion, triggers, context, steps (11) | **Não** — renderizam o placeholder genérico | não configuram nada |

**Comportamentos verificados:** trilho clicável; salvar rascunho persiste e é
retomável (hidrata de `DRAFT_ID` no mount); a etapa 19 (review) lista os 8
bloqueadores; o botão publicar fica **desabilitado** enquanto houver bloqueador
(`e2e/wizard.spec.ts`, `domain/operation-blockers.test.ts`). Publicar gera versão 1.0,
entra no catálogo e grava auditoria (`store.publishOperation`, `app-store.test.ts`).

**Campos que não têm efeito:** os 11 grupos de placeholder — objetivo, gatilhos,
entradas/saídas, etapas configuráveis, indicadores, critérios de conclusão etc. — não
são coletados nem persistidos; a operação publicada usa apenas os campos das 7 etapas
funcionais + defaults do `emptyOperation`.

**Resposta explícita:** o wizard cria uma **configuração parcial persistível**
(identidade, responsável, ambiente, orçamento, evidência, integrações, ação/autoridade,
aprovadores) com **bloqueio real de publicação**, mas **não** uma definição
operacional executável completa: gatilhos, entradas/saídas, etapas de execução,
indicadores e critérios não são configuráveis. É mais que visual, menos que executável.

## 5. Auditoria de Execuções

Fonte: `store.startExecution`. Ao iniciar: cria objeto em `executions`, vincula à
operação e `version`, **percorre `op.steps` de forma síncrona e instantânea**, gera
uma evidência por etapa, soma Work Units, debita orçamento da área, cria `Approval` se
a etapa exige, define estado final `awaiting_approval` ou `completed`, e grava dois
eventos de auditoria. Testado em `app-store.test.ts`.

**Não implementado (F0):** fila, processamento assíncrono, etapas paralelas, retries,
timeout, idempotência, pausa/cancelamento **durante** a execução, rollback/compensação,
escalonamento, polling/websocket. O enum `ExecutionState` (`preparing…cancelled`)
existe em `types.ts`, mas as transições não são exercidas.

**Máquina de estados (real vs. definida):**

| Estado | Entrada | Próximos | Regra | Persistência | Implementação |
|---|---|---|---|---|---|
| (n/a preparing) | — | — | — | — | não usado |
| running→completed | `startExecution` sem etapa de aprovação | completed | soma WU/orçamento | store | síncrono |
| running→awaiting_approval | etapa `execute_with_approval` | awaiting_approval | cria Approval | store | síncrono |
| paused/exception/failed/cancelled | — | — | — | — | **não implementados** |

**Resposta explícita:** o frontend **simula** o resultado de uma execução (calcula
estados finais na hora) e apresenta telas; **não executa** uma operação real nem
modela o ciclo assíncrono. Toda a lógica de execução deve migrar para o backend.

## 6. Auditoria dos Gradientes de Autoridade

Fonte: `features/authority/AuthorityPage.tsx`, `domain/seed.ts` (`AUTHORITY_MATRIX`),
`domain/types.ts` (`AuthorityLevel`).

Cinco níveis (`observe`, `prepare`, `execute_under_rule`, `execute_with_approval`,
`blocked`) e uma matriz de 12 ações (ação/sistema/condição/reversível/risco/autoridade)
exibida como **tabela estática do seed**. O texto "clique para alterar" aparece mas
**não há edição**.

| Gradiente | Informativo | Altera UI | Altera regra | Exige aprovação | Bloqueia | Auditoria |
|---|---|---|---|---|---|---|
| Todos | Sim | parcial (wizard: bloqueador de autoridade destrutiva) | **não** | apenas via `step.requiresApproval` no wizard/execução | **não** | não |

O único ponto onde a autoridade tem efeito é o **bloqueador** do wizard
(`authority_incoherent`: ação destrutiva abaixo de `execute_with_approval` impede
publicação) e a criação de aprovação por etapa. A **matriz do módulo não altera
comportamento** — é informativa. Ligar autoridade a execução/aprovação/limites é
trabalho de backend (GAP-11).

## 7. Papéis e permissões

Fonte: `domain/permissions.ts` (`ROLE_PERMISSIONS`, `can()`), `RequirePermission.tsx`,
`hooks/use-session.ts`, `permissions.test.ts`.

`can({action, session, subject})` verifica: suspenso → nega tudo; permissão do papel;
cross-organization (subject.organizationId ≠ sessão); cross-company (proprietário em
empresa alheia). Os 9 cenários de bloqueio são testados. A proteção cobre rota
(`RequirePermission`), botão e campo (checagens `can(...)` nas telas).

> **Declaração obrigatória:** toda a autorização é **client-side** e, portanto,
> **insuficiente para produção**. Deve ser revalidada no backend a cada request.

**Vetores de burla no estado atual:** `switchProfile` troca o papel em memória
(impersonation de demonstração, atrás de flag); acesso direto por URL depende só do
`session` local; nenhuma verificação carrega tenant validado; o contrato não exige
autorização. Divergências menu↔rota↔botão não foram encontradas (todas derivam do
mesmo `MODULES`/`can()`), mas isso não substitui a barreira de servidor.

## 8. Multitenancy

Fonte: `hooks/use-session.ts` (`useScopedData`), `store` (`organizationId`,
`switchOrganization`), `domain/types.ts`.

O tenant ("organização ativa") é selecionado no `Sidebar` (cicla entre organizações),
armazenado no `store.organizationId`, e os dados são **filtrados no cliente** por
`organizationId`. Entidades operacionais carregam `organizationId`/`companyId`; algumas
entidades auxiliares (Team, CostCenter, Unit, Area) não carregam tenant diretamente.

| Entidade | Campo de tenant | Filtro aplicado | Local da regra | Risco |
|---|---|---|---|---|
| Operation/Execution/Approval/… | `organizationId` | `useScopedData` (cliente) | frontend | vazamento se o backend confiar no cliente |
| Team/CostCenter | via `areaId` | indireto | — | vínculo frouxo |

**Não há multitenancy real** — é segregação visual. O backend deverá impor isolamento
por request e **não confiar** no `X-Arden-Organization` enviado (GAP-03).

## 9. Serviços e providers

Ver `FRONTEND_BACKEND_CONTRACT_MAP_v1.md §3`. Pontos-chave: `ApiClient` cobre o mapa
de erro 400–503 e header de organização; `ApiDataProvider.load` monta o snapshot dos
endpoints (testado com fetch mockado) mas **não é chamado no bootstrap** em modo api;
repositórios de escrita existem para 3 domínios e **nenhuma tela os consome**. Nenhuma
chamada HTTP fora de `services/`. Sem WebSocket/EventSource/polling. Sem retry/timeout/
idempotency/ETag.

## 10. Modelo de domínio

Fonte: `domain/types.ts`. Entidades: Organization, Company, Unit, Area, Team,
CostCenter, Person, Role, Operation (+Step/Action/Limit/Indicator/VersionEntry),
Execution (+StepResult), Approval, OperationException, Evidence, Policy, Risk,
Integration, ContextSource, ManagedFile, WorkUnitLedger, Budget, WorkUnitRequest,
AuditEvent, Deployment (+Step), AppNotification, ResultIndicator, AuthorityMatrixRow,
Assessment.

**Problemas observados:**
- Valores monetários e Work Units como `number` (ponto flutuante) — impróprio para
  dinheiro/ledger (GAP-10).
- `AuditEvent` é objeto mutável em array; sem hash/imutabilidade (GAP-05).
- `Operation.versions` não impede edição de versão publicada (GAP-06).
- Sem `Idempotency-Key`/correlation-id/optimistic-locking nos tipos de escrita.
- Entidade **Agent ausente** apesar de ser central ao produto (GAP-16).
- `Person.companyId` opcional; `Team`/`CostCenter` sem `organizationId` explícito.
- Datas como `string` ISO sem padronização de fuso; ok para leitura, frágil para regra.

Não há entidades duplicadas nem enums conflitantes evidentes; os tipos são coerentes
entre store, contratos e telas (mesmo `types.ts`).

## 11. Versionamento

`Operation.version`, `Operation.versions[]` (seed: 0.9, 1.0), `VersionCompareDialog`.

| Recurso | Tem versão | Imutável após publicar | Comparável | Restaurável | Persistência |
|---|---|---|---|---|---|
| Operação | sim | **não** (nada impede editar) | sim (dialog) | não | store |

Execução referencia `operationVersion` no momento; porém, como a operação é editável,
**uma versão publicada pode ser alterada indevidamente** (GAP-06). Sem histórico
imutável nem invalidação de aprovações após alteração.

## 12–13. Work Units, Orçamento e Custos

`WorkUnitLedger` (`contracted/used/reserved/projected/available/overage`), `Budget`
(`total/spent`), `WorkUnitRequest`. Débito na execução e crédito na aprovação de
excedente são **locais e não transacionais**; valores em `number`; alerta de 85%
apenas visual. Reconciliação/fechamento inexistentes. Tudo deve ser transacional no
backend, com moeda e unidade mínima inteira (GAP-10).

## 14. Aprovações

`store.resolveApproval` aplica decisão e grava auditoria. **Faltam:** proibição de
auto-aprovação, vínculo imutável à versão aprovada, invalidação após alteração,
proteção de concorrência/duplo-clique, expiração/escalonamento (GAP-09).

## 15. Evidências e eventos

Evidência operacional (gerada por etapa na execução) e evento de auditoria
(`recordAudit`) coexistem. Ambos são **mutáveis** no cliente (arrays em memória
persistidos localmente): podem ser alterados, apagados ou fabricados. Faltam
imutabilidade, hash, IP/user-agent, retenção e ordenação garantida (GAP-05).

## 16. Integrações e 17. Agentes

Integrações: conectar/testar/desconectar são flips de estado local — **simuladas**;
sem credenciais, OAuth, logs reais ou webhooks (GAP-13). Agentes: **ausentes** — não
há cadastro, tipo, provedor, modelo, ferramentas, execução ou controle de autoridade;
o produto os prevê, o código não (GAP-16). Nenhum segredo foi encontrado.

## 18. Segurança

- Sem tokens/chaves/segredos no código (grep negativo).
- Sem `dangerouslySetInnerHTML`/`eval`.
- `localStorage` só para idioma (sem dados sensíveis).
- Autorização e tenant **só no cliente** (GAP-02, GAP-03).
- Auditoria fabricável (GAP-05).
- Sem CSP definida no app (entregue como estático; responsabilidade do host).
- `npm audit`: 12 high em `brace-expansion` — **cadeia de dev/build**, fora do bundle
  (GAP-25). Severidade efetiva: baixa em produção.

Achados de segurança consolidados na tabela do `FRONTEND_GAPS_v1.md` (categoria F).

## 19. PWA e offline

`vite-plugin-pwa` com `registerType:'autoUpdate'`, `navigateFallback:'/index.html'`,
precache de assets; `registerSW({immediate:true})`. Dados de demonstração ficam em
IndexedDB. **Não há** limpeza de cache/IndexedDB no logout (não há logout), nem
segregação de cache por tenant, nem expiração.

**Resposta explícita:** o funcionamento offline atual **não é adequado** para um
sistema corporativo com dados sensíveis — o shell e os dados locais persistem
indefinidamente, sem vínculo a sessão/tenant (GAP-23).

## 20. Acessibilidade e responsividade

- axe (WCAG 2 A/AA) automatizado passa na tela de acesso negado (`access-denied.a11y.test.tsx`);
  demais telas **não** têm teste a11y automatizado.
- Layout usa CSS responsivo (grid/flex, `styles/shell.css` com breakpoint 900px e
  drawer mobile). Foco visível via `:focus-visible` (`styles/global.css`), `prefers-
  reduced-motion` respeitado, labels em formulários, drawers/modais via Radix (foco
  gerenciado).
- Verificação manual com leitor de tela real e contraste fino por breakpoint (1440/
  1280/1024/768/430): **NÃO COMPROVADO** nesta etapa (sem navegador interativo manual).
  Evidência disponível é o axe automático (parcial) e a estrutura semântica do código.

## 21. Dados de demonstração

Fonte única: `domain/seed.ts` (`buildSeed`) — organizações (Grupo Atlas/Horizonte),
empresas, unidades, áreas, pessoas (uma por papel + 1 suspensa), operações, execução,
aprovações (4), exceções, evidências, políticas (8), riscos, integrações, contexto,
arquivos, WU, orçamento, auditoria, implantação (16 etapas), notificações, indicadores
de resultado (14), matriz de autoridade (12), assessments (3).

| Dado | Arquivo | Uso | Risco de chegar à produção |
|---|---|---|---|
| Seed completo | `domain/seed.ts` | popular modos mock/indexeddb | **Alto** se `VITE_DATA_PROVIDER≠api` em prod; a UI **não** rotula "dados de demonstração" de forma inequívoca por registro |

A interface exibe um selo "Dados de demonstração"/"Modo demonstração" global no topo,
mas não diferencia por registro (GAP: dado de demo indistinguível de dado real em
listas). Em produção o provider deve ser `api` e o seed nunca deve ser semeado.

## 22. Comparação README × código

Ver tabela dedicada em `FRONTEND_AUDIT_EXECUTIVE_SUMMARY_v1.md §Comparação`. Em
resumo: as afirmações de estrutura (23 módulos, 20 etapas, 16 etapas de implantação,
8 perfis, 2 idiomas), de bloqueio de publicação, de 2 aprovadores e de PWA são
**comprovadas** no código/testes; as afirmações que sugerem execução/medição/
integração reais são **locais/simuladas** — o próprio README as declara como
demonstração, o que se confirma.

## 23. Matriz de prontidão para backend

| Módulo | Domínio | Contrato | UI | Testado | Pronto p/ backend |
|---|---|---|---|---|---|
| Operações/Wizard | parcial | parcial (Operations) | parcial | sim | pronto com ajustes |
| Execuções | parcial | não | sim | sim | **não** (engine async) |
| Aprovações | sim | sim (Approvals) | sim | parcial | pronto com ajustes |
| Governança/Políticas | sim | não | sim | não | pronto com ajustes |
| Autoridade | sim (enum) | não | visual | não | decisão de produto |
| Work Units/Orçamento | parcial | não | sim | parcial | pronto com ajustes |
| Arquivos | sim | sim (Files) | sim | sim | pronto com ajustes |
| Pessoas/Papéis | parcial | não | sim | parcial | pronto com ajustes |
| Auditoria/Evidências | sim | não | sim | parcial | pronto com ajustes (imutabilidade) |
| Integrações | parcial | não | simulada | não | **não** |
| Agentes | **ausente** | não | ausente | não | **decisão de produto** |
| Multitenancy/Auth | ausente | não | visual | não | **não** (bloqueador) |

## 24. Primeiro marco

Marco: *usuário autenticado acessa sua organização, cria operação, cria versão, define
Gradiente de Autoridade, publica versão e consulta auditoria sem ver outra organização.*

| Capacidade | Frontend atual | Gap | Correção antes do backend |
|---|---|---|---|
| Autenticar | ausente | GAP-01 | definir auth/sessão |
| Acessar sua organização | filtro client-side | GAP-03 | isolamento server |
| Criar operação | wizard parcial | GAP-12 | completar campos essenciais |
| Criar versão | local, editável | GAP-06 | imutabilidade |
| Definir Gradiente | matriz visual | GAP-11 | ligar autoridade à regra |
| Publicar versão | local + bloqueadores | GAP-07/08 | rotear ao contrato/servidor |
| Consultar auditoria | local, mutável | GAP-05 | log append-only |
| Não ver outra org | filtro visual | GAP-03 | segregação server |

**Suporte ao marco: PARCIALMENTE.** As telas e o fluxo existem e são navegáveis
localmente, mas nenhuma das garantias de segurança/imutabilidade/isolamento é real —
todas dependem do backend v1.

## 25. Preservação do frontend

O frontend **pode ser preservado** como camada de apresentação: arquitetura coerente,
tipos compartilhados, contratos e container prontos para receber implementações HTTP,
design consistente, testes verdes. As refatorações necessárias são **de integração e
segurança** (rotear escrita ao contrato, remover impersonation, completar wizard,
ligar autoridade), não estruturais. Não há necessidade de reescrever a UI.
