<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Matriz comparável de custos

Tabela comparativa **sem valores** até anexar cotações oficiais. **Nunca usar `0` para
desconhecido.** Estados permitidos por célula: `TBD` · `NOT_INCLUDED` · `NOT_AVAILABLE` ·
`REQUIRES_QUOTE`. Uma cópia por **cenário** (STAGING / PILOT / INITIAL_PRODUCTION).

## Cenário: `TBD` (STAGING | PILOT | INITIAL_PRODUCTION)

Moeda: `TBD` · Região: `TBD` · Data de referência (UTC): `TBD`

| Componente | GCP (B) | PaaS (D) | AWS (A) |
| --- | --- | --- | --- |
| Frontend/CDN | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| API | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Worker | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| PostgreSQL | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| HA | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Backups | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| PITR | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Storage | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Egress | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Secret manager | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Logs | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Metrics | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Tracing | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Error tracking | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Registry | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| WAF | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| Suporte | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |
| **Total** | REQUIRES_QUOTE | REQUIRES_QUOTE | REQUIRES_QUOTE |

## Regras de preenchimento

- Só substituir `REQUIRES_QUOTE` por valor com **cotação oficial anexada** (referência em
  `INFRASTRUCTURE_QUOTE_TEMPLATE.md`).
- `NOT_INCLUDED` = componente não faz parte da proposta daquele fornecedor.
- `NOT_AVAILABLE` = fornecedor não oferece o componente (impacta critérios eliminatórios).
- `TBD` = hipótese ainda não definida pelo negócio.
- **Total** só é numérico quando **todas** as linhas do fornecedor forem numéricas ou
  `NOT_INCLUDED`; caso contrário, `Total = REQUIRES_QUOTE`.

## Referências de fonte

Preços oficiais e calculadoras: S5 do `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`
(`REQUIRES_SALES_CONFIRMATION`). **Nenhum preço estimado por fonte não oficial.**
