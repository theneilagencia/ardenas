# Erros e retry do provider comercial (ARDEN-BE-008, auditoria)

> Doc de AUDITORIA (sem código). Primeiro provider comercial (candidato líder: Anthropic
> Claude — REQUER VERIFICAÇÃO EXTERNA de SDK/endpoints/códigos de erro na implementação).
> O provider comercial NÃO substitui as regras do runtime (BE-007): apenas mapeia erros de
> rede/HTTP para os códigos canônicos já existentes e delega o retry ao motor do BE-005.

## Princípios

- **Resultado incerto → `UNKNOWN`, nunca sucesso.** Uma chamada cujo efeito não é conhecido
  (envio possível, sem resposta confirmada) vira `MODEL_RESULT_UNKNOWN`; o runtime já trata
  UNKNOWN e **nunca** o promove a SUCCEEDED (BE-007.3/.6). Invariante de resultado:
  SUCCEEDED exige output válido.
- **Não re-tentar automaticamente chamadas com efeito não-idempotente sem prova de
  idempotência.** Uma chamada de geração que já pode ter disparado orquestração de tools
  (efeito colateral não-idempotente) não é repetida às cegas. Espelha `EXTERNAL_RESULT_UNKNOWN`
  do BE-006.6.
- **Mapear erros do provider para códigos canônicos** (`MODEL_*` do BE-007.3), nunca vazar o
  erro bruto do SDK para o domínio.
- **Timeout/abort via `AbortSignal`** ligado ao timeout do `AgentExecutionPolicy`; sem
  `sleep` de espera ativa. O retry em si (backoff/`maxAttempts`) é do motor do BE-005 — não
  há mecanismo de retry paralelo dentro do provider.
- **Retryável ≠ não-retryável.** Retryável: rede/5xx/429 com backoff. Não-retryável: 4xx de
  request inválido, content filter, e qualquer resultado incerto.

## Matriz

| Situação do provider | Retry automático | Status interno | Observação |
| --- | --- | --- | --- |
| timeout **antes** do envio | sim (rede, backoff) | FAILED · `AGENT_TIMEOUT` | request comprovadamente não saiu → repetível pelo motor do BE-005 |
| timeout **após** envio, efeito incerto | **não** | **UNKNOWN** · `MODEL_RESULT_UNKNOWN` | pode ter gerado/orquestrado; nunca vira sucesso nem é repetido às cegas |
| rate limit (429) | sim, com backoff | FAILED · `MODEL_RATE_LIMITED` | respeita `Retry-After`/janela do provider; teto de backoff do motor |
| 5xx (erro do provider) | sim, com backoff | FAILED · `MODEL_PROVIDER_ERROR` | transiente; retry apenas se a chamada não tem efeito não-idempotente pendente |
| invalid request (4xx ≠ 429) | **não** | FAILED · `MODEL_PROVIDER_ERROR` (request inválido) | erro determinístico (schema/modelId/params) — repetir não muda o resultado |
| content filter | **não** | FAILED · `MODEL_CONTENT_FILTERED` | decisão do provider; `finishReason = CONTENT_FILTER`; não retryável |
| connection reset | condicional | FAILED · `MODEL_PROVIDER_ERROR` (rede) / **UNKNOWN** se envio incerto | se não há garantia de que a resposta não foi produzida → UNKNOWN |
| malformed response (resposta ilegível) | **não** | FAILED · `MODEL_PROVIDER_ERROR` | resposta chegou mas não parseável; sem output válido → nunca SUCCEEDED |
| request aceito **sem** resposta | **não** | **UNKNOWN** · `MODEL_RESULT_UNKNOWN` | aceito mas sem corpo/stream utilizável; efeito incerto |

## Mapeamento de `finishReason`

`ModelGenerationResult.finishReason ∈ STOP | TOOL_CALL | MAX_TOKENS | CONTENT_FILTER | ERROR`.

- `STOP` / `TOOL_CALL` → prosseguem no fluxo normal do runtime (output ou tool call
  revalidada pelo `AgentToolCallGate`, BE-007).
- `MAX_TOKENS` → sem output completo; tratado como falha de saída (não SUCCEEDED sem output
  válido), candidato a `AGENT_OUTPUT_INVALID`/repair conforme política.
- `CONTENT_FILTER` → `MODEL_CONTENT_FILTERED`, não retryável.
- `ERROR` → classificado pela matriz acima; **uma resposta incerta nunca vira `finishReason`
  de sucesso**.

## Invariantes

- O runtime já lida com resultados incertos: recorder **nunca** marca output
  inválido/desconhecido como PASSED; UNKNOWN é preservado com evidência (BE-007.6).
- Replays são idempotentes (checkpoints do BE-005; `ActionAuthorization` de uso único),
  então uma re-execução autorizada não duplica efeitos aprovados.
- Nenhum retry cross-provider e nenhum fallback silencioso de modelo (ver
  `COMMERCIAL_PROVIDER_MODEL_CATALOG.md`).

## REQUER VERIFICAÇÃO EXTERNA (na implementação)
- códigos/classes de erro reais do SDK e o header de `Retry-After`/limites do provider;
- comportamento de streaming vs. não-streaming quando a conexão cai a meio;
- semântica de idempotency-key do provider (se houver) para tornar retries seguros.
