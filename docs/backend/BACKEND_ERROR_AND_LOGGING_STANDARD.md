# Arden.AS — Padrão de Erros e Logging (ARDEN-BE-001)

## Erros

Envelope único do contrato (`@arden/contracts` · `ApiErrorResponse`):

```jsonc
{ "error": { "code": "…", "message": "…", "correlationId": "…",
             "details": { }, "fieldErrors": [ { "field": "…", "code": "…", "message": "…" } ] } }
```

- `AllExceptionsFilter` (global) serializa **qualquer** erro nesse envelope.
- Códigos vêm do **catálogo do contrato** (`ApiErrorCode`), com HTTP em
  `ERROR_HTTP_STATUS`. `ApiException` carrega o código.
- Mapeamentos: `ApiException` → seu código/status; `ZodError` → `VALIDATION_ERROR`
  (422) + `fieldErrors`; `HttpException` do Nest → código correspondente (404 →
  `RESOURCE_NOT_FOUND`, etc.); desconhecido → `INTERNAL_ERROR` (500).
- **Nunca** retorna: stack trace, SQL, path local, segredo, objeto bruto de erro.
- `correlationId` está **sempre** presente no corpo e no header da resposta.
- Recurso de **outro tenant** deve retornar `RESOURCE_NOT_FOUND` (não revelar
  existência) — regra para os módulos futuros.

## Correlation ID

- Header `X-Correlation-Id`. O cliente **pode** enviar; o servidor **gera** um UUID
  quando ausente/ inválido, **ecoa** na resposta e o inclui em logs e erros.
- Validação de formato/comprimento (não confia em strings arbitrariamente grandes).

## Logging

- Pino (nestjs-pino), estruturado. Cada requisição registra: **método, path, status,
  duração, correlationId, ambiente, versão**.
- **Redaction** (nunca logar segredos): `Authorization`, `cookie`/`set-cookie`,
  `x-api-key`, e chaves `*.password`/`*.token`/`*.secret`. Ver `common/constants.ts`
  (`REDACT_PATHS`).
- Body completo **não** é logado por padrão.
- Em `development`, saída legível (`pino-pretty`); em `production`, JSON puro.
