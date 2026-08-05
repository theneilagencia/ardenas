<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Veredito final

**Pergunta:** O escopo aprovado do Arden.AS foi 100% desenvolvido?

## Resposta: **NÃO**

## Classificação: **SUBSTANTIALLY_COMPLETE**

Commit auditado: `756b244` · Branch: `claude/arden-scope-001-completeness-audit` · Confiança: **ALTA**
(evidência reproduzível — 555 testes unitários + 267 de integração + 10 de execução, todos
verdes em banco limpo neste commit; ver `ARDEN_SCOPE_001_TEST_COVERAGE.md`).

## Por que NÃO é 100%

O critério de `100_PERCENT_DEVELOPED` exige que **nenhum requisito obrigatório** esteja
incompleto/mock-only/disabled e que não exista gap funcional obrigatório. Há requisitos
obrigatórios **não** COMPLETE:

1. **~15 rotas de frontend são demo/snapshot-only (`MOCK_ONLY`)** e ficam **vazias no modo
   `api`** (governança, aprovações, execuções, autoridade, evidências, exceções, work-units,
   risco, contexto, arquivos, deployment, pessoas, relatórios, orçamento, resultados). O
   provedor de dados **padrão** do SPA é `indexeddb` (demonstração com seed), não `api`
   (`src/services/service-container.ts:37`). "Renderiza" não é "desenvolvido" (GAP-001).
2. **Backends prontos porém não consumidos pelo frontend**: execuções, aprovações,
   autoridade e políticas/governança têm API real e testada, mas as telas correspondentes
   mutam apenas o snapshot local; `ApiApprovalsRepository`/`ApiFilesRepository` estão
   registrados mas **nunca são chamados** (GAP-002/003/004).
3. **Work Unit** não tem entidade/domínio dedicado (modelado como etapa de execução) (GAP-007).
4. **Anthropic comercial** está `DISABLED`: sem chamada real, `productionAllowed=false`,
   pricing e data governance `UNVERIFIED` — `BLOCKED_BY_EXTERNAL_PROVIDER` (GAP-009).
5. **Infraestrutura e produção** estão `PREPARED`/`BLOCKED_BY_DECISION`: ADR-0001 `PROPOSED`,
   entry gate `FAIL`, sem staging/produção, sem backup/PITR/restore real (GAP-010/011/013).

Basta **um** requisito obrigatório incompleto para a resposta ser NÃO — e há vários.

## Por que é SUBSTANTIALLY_COMPLETE (e não PARTIALLY/NOT)

A **plataforma central** está genuinamente desenvolvida e verificada por execução real:
identidade/tenancy, operações/versões/publicação, autoridade/políticas/aprovações, motor
de execução + fila durável + worker (recuperação de job comprovada), connectors + cofre
AES-GCM + SSRF, agentes + runtime de tools + governança de uso/custo, contratos de API
(98 paths, zero drift) e segurança (isolamento multi-tenant, keyring fail-closed, higiene
de segredos). Todos os 30 fluxos críticos têm teste comprovando-os; apenas 1 é PARCIAL
(work unit) e 1 é bloqueado externamente (Anthropic live).

## Métricas

| Métrica | Valor |
| --- | --- |
| **IMPLEMENTATION_COMPLETENESS** (só o desenvolvido) | **86,6%** |
| **APPROVED_SCOPE_READINESS** (inclui decisões/operação/produção) | **77,5%** |
| FUNCTIONAL_SCOPE_COMPLETENESS | 89,9% |

Prontidão: **homologação:** NÃO (gaps P1 de frontend + infra) · **piloto:** NÃO ·
**produção:** NÃO.

Detalhe e recomputação: `ARDEN_SCOPE_001_COMPLETENESS_SCORE.md`,
`arden-scope-001-scores.json`. Gaps: `ARDEN_SCOPE_001_GAP_REGISTER.md`.
