# Anthropic — quotas e denial-of-wallet não produtivo (ARDEN-BE-008.4D)

> Limites server-side que contêm o custo das chamadas reais não produtivas. Nenhum valor
> monetário estimado é exibido (sem rate card verificado). Fonte: código do 008.4D.

## 1. Knobs e defaults (VERIFIED)

| Env | Default | Efeito |
| --- | --- | --- |
| `ANTHROPIC_NON_PROD_MAX_OUTPUT_TOKENS` | `256` | teto de tokens de saída por chamada |
| `ANTHROPIC_NON_PROD_DAILY_CALL_CAP` | `50` | máximo de chamadas por dia por organização |
| `ANTHROPIC_NON_PROD_MAX_CONCURRENCY` | `1` | chamadas reais simultâneas permitidas |

## 2. Clamp de `max_tokens` (VERIFIED)

No caminho real, o provider **força** (`clamp`) o `max_tokens` do request ao teto não produtivo
(`ANTHROPIC_NON_PROD_MAX_OUTPUT_TOKENS`), mesmo que a configuração peça mais. É o mesmo teto que
o smoke test usa para o payload sintético. Contém o custo máximo por chamada independentemente
do que a etapa solicite.

## 3. Cap diário e concorrência (VERIFIED)

- **cap diário por organização** (`ANTHROPIC_NON_PROD_DAILY_CALL_CAP`, 50/dia): excedido → a
  chamada é negada antes de tocar o SDK, sem retry storm;
- **concorrência** (`ANTHROPIC_NON_PROD_MAX_CONCURRENCY`, 1): mais de uma chamada real simultânea
  é negada — limita gasto paralelo.

Ambos são avaliados server-side, por organização, e combinam com o circuit breaker
(`ANTHROPIC_CIRCUIT_BREAKER.md`) como defesa contra denial-of-wallet.

## 4. Sem valor monetário (VERIFIED)

Nenhum **valor monetário estimado** é exibido: sem rate card verificado, `estimatedCostMinor` e
`currency` ficam `null` e o sistema emite `COST_RATE_CARD_NOT_AVAILABLE`. As quotas são o
controle de custo desta fase; a contenção é por **tokens/chamadas**, não por moeda. Nunca
exibir custo `0` como se fosse conhecido — ausência de preço verificado é `null`.

## 5. NUNCA

- deixar o request escolher `max_tokens` acima do teto não produtivo (o clamp é obrigatório);
- ignorar o cap diário ou a concorrência para "só uma chamada a mais";
- exibir valor monetário estimado sem rate card verificado;
- reprocessar em loop uma chamada negada por quota (sem retry storm).
