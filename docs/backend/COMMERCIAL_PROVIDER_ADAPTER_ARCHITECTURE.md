# Arquitetura do adapter de provider comercial (ARDEN-BE-008 · auditoria)

Como um provider comercial (Anthropic Claude, direto) se integra ao runtime SEM vazar tipos do
SDK e SEM alterar contrato/runtime/worker/frontend. Documento de arquitetura — nenhum código.

## 1. Ponto de extensão (já existe)

O runtime é provider-neutral por construção (ARDEN-BE-007.3):

```
interface ModelProvider { generate(request: ModelGenerationRequest): Promise<ModelGenerationResult> }
InMemoryModelProviderRegistry.register(provider)   // seleção por `providerKey@providerVersion`
```

Integrar o Claude = implementar `ModelProvider` num adapter e `register()`-á-lo. Nenhuma classe
vem do banco; nenhum import dinâmico por nome; `productionAllowed` decide execução em produção.

## 2. Interface do adapter

```
interface CommercialModelProvider extends ModelProvider {
  generate(request: ModelGenerationRequest, signal?: AbortSignal): Promise<ModelGenerationResult>
}
```

O adapter é a ÚNICA fronteira que conhece o SDK. **Nenhum tipo do SDK escapa** para runtime,
contexto, tool calling, avaliação, governança ou persistência — todos falam apenas
`ModelGenerationRequest`/`ModelGenerationResult` (canônicos).

## 3. Tradução (canônico ⇄ provider)

| Aspecto | Canônico (entra/sai) | Responsabilidade do adapter |
| --- | --- | --- |
| Request | `ModelGenerationRequest` (providerKey/version, modelId, systemInstructions, messages[], tools[], outputSchema?, maxInput/OutputTokens, correlationId) | montar o payload do SDK; `systemInstructions` → system; `messages` → mensagens; limites → parâmetros |
| Mensagens | `ModelMessage` (role + content) | mapear papéis e conteúdo; sem reintroduzir conteúdo externo não isolado |
| Tool definitions | `ModelToolDefinition` (alias, description, inputSchema, riskLevel) | → tool schema do provider; **nunca** enviar connectionId/credencial/URL/headers |
| Structured output | `outputSchema?` | tool/schema-based ou JSON schema nativo (ver `COMMERCIAL_PROVIDER_STRUCTURED_OUTPUT.md`) |
| Tool calls (resposta) | `ModelToolCall` (id, alias, input) | normalizar id; mapear nome→alias canônico; validar input de novo no servidor |
| Structured output (resposta) | `structuredOutput?` / `text?` | extrair; **validação é server-side** (nunca aceitar inválido como sucesso) |
| Finish reason | `STOP\|TOOL_CALL\|MAX_TOKENS\|CONTENT_FILTER\|ERROR` | mapear o stop reason do provider para o enum canônico |
| Usage | `agentUsage` (input/output/cached tokens, model/tool call count, durationMs) | mapear campos; ausente ≠ zero (ver `COMMERCIAL_PROVIDER_USAGE_AND_COST.md`) |
| Request ID | `providerRequestId?` | registrar para diagnóstico; **não** exposto ao frontend por padrão |
| Retries/timeout/abort | — | `AbortSignal`; política de retry canônica (ver `COMMERCIAL_PROVIDER_ERROR_AND_RETRY_MODEL.md`) |
| Errors | erro canônico + finishReason ERROR / status UNKNOWN | mapear erros do SDK para códigos canônicos; incerto → UNKNOWN |
| Redaction | — | segredo nunca entra no payload; nada de prompt/resposta completos em log |

## 4. Invariantes preservadas

- O modelo apenas PROPÕE tool calls; o servidor valida alias (allowlist), resolve o binding
  (BE-006), avalia autoridade (BE-004) e executa (`ExternalToolExecutor`). O adapter **não**
  executa tools nem envia segredo ao provider.
- Structured output inválido **não** vira sucesso; UNKNOWN **não** vira sucesso — o backend é a
  autoridade (repair limitado, falha segura).
- `modelId` vem só da `ModelConfiguration`/versão publicada (catálogo allowlisted) — nunca do
  request de execução, da etapa ou de outro provider.
- Credencial resolvida server-side do vault BE-006; endpoint fixado pela connector definition
  (sem override por request).

## 5. Wiring (fase de implementação, fora desta auditoria)

`CommercialModelProvider` (Nest injectable) → `register()` no `InMemoryModelProviderRegistry`
com `productionAllowed=true` e catálogo de modelos próprio → `SecureHttpClient`/transporte do
SDK sob a política de rede da connector definition → credencial via `CredentialResolver` (BE-006).
Sem fila nova; sem worker novo; sem alteração de OpenAPI.

## 6. Desacoplamento futuro

Bedrock/OpenAI/Vertex entram como novos adapters implementando a MESMA interface, registrados
por `key@version`. Nenhuma camada de roteamento multi-provider é criada agora (evita
acoplamento e complexidade prematura). Ver `COMMERCIAL_MODEL_PROVIDER_DECISION.md`.
