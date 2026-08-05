<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Contradições materiais de documentação

Precedência: decisão aprovada mais recente → código/comportamento → contrato → histórico.
Contradições **não** reconciliadas silenciosamente.

| # | Contradição | Documento(s) | Resolução (auditoria) |
| --- | --- | --- | --- |
| C-01 | Relatórios de fase marcam módulos como PASS/CONCLUÍDO; parte do **frontend** não consome backend | `docs/backend/*`, `docs/implementation/*` (IMPLEMENTATION_REPORT) | Confirmado no **backend**; frontend de ~15 rotas reclassificado `MOCK_ONLY` (código prevalece). Não é regressão de backend, e sim maturidade de FE. |
| C-02 | "modo api implementado" sugere paridade total FE↔BE | FE-001/002/003 reports | Verdadeiro para o **núcleo** (operações/agentes/integrações/auditoria); **não** para execuções/aprovações/autoridade/governança (backend pronto, UI não conectada). |
| C-03 | Infra "documentada/preparada" às vezes lida como pronta | `docs/production/*` | Reclassificado `PREPARED`/`BLOCKED_BY_DECISION`; `PREPARED ≠ IMPLEMENTED`. Coerente com ADR-0001 PROPOSED. |
| C-04 | Anthropic "implementado" | `docs/backend/*` Anthropic | Verdadeiro **offline**; `BLOCKED_BY_EXTERNAL_PROVIDER` para live/produção (gates default false; pricing/data-gov UNVERIFIED). |
| C-05 | Suíte de integração "verde" | evidências de teste | Verdadeiro **em banco limpo** (267/267); re-seed contaminado expõe corrida `seed.ts:45` (GAP-008). Registrado explicitamente. |
| C-06 | `docs/product/` e `docs/specs/` como fontes de escopo | prompt | **Vazios** (0 arquivos); a referência funcional efetiva está em `docs/frontend/` + contratos OpenAPI. |

Nenhuma contradição altera o veredito: o **backend/plataforma** é confirmado; os gaps são
de **frontend (integração)**, **infra/produção (decisão)** e **Anthropic (provedor externo)**.
