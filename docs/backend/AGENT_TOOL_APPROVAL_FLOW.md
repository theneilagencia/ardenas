# Agent tool approval flow (ARDEN-BE-007.5)

Em REQUIRE_APPROVAL, `AgentToolApprovalService` cria/reutiliza a solicitação via
`ApprovalRequestsService.create` (motor BE-004 inalterado: fluxo, quórum, segregação de
funções, delegação). A etapa SUSPENDE (não executa). A aprovação humana pelo endpoint
existente emite uma `ActionAuthorization` single-use. A execução é retomada por
`/executions/{id}/resume`. A tool não executa antes da aprovação; a rejeição/expiração vira
resultado DENIED tipado (sem detalhe de segurança).
