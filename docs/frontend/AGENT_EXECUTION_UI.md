# UI de execução de agentes (ARDEN-BE-007.7)

Princípio central: **não existe execução direta de agente no frontend**. Não há botão de
"run", chat, playground ou endpoint público de execução de modelo/agente. Um agente só
executa como uma **etapa `agent.execute` de uma operação**, disparada pelo motor de
operações (BE-005) como qualquer outra etapa.

## Como um agente chega a executar

1. Configuração de modelo `ACTIVE` (ver `MODEL_CONFIGURATION_UI.md`).
2. Agente + versão publicada (ver `AGENT_VERSION_EDITOR.md`).
3. Uma versão de operação inclui uma etapa cuja action key é `agent.execute`,
   referenciando o agente.
4. A operação é publicada e executada pelo motor — a etapa roda o runtime do agente.

O frontend de agentes **não** cria nem dispara essa execução; ela pertence ao editor de
operação e ao motor de execução existentes.

## Usage do agente por execução

O detalhe da execução consulta o usage do agente daquela execução pelo hook
`useExecutionAgentUsage(executionRunId)` →
`GET …/executions/{runId}/agent-usage`, que retorna os `AgentOperationalResult[]` das
etapas de agente daquela run. Somente leitura; os valores (tokens, custo estimado,
avaliação, governança) vêm prontos do servidor e não são recalculados.

## O que a UI mostra (e o que nunca mostra)

- Mostra: status da etapa, contadores de usage, custo estimado, avaliação final e
  governança — os mesmos campos seguros do resultado operacional.
- **Nunca** mostra: saída completa do modelo, prompt, instruções ou segredo.

Detalhe do registro operacional em `AGENT_RESULTS_UI.md`.
