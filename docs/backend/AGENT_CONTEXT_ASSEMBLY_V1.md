# Montagem de contexto v1 (ARDEN-BE-007.3 §12)

Escopo MÍNIMO: `execution input` + `objective` + `system instructions`. Uma mensagem USER
com o objetivo e o input REDIGIDO (`SensitiveDataRedactor`). `tools = []`.

Aplicado: validação do input contra `inputSchema` (no runtime); `maximumContextBytes` e
`maximumInputTokens` (estimativa `ceil(bytesUTF8/4)`); redação de campos sensíveis. NÃO
inclui: secrets, env vars, vault, dados de outro tenant, outputs de outras etapas, tools,
documentos, RAG, memória — **adiado para 007.4**.

Sinais de segurança (§31) mínimos e determinísticos: marcador explícito de exfiltração
(`__ardenInjectionProbe`) → sinal CRITICAL BLOQUEADO (`AGENT_PROMPT_INJECTION_DETECTED`);
frases explícitas de override/disclosure → sinal registrado (não bloqueia). Guardrails
completos e isolamento de tool result ficam para 007.4.
