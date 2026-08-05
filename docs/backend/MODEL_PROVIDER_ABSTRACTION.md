# Abstração de provedor de modelo (ARDEN-BE-007, auditoria)

> Modelos são **infraestrutura substituível**. O domínio NÃO acopla a Anthropic/OpenAI/
> Bedrock/Vertex ou a um modelo específico. Uma abstração de provider + configuração de
> modelo isola o runtime.

## 1. Abstrações

```ts
interface ModelProvider {
  generate(input: ModelGenerationRequest): Promise<ModelGenerationResult>;
}
interface ModelProviderRegistry {
  get(providerKey: string): ModelProvider;   // por chave registrada (DI), nunca por texto livre
}
```

`ModelGenerationRequest` (proposto): `{ modelKey, systemInstructions, messages,
responseSchema (structured output), tools?, maxOutputTokens, temperature?, stopReason? }`.
`ModelGenerationResult`: `{ output, toolCalls?, usage: { inputTokens, outputTokens,
cachedTokens?, }, providerRequestId, stopReason }` — sem segredo, sem prompt bruto
retornado ao domínio além do necessário.

`ModelConfiguration` (persistida, tenant-scoped):
`{ id, organizationId, providerKey, modelKey, parameters (temp/topP/maxTokens),
credentialRef (cofre), status, revision }`. Versionada por referência na `AgentVersion`
(`modelConfigurationId`), como a conexão é referenciada pelo tool binding no BE-006.

## 2. Um provider real, atrás da abstração (§15)

Suportar **apenas um provider real** no primeiro milestone, atrás do `ModelProvider`.
Não implementar múltiplos por antecipação. Recomendação a validar com o dono do produto
(parcerias/stack/segurança/structured output/tool use/observabilidade/região):

- **Recomendado: Anthropic (Claude)** — este runtime já roda em Claude; oferece
  structured output (tool-use/JSON), tool calling nativo e forte alinhamento de
  segurança. Alternativas atrás da MESMA abstração: AWS Bedrock (Claude) para requisitos
  regionais/compliance. **Nenhum provider é implementado nesta etapa de auditoria.**

## 3. Credenciais do provider (§16) — reuso do cofre

As chaves de provider usam o **mesmo `SecretVault`** (AES-256-GCM, BE-006.4). **NÃO**
criar: variável global por cliente, API key no frontend, key em snapshot de operação,
key em prompt, ou outro cofre. A `ModelConfiguration.credentialRef` aponta para uma
versão de credencial cifrada; o provider a resolve **server-side** imediatamente antes
da chamada e a descarta — exatamente como o executor externo do BE-006.6 resolve o
segredo da ferramenta.

### Platform-managed vs tenant-managed (decisão de produto)
- **Platform-managed** (chave da Arden, uso rateado): simples para começar; implicação
  comercial = custo no provedor da plataforma; segurança = isolamento por tenant no
  billing/limites.
- **Tenant-managed** (chave do cliente): isola custo/limite por tenant; exige o cofre por
  tenant (já disponível).
- **Recomendação:** suportar **ambos por política explícita** por `ModelConfiguration`
  (`credentialOwner: 'PLATFORM' | 'TENANT'`), começando o slice com **tenant-managed**
  (reusa o cofre por tenant sem tocar billing). Documentar limites de custo por tenant.

## 4. Invariante

O modelo é chamado apenas pelo `AgentStepExecutor` (server-side). O provider recebe
instruções versionadas + contexto montado + schema de saída; **nunca** recebe segredo de
ferramenta, credencial de conexão, classe de executor ou URL irrestrita.
