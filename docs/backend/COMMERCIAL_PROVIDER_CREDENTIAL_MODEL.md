# Credencial de provider comercial (ARDEN-BE-008, auditoria)

> Primeiro provider comercial (candidato líder: Anthropic Claude — REQUER VERIFICAÇÃO
> EXTERNA de SDK/endpoints/limites na implementação). Este doc é AUDITORIA, sem código.

O provider comercial precisa de uma API key por tenant. Ela é **credencial**, não
parâmetro: vive no cofre AES-256-GCM do BE-006, versionada, rotacionável e revogável,
resolvida server-side. `ModelConfiguration.credentialConnectionId` já aponta para essa
camada (uma linha `organization_connections` do BE-006). A resposta NUNCA ecoa o segredo.

## Estratégias

### tenant-managed (RECOMENDADA no início)
A org fornece a própria API key do provider.

- **segurança**: key isolada por tenant no cofre (BE-006.4); crypto-shredding na revogação.
- **custo**: responsabilidade 100% da org (fatura direta com o provider). Sem repasse.
- **onboarding**: org cria `organization_connection` + credencial (create/rotate) e uma
  `ModelConfiguration` apontando para ela. Sem provisionamento pela plataforma.
- **operação**: falha de key (inválida/sem crédito) é erro do tenant, não incidente global.
- **rate limits**: cota do provider é por conta do tenant; isolada entre orgs.
- **isolamento**: total — uma key por org, sem raio de explosão cruzado.
- **monetização futura**: nenhuma no MVP (sem markup); Arden cobra só a plataforma.
- **suporte**: Arden orienta configuração; problemas de billing/cota são com o provider.
- **auditoria**: eventos de connection/credencial do BE-006 (create/rotate/revoke) +
  `catalog_hash`/config; a key em si nunca aparece em log/evidência.

### platform-managed (fase futura)
Arden fornece a key e controla o consumo (revenda/markup, cota por tenant).

- **segurança**: key da plataforma (segredo único de alto valor) — raio de explosão amplo.
- **custo**: Arden paga o provider e repassa; exige medição/limite/faturamento por tenant.
- **onboarding**: transparente para a org (sem key própria), mas exige controle de cota.
- **operação**: incidente na key é GLOBAL (afeta todos os tenants); exige rotação rápida.
- **rate limits**: cota compartilhada — precisa de particionamento/enforcement por tenant.
- **isolamento**: fraco por padrão; depende de quotas e atribuição de custo confiáveis.
- **monetização futura**: habilita markup/planos — mas é monetização prematura no MVP.
- **suporte**: Arden é o único ponto de contato (mais carga operacional).
- **auditoria**: além do BE-006, exige trilha de consumo/atribuição por tenant.

**Recomendação**: começar **tenant-managed** — responsabilidade de custo clara, isolamento
por org e sem monetização prematura. platform-managed fica para quando houver medição e
faturamento por tenant maduros.

## Reuso obrigatório (sem cofre paralelo)
A credencial DEVE usar SecretVault + versões de credencial + rotação + revogação +
resolução server-side (`CredentialResolver`, BE-006.4), sobre `organization_connections`
+ `connection_credential_versions` do BE-006. NÃO criar vault/tabela paralela.
Recomenda-se criar uma **connector definition** para o provider comercial, para que
connection + credencial reusem coerentemente o catálogo/ciclo do BE-006.

## NUNCA
- key persistida no frontend ou ecoada em resposta;
- key em `ModelConfiguration.parameters` (é credencial, não parâmetro);
- env var global como ÚNICA solução multi-tenant (não isola nem versiona);
- key em prompt, job, evidência, ou log de auditoria.
