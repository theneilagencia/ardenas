# ARDEN-BE-006 — Relatório final (framework de conectores e ferramentas externas)

Milestone entregue em 8 sub-fases, todas PASS, na branch
`claude/arden-be-006-connectors-tools` (base: BE-005).

## Sub-fases

| Fase | Entrega |
| --- | --- |
| 006.1 | Plano de arquitetura + decisões (vault, SSRF, dependências) — só docs. |
| 006.2 | Contratos, catálogo, permissões, erros, OpenAPI, cliente gerado. |
| 006.3 | Persistência: 8 models, migration, projeção do catálogo, repos, state machines. |
| 006.4 | Cofre AES-256-GCM, ciclo de vida de credencial, redação, validação de startup, canários. |
| 006.5 | SecureHttpClient, classificação de IP, prevenção de SSRF, política de rede. |
| 006.6 | ExternalToolStepExecutor, resolvers, mapping, integração com o worker do BE-005. |
| 006.7 | Webhooks de entrada: token opaco, HMAC, timestamp, replay, trigger de execução. |
| 006.8 | Endpoints de catálogo/conexões + teste funcional, frontend de integrações, hardening, docs, PR. |

## Arquitetura

- **Contratos compartilhados** (`src/contracts/connectors/`) reexportados a API e o
  frontend; OpenAPI gerada e verificada (`contracts:openapi` sem diff).
- **Persistência** tenant-scoped com revision, índices únicos (credencial ativa única,
  delivery por external id) e state machines puras.
- **Cofre** AES-256-GCM com AAD por tenant/recurso, master key só em config, rotação por
  keyring, crypto-shredding na revogação.
- **SecureHttpClient**: classificação do IP final, pinning anti-rebinding, allowlist,
  redirects revalidados, https-only forçado em produção.
- **Executor externo** roteado por action key registrada (DI) no motor do BE-005; nunca
  por classe do banco; sem `eval`/shell.
- **Webhooks inbound** públicos autenticados por assinatura; gatilham execução SYSTEM
  pelo MESMO motor, idempotentes e com replay protection.
- **Frontend** (modo `api`) consome exclusivamente a API v1; segredos só em memória
  transitória do formulário.

## Migrations

Uma única migration em todo o 006 (`20260802001518_connectors_persistence`, fase 006.3).
Nenhuma migration nas fases 006.4–006.8 (os modelos e constraints já existiam).

## Dependências

Nenhuma dependência de runtime nova em todo o 006 — apenas `node:crypto/http/https/dns/
net` nativos + a stack existente (NestJS/Fastify/Prisma/Zod). Conforme a decisão de
006.1 (preferir nativo).

## Segurança

Ver [`ARDEN_BE_006_SECURITY_REVIEW.md`](./ARDEN_BE_006_SECURITY_REVIEW.md). Segredos
nunca em job/log/audit/evidence/idempotência/resposta/execução/cliente — comprovado por
canários em tools, webhooks e frontend (storage/DOM).

## Testes / evidências

Ver [`ARDEN_BE_006_FINAL_TEST_EVIDENCE.md`](./ARDEN_BE_006_FINAL_TEST_EVIDENCE.md) e os
relatórios por fase (`ARDEN_BE_006_{PERSISTENCE,VAULT,SECURE_HTTP,EXTERNAL_TOOLS,
WEBHOOKS}_REPORT.md`).

## Riscos remanescentes / decisões adiadas

- Rate limit de webhook em processo (Redis/distribuído adiado).
- Estado terminal dedicado para `EXTERNAL_RESULT_UNKNOWN` (adiado; hoje FAILED+flag).
- Rotação de token de webhook por endpoint dedicado (adiado; recriar emite novo token).
- OAuth, conectores SaaS específicos, mTLS/RSA: fora de escopo (ARDEN-BE-007+).
