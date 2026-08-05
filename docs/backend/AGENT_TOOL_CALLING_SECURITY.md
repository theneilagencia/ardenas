# Segurança de tool calling do agente (ARDEN-BE-007, auditoria)

> O MODELO propõe a chamada; o SERVIDOR valida e executa. O modelo nunca escolhe
> ferramentas arbitrárias nem recebe segredo.

## 1. O agente só pode usar (§21)

- **tool bindings aprovados** da operação (BE-006): `OperationToolBinding` por alias;
- **aliases da operação** (nunca IDs livres nem action keys arbitrárias);
- **action keys permitidas** pelo binding (`allowedActionKeys`);
- dentro da **autoridade aprovada** (Gradiente de Autoridade da versão publicada);
- respeitando **limites de chamadas, orçamento, timeout e número máximo de passos**
  (`AgentExecutionPolicy`).

## 2. Gate server-side (`AgentToolCallGate`)

Para cada tool call proposta pelo modelo:
1. o alias existe e está habilitado na operação (reusa `ToolBindingResolver` do BE-006.6);
2. a action key ∈ `allowedActionKeys` do binding;
3. a autoridade da operação (BE-004) classifica a ação (ver §3) e decide
   executar/aprovar/negar/escalar;
4. o input da tool é validado contra o `inputSchema` da ferramenta;
5. a execução usa o `ExternalToolExecutor` do BE-006.6 (SecureHttpClient + SSRF +
   credencial server-side). O modelo **não** executa nada diretamente.

Proposta inválida (alias desconhecido, action não permitida, autoridade nega) →
`agent.tool_denied` + a proposta é rejeitada e devolvida ao modelo como erro (dentro do
limite de turnos), nunca executada.

## 3. Classificação por Gradiente de Autoridade (§23)

Cada tool call é classificada (reusando a taxonomia do BE-004): `READ` | `WRITE` |
`DESTRUCTIVE` | `FINANCIAL` | `SECURITY_CRITICAL` (o `riskLevel` já existe em
`ConnectorToolDefinition`). A política da operação decide:
- **executar automaticamente** (ex.: READ dentro do nível);
- **solicitar aprovação** (`ActionAuthorization`/approval do BE-004/005 → etapa SUSPENDED);
- **negar**;
- **escalar**.

O agente **não pode contornar o `ActionAuthorization`**. O primeiro slice usa apenas
ferramentas **read-only** (sem ação financeira/destrutiva), com aprovação opcional.

## 4. O modelo NUNCA recebe

segredo, credencial, connection configuration sensível, classe de executor, URL
irrestrita. Ele recebe apenas: os aliases disponíveis, os schemas de input/output das
ferramentas e os resultados (sanitizados) das tools que o servidor executou. O segredo é
resolvido no cofre pelo executor da ferramenta (BE-006.4/.6), fora do alcance do prompt.
