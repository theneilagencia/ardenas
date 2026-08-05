<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Sumário executivo

Auditoria **independente e reproduzível** de completude do escopo aprovado do Arden.AS.
Commit `756b244`. Branch documental `claude/arden-scope-001-completeness-audit`. Fase de
auditoria — **nenhum gap foi corrigido**; apenas `docs/audits/` e `docs/implementation/`.

## Resposta

**"O escopo foi 100% desenvolvido?" → NÃO.** Classificação: **SUBSTANTIALLY_COMPLETE**.
- **IMPLEMENTATION_COMPLETENESS: 86,6%** (o que foi efetivamente desenvolvido).
- **APPROVED_SCOPE_READINESS: 77,5%** (inclui decisões, operação e produção).

## O que está realmente pronto (verificado por execução)

- **Backend/plataforma central** (89,3%): identidade+tenancy, operações/versões/publicação,
  autoridade/políticas/aprovações, execução, connectors, agentes — 27 controllers, 99
  services, 48 modelos Prisma, 11 migrations.
- **Motor de execução + worker + fila durável** (86,7%): `FOR UPDATE SKIP LOCKED`, leases,
  recuperação de job preso, pausa/retomada — comprovado por testes críticos.
- **Connectors + cofre + tools** (100%): AES-256-GCM write-only, rotação/crypto-shredding,
  keyring versionado + recriptografia, SSRF guard, webhooks assinados.
- **Agentes/IA** (93,3%): runtime de tools com aprovação/suspensão/retomada, governança de
  uso/custo/avaliação; provider determinístico interno; Anthropic offline (structured
  output + tool calling).
- **API** (100%): OpenAPI 98 paths, zero drift; cliente gerado + testes de compat; canário
  de segredo.
- **Segurança/governança** (95%): isolamento multi-tenant em profundidade (cross-tenant
  404 em 20+ specs), keyring preflight + readiness fail-closed, platform secret source,
  higiene de segredos.

## Onde o escopo NÃO está 100%

| Área | Score | Natureza |
| --- | --- | --- |
| **Frontend** | **71%** | ~15 rotas demo/snapshot-only (vazias em modo `api`); 4 backends prontos não conectados; 2 repositórios API órfãos |
| **Operacional** | **19,2%** | Infra `PREPARED`/`BLOCKED_BY_DECISION` (ADR-0001 PROPOSED); sem staging/produção/backup real |
| **Produção** | **0%** | `BLOCKED_BY_DECISION`/`BLOCKED_BY_EXTERNAL_PROVIDER`; entry gate FAIL; Anthropic comercial DISABLED |

## Gaps (13)

P0×1, P1×5, P2×7. Por bucket: **desenvolvimento** 8 · **decisão humana** 3 · **provedor
externo** 1 · **jurídico/comercial** 1. Ver `ARDEN_SCOPE_001_GAP_REGISTER.md`.

O maior gap de **desenvolvimento** é a maturidade do frontend: a experiência padrão do SPA
é demonstração (IndexedDB + seed); o "modo api" cobre bem apenas o núcleo (operações,
agentes, integrações, Anthropic, auditoria), deixando ~15 telas sem backend conectado.

## Gates técnicos (commit 756b244, banco limpo)

Todos os gates aplicáveis **verdes**; `infrastructure:decision:validate` = **EXPECTED_BLOCK**
(FAIL por design). Testes: 555 unit + 267 integração + 10 execução + 305 frontend/infra +
3 a11y. Ver `ARDEN_SCOPE_001_AUDIT_EVIDENCE.md`.

> Ressalva de honestidade: uma re-execução da suíte de integração sobre um banco
> **contaminado** (re-seed repetido) produziu 7 falhas em `identity-authz` por uma corrida
> em `prisma/seed.ts:45`; em **banco limpo** a suíte passa **267/267** (reproduzido). É um
> gap de **test-harness** (GAP-008, P2), não um defeito de produto.
