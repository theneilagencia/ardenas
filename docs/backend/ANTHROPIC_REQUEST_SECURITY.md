# Anthropic — segurança do request ao provider (ARDEN-BE-008.3)

> O que **é** e o que **nunca é** enviado ao provider quando o request é composto em runtime.
> Reusa o mapper puro do 008.1 (`ANTHROPIC_REQUEST_RESPONSE_MAPPING.md` /
> `ANTHROPIC_STRUCTURED_OUTPUT_MAPPING.md`); esta fase apenas o executa atrás de gate.

## 1. O que É enviado (controle da Arden)

- **instruções de sistema** versionadas da `AgentVersion` — enviadas como campo `system`
  **separado**, nunca embutidas nas mensagens do usuário;
- **mensagens/contexto redigidos** pelo runtime (BE-007), conteúdo não confiável rotulado
  como dado;
- **schema de saída** (structured output), representado como tool sintética forçada (§3);
- parâmetros allowlisted (`max_tokens`, `temperature`, `top_p`, `top_k`, `stop_sequences`).

## 2. O que NUNCA é enviado (VERIFIED)

- **API key** da Anthropic — só existe em memória no contexto de transporte, resolvida
  server-side no cofre e descartada; nunca vai no corpo;
- `organizationId` / tenant id;
- `credentialConnectionId` / `credentialId` / internos de conexão (endpoints, headers de auth);
- versões de credencial / conteúdo bruto do cofre;
- políticas, autoridade, evidência, trilha de auditoria;
- dados de outros tenants (tenant sempre da `ExecutionRun`).

O `ModelGenerationContext` que trafega é não-secreto (ver `ANTHROPIC_MODEL_PROVIDER.md`); os
identificadores acima **não** entram no request ao provider.

## 3. Structured output via tool sintética

Sem tool calling real nesta fatia. A saída estruturada é forçada por **uma** tool sintética:

- `tools` reais = `[]` — nenhuma ferramenta do agente é exposta ao provider;
- registra `arden_structured_output` cujo `input_schema` = o `outputSchema` canônico;
- `tool_choice = { type: 'tool', name: 'arden_structured_output' }` para forçar a chamada;
- o `input` do `tool_use` retornado é a saída estruturada.

O `outputSchema` canônico registrado é a **fonte da verdade**; o adapter adapta só a
representação enviada, nunca o schema canônico.

## 4. Compatibilidade de schema (pré-envio)

Antes de compor o request, `anthropic-schema-compatibility.ts` rejeita schema incompatível de
forma determinística (`$ref`, profundidade/nº de propriedades/tamanho excessivos) — nunca
degrada silenciosamente. Ver `ANTHROPIC_STRUCTURED_OUTPUT_RUNTIME.md`.

## 5. NUNCA

- embutir instruções de sistema nas mensagens (o campo `system` é separado);
- expor tools reais do agente ao provider nesta fatia (`tools=[]`);
- enviar qualquer segredo/identificador de tenant/credencial/conexão no request;
- deixar schema incompatível seguir para o provider.
