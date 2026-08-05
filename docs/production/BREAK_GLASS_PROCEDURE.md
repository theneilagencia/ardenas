<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Procedimento break-glass

Acesso de emergência, nunca cotidiano. Runbook: `docs/runbooks/BREAK_GLASS.md`.

## Requisitos
- Ativação **temporária** (janela limitada) com **revogação automática** ao expirar.
- **MFA obrigatório**.
- **Duas aprovações** independentes.
- **Motivo** registrado.
- **Logs** completos de toda ação.
- **Revisão posterior** (post-mortem) obrigatória.
- **Nenhum acesso rotineiro**; a identidade break-glass fica inativa fora de incidente.

Nesta fase **nenhuma credencial break-glass é criada** (001.2B). Papel `A` de segurança na
RACI (`INFRASTRUCTURE_APPROVAL_RACI.md`).
