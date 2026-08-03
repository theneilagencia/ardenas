# UI de aprovação de tool calls de agentes (ARDEN-BE-007.7)

Quando uma tool call do agente exige aprovação (`REQUIRE_APPROVAL`), a etapa **suspende** e
o backend cria/reutiliza uma solicitação de aprovação pelo motor BE-004 inalterado (fluxo,
quórum, segregação de funções, delegação). A UI não introduz um mecanismo próprio de
aprovação — reusa a superfície de aprovações existente.

## Somente campos seguros

A aprovação surge para o humano com **apenas** metadados seguros:

- `alias`/rótulo da ferramenta, **classe de risco** e a **decisão** (aprovar / rejeitar /
  delegar).

E **nunca** expõe: credencial, input da tool, output da tool, prompt, instruções ou
qualquer segredo. A rejeição/expiração vira resultado `DENIED` tipado, **sem detalhe de
segurança**.

## Retomada (resume) pelo endpoint real

A aprovação humana emite uma `ActionAuthorization` single-use; a execução é retomada pelo
endpoint real `POST …/executions/{id}/resume` (`resumeExecution` no `v1-http-client`) —
não há simulação local nem mudança de status inventada no cliente. Concorrência otimista
via `expectedRevision`.

## Idempotência evita duplicação

A retomada carrega chave de idempotência; um duplo clique / replay **não** executa a tool
duas vezes nem duplica autorização. A tool nunca executa antes da aprovação.

Fluxo de backend detalhado em `../backend/AGENT_TOOL_APPROVAL_FLOW.md` e
`../backend/AGENT_TOOL_RESUME.md`.
