<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Plano de implementação da infraestrutura (para ARDEN-PRD-001.2B)

Plano **faseado** para a implementação futura. **NÃO iniciar** enquanto o resultado de
001.2A for `REQUIRES_BUSINESS_DECISION` (ver `ADR-0001`). Cada fase tem entrada, saída e
gate. Nenhum recurso é criado em 001.2A.

## Pré-condição de arranque (bloqueio)

001.2B **só começa** quando a decisão de negócio de 001.2A estiver resolvida:
- Plataforma finalista escolhida (custo S5 + SLA S4 + lock-in), e
- Parecer de **residência de dados/jurisdição** (S8) emitido pelo jurídico, e
- ADR-0001 movido de `PROPOSED` para `ACCEPTED` por aprovação autorizada e registrada.

## Fases

| Fase | Nome | Entrada | Saída / gate |
| --- | --- | --- | --- |
| **001.2B.1** | Contas, projetos e IAM | Plataforma escolhida | Contas/projetos criados; workload identities + OIDC de CI; menor privilégio provado (`INFRASTRUCTURE_IAM_MODEL.md`) |
| **001.2B.2** | Rede privada + egress DENY | 2B.1 | Banco não público; egress default DENY + allowlist; Anthropic inalcançável (testado) — `NETWORK_AND_EGRESS_DECISION.md` |
| **001.2B.3** | PostgreSQL gerenciado (HA) | 2B.2 | Instância HA; PG16; pooler (transaction) + conexão direta p/ migrations; `directUrl` no Prisma (mudança de schema aqui, **não** em 2A) |
| **001.2B.4** | Backups + PITR | 2B.3 | Backups automatizados + PITR habilitados; retenção definida — `DATABASE_BACKUP_AND_PITR_POLICY.md` |
| **001.2B.5** | Secret manager | 2B.1 | Adapter `EXTERNAL_SECRET_MANAGER` implementado; 5 secrets provisionados; acesso mínimo — `SECRET_MANAGER_OPTIONS.md` |
| **001.2B.6** | Deploy pipeline + registro | 2B.1–2B.5 | Imagem OCI no registro; deploy por artefato imutável; rollback ensaiado; migration job (direto) — `DEPLOYMENT_AND_PROMOTION.md` |
| **001.2B.7** | Observabilidade + alertas | 2B.6 | Logs/métricas/traces externos; alertas SEV-1/2 com owner/runbook — `OBSERVABILITY_STRATEGY.md`, `ALERT_CATALOG.md` |
| **001.2B.8** | Restore drill (banco + master key) | 2B.4, 2B.5 | Drill PASS com evidência completa — `DATABASE_RESTORE_DRILL_PLAN.md` |
| **001.2B.9** | Gate de produção | 2B.1–2B.8 | Todos os gates BLOCKING + REQUIRED BEFORE PILOT satisfeitos; Anthropic mantém-se DISABLED — `GO_LIVE_GATES.md` |

## Ordem e dependências

```
2B.1 IAM ─┬─> 2B.2 Rede ─> 2B.3 PostgreSQL ─> 2B.4 Backup/PITR ─┐
          └─> 2B.5 Secret manager ───────────────────────────────┤
                                                                  ├─> 2B.8 Restore drill ─> 2B.9 Gate
                              2B.6 Deploy ─> 2B.7 Observabilidade ─┘
```

## Invariantes ao longo de todas as fases

- **Anthropic permanece DISABLED**; `productionAllowed=false` até o gate 2B.9 e os gates
  deferidos próprios da Anthropic.
- **Nenhum secret no repositório**; **master key nunca no banco**; **sem endpoint HTTP de
  secrets/rotação**.
- Cada fase adiciona **um adapter/config**, nunca redesenha os contratos existentes
  (`PlatformSecretSource`, keyring, vault).
- Migrations com conexão **direta**; app com **pooler**.

## O que 001.2A NÃO faz

- Não cria nenhum recurso de nuvem; não executa deploy; não usa credencial real; não
  altera código/Prisma/migrations/OpenAPI/dependências/CI; não habilita Anthropic; não
  inicia 001.2B.

---
## Atualização ARDEN-PRD-001.2A.1
- A **pré-condição de arranque** desta implementação é agora formalizada como o gate
  documental `ARDEN_PRD_001_2B_ENTRY_GATE` (`docs/production/ARDEN_PRD_001_2B_ENTRY_GATE.md`),
  hoje = **FAIL**.
- 001.2B.1 (contas/IAM) só inicia quando o entry gate = PASS: `ADR-0001 = ACCEPTED`,
  arquitetura + região selecionadas, cotação oficial + parecer jurídico anexados, RPO/RTO
  aprovados e responsável operacional atribuído. Pacote de decisão:
  `ARDEN_PRD_001_2A_1_DECISION_PACKAGE_REPORT.md`.
