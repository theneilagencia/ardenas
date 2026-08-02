# Avaliação do agente (ARDEN-BE-007, auditoria)

> `AgentEvaluator` com verificações DETERMINÍSTICAS primeiro. LLM-as-a-judge é opcional e
> nunca o único critério.

## 1. Verificações determinísticas (§24)

`AgentEvaluationPolicy` (versionada) aplica, em ordem:
- schema de saída válido (pré-requisito; ver `AGENT_STRUCTURED_OUTPUT.md`);
- critérios de conclusão declarados atendidos (campos obrigatórios presentes/coerentes);
- tool calls usadas ∈ allowlist da operação;
- citações/evidências exigidas presentes (quando a policy pede);
- ausência de campos proibidos (ex.: PII não solicitada, segredos);
- `confidence policy` (se o modelo emitir confiança, comparar a um limiar);
- business rule checks determinísticos declarados.

Falha em qualquer verificação → `agent.evaluation_failed` + etapa FAILED (sem sucesso
silencioso). Passa em todas → `agent.evaluation_passed`.

## 2. LLM-as-a-judge (opcional)

Pode complementar como um sinal adicional, **nunca** substituindo as verificações
determinísticas nem sendo o único critério. Se habilitado, o judge é outra chamada de
modelo (contabilizada em custo) e seu veredito é apenas mais uma verificação.

## 3. Reuso

O avaliador roda dentro do `AgentStepExecutor` (server-side); reusa o validador de schema
do BE-006.6 e registra evidência/auditoria pelos recorders do BE-005. Nenhuma
infraestrutura nova.
