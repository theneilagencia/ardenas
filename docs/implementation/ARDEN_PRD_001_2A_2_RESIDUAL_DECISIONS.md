<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# ARDEN-PRD-001.2A.2 — Decisões humanas residuais

Após esta fase, restam **apenas** decisões humanas (nenhuma arquitetura/descoberta pendente):

1. Fornecedor selecionado (GCP | AWS | SPECIALIZED_PAAS)
2. Região principal
3. Região de recuperação
4. Orçamento (staging/piloto/produção) + moeda
5. SLA e suporte
6. Aprovação jurídica
7. DPA, residência e subprocessadores
8. RPO e RTO aprovados
9. Responsável operacional
10. Preferência entre velocidade e lock-in

Cada uma entra pelo **manifesto de decisão** (`PRODUCTION_DECISION_MANIFEST.md`) e é
verificada por `infrastructure:decision:validate`. Enquanto qualquer uma faltar:
`ARDEN_PRD_001_2B_ENTRY_GATE = FAIL`, ADR = PROPOSED, 001.2B bloqueado.

## Estado de prontidão (tudo o que NÃO depende de humano)
application security · master-key lifecycle · database reencryption · platform secret
boundary · decision package · **decision manifest** · **IaC contracts** · **environment
contracts** · **container strategy** · **artifact strategy** · **migration automation
(blocked)** · **smoke suite (not executed remotely)** · **backup/restore contracts (adapter
unselected)** · **IAM contracts** · **network policy** · **observability contract** · **alert
definitions** · **runbooks** · **staging/production checklists (blocked)** → todos **READY**.
