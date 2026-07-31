# Arquitetura do Motor de Políticas (ARDEN-BE-004)

## Objetivo

Transformar políticas declarativas versionadas em contribuições determinísticas para a
decisão de autoridade, **sem executar código arbitrário**.

## Modelo de dados

- **Policy** — política nomeada por organização (`@@unique(organizationId, key)`), com
  categoria (`AUTHORITY|APPROVAL|FINANCIAL|SECURITY|OPERATIONAL`) e status
  (`DRAFT|PUBLISHED|SUSPENDED|ARCHIVED`).
- **PolicyVersion** — versões imutáveis após publicação; rascunho único por política;
  `definition` (JSON validado pelo contrato `policyDefinition`).
- **OperationPolicyBinding** — vincula uma versão de política a uma operação
  (escopo `OPERATION|VERSION`, `priority`, `enabled`). Remover o vínculo nunca apaga a
  política nem seu histórico.

## Ciclo de vida (idêntico ao de operações em BE-003)

Criar → editar rascunho → **publicar** (transacional: supersede da versão anterior +
ponteiros) → suspender/arquivar. A versão publicada é **imutável** (`ALREADY_PUBLISHED`
em qualquer tentativa de edição). Concorrência otimista via `expectedRevision`;
idempotência via `Idempotency-Key`; auditoria dentro da transação.

## Definição de política (`policyDefinition`)

```jsonc
{
  "appliesWhen": [ { "field": "amountMinor", "operator": "GREATER_THAN", "value": 50000 } ],
  "effect": "REQUIRE_APPROVAL",          // ALLOW | DENY | REQUIRE_APPROVAL
  "approvalFlowId": "…",                  // fluxo quando exige aprovação
  "limits": { "financial": { "amountMinor": 50000, "currency": "BRL" } },
  "validFrom": "…", "validUntil": "…"
}
```

## Avaliação de condições — sem `eval`

`apps/api/src/enforcement/authority-evaluation.ts` avalia condições por um
**interpretador fechado** (`switch` por operador). Operadores: `EQUALS`, `NOT_EQUALS`,
`IN`, `NOT_IN`, `GREATER_THAN(_OR_EQUAL)`, `LESS_THAN(_OR_EQUAL)`, `EXISTS`. Campos são
resolvidos por caminho pontuado sobre o contexto da ação. Nunca há `eval`, `Function`,
nem persistência de expressões JS.

## Pureza e testabilidade

O motor não acessa banco, rede ou relógio (recebe `now` por parâmetro). Isso o torna
100% testável — ver `authority-evaluation.spec.ts` (26 casos). A montagem do snapshot
(perfil + políticas publicadas) fica no `EnforcementService`.

Ver também: `POLICY_PRECEDENCE_V1.md`, `AUTHORITY_ENFORCEMENT.md`.
