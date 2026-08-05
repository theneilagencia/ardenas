<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Job de migration de produção

Comando único e idempotente: `npm run production:migrate`
(`tooling/infrastructure/infra.cli.ts production:migrate`).

## Fluxo (fail-closed)
1. valida o decision manifest (guard comum `requireApprovedDecision`);
2. usa **conexão direta** (`DIRECT_URL`), nunca o pooler;
3. confirma banco alvo e migrations pendentes;
4. exige referência de aprovação (não-secreta) no manifesto;
5. executa `prisma migrate deploy`; 6. `migrate status`; 7. evidência sanitizada.

## Estado atual
Sem banco/decisão aprovada → **FAIL-CLOSED** (exit ≠ 0). Não acessa banco remoto. A
separação `DATABASE_URL`/`DIRECT_URL` está implementada no `schema.prisma` e validada por
teste (migrations aplicam via conexão direta).
