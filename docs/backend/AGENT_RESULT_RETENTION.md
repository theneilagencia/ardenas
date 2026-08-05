# Agent result retention (ARDEN-BE-007.6)

Política de retenção e classificação de dados dos registros operacionais. Reforça a regra do
BE-007: **nunca** persistir prompt, output bruto, contexto ou segredo — apenas hashes,
contadores, sumários e códigos.

## Classificação

| Categoria | Exemplos | Tratamento |
| --- | --- | --- |
| Dados seguros | tokens, contadores, custo, durações, status, provider/model key | persistidos em claro |
| Hashes | `output_hash`, `context_hash`, `request_hash`, `response_hash`, `input_hash` | persistidos |
| Sumários | `evaluationSummary.checks`, `governanceSummary` (códigos), warnings | persistidos, sanitizados |
| Sensível | prompt, system instructions, contexto bruto, output bruto, credencial | **jamais** persistido |

O canário de segredo dos testes (`AGENT_TOOL_CALLING_SECURITY.md`, §47 do governance spec)
verifica que nada disso vaza para result/usage/rollup/eventos/audit/métricas.

## Retenção

Os registros são append/idempotentes e tenant-scoped; ligados a `execution_run`/
`execution_step` do BE-005. A retenção segue a mesma janela dos artefatos de execução/
evidência do BE-005 — este milestone não implementa expurgo automático próprio (fica
alinhado à retenção de execução). Rollups são agregados diários sem PII e podem ser retidos
por mais tempo para análise de consumo.

## Tenancy

Toda linha carrega `organization_id`; toda consulta filtra por tenant (path
`organizations/{id}`). Sem FK cross-tenant, sem chave global. Ver `AGENT_MULTITENANCY.md`.
