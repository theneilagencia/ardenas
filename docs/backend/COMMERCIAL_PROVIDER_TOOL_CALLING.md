# Tool calling com provider comercial (ARDEN-BE-008, auditoria)

> O provider comercial apenas PROPÕE chamadas; o servidor valida e executa (BE-007.5).
> O adapter traduz definições e propostas de/para os tipos canônicos; nenhum tipo do SDK
> escapa do domínio. NADA de código/SDK nesta fase.

## 1. `ModelToolDefinition` → definição de tool do provider

O assembler entrega ao provider apenas `ModelToolDefinition[]`
(`{ alias, description, inputSchema, riskLevel }`). O adapter converte cada uma para o
formato de tool do provider:

- **`alias`** vira o nome/identificador da tool no provider — o alias canônico é
  PRESERVADO; nunca se envia `connectionId`, credential, URL, headers, action key ou
  classe de executor (esses campos não existem em `ModelToolDefinition`).
- **`inputSchema`** vira o schema de parâmetros da tool.
- **`riskLevel`** NÃO é enviado ao provider (é sinal interno de autoridade).

> REQUER VERIFICAÇÃO EXTERNA: formato exato da tool definition do provider (nome dos
> campos, dialeto do schema de parâmetros, limites de quantidade/tamanho de tools).

## 2. Chamada do provider → `ModelToolCall`

O retorno do provider é convertido para `ModelToolCall` (`{ id, alias, input }`):

- **`id`** é NORMALIZADO pelo servidor (id próprio, estável), não se confia no id do
  provider como chave de autoridade/idempotência;
- **`alias`** deve pertencer ao allowlist da operação — o adapter mapeia de volta o nome
  do provider para o alias canônico;
- **`input`** é re-validado server-side pelo `AgentToolCallValidator` (BE-007.5): input
  serializável, ≤ 32 KiB, schema da tool, e REJEIÇÃO de propriedades de controle
  (organizationId, connectionId, credential, authorization, endpoint, host, headers,
  executor…) e URL absoluta.

## 3. Invariantes de segurança (reuso, não reimplementação)

O provider comercial **não muda** o modelo de segurança do BE-007.5:

- o provider **não executa** ferramenta alguma — só propõe;
- **segredos nunca são enviados** ao provider (resolvidos no cofre pelo
  `ExternalToolExecutor`, BE-006.4/.6);
- resolução de binding (BE-006), autoridade (BE-004) e aprovações/`ActionAuthorization`
  single-use (BE-004/005) permanecem SERVER-SIDE. Ver `AGENT_TOOL_CALLING_SECURITY.md`.
- proposta inválida (alias desconhecido, action não permitida, autoridade nega) →
  `agent.tool_denied`, rejeitada e devolvida ao modelo como erro, nunca executada.

## 4. `tool_choice` e parallel tool calls → modelo de proposta única

O runtime é multi-turno com UMA proposta por vez, sem execução paralela. O adapter
concilia isso com os recursos do provider:

- **`tool_choice`** (auto/forçado/nenhuma): mapeado para a intenção do turno; forçar uma
  tool específica só quando a política do turno pede. REQUER VERIFICAÇÃO EXTERNA dos
  modos suportados.
- **Parallel tool calls**: se o provider retornar MÚLTIPLAS chamadas num único turno, o
  servidor NÃO as executa em paralelo. Ou o adapter desabilita o recurso, ou o runtime
  processa de forma sequencial/determinística dentro dos limites (`maximumTurns`,
  `maximumToolCalls`, `maximumCallsPerAlias`); nunca há execução concorrente de efeitos.
- cada resultado de tool é reinserido ISOLADO (`TOOL_CONTINUATION`) e o modelo é chamado
  de novo até o structured output final.
