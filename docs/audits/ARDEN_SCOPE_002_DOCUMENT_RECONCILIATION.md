<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002.6 — Reconciliação de contradições documentais

Base: `docs/audits/ARDEN_SCOPE_001_DOCUMENT_CONTRADICTIONS.md` (6 contradições). Histórico
**preservado** (nota de supersessão, sem reescrever resultado histórico — §26).

| # | Contradição | Estado factual (verificado em código/teste) | Marcação |
| --- | --- | --- | --- |
| C-01 | Relatórios PASS vs frontend não conectado | Backend confirmado; ~15 rotas demo `MOCK_ONLY` (Exclusão A). Orfãos removidos, assessment corrigido | CURRENT |
| C-02 | "modo api completo" vs paridade parcial | Núcleo (operações/agentes/integrações/auditoria) real; execuções/aprovações/autoridade/governança = demo com backend pronto | CURRENT / PARTIAL |
| C-03 | Infra "documentada" lida como pronta | `PREPARED`/`BLOCKED_BY_DECISION`; ADR-0001 PROPOSED; entry gate FAIL | PREPARED / BLOCKED |
| C-04 | Anthropic "implementado" | Offline COMPLETE; live/produção `BLOCKED_BY_EXTERNAL_PROVIDER` (Exclusão B) | BLOCKED |
| C-05 | Suíte "verde" vs corrida de seed | **RESOLVIDO** (GAP-008): seed concorrência-seguro; 271/271 estável | CURRENT (era PARTIAL) |
| C-06 | `docs/product`/`docs/specs` como fontes | **Vazios** (0 arquivos); referência funcional em `docs/frontend` + OpenAPI | CURRENT |

## Ações
- C-05 marcado **resolvido** (código + teste, commit aaddd4b).
- Demais permanecem factuais; nenhuma exigia alteração de ADR aprovada ou de status
  histórico. As correções desta fase (orfãos, assessment, seed) refinam C-01/C-02 sem
  reescrever o histórico. Documentos históricos não foram apagados.

Contradições materiais remanescentes que exigem mudança de **status histórico**: **0**.
