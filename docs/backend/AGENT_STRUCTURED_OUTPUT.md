# Saída estruturada do agente (ARDEN-BE-007, auditoria)

> O primeiro milestone EXIGE saída estruturada. Texto livre não é resultado válido.

## 1. Regras (§20)

- Toda `AgentVersion` declara um `outputSchema` (JSON Schema serializável, como os
  schemas de ferramenta do BE-006).
- O output do modelo é validado contra o schema com o **mesmo validador determinístico**
  do BE-006.6 (`json-schema-validator`: type/required/properties/additionalProperties/
  enum/items). Nenhum validador novo.
- **Retry de correção LIMITADO**: em output inválido, o executor pode reenviar ao modelo
  com o erro do schema, no máximo `N` vezes (ex.: 1–2), dentro dos limites do loop.
  Esgotado → falha segura `AGENT_OUTPUT_INVALID`.
- **Output inválido NUNCA vira sucesso silencioso** (mesma regra de `TOOL_OUTPUT_INVALID`
  do BE-006.6).
- Limite de tamanho de output (`maximumOutputTokens`); excedido → falha segura.

## 2. Evidência

Registra: `outputSchemaHash`, `outputHash` (do output ACEITO), `correctionRetries`,
`accepted: boolean`, e um resumo/hash do output original vs aceito. Nunca campos
sensíveis. Reusa `EvidenceRecord` do BE-005.

## 3. Falha segura

`AGENT_OUTPUT_INVALID` é NÃO-retryável pelo motor (entra em `NON_RETRYABLE_CODES` como os
códigos de validação do BE-006). A etapa fica FAILED; a execução segue a saga do BE-005.
