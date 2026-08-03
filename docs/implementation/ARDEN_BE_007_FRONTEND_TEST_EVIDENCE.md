# ARDEN-BE-007.7 — Evidência de teste (frontend de agentes)

> Esqueleto. Os resultados de gate (contagens, pass/fail, cobertura) são preenchidos pela
> sessão em execução após rodar os gates — **não** editar manualmente os números aqui.

## Categorias

| Categoria | Escopo | Resultado |
| --- | --- | --- |
| Unit | helpers puros de apresentação (`agent-format`: `formatMinorCost` null vs zero, `toMinorUnits`/`fromMinorUnits` sem float) | _(gate)_ |
| Component | telas (lista/detalhe/editor/configurações/resultados/usage): loading/vazio/erro/sem-permissão, seções do editor | _(gate)_ |
| Integration | hooks → aplicação → repositório API v1 (`client-compat`); tenant da sessão; `expectedRevision`/idempotência | _(gate)_ |
| E2E | fluxo consultar providers → config → agente → versão → publicar → resultado → usage | _(gate)_ |
| Canary | sem segredo/prompt/instrução em storage/URL/logs/analytics/erro serializado | _(gate)_ |
| Cost | null → "Custo não disponível"; zero conhecido → formatado; nunca "0,00" para null | _(gate)_ |
| Published-read-only | versão publicada sem PATCH; CTA "criar nova versão" | _(gate)_ |
| Cross-tenant | isolamento por organização ativa; sem vazamento entre tenants | _(gate)_ |

## Gates

- Lint / typecheck: _(gate)_
- Testes: _(gate)_
- Arquitetura (`src/test/architecture.test.ts` — features não importam repositórios): _(gate)_
