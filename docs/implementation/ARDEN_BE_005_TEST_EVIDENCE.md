# ARDEN-BE-005 — Evidência de Testes

## Unidade (api)
- `execution.state-machine.spec.ts` — transições válidas/inválidas, terminais, executores
  determinísticos (sucesso/falha/idempotência/executor ausente).

## Integração (Postgres + fila + worker reais)
- `execution-flow.integration.spec.ts` — criação→processamento→SUCCEEDED com etapas,
  eventos (sequência monotônica) e evidências; bloqueio (nível 1 → `ACTION_DENIED`);
  retry determinístico (2 tentativas); falha não-retryable → compensação; multitenancy
  (404); idempotência.
- `execution-critical.integration.spec.ts`:
  - **§40** consumo duplo — dois requests concorrentes com a mesma autorização → UMA
    execução, autorização `USED`, segundo `AUTHORIZATION_ALREADY_USED`, um único job;
  - **§40b** autorização exigida ausente → `AUTHORIZATION_REQUIRED`;
  - **§41** recuperação — worker morto (lease expirado) → job recuperado, etapa concluída
    não repetida, execução coerente `SUCCEEDED`, evento `execution_job.recovered`;
  - **§42** pausa real — worker não inicia etapas enquanto pausado; retoma e conclui.

## Gates
`typecheck`, `lint`, `test`, `build`, `contracts:openapi` (diff limpo), `typecheck:api`,
`lint:api`, `test:api`, `test:api:integration`, `build:api`, `db:migrate:status` — verdes.
