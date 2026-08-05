<!-- Milestone: ARDEN-PRD-001.1 -->
# ARDEN-PRD-001.1 — Modos de falha de secrets (fail-closed)

Mensagens PÚBLICAS sanitizadas (nunca incluem valor/material):

| Código | Situação |
| --- | --- |
| `PLATFORM_SECRET_UNAVAILABLE` | secret de plataforma obrigatório ausente/vazio |
| `PLATFORM_SECRET_SOURCE_NOT_CONFIGURED` | origem `external` sem adapter |
| `PLATFORM_SECRET_SOURCE_NOT_ALLOWED` | produção + `environment` sem aprovação explícita |
| `MASTER_KEY_CONFIGURATION_INVALID` | keyring sem primária / material inválido / versão duplicada |
| `MASTER_KEY_VERSION_UNAVAILABLE` | ciphertext referencia versão ausente do keyring |
| `SECRET_DECRYPTION_FAILED` | decrypt/auth-tag/AAD inválida (do cofre) |
| `MASTER_KEY_BACKUP_INVALID` | formato/checksum/wrapping-key do backup inválidos |
| `MASTER_KEY_RESTORE_VERIFICATION_FAILED` | restore não valida (chave errada/adulteração) |

## Nunca
tentar outra chave indiscriminadamente · ignorar auth failure · retornar plaintext parcial ·
marcar secret como vazio · substituir por default · logar material de chave/valor/ciphertext/
auth tag/nonce/wrapping key.

## Redação
Reutilizar/estender `apps/api/src/common/redaction/sensitive-data-redactor.ts` para bloquear
esses campos em logs e mensagens de erro. Integração completa do redactor a esses novos
códigos: **PARTIALLY_CLOSED** (os erros já são sanitizados na origem; auditoria de log de
ponta a ponta é item aberto).
