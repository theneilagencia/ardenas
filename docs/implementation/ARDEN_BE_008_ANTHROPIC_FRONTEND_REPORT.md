<!-- Milestone: ARDEN-BE-008.6 -->
# Relatório — Frontend administrativo da Anthropic (ARDEN-BE-008.6)

> Este marco foi entregue como uma **FATIA FOCADA**: administração do provider Anthropic +
> visibilidade de status, somente leitura, consumindo a API v1 real. As demais telas
> (wizards, rotação, painel de smoke, wizard de ModelConfiguration, badges de execução) e a
> matriz de testes ampla ficam **DEFERIDAS**. Live smoke e live tool calling permanecem NOT
> EXECUTED; a produção permanece BLOCKED.

Linhas de status: Production: BLOCKED. Live smoke: NOT EXECUTED. Live tool calling: NOT
EXECUTED. Pricing: UNVERIFIED. Data governance: UNVERIFIED.

## 1. Escopo entregue

Uma página read-only de administração do provider Anthropic (`anthropic.direct`), com banner
permanente de produção bloqueada, resumo do provider a partir de dados reais da API, estados
de verificação em texto + ícone, e links para as telas seguras já existentes. Rota, navegação
e i18n completos. Testes unit + a11y verdes; gates de frontend verdes.

## 2. Arquitetura (Page → hook → use-case → repositório → cliente gerado → backend)

```
AnthropicAdminPage.tsx
  → useModelProviders()            (src/hooks/use-agents.ts)
    → use-case de agentes/providers (src/application/agents/*)
      → repositório v1 (API-only)   (src/services/api/v1-agents-repository.ts)
        → cliente gerado            (src/services/api/generated + v1-http-client)
          → backend  GET /model-providers  (API v1)
```

Nenhuma etapa usa mock; nenhum dado é fabricado no cliente. O provider é localizado por
`key === anthropic.direct`.

## 3. Reuso vs. novo

| Item | Situação | Caminho |
| --- | --- | --- |
| Página de administração Anthropic | **NOVO** | `src/features/anthropic/AnthropicAdminPage.tsx` |
| Testes unit da página | **NOVO** | `src/features/anthropic/AnthropicAdminPage.test.tsx` |
| Teste a11y (axe) | **NOVO** | `src/features/anthropic/AnthropicAdminPage.a11y.test.tsx` |
| Rota `/anthropic` + módulo de nav (grupo `control`) | **NOVO** | `src/app/modules.ts` |
| Namespace i18n `anthropic` (+ `nav.anthropic`) | **NOVO** | `src/i18n/locales/pt-BR.ts`, `src/i18n/locales/en-US.ts` |
| Hook de providers | **REUSO** | `src/hooks/use-agents.ts` (`useModelProviders`) |
| Badge de status de provider | **REUSO** | `src/features/agents/AgentStatusBadge.tsx` (`ModelProviderStatusBadge`) |
| Connection segura + credencial write-only (`SecretField`) + rotação + suspend/revoke | **REUSO** | telas de Integrações → connections (BE-006.8) |
| Criação de configuração de modelo (provider-neutra) | **REUSO** | tela ModelConfigurations |
| Cabeçalho de página | **REUSO** | `src/components/ui/PageHeader.tsx` |

## 4. O que a página mostra

- Banner permanente e não ocultável "Uso em produção bloqueado" com a mensagem mandatória.
- Resumo real: nome, provider key (`anthropic.direct`), versão (`1`), connector
  (`system.anthropic`), status persistido (via `ModelProviderStatusBadge`), capabilities
  implementadas (ex.: `STRUCTURED_OUTPUT`, `TOOL_CALLING`), `productionAllowed` ("Não").
- Estados de verificação (texto + ícone): Preço = Não verificado; Governança de dados = Não
  verificado; Smoke test real = Não executado; Tool calling = Validado offline;
  Disponibilidade = Apenas ambiente controlado não produtivo.
- Ações: "Configurar connection" → `/integrations?tab=connections`; "Configurações de modelo"
  → `/model-configurations`.
- Estados tratados: loading, erro + retry, not-found (provider ausente do catálogo).

## 5. Realidades de backend que moldaram a UI (restrições)

- **Smoke é CLI-only**: não há endpoint HTTP de smoke; os metadados de smoke não são expostos
  por API (o serializer de credencial os remove). Logo, sem botão funcional de smoke —
  status + instruções apenas (§20/§60). `AnthropicSmokeStatus` de servidor é só
  `PASSED/FAILED/UNKNOWN`; `NOT_EXECUTED/INVALIDATED` são conceitos derivados na UI.
- **Sem endpoint de elegibilidade/bloqueadores de model-config**: bloqueadores de ativação
  afloram só via o erro `MODEL_PROVIDER_DISABLED` na chamada de `activate`.
- **Permissões reais** diferem da lista original: `connection.suspend` é guardado por
  `connection.edit`; `connection.validate_external` por `connection.test`;
  `model_configuration.activate` por `model_configuration.edit`. `model_provider.view`
  existe e guarda a rota `/anthropic`.
- **Endpoints existentes mas ainda não envelopados pelo cliente gerado**: o catálogo por
  modelo (`GET /model-providers/{key}/versions/{ver}/models`) e
  `POST .../connections/{id}/validate-configuration` existem no OpenAPI, mas ainda **não**
  têm wrapper no cliente gerado do frontend.
- **Telas provider-neutras já existentes** (Integrações → connections, BE-006.8) já fornecem
  create seguro + credencial write-only (`SecretField`) + rotação + suspend/revoke para
  qualquer connector, incluindo `system.anthropic`; a ModelConfigurations já cria configs
  (provider-neutra). Elas são **reutilizadas, não reconstruídas**.

## 6. Invariantes de segurança da página entregue

- **Nunca** coleta credencial (sem campo de API key nesta página; a entrada de credencial usa
  o fluxo seguro write-only `SecretField` na tela de Integrações/connections).
- **Nunca** importa o SDK oficial da Anthropic v0.115.0 (backend-only).
- **Nunca** renderiza prompt/request/response crus; **nunca** gera texto.
- **Nunca** exibe custo como `US$ 0,00` para a Anthropic (custo `null` → "não disponível",
  tratado pelo painel de usage/execução existente).
- Reutiliza o isolamento cross-tenant via `queryClient.clear()` na troca de organização.

## 7. Entregue vs. DEFERIDO

**Entregue (fatia focada):** página read-only de administração do provider + visibilidade de
status; rota/nav/i18n; 5 testes unit + 1 a11y; gates verdes.

**DEFERIDO (para um follow-up):**

- Wizard dedicado (stepped) de criação de connection com marca Anthropic.
- Diálogo dedicado de rotação de credencial Anthropic.
- Painel de detalhe de smoke status conectado a eventos de auditoria.
- Wizard dedicado de ModelConfiguration Anthropic com dropdown de allowlist de modelos vinda
  da API.
- Badges de elegibilidade Anthropic no editor de AgentVersion.
- Linhas de execução mostrando provider/modelo.
- Envelopamento, no cliente gerado, dos endpoints de catálogo por modelo e
  validate-configuration.
- Matriz completa de testes (~46 unit / ~20 integração / E2E offline / canário de
  segredo-no-DOM / cross-tenant-404).

## 8. Conclusão

Marco entregue como **FATIA FOCADA** — administração do provider + visibilidade de status —
com as telas e testes restantes **DEFERIDOS**. Independentemente do que venha a seguir: **live
smoke e live tool calling permanecem NOT EXECUTED e a produção permanece BLOCKED.**
