<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Matriz lock-in × velocidade

Avaliação **sem escolher vencedor**. Classificações permitidas: `LOW` · `MEDIUM` · `HIGH`
· `UNVERIFIED`. **Toda classificação deve apontar para uma justificativa** (coluna
"Justificativa/Fonte"). Onde a evidência não foi confirmada por fonte oficial direta,
usar `UNVERIFIED`.

## Matriz

| Dimensão | GCP (B) | PaaS (D) | AWS (A) | Justificativa/Fonte |
| --- | --- | --- | --- | --- |
| Tempo estimado de implantação | UNVERIFIED | UNVERIFIED | UNVERIFIED | Depende de familiaridade do time (não medido) |
| Complexidade operacional | UNVERIFIED | UNVERIFIED | UNVERIFIED | Qualitativo; ver `INFRASTRUCTURE_OPTIONS_COMPARISON.md` |
| Portabilidade de containers | UNVERIFIED | UNVERIFIED | UNVERIFIED | Todos usam OCI (S7) — confirmar por questionário |
| Portabilidade de PostgreSQL | UNVERIFIED | UNVERIFIED | UNVERIFIED | Postgres padrão; export/import a confirmar (questionário) |
| Dependência de IAM proprietário | UNVERIFIED | UNVERIFIED | UNVERIFIED | S3 (secret manager) — a confirmar |
| Dependência de rede proprietária | UNVERIFIED | UNVERIFIED | UNVERIFIED | S6 — a confirmar |
| Dependência de observabilidade | UNVERIFIED | UNVERIFIED | UNVERIFIED | Sentry/Grafana portáteis; nativos acoplam |
| Facilidade de saída | UNVERIFIED | UNVERIFIED | UNVERIFIED | Exportação de dados (questionário) |
| Custo de migração futura | UNVERIFIED | UNVERIFIED | UNVERIFIED | Depende de cotação e desenho final |
| Conhecimento necessário | UNVERIFIED | UNVERIFIED | UNVERIFIED | Perfil do time (negócio) |

## Como preencher (em 001.2B / durante decisão)

- Substituir `UNVERIFIED` por `LOW`/`MEDIUM`/`HIGH` **apenas** com justificativa e fonte
  (resposta do questionário ao fornecedor ou documentação oficial reconfirmada).
- A matriz **informa** as decisões #14 (apetite de lock-in) e #15 (velocidade ×
  portabilidade) do `INFRASTRUCTURE_BUSINESS_DECISION_FORM.md` — **não** as substitui, nem
  elege um vencedor.

## Nota

`PARTIALLY_VERIFIED` (fetch bloqueado no ambiente de análise) **não** conta como
classificação final aqui; enquanto não reconfirmado por fonte oficial direta ou resposta
do fornecedor, permanece `UNVERIFIED`.
