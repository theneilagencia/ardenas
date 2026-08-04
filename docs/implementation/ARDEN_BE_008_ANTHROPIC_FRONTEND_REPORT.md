<!-- Milestone: ARDEN-BE-008.6 -->
# Relatório — Frontend administrativo da Anthropic (ARDEN-BE-008.6)

> **Continuação concluída.** A fatia focada inicial (administração do provider +
> visibilidade de status, somente leitura) foi **estendida** para cobrir os fluxos
> administrativos completos: catálogo de modelos real, connection segura Anthropic
> (criar/validar/rotacionar/lifecycle), status de smoke CLI-only, ModelConfiguration
> guiada + elegibilidade/bloqueio de ativação, e integração visual em AgentVersion e
> execução. Live smoke e live tool calling permanecem **NOT EXECUTED**; a produção
> permanece **BLOCKED**.

Linhas de status: Production: BLOCKED. Live smoke: NOT EXECUTED. Live tool calling: NOT
EXECUTED. Pricing: UNVERIFIED. Data governance: UNVERIFIED.

## 1. Escopo entregue

Página administrativa Anthropic (`/anthropic`, `anthropic.direct`) com banner permanente de
produção bloqueada, resumo do provider (dados reais da API), estados de verificação em
texto + ícone, e as seções administrativas:

1. **Catálogo de modelos** (`AnthropicModelCatalog`): IDs de modelo vêm do backend
   (`useModelCatalog`) — nunca hardcoded, nunca digitados livremente; modelos `DISABLED`
   aparecem não selecionáveis; limite de token `null` → "Limite não verificado"; sem rate
   card → "Preço não verificado".
2. **Conexões seguras** (`AnthropicConnections`): criação com connector FIXO
   `system.anthropic` e base URL FIXA oficial (somente leitura); API key **write-only**
   (estado local, apagada após envio, nunca em cache/URL/log/DOM/storage); detalhe só com
   fingerprint; validação LOCAL (`NOT_VERIFIED_WITH_PROVIDER`, nunca "conectado"); smoke
   CLI-only (sem gatilho); rotação que invalida o smoke anterior; suspend/reactivate/revoke.
3. **ModelConfiguration guiada** (`AnthropicModelConfiguration`): provider FIXO
   `anthropic.direct`; modelo do catálogo (allowlist); conexão de conexões Anthropic ativas;
   parâmetros validados; criação em DRAFT; checklist de elegibilidade + **bloqueio de
   ativação** (autoridade do backend — ativação recusada enquanto o provider é DISABLED).
4. **AgentVersion** (§16): configuração Anthropic mostra aviso "validado offline" e
   **bloqueia publicação**.
5. **Execução** (§17): colunas provider/modelo; linhas Anthropic marcadas "validado offline";
   custo `null` → "Custo não disponível" (nunca 0,00); zero conhecido → "US$ 0,00".

Rota, navegação e i18n (pt-BR + en-US) completos. Gates de frontend verdes.

## 2. Arquitetura (Page → hook → use-case → repositório → cliente → backend)

```
AnthropicAdminPage.tsx
  → useModelProviders() / useModelCatalog()      (src/hooks/use-agents.ts)
  → useConnections / useValidateConnectionConfiguration / useCreate/RotateCredential …
                                                 (src/hooks/use-connectors.ts)
    → use-cases (src/application/agents/*, src/application/connectors/*)
      → repositório v1 (API-only)                (src/services/api/v1-*-repository.ts)
        → cliente contract-derived + http client (src/services/api/generated + v1-http-client)
          → backend (API v1)
```

Nenhuma etapa usa mock; nenhum dado é fabricado no cliente.

## 3. Cliente de API — dois endpoints expostos (§4)

Ambos já existiam no contrato OpenAPI, mas não estavam expostos pelas camadas do frontend.
Foram ligados **aditivamente** por todas as camadas:

| Endpoint | Método do cliente | Hook |
| --- | --- | --- |
| `GET /model-providers/{key}/versions/{ver}/models` | `listModelCatalog` | `useModelCatalog` |
| `POST …/connections/{id}/validate-configuration` | `validateConnectionConfiguration` | `useValidateConnectionConfiguration` |

> **§35 (cliente gerado):** `src/services/api/generated/api-v1-client.ts` NÃO é um artefato de
> codegen. Seu cabeçalho declara: "Interface do cliente DERIVADA dos contratos … Declarada
> manualmente e coberta por um teste de compatibilidade". O único script de geração
> (`contracts:openapi`) produz o **spec OpenAPI a partir dos contratos**, não o cliente. A
> implementação real é a classe manuscrita `ApiV1HttpClient`. Estender essa interface de forma
> aditiva não viola a restrição "não editar o cliente gerado manualmente" — não há pipeline de
> codegen para os corpos desses métodos. O `contracts:openapi` foi re-executado após as
> mudanças: **sem diff**.

## 4. Componentes novos vs. reuso

