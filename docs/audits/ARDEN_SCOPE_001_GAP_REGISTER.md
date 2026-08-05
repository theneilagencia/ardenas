<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Registro de gaps

Fonte machine-readable: `arden-scope-001-gaps.json` (13 gaps). Severidade: P0 segurança/
integridade/produção · P1 fluxo obrigatório/homologação · P2 qualidade/operação/cobertura ·
P3 melhoria. Esforço relativo: XS/S/M/L/XL/REQUIRES_DISCOVERY (sem horas).

## Distribuição
- Severidade: **P0×1, P1×5, P2×7**.
- Bucket: **desenvolvimento 8 · decisão humana 3 · provedor externo 1 · jurídico/comercial 1**.

## GAPS_REQUIRING_DEVELOPMENT (8)
| Gap | Scope | Severidade | Esforço | Resumo |
| --- | --- | --- | --- | --- |
| GAP-001 | SCOPE-FE-007 | P1 | L | ~15 rotas frontend demo/snapshot-only; vazias em modo api |
| GAP-002 | SCOPE-APV-004 | P1 | M | Governança/aprovações/arquivos: repositórios API existem mas nunca chamados |
| GAP-003 | SCOPE-EXE-003 | P2 | M | UI de execuções não conectada ao backend real |
| GAP-004 | SCOPE-AUTH-LEVEL-003 | P2 | M | UI de autoridade não conectada ao backend real |
| GAP-005 | SCOPE-FE-008 | P2 | S | Assessment→operação lança em modo api (regressão demo vs api) |
| GAP-006 | SCOPE-PERM-004 | P2 | M | Gestão de papéis é constante estática (sem CRUD/backend) |
| GAP-007 | SCOPE-WU-001 | P2 | M | Sem entidade WorkUnit dedicada (modelada como etapa) |
| GAP-008 | SCOPE-DB-003 | P2 | S | Corrida no seed (`prisma/seed.ts:45`) sob re-seed; banco limpo passa 267/267 |

## GAPS_REQUIRING_HUMAN_DECISION (3)
| Gap | Scope | Severidade | Resumo |
| --- | --- | --- | --- |
| GAP-010 | SCOPE-INF-002 | P1 | Infra real (IaC/staging/prod/PG/backup/secret manager) bloqueada pelo ADR-0001 |
| GAP-011 | SCOPE-PRD-001 | P0 | Gates de produção/go-live não satisfeitos; entry gate FAIL |
| GAP-012 | SCOPE-INF-012 | P2 | On-call e operação real inexistentes |

## GAPS_REQUIRING_EXTERNAL_PROVIDER (1)
| Gap | Scope | Severidade | Resumo |
| --- | --- | --- | --- |
| GAP-009 | SCOPE-AI-004 | P1 | Anthropic: execução real/produção comercial (pricing/data governance UNVERIFIED; DISABLED) |

## GAPS_REQUIRING_LEGAL_OR_COMMERCIAL_APPROVAL (1)
| Gap | Scope | Severidade | Resumo |
| --- | --- | --- | --- |
| GAP-013 | SCOPE-PRD-002 | P1 | Residência de dados / jurisdição / subprocessadores / DPA pendentes |

## O que bloqueia o quê
- **100% desenvolvido:** GAP-001..013 (qualquer um dos obrigatórios).
- **Homologação:** GAP-001, GAP-002, GAP-008, GAP-010, GAP-011.
- **Piloto/Produção:** GAP-009, GAP-010, GAP-011, GAP-013.
