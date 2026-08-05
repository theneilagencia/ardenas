<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Orçamento de conexões do banco

Calculadora executável: `tooling/infrastructure/connection-budget.ts` (testada).

## Fórmula
```
totalReserved = apiReplicas*poolPerApi + workerReplicas*poolPerWorker
              + migrationConnections + adminConnections + restoreDrillConnections
OK  ⇔  totalReserved < databaseConnectionLimit × approvedSafetyFactor
```

## Regra fail-closed
Enquanto o produto de banco não for selecionado, `databaseConnectionLimit = TBD (null)` e o
resultado é **BLOCKED** — nenhum limite é inventado. `approvedSafetyFactor` deve estar em
(0,1]. Inputs: réplicas de API/worker, pool por réplica, migration/admin/restore-drill,
margem de segurança, limite do banco.

## Compatibilidade
Runtime usa transaction pooling (`DATABASE_URL`); migrations usam conexão direta
(`DIRECT_URL`) e contam como `migrationConnections`. Ver `POSTGRESQL_POOLING_DECISION.md`.
