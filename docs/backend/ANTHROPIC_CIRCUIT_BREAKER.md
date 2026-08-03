# Anthropic — circuit breaker do caminho real (ARDEN-BE-008.4D)

> Disjuntor que interrompe chamadas reais após falhas consecutivas, evitando retry storm e
> gasto repetido contra um provider indisponível. In-memory, por processo. Fonte: código do
> 008.4D.

## 1. Estados (VERIFIED)

| Estado | Significado |
| --- | --- |
| `CLOSED` | chamadas reais permitidas (estado normal) |
| `OPEN` | chamadas reais **negadas** de imediato, sem tocar o SDK |
| `HALF_OPEN` | permite uma tentativa de sondagem após o cooldown |

## 2. Thresholds e cooldown (VERIFIED)

- abre (`CLOSED → OPEN`) após `ANTHROPIC_CIRCUIT_BREAKER_THRESHOLD` (default **5**) falhas
  **consecutivas**;
- transita `OPEN → HALF_OPEN` após `ANTHROPIC_CIRCUIT_BREAKER_COOLDOWN_MS` (default **60000ms**);
- em `HALF_OPEN`, **sucesso** reseta para `CLOSED` (zera o contador); falha volta a `OPEN`.

Um sucesso a qualquer momento reseta o contador de falhas consecutivas.

## 3. Sem retry storm (ARCHITECTURAL_DECISION)

Enquanto `OPEN`, as chamadas são negadas **antes** de tocar a rede — o disjuntor troca N
tentativas falhas por uma recusa barata, sem martelar o provider nem acumular gasto. Combina com
as quotas (`ANTHROPIC_NON_PROD_QUOTAS.md`): quota limita o volume permitido, o breaker corta o
caminho quando o provider está falhando.

## 4. Escopo in-memory (limitação documentada)

O estado é **in-memory, por processo** — não é compartilhado entre instâncias/workers nem
persistido. Consequências assumidas nesta fase:

- reinício de processo **reseta** o breaker para `CLOSED`;
- com múltiplos processos, cada um mantém seu próprio estado (não há coordenação global).

Aceitável porque o caminho real é **não produtivo e restrito** (allowlist + quotas por
organização). Um breaker distribuído/persistido fica **DEFERRED** para uma fase de produção.

## 5. NUNCA

- reintroduzir retry cego que ignore o estado `OPEN`;
- tratar o breaker in-memory como garantia global entre processos;
- abrir/fechar o breaker a partir de entrada do request (estado é server-side por falhas reais).
