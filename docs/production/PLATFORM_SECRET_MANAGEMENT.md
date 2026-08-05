<!-- Milestone: ARDEN-PRD-001.1B -->
# ARDEN-PRD-001.1B — Gestão de secrets de plataforma

Fronteira neutra em `apps/api/src/security/platform-secret-source.ts`.

- **Catálogo FECHADO** `PlatformSecretName` (sem string arbitrária).
- **Contrato** `PlatformSecretSource` (`getRequiredSecret`/`getOptionalSecret`) →
  `ResolvedPlatformSecret { value, version?, source }` (só metadata segura; `value` nunca
  serializado/logado/persistido).
- **EnvironmentPlatformSecretSource**: lê de um mapa (`process.env`) só para local/test/CI;
  valor vazio = ausente (não silencioso); sem fallback para arquivo.
- **createPlatformSecretSource** (fail-closed): produção + `environment` sem aprovação
  explícita → FALHA; `external` sem adapter → FALHA; `external` com adapter → usa o adapter.

**Separação:** platform secrets (banco, master key, wrapping key, JWT, observabilidade) ≠
tenant-managed secrets (credenciais de conector, cifradas pelo SecretVault). Os últimos
**não** passam por esta fronteira.

**Nenhum fornecedor de nuvem escolhido.** Decisão registrada como
`PRODUCTION_SECRET_MANAGER_DECISION: REQUIRES_EXTERNAL_DECISION` — o adapter externo é um
ponto de extensão (`externalAdapter`), a ser implementado quando houver decisão versionada.
