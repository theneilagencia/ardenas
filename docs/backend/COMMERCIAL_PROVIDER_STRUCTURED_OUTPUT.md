# Saída estruturada com provider comercial (ARDEN-BE-008, auditoria)

> Primeiro provider comercial atrás da MESMA abstração `ModelProvider` (candidato
> principal: Anthropic Claude). O adapter TRADUZ de/para os tipos canônicos; nenhum
> tipo do SDK escapa do domínio. NADA de código/SDK nesta fase.

## 1. Objetivo do adapter

Garantir o contrato canônico de structured output do BE-007: dado um
`ModelGenerationRequest` com `outputSchema`, produzir um `ModelGenerationResult` com
`structuredOutput` válido — sem que o formato interno do provider vaze. O adapter é o
ÚNICO ponto que conhece o SDK; ele converte `systemInstructions`/`messages`/`tools`/
`outputSchema` para o formato do provider e o retorno de volta para os tipos canônicos.

## 2. Como obter output estruturado (opções)

O provider pode oferecer mais de um mecanismo. O adapter escolhe UM, encapsulado:

- **Tool/schema-based** — forçar o modelo a "chamar" uma ferramenta de resposta cujo
  `input` é o `outputSchema`; o argumento vira `structuredOutput`.
- **JSON schema nativo** — quando o provider aceita um response format com JSON Schema.
- **Constrained decoding** — quando o provider restringe a geração ao schema.

> REQUER VERIFICAÇÃO EXTERNA: quais desses mecanismos o provider comercial escolhido
> oferece, seus nomes de campo, limites de tamanho de schema e restrições de dialeto
> JSON Schema. Não presumir; validar na doc oficial antes de implementar.

O `outputSchema` canônico é a fonte da verdade. Se o dialeto do provider for mais
restrito que o JSON Schema aceito pelo `AgentOutputValidatorV1`, o adapter adapta a
REPRESENTAÇÃO enviada ao provider — nunca o schema canônico registrado.

## 3. Validação server-side é a autoridade

Mesmo que o provider declare o output como válido (constrained/tool-use), o backend
**revalida localmente** com o `AgentOutputValidatorV1` determinístico (BE-006.6/007.3):
type/required/properties/additionalProperties/enum/items + limite de bytes. A declaração
do provider NÃO é confiada. Regras (reusa `AGENT_OUTPUT_VALIDATION.md`):

- aplicar o `outputSchema` canônico ao `structuredOutput` retornado;
- registrar `outputSchemaHash` e `outputHash` do output ACEITO (nunca payload bruto);
- output inválido **nunca** vira sucesso silencioso.

## 4. Repair limitado e falha segura

Output inválido segue `AGENT_OUTPUT_REPAIR.md`: repair só com `retryInvalidOutput=true`,
no máximo `maximumOutputRepairAttempts` (≤ 5), cada tentativa somando `modelCallCount`.
Esgotado → `AGENT_OUTPUT_REPAIR_EXHAUSTED`; sem repair → `AGENT_OUTPUT_INVALID`. Ambos
NÃO-retryáveis; a etapa fica FAILED (saga do BE-005).

## 5. Mapeamento de stop reason → `finishReason`

O adapter mapeia o motivo de parada do provider para o enum canônico
(`STOP`|`TOOL_CALL`|`MAX_TOKENS`|`CONTENT_FILTER`|`ERROR`):

| Categoria do provider | `finishReason` canônico |
| --- | --- |
| conclusão normal / fim de turno | `STOP` |
| pedido de uso de ferramenta | `TOOL_CALL` |
| corte por limite de tokens de saída | `MAX_TOKENS` |
| bloqueio por filtro de conteúdo/segurança | `CONTENT_FILTER` |
| erro/interrupção do provider | `ERROR` |

> REQUER VERIFICAÇÃO EXTERNA: os valores literais de stop reason do provider e sua
> semântica exata. Motivo desconhecido → mapear conservadoramente para `ERROR` (nunca
> `STOP`), preservando a invariante "SUCCEEDED exige output válido".
