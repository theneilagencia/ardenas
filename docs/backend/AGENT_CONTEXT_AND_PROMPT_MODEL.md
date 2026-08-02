# Contexto e prompt do agente (ARDEN-BE-007, auditoria)

> Separação explícita de camadas; tudo versionado; **nenhum prompt arbitrário vindo do
> request de execução**.

## 1. Camadas separadas (§17)

| Camada | Origem | Versionada? |
| --- | --- | --- |
| Instruções do sistema | `AgentVersion.systemInstructions` | SIM (imutável após publicar) |
| Objetivo operacional | `AgentVersion.objective` + operação | SIM |
| Contexto persistido | fontes filtradas por `contextPolicy` | política versionada |
| Input da execução | `ExecutionRun.input` (validado contra `inputSchema`) | por execução |
| Outputs anteriores | etapas anteriores permitidas | por execução |
| Políticas | autoridade/policy da operação (BE-004) | SIM |
| Ferramentas | tool bindings da operação (aliases) | SIM |
| Formato de saída | `AgentVersion.outputSchema` | SIM |

O request de execução fornece **apenas** o `input` (validado por schema). Ele **não**
fornece instruções, prompt, objetivo, ferramentas nem modelo — tudo vem da versão
publicada. Isso é anti-prompt-injection e garante reprodutibilidade/auditoria.

## 2. Montagem de contexto (§18)

```
Execution context
→ policy-filtered context sources
→ size/token budget (maximumInputTokens)
→ redaction (SENSITIVE keys)
→ prompt assembly (system + objective + context + input)
→ model request
```

**Fontes inicialmente permitidas** (allowlist, não memória global):
- input da execução;
- configuração (não sensível) da operação/versão;
- outputs de etapas anteriores autorizadas;
- documentos EXPLICITAMENTE vinculados à operação;
- resultados de ferramentas autorizadas (nesta execução).

**Proibido:** memória global irrestrita, dados de outro tenant, segredos do cofre,
variáveis de ambiente, headers de request. A montagem é tenant-scoped e passa pela
redação (`authorization|token|secret|password|cookie|bearer`) do BE-004/005 antes de ir
ao modelo.

## 3. Budget e redação

`contextPolicy` define `maximumContextTokens` e as fontes. Antes de montar o prompt, o
contexto é truncado ao budget e redigido. Conteúdo não confiável (documentos, tool
results, payload de webhook) é **rotulado como não confiável** no prompt (ver
`AGENT_PROMPT_INJECTION_THREAT_MODEL.md`) — o modelo é instruído a tratá-lo como dado,
não como instrução.

## 4. Evidência

A evidência de execução registra: `agentVersionId`, `modelConfigurationId`,
`contextSourceKinds` (categorias, não conteúdo), `promptHash`, `contextTokens`,
`inputHash` — **nunca** o prompt completo/system instructions em claro por padrão (ver
classificação de dados em `AGENT_COST_AND_USAGE.md`).
