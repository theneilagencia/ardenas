# Segurança da ferramenta externa — ARDEN-BE-006.6

> Invariantes de segurança da execução de conector. Reforça
> [`EXECUTION_SECURITY`](./EXECUTION_SECURITY.md), o cofre
> ([`CREDENTIAL_VAULT_ARCHITECTURE`](./CREDENTIAL_VAULT_ARCHITECTURE.md)) e o cliente
> HTTP seguro ([`SECURE_HTTP_CLIENT`](./SECURE_HTTP_CLIENT.md)).

## Segredo

- Resolvido **server-side** pelo `CredentialResolver` **imediatamente antes** da
  chamada; re-resolvido a cada tentativa; **nunca** cacheado para retries futuros.
- Usado só para montar a autenticação; a referência ao plaintext é **descartada** logo
  após montar o request.
- **Nunca** entra em job, log, auditoria, evidência, idempotência, snapshot da
  execução, output ou erro. Comprovado por teste de canário
  (`ARDEN_BE006_TOOL_SECRET_CANARY_<UUID>`).

## Rede (SSRF)

- Toda chamada passa pelo `SecureHttpClient`: classificação do IP final, pinning
  anti-rebinding, allowlist de host/porta, redirects revalidados, timeout e limites de
  payload. Em produção a política é forçada a **https-only**, sem redes privadas/
  loopback/link-local.
- O input da etapa fornece apenas **path relativo/query/body** dentro do **endpoint
  fixo** da configuração; **URL absoluta arbitrária é rejeitada**.
- Headers sensíveis vindos do input (`authorization`, `cookie`, `x-api-key`, …) são
  **rejeitados**; headers proibidos são removidos pelo cliente HTTP.

## Autorização e tenant

- `integration.execute` (server-side) exigida para execução com etapa externa, além da
  autoridade do BE-004 e da `ActionAuthorization` quando aplicável.
- Toda resolução é `findFirst` por `organizationId`; o worker usa o tenant da LINHA do
  run, **nunca** do payload. Cross-tenant → não encontrado.

## Execução

- Executor selecionado por **action key registrada** (DI), nunca por classe do banco;
  sem `eval`/`Function`/import dinâmico/shell/scripts.
- `internal.test` (fake/echo/failure/timeout) **proibido em produção**.
- Sem endpoint de execução direta de ferramenta — a execução ocorre exclusivamente
  pelo motor de operações.
