# ARDEN-BE-006 — Vertical slice

Fluxo funcional completo coberto por testes de integração (API + fila + worker +
servidores locais; nunca a internet):

```
catálogo (GET /connectors)
→ criar conexão (POST /connections)
→ cadastrar credencial (POST /connections/{id}/credentials, segredo write-only, cifrado)
→ testar conexão (POST .../test → SecureHttpClient, resultado sanitizado)
→ ativar (POST .../activate)
→ criar organization tool binding (POST /tool-bindings)
→ vincular à operação (POST /operations/{id}/tool-bindings, alias)
→ publicar versão com etapa externa (tool: { alias, actionKey })
→ iniciar execução por API OU por webhook assinado
→ worker resolve binding → conexão → credencial → SecureHttpClient → valida output
→ SUCCEEDED / FAILED / EXTERNAL_RESULT_UNKNOWN
→ evidência + auditoria sanitizadas
→ rotacionar/revogar credencial · suspender/revogar conexão · replay bloqueado
```

## Cobertura de testes por etapa

| Etapa | Teste |
| --- | --- |
| Catálogo + conexão CRUD + test + lifecycle | `connections-api.integration.spec.ts` |
| Tool binding + execução externa (http/webhook) + retry/UNKNOWN + cross-tenant | `external-tool.integration.spec.ts` |
| Webhook inbound (HMAC, replay, conflito, trigger→execução, worker) | `webhook-inbound.integration.spec.ts` |
| Vault (cifragem, rotação, revogação, canário) | `credential-vault*.integration.spec.ts` |
| SecureHttpClient/SSRF | `secure-http-client.integration.spec.ts` + unit |
| Persistência/state machines/multitenancy | `connectors-persistence` / `connectors-critical` |

## Frontend

Modo `api` (`VITE_DATA_PROVIDER=api`): a página de Integrações consome exclusivamente a
API v1 (catálogo, conexões, credenciais, tool bindings, webhooks) via o cliente gerado
`ApiV1HttpClient` → repositório `connectors` → use-cases → hooks React Query. Segredos e
token one-time vivem só no estado local do formulário; nunca em store/IndexedDB/
localStorage/URL. Ver `FRONTEND_TO_API_V1_MAP.md`.
