# ARDEN-BE-006 — Revisão de segurança

## Sweep automatizado (§40)

| Busca | Resultado |
| --- | --- |
| `findUnique({ where: { id } })` fora de tenant | Apenas `findRunById` (worker) — usa `run.organizationId` como tenant CONFIÁVEL; o step executor revalida `run.organizationId === ctx.organizationId`. Catálogo é system-managed. |
| `console.log/error/warn` | Nenhum em `connectors/`/`executions/`. |
| `TODO`/`FIXME` | Nenhum (apenas a palavra "TODOS" em comentários pt-BR). |
| `any` / `@ts-ignore` / `eslint-disable` | Nenhum. |
| `JSON.stringify(secret)` / log de segredo | Apenas na serialização canônica ANTES da cifragem (vault) — o resultado é cifrado, nunca logado. |
| `endpointToken` | Retornado UMA vez na criação; `null` em replay; persistido só como hash. |
| `rawBody` | Usado só para verificar HMAC; nunca logado/auditado/evidenciado. |
| `@Public()` | Apenas o webhook de entrada. |

## Invariantes verificadas

- **Multitenancy**: toda leitura tenant-scoped é `findFirst` por `organizationId`;
  cross-tenant → 404 (anti-enumeração). Testes cross-tenant em tools e webhooks.
- **Segredos**: cifrados (AES-256-GCM), resolvidos server-side, descartados após uso;
  ausentes de job, log, auditoria, evidência, idempotência, resposta e execução —
  comprovado por canários (`ARDEN_BE006_*_CANARY`) em tools, webhooks e (frontend)
  storage/DOM.
- **SSRF**: toda chamada externa passa pelo `SecureHttpClient` (classificação de IP
  final, pinning anti-rebinding, allowlist, https-only forçado em produção). URL
  absoluta do input rejeitada; header sensível do input rejeitado.
- **Webhook inbound**: token opaco (hash), HMAC sobre raw body constant-time,
  timestamp + replay, tenant do endpoint, `NONE` proibido em produção, gatilho só com
  autoridade ALLOWED, rate limit, limite de payload.
- **Execução**: executor por action key registrada (DI), nunca por classe do banco;
  sem `eval`/shell/scripts; `internal.test` proibido em produção.
- **Concorrência**: revision otimista + índices únicos (credencial ativa única,
  delivery por external id) + `runIdempotentCommand`.

## Riscos remanescentes (aceitos / adiados)

- Rate limit de webhook é EM PROCESSO (não distribuído). Adequado a single-instance;
  Redis/distribuído é decisão futura.
- `EXTERNAL_RESULT_UNKNOWN` mapeia para etapa FAILED+flag (sem estado terminal dedicado
  de "aguardando intervenção") — documentado em `EXTERNAL_RESULT_UNKNOWN.md`.
- Rotação de token de webhook não tem endpoint dedicado (decisão futura; recriar
  endpoint emite novo token).
