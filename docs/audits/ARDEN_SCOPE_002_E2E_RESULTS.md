<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002.5 — Resultados de E2E (reexecutados)

Todos os 9 specs de demonstração + 10 casos de api-mode **reexecutados** neste commit
(não histórico). Chromium real via `ARDEN_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Demo (IndexedDB, sem backend) — `npm run test:e2e` → **9/9 PASS** (36,3s)
command-palette (2), deployment (trava sequencial), detail-drawer, operations-flow
(persiste após reload), session-tenant (3: isolamento entre orgs, sessão expirada, sem
permissão de publicação), wizard (bloqueio real de publicação).

## API real (frontend api-mode ↔ backend NestJS + Postgres) — `npm run test:e2e:api` → **10/10 PASS** (45,9s)
anthropic-admin-api (4: produção bloqueada + catálogo sem preço; API key write-only +
canário ausente do DOM; rotação invalida smoke; ModelConfiguration nasce DRAFT bloqueada),
operations-api (3: CRUD+publish+audit via backend real; api-mode lê do backend sem fallback
mock; tenant alheio → 404), session-api (3: org do backend real; logout canônico; sem token
NÃO cai para mock).

## Nota sobre a primeira tentativa
A primeira execução falhou 9/9 por **incompatibilidade de binário do navegador** do
Playwright no sandbox ("Please run npx playwright install"), NÃO por defeito de produto.
Corrigido apontando o executável real (`ARDEN_CHROMIUM_PATH`), conforme a política do
ambiente (não rodar `playwright install`). Reexecução: verde.

## Fluxos obrigatórios (A–G) — cobertura
| Fluxo | Onde comprovado |
| --- | --- |
| A operação completa (login→tenant→operação→versão→autoridade→policy→publicar→execução→worker→resultado) | api-mode operations-api (create→publish→audit) + integração execution-flow/enforcement-flow (worker processa, resultado persiste) |
| B aprovação humana (suspende→aprova→retoma→resultado) | integração agent-tool-calling §38 + execution-critical §42 |
| C connector/tool offline | integração external-tool + connectors-persistence + secure-http |
| D agent offline (structured output→usage→cost null→avaliação) | integração agent-runtime §35 + agent-governance §42 |
| E Work Unit (contabilidade via execução/uso) | execution-flow + agent-governance (ver WORK_UNIT_DECISION) |
| F restart/recuperação (lease expira→retomada única) | execution-critical §41 |
| G cross-tenant (Alpha→Beta = 404) | multitenancy + operations-api (e2e) + 20+ specs |

## Bloqueados externos (§24) — não são falhas desta fase
Anthropic **live**, infraestrutura cloud, staging remoto, produção, backup/PITR/restore
real. Classificados EXCLUDED_ANTHROPIC / EXCLUDED_INFRASTRUCTURE.
