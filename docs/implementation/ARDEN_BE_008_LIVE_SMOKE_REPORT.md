# ARDEN-BE-008.4 — smoke test real controlado e habilitação restrita (relatório)

Fase que comprova o provider com uma chamada real mínima e controlada em ambiente NÃO
produtivo, **sem** remover os bloqueios de produção. Quatro gates sequenciais. Executada em
**2026-08-03**. Nenhum segredo real usado; nenhuma chamada externa realizada nesta execução.

## Gate 008.4A — verificação oficial manual/por documentos

**Resultado: B (insuficiente).** Não foi fornecido nenhum documento oficial pelo responsável
técnico, e o acesso automatizado às páginas oficiais permanece **403** (Cloudflare) — reconfirmado
em 2026-08-03T15:51Z (`docs.anthropic.com/.../pricing`). Ver o log histórico em
`ARDEN_BE_008_EXTERNAL_VERIFICATION_GATE.md`.

| Dimensão | Status |
| --- | --- |
| **PRICING_STATUS** | **UNVERIFIED** |
| **DATA_GOVERNANCE_STATUS** | **UNVERIFIED** (Retention/Training/ZDR/Residency/DPA/Sub-processors/Abuse/Deletion/Enterprise — todos UNVERIFIED) |
| Documentos oficiais recebidos | **0** |

Consequência (§7 Resultado B): permitido construir a **infraestrutura de smoke test** e executar
um smoke técnico mínimo **quando** houver credencial oficial de teste e confirmação manual; **não**
permitido produção, custo comercial, `productionAllowed=true`, rate card, dados reais de clientes
nem execução automática. Nenhum rate card comercial foi criado; custo permanece `null`.

## Gate 008.4B — infraestrutura do smoke test

**PASS.** Comando dedicado `npm run smoke:anthropic` (CLI interna), **fora** de `test`/`test:api`/
`test:api:integration`/CI/seed/startup/worker. Só executa quando **todas** as flags são verdadeiras
(`NODE_ENV!=production`, `ANTHROPIC_PROVIDER_RUNTIME_ENABLED`, `ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED`,
`ANTHROPIC_SMOKE_TEST_ENABLED`, `ANTHROPIC_SMOKE_TEST_ACKNOWLEDGED`) **e** com confirmação explícita
`--confirm-live-anthropic-call` **e** `organizationId`/`connectionId` explícitos. Credencial vem
exclusivamente do `OrganizationConnection → CredentialVersion ativa → SecretVault` (nunca de CLI/env/
arquivo/fixture). Payload sintético fixo, `tools=[]`, `maxTokens` baixo, timeout curto, 1 chamada.
Resultado sanitizado (`AnthropicSmokeTestResult`) — nunca chave/prompt/raw/headers/requestId bruto.
Caminho REAL exercitado offline com o fake transport nos testes.

## Gate 008.4C — smoke test real controlado

**NOT EXECUTED.** Não há credencial oficial de teste da Anthropic disponível a este agente, nem
confirmação manual de operador, nem documentos oficiais (008.4A = UNVERIFIED). Portanto **nenhuma
chamada real foi feita** (proibido rodar sem confirmação explícita e credencial de cofre — §55/§56).
O caminho real (`Smoke → AnthropicModelProvider → CredentialResolver → SecretVault →
AnthropicSdkTransport → Messages API → ResponseMapper → validação local`) está implementado e
provado **offline** (fake transport). A execução real fica para o operador com credencial legítima.

## Gate 008.4D — habilitação restrita não produtiva

**PASS.** Provider persistido continua `DISABLED`/`productionAllowed=false`. A execução real (gate de
chamada externa ON) exige, server-side: ambiente não produtivo + organização em allowlist
(`ANTHROPIC_NON_PROD_ALLOWED_ORGANIZATION_IDS`) + versão de credencial com smoke `PASSED` + circuit
breaker fechado + quotas (max tokens/dia/concorrência). Rotação de credencial **invalida** o smoke
anterior (a verificação vive nos metadados da versão de credencial). Produção → `MODEL_PROVIDER_DISABLED`
antes de resolver credencial ou tocar o SDK. Nenhuma allowlist vem do request.

## Classificação final (§52)

- **OFFLINE VERIFIED:** resolução de credencial, structured output, validação local, usage,
  classificação de erro, timeout/abort, retry/UNKNOWN, quotas, circuit breaker, rotação-invalida-smoke,
  bloqueio de produção, cross-tenant, canário de segredo — todos por fake transport.
- **LIVE VERIFIED:** nenhum (sem credencial/documentos oficiais).
- **NOT EXECUTED:** chamada real (008.4C).
- **UNVERIFIED:** preços e governança de dados.
- **BLOCKED BY POLICY:** produção; `productionAllowed=true`; rate cards comerciais.
