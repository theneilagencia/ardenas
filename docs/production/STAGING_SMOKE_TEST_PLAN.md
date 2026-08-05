<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Plano de smoke de staging

Suíte provider-neutra: `tooling/infrastructure/smoke.ts`. **URL obrigatória e explícita**;
sem URL → **não executa** (nunca aponta implicitamente para localhost). Alvo Anthropic é
rejeitado.

## Cobertura
`/live` · `/ready` · autenticação · tenant isolation · CRUD de recurso simples · worker
adquire/conclui job controlado · connector vault canário · migration status · OpenAPI ·
nenhum Anthropic · nenhuma chamada externa não aprovada.

## Execução
Só contra staging futuro, com URL passada por parâmetro. Nesta fase: **não executado
remotamente**; Anthropic **não exercitado**.
