# Redaction de credenciais — ARDEN-BE-006.4

`SensitiveDataRedactor` (`apps/api/src/common/redaction/sensitive-data-redactor.ts`):
- `redactObject` — recursiva, case-insensitive, arrays, **sem mutar** o original,
  resistente a circular (`[CIRCULAR]`).
- `redactHeaders` — redige `authorization`, `proxy-authorization`, `cookie`,
  `set-cookie`, `x-api-key`, `api-key`, `token`, `access_token`, `refresh_token`,
  `password`, `secret`, `client_secret`, `credential(s)`, e material do cofre
  (`encryptedSecret`/`nonce`/`authTag`/`masterKey`).
- `redactError` — reduz a `{ name, code?, message }` SEM stack e sem segredo (mensagem
  genérica quando suspeita).
- `redactUrl` — remove userinfo e redige query params sensíveis.

## Logger
Pino (`REDACT_PATHS`) redige headers/campos sensíveis e **não loga o body**. Requests
de credencial não são logados; exceptions não serializam o segredo (filtro global +
`credentialResolutionFailed` sanitizado). Redaction não depende do desenvolvedor
lembrar — é estrutural.
