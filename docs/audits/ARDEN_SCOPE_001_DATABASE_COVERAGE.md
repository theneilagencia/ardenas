<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura de persistência

**48 modelos, 48 enums, 11 migrations.** `db:migrate:deploy` idempotente; `db:migrate:status`
up-to-date; `db:seed` re-executável (com ressalva GAP-008). `DIRECT_URL` para migrations
(conexão direta), `DATABASE_URL` para runtime.

## Grupos de modelos (todos usados)
- Fundação: IdempotencyRecord, ApplicationMetadata.
- Identidade/tenancy: User, Organization, Membership, Role, Permission, MembershipRole,
  RolePermission, UserSessionPreference, IdentityAuditEvent.
- Operações: Operation, OperationVersion, AuditEvent.
- Governança: Policy, PolicyVersion, OperationPolicyBinding, ApprovalFlow(+Step),
  ApprovalRequest, ApprovalDecision, ApprovalDelegation, ActionAuthorization.
- Execução: ExecutionRun/Step/Attempt/Event, EvidenceRecord, ExecutionJob.
- Connectors/vault: ConnectorDefinition, ConnectorToolDefinition, OrganizationConnection,
  ConnectionCredentialVersion, Organization/OperationToolBinding, WebhookEndpoint/Delivery.
- Agentes/IA: ModelProviderDefinition, ModelCatalogEntry, ModelConfiguration,
  AgentDefinition, AgentVersion, AgentRuntimeCheckpoint, AgentExecutionResult,
  AgentModelCallUsage, AgentToolCallUsage, AgentUsageRollup, ModelRateCard.

## Integridade
- **Tenant ownership**: organizationId em modelos multi-tenant; scoping em repositórios.
- **Idempotência**: IdempotencyRecord + `runIdempotentCommand`; **concorrência otimista**
  via `revision`; **row locks** `FOR UPDATE` em aprovações/execuções.
- **Sem campos sempre-null/órfãos** detectados nos caminhos auditados; catálogos projetados
  (connector/provider) semeados idempotentemente.
- **Ressalva**: seed do catálogo de permissões sofre corrida sob re-seed concorrente
  (`prisma/seed.ts:45`) — GAP-008 (test-harness), não afeta o schema.

## Execução reproduzível
Banco limpo → migrate deploy → seed×2 → suítes: **267/267 integração + 10/10 execução**.
