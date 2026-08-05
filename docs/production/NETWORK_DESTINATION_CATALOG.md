<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Catálogo de destinos de rede/egress

Fonte executável: `tooling/infrastructure/network-catalog.ts`. Egress **default DENY**.

| Destino | Estado |
| --- | --- |
| PostgreSQL | REQUIRED |
| Secret manager | REQUIRED após seleção (hoje UNVERIFIED) |
| Observability | REQUIRED após seleção (hoje UNVERIFIED) |
| Container registry | REQUIRED após seleção (hoje UNVERIFIED) |
| Anthropic | **BLOCKED** |
| Internet genérica | **BLOCKED** |

## Invariantes (teste)
- **Nenhum** domínio Anthropic entra na allowlist (`validateEgressAllowlist` rejeita).
- Curinga total (`*`, `0.0.0.0/0`, `::/0`) proibido.
- `defaultPolicy` deve ser DENY.

Complementa a defesa de aplicação (SSRF guard, BE-006.5) — duas camadas.
