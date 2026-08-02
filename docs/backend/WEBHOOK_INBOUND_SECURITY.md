# Webhook de entrada — segurança (ARDEN-BE-006.7)

## Invariantes

- **Tenant sempre do endpoint persistido**, nunca do request. `organizationId`,
  `operationId`, `operationVersionId`, `userId`, status e permissões do payload são
  IGNORADOS.
- **Token opaco**: `whk_<256 bits>`, exibido UMA vez na criação; persistido só como
  hash SHA-256; lookup por hash; comparação constant-time. Nunca logado/auditado/
  retornado em GET/list/update.
- **Segredo de assinatura**: cifrado no cofre (AES-256-GCM), resolvido server-side
  imediatamente antes da verificação, descartado após uso. Nunca em log, auditoria,
  evidência, delivery, `idempotency_records` em claro, resposta ou execução.
- **Raw body**: a assinatura é verificada sobre os BYTES ORIGINAIS; JSON reserializado
  NÃO valida. Parse só após autenticar.
- **NONE proibido em produção** (bloqueado na criação e na entrada); nunca default.
- **Autorização de gatilho**: execução criada como SYSTEM só quando a autoridade do
  BE-004 resulta `ALLOWED`. Nunca fabrica `ActionAuthorization`; se exigir aprovação,
  `WEBHOOK_TRIGGER_DENIED` (delivery aceita, sem execução).
- **Resposta pública mínima**: não revela tenant, operação, scheme esperado, existência
  do endpoint (token inválido é indistinguível de 404), hash ou política.

## Rate limiting

Em processo, por `tokenHash + IP` (não confia em `X-Forwarded-For`; usa `req.ip` do
socket). Excesso → `RATE_LIMITED` (429). Ver
[`WEBHOOK_RATE_LIMITING.md`](./WEBHOOK_RATE_LIMITING.md).

## Limites

Payload ≤ 256 KB (além do limite global de body). Excedido → `REQUEST_TOO_LARGE`.
