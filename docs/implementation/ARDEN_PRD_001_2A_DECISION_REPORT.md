<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Relatório de decisão de infraestrutura

Consolida a análise das 4 arquiteturas e produz a **recomendação** verificável. Fatos
remetem ao `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`. Documentos de apoio em `docs/production/`.

## Escopo e restrições honradas

- Fase **documental**: nada provisionado; nenhum código/Prisma/OpenAPI/dependência/CI
  alterado; Anthropic **DISABLED**.
- Toda afirmação de serviço atual tem fonte oficial registrada com status. **Fetch direto
  bloqueado** neste ambiente → teto `PARTIALLY_VERIFIED`; **snippets de busca não são
  evidência final**.
- **Nenhum preço/SLA inventado**; residência de dados **não** decidida (jurídico).

## Matriz de decisão ponderada

Pesos refletem prioridade do estágio (time pequeno, piloto primeiro, segurança inegociável).
Escala **1–5** (5 = melhor). Notas são **qualitativas e sourced**; **não** incorporam
preço/SLA (indisponíveis) — as linhas de custo/SLA entram como **pendência**, não como nota.

| Critério (peso) | A — AWS | B — GCP | C — Azure | D — PaaS |
| --- | --- | --- | --- | --- |
| Segurança/controle de rede (0.20) | 5 | 4 | 4 | 3 |
| PITR+HA+backup gerenciado (0.15) | 5 | 5 | 5 | 4 |
| Simplicidade p/ time pequeno (0.15) | 3 | 4 | 3 | 5 |
| Esforço operacional (0.15) | 3 | 4 | 3 | 5 |
| Compat. Prisma+pooling (0.10) | 5 | 5 | 5 | 5 |
| Custo ocioso (dev/staging) (0.10) | 2 | 4 | 3 | 5 |
| Maturidade/ecossistema (0.10) | 5 | 5 | 5 | 3 |
| Portabilidade / lock-in (0.05) | 2 | 2 | 2 | 4 |
| **Score ponderado** | **3.95** | **4.35** | **3.95** | **4.30** |

Cálculo (soma peso×nota):
- A: 5·.20+5·.15+3·.15+3·.15+5·.10+2·.10+5·.10+2·.05 = **3.95**
- B: 4·.20+5·.15+4·.15+4·.15+5·.10+4·.10+5·.10+2·.05 = **4.35**
- C: 4·.20+5·.15+3·.15+3·.15+5·.10+3·.10+5·.10+2·.05 = **3.95**
- D: 3·.20+4·.15+5·.15+5·.15+5·.10+5·.10+3·.10+4·.05 = **4.30**

> A matriz **não** inclui custo real nem SLA contratual (indisponíveis nesta fase). Ela
> ordena por adequação técnica/operacional; a decisão final exige as pendências de negócio.

## Pendências que impedem `SELECTED`

1. **Custo real** — todos `REQUIRES_SALES_CONFIRMATION` (S5). Sem cotação oficial, comparar
   TCO seria inventar número.
2. **SLA contratual** — `REQUIRES_SALES_CONFIRMATION` (S4).
3. **Residência de dados / jurisdição / sub-processadores** — `REQUIRES_LEGAL_REVIEW` (S8).
4. **Apetite lock-in vs velocidade** — decisão estratégica do negócio.

Nenhuma é técnica; todas são de **negócio/jurídico**. Por definição do critério, o
resultado **não** pode ser `SELECTED`.

## Recomendação

**`INFRASTRUCTURE_DECISION: REQUIRES_BUSINESS_DECISION`**

**Finalistas (≤3):** **B (GCP gerenciado)**, **D (PaaS especializado)**, **A (AWS
gerenciado)**.

- **B (GCP)** e **D (PaaS)** lideram a matriz técnica/operacional (4.35 e 4.30). B combina
  controle de rede alto + PITR/HA maduros (S1.5/S1.6) com compute serverless (Cloud Run,
  scale-to-zero). D minimiza carga operacional e custo ocioso (Neon autosuspend + PgBouncer
  embutido, S1.12/S2.5) — atraente para um time pequeno no piloto.
- **A (AWS)** entra como finalista conservador por **máximo controle de rede/egress**
  (favorável ao requisito banco-não-público + egress DENY + bloqueio Anthropic) e maturidade.
- **C (Azure)** é tecnicamente equivalente (3.95) mas não adiciona vantagem decisiva sobre
  A/B para este perfil; fica fora dos finalistas para focar a decisão.

**Recomendação técnica (não vinculante, sujeita às pendências):** se o negócio priorizar
**menor carga operacional + custo ocioso baixo no piloto** e a residência de dados de um
provedor PaaS for aprovada pelo jurídico → **D**. Se priorizar **controle de rede máximo +
ecossistema gerenciado único + residência clara em região do hyperscaler** → **B** (ou A).

## Decisão objetiva requerida do negócio (para destravar 001.2B)

Responder, com evidência, a **três** perguntas:
1. **Custo:** cotação oficial dos finalistas nos 3 cenários (`INFRASTRUCTURE_COST_MODEL.md`).
2. **Jurídico:** parecer de residência/jurisdição/sub-processadores (S8) — aprova qual(is)
   finalista(s)?
3. **Estratégia:** apetite de lock-in vs velocidade (hyperscaler B/A vs PaaS D).

Com essas três respostas, um finalista é selecionável e o ADR-0001 pode ser movido para
`ACCEPTED` por aprovação autorizada — então 001.2B inicia.

## Rastreabilidade

- Comparação: `docs/production/INFRASTRUCTURE_OPTIONS_COMPARISON.md`
- PostgreSQL: `docs/production/MANAGED_POSTGRESQL_OPTIONS.md`
- Pooling: `docs/production/POSTGRESQL_POOLING_DECISION.md`
- Backup/PITR + drill: `DATABASE_BACKUP_AND_PITR_POLICY.md`, `DATABASE_RESTORE_DRILL_PLAN.md`
- Secret manager: `docs/production/SECRET_MANAGER_OPTIONS.md`
- IAM: `docs/production/INFRASTRUCTURE_IAM_MODEL.md`
- Rede/egress: `docs/production/NETWORK_AND_EGRESS_DECISION.md`
- Ambientes: `docs/production/ENVIRONMENT_ISOLATION.md`
- Custo: `docs/production/INFRASTRUCTURE_COST_MODEL.md`
- Plano 001.2B: `docs/production/INFRASTRUCTURE_IMPLEMENTATION_PLAN.md`
- Fontes: `ARDEN_PRD_001_2A_SOURCE_REGISTER.md` · Riscos: `ARDEN_PRD_001_2A_RISK_ASSESSMENT.md`
- Decisão: `docs/decisions/ADR-0001-PRODUCTION-INFRASTRUCTURE.md` (PROPOSED)

---
## Atualização ARDEN-PRD-001.2A.1
- A pendência "decisão objetiva requerida do negócio" desta 2A foi convertida em um
  **pacote executivo** acionável: formulário de decisão (20 itens), modelo de cotação,
  matriz de custos, questionário ao fornecedor, checklist jurídico, questionário de
  residência, checklist de SLA/suporte, matriz lock-in × velocidade, RACI, registro de
  decisão e checklist de aprovação da ADR. Índice em
  `ARDEN_PRD_001_2A_1_DECISION_PACKAGE_REPORT.md`.
- A transição para SELECTED/ACCEPTED e o início de 001.2B ficam condicionados ao
  `ARDEN_PRD_001_2B_ENTRY_GATE = PASS` (hoje FAIL). Recomendação e finalistas inalterados.
