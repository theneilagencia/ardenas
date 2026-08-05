# Anthropic — mapeamento de saída estruturada (ARDEN-BE-008.1)

> Mapeamento verificado sobre `@anthropic-ai/sdk@0.115.0` (ver
> `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`). Nenhum tipo do SDK escapa do domínio: o
> adapter usa tipos de transporte INTERNOS (`AnthropicTransportRequest/Response`), nunca
> tipos do SDK. Doc de auditoria — NADA de código/SDK nesta fase.

## 1. Mecanismo: structured output forçado por tool

A Messages API expõe `tools` + `tool_choice` (`auto | any | tool | none`, VERIFICADO no
`.d.ts` de messages) e o bloco de conteúdo `tool_use` (VERIFICADO). Para produzir
`ModelGenerationResult.structuredOutput` a partir de um `ModelGenerationRequest` com
`outputSchema`, o adapter usa a estratégia **tool-forced**:

- registra UMA tool de resposta cujo `input_schema` = o `outputSchema` canônico do agente;
- envia `tool_choice = { type: 'tool', name: <tool de resposta> }` para forçar a chamada;
- o `input` do bloco `tool_use` retornado É o output estruturado → vira `structuredOutput`.

O `outputSchema` canônico registrado é a FONTE DA VERDADE; o adapter adapta apenas a
REPRESENTAÇÃO enviada à Anthropic, nunca o schema canônico.

## 2. Validação server-side é a autoridade

A declaração da Anthropic (o `tool_use` "bem formado") NÃO é confiada. O backend
revalida localmente com o `AgentOutputValidatorV1` determinístico (BE-006.6/007.3):
type/required/properties/additionalProperties/enum/items + limite de bytes. Reusa
`AGENT_OUTPUT_VALIDATION.md`:

- aplicar o `outputSchema` canônico ao `structuredOutput` retornado;
- registrar `outputSchemaHash`/`outputHash` do output ACEITO (nunca payload bruto);
- output inválido **nunca** vira sucesso silencioso. O provider nunca é autoridade final.

## 3. Repair limitado e falha segura

Output inválido segue `AGENT_OUTPUT_REPAIR.md`: repair só com `retryInvalidOutput=true`,
até `maximumOutputRepairAttempts` (≤ 5), cada tentativa somando `modelCallCount`.
Esgotado → `AGENT_OUTPUT_REPAIR_EXHAUSTED`; sem repair → `AGENT_OUTPUT_INVALID`. Ambos
NÃO-retryáveis; a etapa fica FAILED (saga do BE-005).

## 4. Limitações de subconjunto de schema — UNVERIFIED

Os limites do dialeto de JSON Schema aceito em `input_schema` (tamanho, keywords
suportadas, formatos) NÃO estão nos type defs e estão atrás de docs protegidas (403) —
marcados UNVERIFIED no register. Portanto o adapter deve VALIDAR o `outputSchema` contra
a compatibilidade conhecida ANTES da chamada e REJEITAR schema incompatível de forma
determinística (nunca degradar silenciosamente). Confirmar por leitura direta antes de
008.2/008.3.
