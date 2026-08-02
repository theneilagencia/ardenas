# ARDEN-BE-006.7 — Evidência de testes (webhooks de entrada)

## Unidade (`apps/api/src/connectors/webhooks/*.spec.ts`) — 31 casos

- `webhook-token.spec.ts` (5): formato `whk_`, entropia, unicidade, hash SHA-256,
  constant-time.
- `webhook-signature.spec.ts` (23): timestamp (janela/limite/1s fora/futuro/malformado);
  HMAC válido; **corpo re-serializado NÃO valida** (raw body); segredo errado; assinatura
  malformada; timestamp muda a assinatura; bearer válido/inválido/ausente/malformado.
- `webhook-rate-limiter.spec.ts` (3): limite por janela; janela desliza; chaves distintas.

## Integração (`apps/api/test/webhook-inbound.integration.spec.ts`) — 12 casos

PostgreSQL, fila e worker reais:

1. **E2E**: assinado → 202 → delivery → execução SYSTEM → worker → SUCCEEDED; evidência
   com `payloadHash`; audit `webhook.execution_created`; **canário ausente** de tudo.
2. Assinatura inválida → 401, sem delivery, sem execução.
3. Timestamp expirado → 401 `WEBHOOK_TIMESTAMP_INVALID`.
4. **Raw body**: bytes exatos assinam; corpo re-serializado → 401.
5. Replay (mesmo delivery id + payload) → `replayed`, sem nova execução.
6. **CRÍTICO concorrência**: dois requests idênticos simultâneos → uma execução, um job.
7. **CRÍTICO conflito**: mesmo delivery id, payload diferente → 409 `WEBHOOK_DELIVERY_CONFLICT`.
8. Event type não permitido → 422.
9. Suspenso bloqueia (404); reativado aceita (202); revogado bloqueia (terminal).
10. Token não retorna em GET; sem `pathTokenHash`.
11. **CRÍTICO cross-tenant**: token de Alpha usa operação de Alpha; Beta sem execução;
    segredo de Alpha não valida em Beta.
12. Token inexistente → 404 indistinguível.

Persistência (006.3) atualizada: endpoint HMAC agora cifra o segredo (cofre) e
`secretCredentialVersionId` é populado.

## Testes críticos cobertos

- **Assinatura/canário**: casos 1, 2, 11.
- **Raw body**: caso 4.
- **Timestamp**: caso 3 (+ unidade janela/futuro/malformado).
- **Replay/concorrência**: casos 5, 6.
- **Delivery conflict**: caso 7.
- **Cross-tenant**: caso 11.
- **E2E API + worker**: caso 1 + estados (9).

Nenhuma suíte anterior foi removida; todas permanecem verdes.
