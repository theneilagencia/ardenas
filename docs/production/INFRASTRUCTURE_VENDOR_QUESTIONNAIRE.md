<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Questionário ao fornecedor

Questionário padrão a enviar aos três finalistas (A/B/D). Respostas devem vir por **fonte
oficial do fornecedor** (documentação/proposta/contrato). Campos em branco = `TBD`. Uma
cópia por finalista.

Fornecedor: `TBD` · Arquitetura (A/B/D): `TBD` · Data (UTC): `TBD` · Fonte: `TBD`

## Banco (PostgreSQL)

| Pergunta | Resposta | Fonte |
| --- | --- | --- |
| Versão PostgreSQL suportada (16/17?) | `TBD` | `TBD` |
| Extensões suportadas (necessárias ao schema) | `TBD` | `TBD` |
| HA (arquitetura, zonas/regiões) | `TBD` | `TBD` |
| RTO de failover | `TBD` | `TBD` |
| PITR (mecanismo + granularidade) | `TBD` | `TBD` |
| Retenção de backup (mín/máx) | `TBD` | `TBD` |
| Procedimento de restore (para ambiente isolado) | `TBD` | `TBD` |
| Encryption at rest / in transit | `TBD` | `TBD` |
| Private networking / IP privado | `TBD` | `TBD` |
| Janela de manutenção | `TBD` | `TBD` |
| Upgrade de major (mecanismo) | `TBD` | `TBD` |
| Connection limit (por tier) | `TBD` | `TBD` |
| Pooling (modo/produto) | `TBD` | `TBD` |
| SLA do banco | `TBD` (REQUIRES_SALES_CONFIRMATION) | `TBD` |

## Secrets

| Pergunta | Resposta | Fonte |
| --- | --- | --- |
| Versionamento de segredo | `TBD` | `TBD` |
| Rotação (nativa/automatizável) | `TBD` | `TBD` |
| Recovery/undelete | `TBD` | `TBD` |
| Auditoria de acesso | `TBD` | `TBD` |
| Workload identity (sem chave exportada) | `TBD` | `TBD` |
| Acesso privado (endpoint privado) | `TBD` | `TBD` |
| Deletion protection | `TBD` | `TBD` |
| Replicação | `TBD` | `TBD` |
| SLA do secret manager | `TBD` | `TBD` |

## Operação

| Pergunta | Resposta | Fonte |
| --- | --- | --- |
| Suporte (planos) | `TBD` | `TBD` |
| Horário de cobertura | `TBD` | `TBD` |
| Severidades e definições | `TBD` | `TBD` |
| Tempo de resposta por severidade | `TBD` | `TBD` |
| Status page | `TBD` | `TBD` |
| Histórico de incidentes | `TBD` | `TBD` |
| Exportação de logs | `TBD` | `TBD` |
| API de gestão | `TBD` | `TBD` |
| Suporte a Terraform/IaC | `TBD` | `TBD` |
| Grau de lock-in declarado | `TBD` | `TBD` |
| Exportação de dados (saída) | `TBD` | `TBD` |

## Jurídico

| Pergunta | Resposta | Fonte |
| --- | --- | --- |
| DPA disponível | `TBD` | `TBD` |
| Regiões de processamento | `TBD` | `TBD` |
| Regiões de armazenamento | `TBD` | `TBD` |
| Subprocessadores (lista) | `TBD` | `TBD` |
| Transferência internacional (mecanismo) | `TBD` | `TBD` |
| Retenção | `TBD` | `TBD` |
| Exclusão | `TBD` | `TBD` |
| Certificações (ISO/SOC/etc.) | `TBD` | `TBD` |

> As respostas jurídicas alimentam `INFRASTRUCTURE_LEGAL_REVIEW_CHECKLIST.md` e
> `INFRASTRUCTURE_DATA_RESIDENCY_QUESTIONNAIRE.md`; **somente o jurídico** as aprova.
