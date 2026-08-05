<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Anthropic: gates de produção deferidos

O ARDEN-PRD-001 **não** tenta resolver estes gates. Deve apenas garantir que **produção
permaneça bloqueada** para Anthropic. Estado herdado do ARDEN-BE-008 (merged):

```
Provider persisted status: DISABLED
productionAllowed:         false
Live smoke:                NOT EXECUTED
Live structured output:    NOT VERIFIED
Live usage:                NOT VERIFIED
Live tool calling:         NOT VERIFIED
Pricing:                   UNVERIFIED
Retention:                 UNVERIFIED
Training:                  UNVERIFIED
Data residency:            UNVERIFIED
DPA:                       UNVERIFIED
Sub-processors:            UNVERIFIED
Production:                BLOCKED
```

## Reforço de bloqueio em produção
- Provider persistido DISABLED (seed) + `productionAllowed=false`.
- Runtime recusa em production mesmo com flags `true` (`MODEL_PROVIDER_DISABLED`).
- **Egress Anthropic em DENY** na rede de produção (ver `SECURITY_OPERATIONS.md`).
- Fixture `CONNECTOR_MASTER_KEY` recusada em production (`env.schema.ts`).

## O que liberaria (fora deste milestone)
Credencial oficial de teste + autorização de operador + ambiente não produtivo allowlisted
→ live smoke/structured output/usage/tool calling; documentação oficial de pricing +
retention + training + ZDR + data residency + DPA + sub-processors; decisão de produto
para `productionAllowed=true`. Referência: `docs/implementation/ARDEN_BE_008_DEFERRED_PRODUCTION_GATES.md`.
