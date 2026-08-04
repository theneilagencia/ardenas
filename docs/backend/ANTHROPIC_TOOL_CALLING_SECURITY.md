<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — segurança de tool calling (ARDEN-BE-008.5)

> O SDK oficial e o provider **nunca** executam tools, nunca resolvem credenciais de tool, nunca
> criam aprovações e nunca emitem autorização. Definições e resultados são isolados como
> conteúdo não confiável; prompt-injection é inspecionado; um canary de segredo detecta
> vazamento; produção é bloqueada. Fonte: mappers da Fatia 2 + `anthropic-model-provider.ts`.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Invariantes de segurança (VERIFIED)

| Invariante | Garantia |
| --- | --- |
| SDK/provider não executam tool | único executor é `ExternalToolExecutor` (BE-006) no runtime |
| provider não resolve credencial de tool | resolução de binding/credencial é do runtime |
| provider não cria aprovação | pausa/checkpoint/resume é do runtime |
| provider não emite `ActionAuthorization` | autorização single-use é do runtime |
| provider não decide autoridade | `AgentToolAuthorityEvaluator` decide (ALLOW/REQUIRE_APPROVAL/DENY) |

O provider é **borda de tradução**. Toda autoridade e todo efeito externo ficam no runtime
provider-neutro.

## 2. Isolamento de definição de tool (VERIFIED)

`anthropic-tool-description-guard.ts` trata a descrição como não confiável:

- limite de tamanho **500**, Unicode **NFC**, redação;
- inspeção de prompt-injection reusando `detectInjectionRules` (007.4);
- **REJEITA** marcadores de credencial → `AGENT_TOOL_DESCRIPTION_REJECTED`;
- hash sha256 de evidência (nunca conteúdo cru).

Campos de autoridade/segredo (`risk`, `actionKey`, `authorization`, `approval`, `connectionId`,
`organizationId`, `credential`, `endpoint`, `headers`, `executor`, `binding`) **nunca** saem
(ver `ANTHROPIC_TOOL_DEFINITION_MAPPING.md`).

## 3. Isolamento de resultado de tool (VERIFIED)

Resultado é dado, não instrução: `AgentToolResultSanitizer` + `PromptInjectionGuard` (007.4) no
runtime, clamp **8000** caracteres, passe final de `SensitiveDataRedactor` no mapper (ver
`ANTHROPIC_TOOL_RESULT_MAPPING.md`). `REQUIRES_APPROVAL` nunca vira `tool_result`.

## 4. Prompt injection (VERIFIED)

A mesma base de regras 007.4 (`detectInjectionRules`) inspeciona descrições de tools na borda;
o isolamento de resultados usa o `PromptInjectionGuard`. Conteúdo vindo do modelo ou da tool
nunca é reintroduzido como instrução confiável.

## 5. Canary de segredo (VERIFIED)

Formato: `ARDEN_BE008_ANTHROPIC_TOOL_SECRET_CANARY_<UUID>`. Usado para provar, offline, que
segredos não vazam para o payload enviado à Anthropic. Nos testes offline o canary é verificado
**ausente** no que sai pela borda.

## 6. Bloqueio de produção (VERIFIED)

- request com tools exige **não produção** + gate `ANTHROPIC_TOOL_CALLING_ENABLED`, senão
  `PROVIDER_ERROR`;
- produção sempre lança `MODEL_PROVIDER_DISABLED` **antes** de mapear tools, resolver credencial
  ou tocar o transporte;
- `ANTHROPIC_TOOL_CALLING_ENABLED` default **false**, honrado só fora de produção;
- provider persistido segue `DISABLED` / `productionAllowed=false`.

## 7. Estado UNVERIFIED explícito

- Pricing: **UNVERIFIED**.
- Data governance: **UNVERIFIED**.
- Live smoke: **NOT EXECUTED**.
- Live Anthropic tool calling: **NOT EXECUTED** (validado exclusivamente com
  `FakeAnthropicTransport`).

## 8. NUNCA / PROIBIDO

- executar tool, resolver credencial de tool, criar aprovação ou emitir autorização no provider;
- deixar campo de autoridade/segredo cruzar a borda;
- reintroduzir conteúdo de modelo/tool como instrução confiável;
- enviar tools em produção ou sem gate não produtivo;
- gravar segredo/conteúdo cru (usar hash).

## 9. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
