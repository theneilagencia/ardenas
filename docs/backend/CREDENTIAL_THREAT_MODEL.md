# Threat model de credenciais (implementado) — ARDEN-BE-006.4

| Ameaça | Controle | Teste |
|---|---|---|
| Plaintext no banco | só ciphertext AES-GCM; nunca plaintext/Base64-do-segredo | canário: ausente no banco |
| Plaintext em resposta | serializador só de metadados; secret write-only | integração + canário |
| Plaintext em log | Pino não loga body; REDACT_PATHS; redactor | redaction unit + logger silent |
| Plaintext em auditoria | AuditRecorder redige; nunca passa segredo | canário na auditoria |
| Plaintext em idempotência | `idempotency_records` guarda só hash + metadados | canário no idem store |
| Master key no Git/banco | só via env; `.env.example` com placeholder; secret hygiene CI | — |
| Master key ausente/inválida | startup falha em production | vault-config unit |
| Nonce reutilizado | `randomBytes(12)` por operação | aes-gcm unit |
| Troca de ciphertext entre tenants | AAD (org/conn/version/keyVersion) → falha | teste de troca de ciphertext |
| Rotação concorrente | índice parcial único + tx | rotação concorrente |
| Rollback parcial | criação/rotação atômica (tx única) | rollback |
| Revogada resolvível | crypto-shredding + resolver bloqueia | revogação |
| Cross-tenant | tenant em toda query; AAD; 404 sem revelar | cross-tenant |
| Fake em produção | factory + config falham | vault-config unit |

Pendências: envelope com DEK separada e re-encryption de master key (fases futuras).
