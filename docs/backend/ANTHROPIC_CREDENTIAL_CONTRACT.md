# Contrato de credencial Anthropic (ARDEN-BE-008.1)

> Contrato/schema apenas — **não persistido nesta fase** (`implementationStatus=CONTRACT_ONLY`,
> `status=DISABLED`). Credencial tenant-managed reusando o cofre do BE-006. Connector
> `system.anthropic`. Fonte de fatos: `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`.

## 1. Input write-only

```
AnthropicCredentialInput { apiKey: string }   // header x-api-key da API (VERIFIED: SDK usa API key)
```

`apiKey` é **write-only**: entra pela criação/rotação e nunca sai. Não há campo de leitura,
nem eco em resposta, nem projeção em config. É credencial, não parâmetro.

## 2. Cofre BE-006 (reuso obrigatório, sem cofre paralelo)

A key vive em `organization_connections` + `connection_credential_versions` (BE-006), cifrada
AES-256-GCM, resolvida server-side pelo `CredentialResolver` (BE-006.4). Recursos reusados:

- **versões**: cada create/rotate cria uma nova versão de credencial;
- **rotação**: nova versão ativa; a anterior deixa de ser ativa;
- **revogação**: crypto-shredding; `ModelConfiguration` apontando para conexão revogada falha;
- **ativa**: apenas a versão ativa é resolvida na chamada;
- **resolução server-side**: key materializada imediatamente antes do request e descartada;
- **fingerprint**: identificação não reversível da versão (sem expor o segredo).

`ModelConfiguration.credentialConnectionId` aponta para a `organization_connection` (mesmo
tenant). Recomenda-se uma connector definition `system.anthropic` para o create/rotate/revoke
reusar coerentemente o ciclo do BE-006.

## 3. Estratégia: tenant-managed

A org fornece a própria API key da Anthropic (fatura direta com o provider, sem markup no
MVP). Falha de key (inválida/sem crédito) é erro do tenant, isolado por org — não incidente
global. platform-managed fica para fase futura (`COMMERCIAL_PROVIDER_CREDENTIAL_MODEL.md`).

## 4. NUNCA

- key retornada em qualquer resposta ou persistida no frontend;
- key em `ModelConfiguration.parameters` (é credencial);
- key logada (log estruturado ou métrica);
- key persistida em config, prompt, job, evidência ou trilha de auditoria;
- env var global como ÚNICA solução multi-tenant (não isola nem versiona).

Auditam-se apenas os eventos de connection/credencial do BE-006 (create/rotate/revoke) e
`catalog_hash`/config — a key em si nunca aparece.

## 5. Fase atual

Nada é gravado agora: apenas o contrato do input e o mapeamento ao cofre estão fixados. A
persistência e o wiring do connector `system.anthropic` chegam quando o provider for
habilitado (pós-008.2).
