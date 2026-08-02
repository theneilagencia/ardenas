# ARDEN-BE-006 — Notas de deployment

## Variáveis obrigatórias (cofre de credenciais)

| Variável | Descrição |
| --- | --- |
| `CONNECTOR_VAULT_PROVIDER` | `app-aes-gcm` (produção) ou `fake` (proibido em produção). |
| `CONNECTOR_MASTER_KEY` | Chave mestra base64 de **32 bytes**. Obrigatória em produção. NÃO no banco, NÃO no Git. |
| `CONNECTOR_KEY_VERSION` | Versão da chave corrente (ex.: `v1`), para rotação. |
| `CONNECTOR_KEYRING_JSON` | (Opcional) JSON de chaves anteriores para decifrar versões antigas após rotação. |

### Geração segura da master key

```
openssl rand -base64 32
```

Armazene em um secret manager (nunca em `.env` versionado). A API **falha ao subir** se
`app-aes-gcm` estiver ativo sem uma chave válida de 32 bytes (fail-closed).

## Webhook / raw body

- O bootstrap habilita `rawBody: true` (Fastify) — necessário para verificar HMAC sobre
  os bytes originais. Não desabilitar.
- Endpoint público: `POST {API_PREFIX}/webhooks/{token}`. Sem Bearer de sessão.
- `signatureScheme=NONE` é **proibido em produção** (bloqueado na criação e na entrada).

## Proxy / IP

- `req.ip` (socket) é usado para rate limit; **não** confiar em `X-Forwarded-For`. Se
  houver proxy reverso confiável, configure `trustProxy` do Fastify explicitamente
  (fora do escopo desta fase).

## Worker

- Processo lógico separado (`ARDEN_WORKER=1 node dist/worker.js`). Reutiliza o motor do
  BE-005. Não carrega segredo no job (só `executionRunId`); resolve credencial
  server-side por tentativa.

## Rate limit

- Webhook: em processo (single-instance). Para múltiplas instâncias, um limitador
  distribuído (Redis) é decisão futura.

## Migrations / seed

```
npm run db:migrate:deploy   # aplica migrations (nenhuma nova em 006.6/.7/.8)
npm run db:migrate:status   # deve reportar "up to date"
npm run db:seed             # idempotente (catálogo + permissões); pode rodar 2×
```

## Rollback

- As migrations de 006 (`20260802001518_connectors_persistence`) são aditivas. Rollback
  de código para o BE-005 mantém as tabelas de conector inertes (sem controllers). Não
  editar migrations aplicadas; correções via migration nova.

## Monitoramento

- Auditoria (`audit_events`) cobre `connection.*`, `credential.*`, `tool_binding.*`,
  `external_tool.*`, `webhook.*`. Evidências de execução carregam hashes e fingerprint,
  nunca segredo. Correlacione por `correlationId`.
