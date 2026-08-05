# Máquinas de estado do runtime de agentes (ARDEN-BE-007.2)

Funções puras em `apps/api/src/agents/agent.state-machines.ts`. Nenhuma mudança de estado
por PATCH genérico — toda transição passa por aqui, guardada por `revision` (e, na
publicação, por `status`).

## AgentDefinition (REVOKED terminal)
```
DRAFT → ACTIVE | REVOKED
ACTIVE → SUSPENDED | REVOKED
SUSPENDED → ACTIVE | REVOKED
```

## AgentVersion (RETIRED terminal; PUBLISHED/RETIRED imutáveis)
```
DRAFT → PUBLISHED | RETIRED
PUBLISHED → RETIRED
```
Proibidos: `PUBLISHED → DRAFT`, `RETIRED → PUBLISHED`.

## ModelConfiguration (REVOKED terminal)
```
DRAFT → ACTIVE | REVOKED
ACTIVE → SUSPENDED | REVOKED
SUSPENDED → ACTIVE | REVOKED
```

Revogados/retirados nunca reativam. Coberto por `agent.state-machines.spec.ts` e testes
de integração de lifecycle.
