# Anthropic — provider de modelo executável (ARDEN-BE-008.3)

> `AnthropicModelProvider` implementa `ModelProvider` e torna o provider **executável** — mas
> só atrás de feature gate e sem chamada real nesta fase. Integração **provider-neutra**: o
> runtime não conhece "anthropic". Fonte: `anthropic-model-provider.ts`.

## 1. Identidade

| Item | Valor |
| --- | --- |
| Classe | `AnthropicModelProvider` |
| Arquivo | `apps/api/src/agents/providers/anthropic/anthropic-model-provider.ts` |
| Chave | `anthropic.direct` |
| Versão | `1` |
| Conector de sistema | `system.anthropic` |

## 2. Integração provider-neutra (ARCHITECTURAL_DECISION)

O runtime chama `generate(request, context)` sem nenhum `if provider === 'anthropic'`. O
`context` é o `ModelGenerationContext` — **não-secreto**:

```
ModelGenerationContext = {
  organizationId, modelConfigurationId, credentialConnectionId,
  correlationId, deadlineMs
}
```

Nenhum segredo trafega no contexto: a resolução de credencial é um **seam** interno do
provider (§4), não uma responsabilidade do runtime.

## 3. Fluxo de `generate`

1. **rejeitar tools reais** (§26 do BE-007): tool calling não é suportado nesta fatia → erro;
2. **rejeitar `modelId` fora do allowlist** (catálogo fechado);
3. **checar compatibilidade de schema** (`anthropic-schema-compatibility.ts`: rejeita `$ref`,
   profundidade/propriedades/tamanho excessivos — ver structured output doc);
4. **resolver credencial tenant-scoped** (§4) → apiKey em memória;
5. **mapear request** (reusa o mapper puro do 008.1): structured output via tool sintética
   forçada `arden_structured_output`, `system` separado (ver request security doc);
6. **loop de retry** próprio do adapter (retry do SDK desligado — ver retry doc);
7. **mapear response/usage** (ver response security e usage docs);
8. **descartar a apiKey** (best-effort; limitação de zeroização do JS documentada).

## 4. Seam de resolução de credencial

`anthropic-provider-credential.resolver.ts` (ver §5 de request security / governança):

- lookup da conexão **tenant-scoped** (cross-tenant → not found);
- `connector key` deve ser `system.anthropic`;
- resolve a credencial **ACTIVE** no SecretVault (BE-006), lê `apiKey` em memória, descarta;
- **nunca** busca conexão só por id, sem escopo de tenant.

## 5. Sem execução de tool (VERIFIED)

Nenhuma tool real é enviada nem executada por este provider nesta fatia. Um `stop_reason =
tool_use` que corresponde à tool sintética de structured output é normalizado para
`finishReason = STOP` (não `TOOL_CALL`) — a saída estruturada **não** entra no pipeline de
tools. Ver `ANTHROPIC_RESPONSE_SECURITY.md`.

## 6. NUNCA

- ramificar o runtime por provider (`if provider === 'anthropic'`);
- passar segredo no `ModelGenerationContext`;
- escolher `modelId`/base URL a partir do request;
- executar tool real ou rotear a tool sintética para o pipeline de tools;
- persistir/retornar/logar a apiKey.

## 7. Estado

Provider executável: **SIM**, atrás de gate de teste/desenvolvimento. Chamada externa real:
**NÃO**. Disponibilidade em produção: **NÃO**. Ver `ANTHROPIC_RUNTIME_FEATURE_GATES.md`.

## 8. Atualização 008.5 — tool calling (OFFLINE)

O bloqueio duro de tool da Fatia 1 (§5) é **substituído**: o provider agora **traduz** tools
reais, sempre atrás de gate e reutilizando o runtime provider-neutro — mas **ainda não executa
tool** e não faz chamada real.

- **Gate:** request com tools exige não produção + `ANTHROPIC_TOOL_CALLING_ENABLED`
  (`toolCallingEnabled() = ANTHROPIC_TOOL_CALLING_ENABLED && !isProduction()`, `NODE_ENV` ao
  vivo; default false, honrado só fora de produção); senão `PROVIDER_ERROR`. Produção sempre
  `MODEL_PROVIDER_DISABLED` **antes** de mapear tools / resolver credencial / tocar o transporte.
- **Capability:** modelos Anthropic declaram `['STRUCTURED_OUTPUT','TOOL_CALLING']`, mas seguem
  `DISABLED` / `productionAllowed=false` (capability IMPLEMENTADA, não disponível em produção).
- **Provider NUNCA executa tool** — o único executor é `ExternalToolExecutor` (BE-006) no runtime;
  o provider só faz threading do codec por request no request/response mapping. Custo `null`
  (`COST_RATE_CARD_NOT_AVAILABLE`).

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT EXECUTED**.
Production: **BLOCKED**. Detalhe em `ANTHROPIC_TOOL_CALLING_RUNTIME.md` e
`ARDEN_BE_008_ANTHROPIC_TOOL_CALLING_REPORT.md`.
