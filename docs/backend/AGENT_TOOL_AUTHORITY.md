# Agent tool authority (ARDEN-BE-007.5)

`AgentToolAuthorityEvaluator` combina, com precedência DENY > REQUIRE_APPROVAL > ALLOW:
(1) gates de risco da `AgentToolPolicy` (o agente nunca reduz o risco); (2) Gradiente de
Autoridade + políticas da operação via `enforcement.evaluateCore('integration.invoke', inputLógico)`
(BE-004); (3) `ActionAuthorization` ativa para a mesma tupla (op, versão, ação, payloadHash).
Defaults: READ conforme alias; WRITE controlado; DESTRUCTIVE/FINANCIAL/SECURITY_CRITICAL
negados. Se a policy exige autorização humana para o risco mas a autoridade concede
diretamente (sem fluxo), a decisão é DENY (fail-safe).
