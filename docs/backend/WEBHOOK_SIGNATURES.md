# Webhook de entrada — assinaturas (ARDEN-BE-006.7)

## Schemes

`HMAC_SHA256` (recomendado), `STATIC_BEARER`, `NONE` (proibido em produção).

## HMAC-SHA256

- Formato canônico: **`timestamp + "." + rawBody`** (bytes originais).
- Headers: `X-Arden-Timestamp`, `X-Arden-Signature` (`sha256=<hex>`),
  `X-Arden-Delivery-Id` (opcional), `X-Arden-Event-Type`.
- Comparação **constant-time** (`timingSafeEqual`); assinatura malformada rejeita;
  header ambíguo (múltiplos valores) rejeita.
- Segredo resolvido pelo `CredentialResolver` (versão específica do cofre).

## Static Bearer

`Authorization: Bearer <token>`; comparação constant-time; token do cofre; sem
fallback para query string; sem log/auditoria/exposição em erro.

## Timestamp

Unix seconds; rejeita futuro além de 60s de tolerância e além da janela de replay do
endpoint (`replayWindowSeconds`, default 300); relógio injetável em testes. Falha →
`WEBHOOK_TIMESTAMP_INVALID`.
