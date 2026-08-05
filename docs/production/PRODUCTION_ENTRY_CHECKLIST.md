<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Checklist de entrada em produção

Gate **independente** de staging. Produção **não** é liberada só porque staging passou.
Estado atual: **BLOCKED**.

| # | Item | Estado |
| --- | --- | --- |
| 1 | staging stable | ❌ |
| 2 | restore drill PASS | ❌ |
| 3 | backup evidence present | ❌ |
| 4 | PITR evidence present | ❌ |
| 5 | security review | ❌ |
| 6 | legal approval | ❌ |
| 7 | operations owner | ❌ |
| 8 | on-call | ❌ |
| 9 | alerts tested | ❌ |
| 10 | rollback tested | ❌ |
| 11 | capacity reviewed | ❌ |
| 12 | RPO/RTO evidence | ❌ |
| 13 | aprovação humana | ❌ |

Anthropic permanece **DISABLED** independentemente deste gate. Ver `GO_LIVE_GATES.md`.