| Item | Situação | Caminho |
| --- | --- | --- |
| Catálogo de modelos Anthropic | **NOVO** | `src/features/anthropic/AnthropicModelCatalog.tsx` |
| Conexões Anthropic seguras (criar/validar/rotacionar/lifecycle/smoke) | **NOVO** | `src/features/anthropic/AnthropicConnections.tsx` |
| ModelConfiguration guiada + elegibilidade/bloqueio | **NOVO** | `src/features/anthropic/AnthropicModelConfiguration.tsx` |
| Integração AgentVersion (aviso offline + bloqueio de publicação) | **ESTENDIDO** | `src/features/agents/AgentVersionEditorPage.tsx` |
| Integração de execução (provider/modelo + badge offline) | **ESTENDIDO** | `src/features/agent-results/ExecutionAgentUsagePanel.tsx` |
| `useModelCatalog`, `useValidateConnectionConfiguration` | **NOVO** | `src/hooks/use-agents.ts`, `src/hooks/use-connectors.ts` |
| `SecretField` write-only | **REUSO** | `src/features/integrations/secret-field.tsx` |
| Formatação de custo (`null`→indisponível; zero→formatado) | **REUSO** | `src/features/agents/agent-format.ts` |
| Badge de status de provider | **REUSO** | `src/features/agents/AgentStatusBadge.tsx` |

## 5. Realidades de backend que moldaram a UI (restrições)

- **Smoke é CLI-only**: não há endpoint HTTP de smoke; os metadados não são expostos por API.
  Logo, sem botão funcional — status + comando CLI apenas (§12). `AnthropicSmokeStatus` de
  servidor é só `PASSED/FAILED/UNKNOWN`; `NOT_EXECUTED/INVALIDATED` são derivados na UI.
- **Sem endpoint de elegibilidade**: bloqueadores de ativação afloram via o erro
  `MODEL_PROVIDER_DISABLED` na chamada de `activate`. A UI mostra o checklist e mantém a
  ativação bloqueada enquanto o provider é DISABLED.
- **Permissões reais**: `connection.create/edit/test/rotate_credentials/revoke`,
  `model_configuration.create/edit`, `model_provider.view` — todas confirmadas em
  `src/domain/permissions.ts`.
- **Secret shape do conector `system.anthropic`**: `{ apiKey }` (confirmado no resolver
  `anthropic-provider-credential.resolver.ts`).

## 6. Invariantes de segurança (verificadas por teste)

- API key **write-only**: enviada uma vez, apagada do formulário; canário de segredo confirma
  ausência no DOM, `localStorage` e `sessionStorage` após o envio (também na rotação).
- Connector e base URL **fixos** (não editáveis).
- Validação **local**: só `NOT_VERIFIED_WITH_PROVIDER`; nunca "conectado/autenticado/válido".
- Detalhe de credencial: **só fingerprint**, nunca a key.
- Smoke **CLI-only**: nenhum botão dispara o smoke.
- Custo desconhecido **nunca** vira `0,00`.
- **Nunca** importa o SDK oficial da Anthropic (backend-only).
- Isolamento cross-tenant: hooks derivam o tenant da sessão ativa; `queryClient.clear()` na
  troca de organização.

## 7. Testes (frontend)

- `AnthropicModelCatalog.test.tsx` (3): IDs do backend, DISABLED não selecionável, limites/preço
  não verificados, catálogo vazio não inventa modelos.
- `AnthropicConnections.test.tsx` (5): connector/base URL fixos, **canário de segredo**
  write-only, validação `NOT_VERIFIED_WITH_PROVIDER` + só fingerprint, smoke CLI-only sem
  gatilho, rotação invalida smoke.
- `AnthropicModelConfiguration.test.tsx` (4): provider fixo, allowlist de modelos, corpo de
  criação DRAFT com `anthropic.direct`, ativação bloqueada.
- `AgentVersionEditorPage.test.tsx` (+1): aviso offline + publicação bloqueada.
- `ExecutionAgentUsagePanel.test.tsx` (3): provider/modelo + badge offline; custo `null` →
  "não disponível" (nunca 0,00); zero → "US$ 0,00".
- `AnthropicAdminPage.test.tsx` (5) + `.a11y.test.tsx` (1): mantidos verdes com as novas seções.

Suite de frontend: **271 testes verdes** (unit + a11y). Typecheck, lint, build e diff de
OpenAPI: verdes.

### 7.1 Integração (backend real, HTTP + Postgres)

`apps/api/test/anthropic-connection.integration.spec.ts` — **8 testes verdes** contra o backend
real que o frontend consome: catálogos persistidos (§42), credencial write-only + canário de
cofre (§43), validação local `NOT_VERIFIED_WITH_PROVIDER` sem segredo (§17), rotação
supersede/ativa sem retornar segredo (§44), ModelConfiguration DRAFT com ativação bloqueada por
`MODEL_PROVIDER_DISABLED` e rejeição de modelId fora da allowlist (§45), **cross-tenant 404**
(§46) e seed idempotente (§38).

### 7.2 E2E offline (navegador ↔ backend real, provider FAKE)

`e2e/api/anthropic-admin-api.spec.ts` — **4 testes verdes** dirigindo o frontend construído em
modo `api` contra o backend real: (1) fixture não produtiva (produção bloqueada + catálogo real
sem preço verificado); (2) connection segura com **canário de segredo no DOM real** + validação
`NOT_VERIFIED_WITH_PROVIDER`; (3) rotação de credencial invalida o smoke; (4) ModelConfiguration
guiada em DRAFT com ativação bloqueada. O `playwright.api.config.ts` passou a fornecer
`CONNECTOR_MASTER_KEY` (somente teste) para o cofre operar ponta a ponta.

## 8. Conclusão

Os fluxos administrativos da Anthropic estão completos no frontend, consumindo a API v1 real,
com todas as invariantes de segurança verificadas por teste. **Live smoke e live tool calling
permanecem NOT EXECUTED; a produção permanece BLOCKED; preço e governança permanecem
UNVERIFIED.**
