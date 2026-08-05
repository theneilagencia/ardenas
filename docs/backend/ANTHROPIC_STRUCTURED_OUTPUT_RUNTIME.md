# Anthropic — structured output em runtime (ARDEN-BE-008.3)

> O fluxo de saída estruturada executado em runtime. O **backend é a autoridade**: a
> declaração do provider nunca é confiada; o output é revalidado localmente contra o schema
> canônico. Reusa `ANTHROPIC_STRUCTURED_OUTPUT_MAPPING.md` e `AGENT_OUTPUT_VALIDATION.md`.

## 1. Pipeline (VERIFIED)

```
outputSchema canônico
  → checagem de compatibilidade (§3)
  → mapeamento (tool sintética forçada)  → provider
  → parse do input do tool_use
  → validação local (JSON Schema determinístico)
  → repair existente (se inválido)  →  aceito | falha segura
```

1. **schema canônico**: o `outputSchema` da `AgentVersion` é a fonte da verdade;
2. **compatibilidade** (§3) antes de qualquer chamada;
3. **mapeamento**: tool sintética `arden_structured_output`, `tool_choice` forçado, `system`
   separado, `tools` reais `= []` (ver `ANTHROPIC_REQUEST_SECURITY.md`);
4. **parse**: o `input` do bloco `tool_use` retornado é o output candidato;
5. **validação local** (§2);
6. **repair** existente (§4).

## 2. Validação local é a autoridade

A afirmação do provider (o `tool_use` "bem formado") **não** é confiada. O backend revalida
com o validador determinístico (BE-006.6/007.3): type/required/properties/
additionalProperties/enum/items + limite de bytes.

- aplica o `outputSchema` canônico ao output retornado;
- registra `outputSchemaHash`/`outputHash` do output **ACEITO** (nunca payload bruto);
- output inválido **nunca** vira sucesso silencioso.

## 3. Limites de compatibilidade de schema (ARCHITECTURAL_DECISION)

`anthropic-schema-compatibility.ts` rejeita, de forma determinística, **antes** da chamada,
schema incompatível:

| Limite | Regra |
| --- | --- |
| `$ref` | rejeitado |
| profundidade | acima do limite → rejeitado |
| nº de propriedades | acima do limite → rejeitado |
| tamanho | acima do limite → rejeitado |

O dialeto de JSON Schema aceito pelo provider em `input_schema` permanece **UNVERIFIED** (docs
sob 403); por isso o adapter valida contra a compatibilidade conhecida e rejeita — nunca
degrada silenciosamente.

## 4. Repair limitado e falha segura

Reusa `AGENT_OUTPUT_REPAIR.md`: repair só com `retryInvalidOutput=true`, até
`maximumOutputRepairAttempts` (≤ 5), cada tentativa somando `modelCallCount`. Esgotado →
`AGENT_OUTPUT_REPAIR_EXHAUSTED`; sem repair → `AGENT_OUTPUT_INVALID`. Ambos **não**-retryáveis.

## 5. NUNCA

- confiar na validação do provider como autoridade final;
- deixar schema incompatível seguir para o provider;
- aceitar output inválido como sucesso;
- persistir payload bruto do output (só hashes do output aceito).
