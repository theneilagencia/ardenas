<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — mapeamento de definição de tools (ARDEN-BE-008.5)

> `anthropic-tool-definition-mapper.ts` converte `ModelToolDefinition[]` em objetos Anthropic
> com **apenas 3 campos** (`name`, `description`, `input_schema`). Nenhum campo de autoridade,
> credencial ou binding cruza a borda. Descrição passa por guard de isolamento; schema passa por
> compatibilidade. Fonte: `anthropic-tool-definition-mapper.ts`, `anthropic-tool-description-guard.ts`.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Regra dos 3 campos (VERIFIED)

A definição enviada para a Anthropic contém **somente**:

| Campo Anthropic | Origem |
| --- | --- |
| `name` | alias determinístico do codec (ver §4 e `ANTHROPIC_TOOL_USE_MAPPING.md`) |
| `description` | descrição isolada pelo guard (ver §5) |
| `input_schema` | schema compatível (ver §3) |

Qualquer outro atributo do modelo de domínio é **descartado** na borda.

## 2. Campos PROIBIDOS de sair (NUNCA enviados)

O mapper **nunca** envia nenhum destes:

- `risk`
- `actionKey`
- `authorization`
- `approval`
- `connectionId`
- `organizationId`
- `credential`
- `endpoint`
- `headers`
- `executor`
- `binding`

Esses campos carregam autoridade/segredo/roteamento e permanecem exclusivamente no runtime
provider-neutro. O provider não os conhece do lado da borda Anthropic.

## 3. Compatibilidade de schema (VERIFIED)

Por tool, `assertAnthropicSchemaCompatible` valida o `input_schema` e **rejeita**:

| Condição | Rejeição |
| --- | --- |
| presença de `$ref` | schema incompatível |
| profundidade > 12 | schema incompatível |
| número de propriedades > 200 | schema incompatível |
| tamanho excessivo | schema incompatível |

Falha → `AGENT_TOOL_SCHEMA_INVALID`. A validação é **por tool**; uma tool inválida não é
silenciosamente omitida — a falha é explícita.

## 4. Nome via codec (VERIFIED)

O `name` enviado é o **alias** produzido pelo `AnthropicToolNameCodec` (mapa determinístico,
reversível e por request; padrão `^[a-zA-Z0-9_-]{1,64}$`; colisão-safe; nomes reservados
re-codificados para `arden_t_<sha256[:24]>`). O provider **nunca** envia o nome de provider
cru como identidade de autoridade. Detalhe em `ANTHROPIC_TOOL_USE_MAPPING.md`.

## 5. Isolamento de descrição (VERIFIED)

`anthropic-tool-description-guard.ts` trata a descrição como conteúdo não confiável antes de
enviá-la:

- limite de tamanho **500**;
- normalização Unicode **NFC**;
- redação;
- inspeção de prompt-injection reusando `detectInjectionRules` (007.4);
- **REJEITA** marcadores de credencial → `AnthropicToolMappingError` código
  `AGENT_TOOL_DESCRIPTION_REJECTED`;
- hash de evidência sha256 (nunca o conteúdo cru — ver `ANTHROPIC_TOOL_CALLING_EVIDENCE.md`).

## 6. NUNCA / PROIBIDO

- enviar qualquer campo além de `name`/`description`/`input_schema`;
- enviar `risk`/`actionKey`/`authorization`/`approval`/`connectionId`/`organizationId`/
  `credential`/`endpoint`/`headers`/`executor`/`binding`;
- aceitar schema com `$ref` ou acima dos limites;
- usar o nome de provider cru como identidade de autoridade;
- gravar a descrição crua como evidência.

## 7. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
