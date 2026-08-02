# Validação de saída estruturada (ARDEN-BE-007.3 §16)

`AgentOutputValidator` reutiliza o validador JSON Schema determinístico do BE-006.6 (subset
fechado: type/required/properties/enum/items/additionalProperties; sem `$ref`, sem código).
Valida a `structuredOutput` do provider contra `AgentVersion.outputSchema` e impõe
`maximumOutputBytes` (derivado de `maximumOutputTokens`). Output inválido ou grande demais
→ `valid=false` com `validationErrors` — **nunca** tratado como sucesso. Sucesso exige
`acceptedOutput` válido (`SUCCEEDED` só com output presente, por invariante de resultado).
