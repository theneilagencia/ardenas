# ADR-0001 — Infraestrutura inicial de produção do Arden.AS

- **Status:** `PROPOSED`
- **Milestone:** ARDEN-PRD-001.2A
- **Data:** 2026-08-05
- **Decisores:** (a definir — aprovação autorizada pendente)
- **Resultado:** `INFRASTRUCTURE_DECISION: REQUIRES_BUSINESS_DECISION`

> Este ADR **não** deve ser movido para `ACCEPTED` sem decisão explícita e autorizada,
> registrada aqui com nome/aprovador/data. `PROPOSED` significa análise concluída, decisão
> de negócio pendente.

## Contexto

O Arden.AS precisa de uma decisão verificável sobre a infraestrutura inicial de produção
(compute, PostgreSQL gerenciado, HA, pooling, backups, PITR, restore drill, secret manager,
rede privada, egress, registro de imagem, deploy/rollback, observabilidade, ambientes,
custo, IAM, região/dados). O sistema é: SPA React + API/worker NestJS (container
`node:22-slim`), PostgreSQL 16, fila em banco (`FOR UPDATE SKIP LOCKED`), cofre de
credenciais AES-256-GCM com master key versionada, e uma fronteira de secrets de plataforma
já implementada (`PlatformSecretSource`). Invariantes: Anthropic **DISABLED**, banco não
público, egress DENY, secrets fora do repo.

## Opções consideradas

- **A — AWS gerenciado** (ECS/App Runner + RDS + Secrets Manager + VPC).
- **B — GCP gerenciado** (Cloud Run + Cloud SQL + Secret Manager + VPC).
- **C — Azure gerenciado** (Container Apps + Flexible Server + Key Vault + VNet).
- **D — PaaS especializado** (Vercel/Cloudflare + Fly.io/Render/Railway + Neon/Supabase +
  Sentry + Grafana Cloud).

Análise completa: `docs/implementation/ARDEN_PRD_001_2A_DECISION_REPORT.md` e docs de apoio
em `docs/production/`. Evidência: `docs/implementation/ARDEN_PRD_001_2A_SOURCE_REGISTER.md`.

## Decisão

**`REQUIRES_BUSINESS_DECISION`.** Todas as 4 arquiteturas atendem aos requisitos técnicos
essenciais conforme fontes oficiais (`PARTIALLY_VERIFIED`; fetch direto bloqueado no
ambiente de análise). **Nenhuma** é tecnicamente eliminada. A seleção **não** pode ser
feita porque pendem decisões de **negócio/jurídico**:

1. Custo real — `REQUIRES_SALES_CONFIRMATION` (nenhum preço inventado).
2. SLA contratual — `REQUIRES_SALES_CONFIRMATION`.
3. Residência de dados / jurisdição / sub-processadores — `REQUIRES_LEGAL_REVIEW`.
4. Apetite de lock-in vs velocidade — estratégico.

**Finalistas (≤3):** **B (GCP)**, **D (PaaS)**, **A (AWS)** — por adequação
técnica/operacional (matriz ponderada: B 4.35, D 4.30, A/C 3.95). C fica fora dos
finalistas por não adicionar vantagem decisiva neste perfil.

## Decisão objetiva requerida (para destravar 001.2B)

1. Cotação oficial dos finalistas nos 3 cenários (`INFRASTRUCTURE_COST_MODEL.md`).
2. Parecer jurídico de residência/jurisdição/sub-processadores.
3. Definição de apetite lock-in vs velocidade.

Com as três respostas, seleciona-se um finalista e este ADR pode ser movido para
`ACCEPTED` (com aprovação registrada). **Só então** 001.2B inicia.

## Consequências

- **Positivas:** análise técnica concluída e sourced; pooling, backup/PITR, restore drill,
  IAM, rede/egress e ambientes já especificados de forma provider-neutra; o contrato
  `PlatformSecretSource` acomoda qualquer secret manager sem redesenho; plano faseado
  001.2B pronto.
- **Negativas / abertas:** sem seleção, 001.2B fica bloqueado; gates BLOCKING (secrets
  manager de produção, banco HA, backups, restore drill, rede privada) permanecem abertos.
- **Segurança:** Anthropic permanece DISABLED; nenhuma mudança de código nesta fase.

## Reversibilidade

`PROPOSED` é totalmente reversível (documento). A escolha futura minimiza lock-in preferindo
padrões portáteis (OCI, PostgreSQL gerenciado padrão, adapter de secrets neutro).

## Registro de aprovação (preencher ao mover para ACCEPTED)

| Campo | Valor |
| --- | --- |
| Finalista selecionado | (pendente) |
| Aprovado por | (pendente) |
| Data de aprovação (UTC) | (pendente) |
| Evidência de custo (S5) | (pendente) |
| Parecer jurídico (S8) | (pendente) |
| Novo status | (permanece PROPOSED até aprovação) |

## Processo formal de aprovação (ARDEN-PRD-001.2A.1)

O caminho objetivo para mover esta ADR de `PROPOSED` para `ACCEPTED` está formalizado no
**pacote executivo de decisão** (ARDEN-PRD-001.2A.1). Pré-condições e evidências exigidas:
`docs/decisions/ADR-0001-APPROVAL-CHECKLIST.md`. Coleta da decisão de negócio/jurídico:
`docs/production/INFRASTRUCTURE_BUSINESS_DECISION_FORM.md` e demais documentos indexados em
`docs/implementation/ARDEN_PRD_001_2A_1_DECISION_PACKAGE_REPORT.md`.

A ADR **só** muda para `ACCEPTED` quando **todas** as pré-condições do checklist estiverem
satisfeitas (alternativa + região selecionadas; cotação oficial anexada; orçamento
aprovado; SLA confirmado; jurídico + DPA aprovados; RPO/RTO aprovados; responsável
operacional atribuído; riscos aceitos; aprovadores registrados). Ao mover, registrar aqui —
**sem reescrever o histórico** — `approval date`, `approvers`, `evidence references`,
`decision conditions` e `review date`. O início de ARDEN-PRD-001.2B fica condicionado ao
`ARDEN_PRD_001_2B_ENTRY_GATE = PASS` (`docs/production/ARDEN_PRD_001_2B_ENTRY_GATE.md`).

**Estado atual:** ADR = `PROPOSED`; entry gate = `FAIL`. Nenhuma pré-condição satisfeita.

## Preparação técnica (ARDEN-PRD-001.2A.2)

O repositório está tecnicamente preparado para implementar a infraestrutura **assim que**
esta ADR for movida para `ACCEPTED` — sem nova fase de descoberta/redesenho. Estão prontos
(provider-neutros, offline): manifesto de decisão + validador
(`npm run infrastructure:decision:validate`), contratos de IaC (`infra/`), estratégia de
container/artefato imutável por SHA, migração e deploy **fail-closed**, smoke suite,
adapter de recuperação, IAM de menor privilégio, catálogo de rede/egress (Anthropic
BLOCKED), contrato de observabilidade, definições de alerta e runbooks. Índice:
`docs/implementation/ARDEN_PRD_001_2A_2_PREPARATION_REPORT.md`. A ADR **permanece PROPOSED**;
o `ARDEN_PRD_001_2B_ENTRY_GATE` permanece `FAIL` (machine-checkable). Nenhum fornecedor,
região ou produto foi selecionado.
