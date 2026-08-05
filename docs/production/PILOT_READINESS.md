<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Prontidão para piloto

Estado atual: **NOT FOUND**. Classificação: **MISSING / P1**. **Anthropic não é requisito
para o primeiro piloto** — o produto opera com `internal.test-model` (só teste,
`productionAllowed=false`) e todo o núcleo (operações, aprovações, governança, auditoria,
conectores) sem provider comercial.

## Requisitos do piloto controlado
- Ambiente **staging/pilot** dedicado (não local).
- **Tenant isolado**, dados sintéticos ou de baixo risco.
- Operações **allowlisted**; **aprovações obrigatórias** para ações WRITE.
- Limites conservadores (rate/quotas).
- Observabilidade externa mínima (logs+metrics+alertas SEV-1/2).
- Backup habilitado + **restore drill PASS**.
- Contato de incidente + janela de suporte definida.
- **Rollback** ensaiado.
- Métricas de sucesso e **exit criteria** definidos.

## Bloqueadores de piloto (P1)
staging/pilot ausente · observabilidade externa ausente · backup/restore não comprovado ·
alertas ausentes · runbooks ausentes · secret manager ausente. Ver `GO_LIVE_GATES.md`.

## Fora do piloto inicial
Provider comercial Anthropic (permanece DISABLED), carga destrutiva, produção comercial
ampla.
