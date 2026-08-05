<!-- Milestone: ARDEN-BE-008.6 -->
# Página de administração do provider Anthropic (ARDEN-BE-008.6)

> Página **somente leitura** de administração do provider comercial Anthropic. Consome o
> provider real da API v1 (sem mock) e apresenta os estados que **não** se resumem a
> "ativo/inativo": produção **BLOQUEADA**, preço **NÃO VERIFICADO**, governança de dados
> **NÃO VERIFICADA**, live smoke **NÃO EXECUTADO** e tool calling **validado OFFLINE**. As
> ações de configuração reutilizam as telas provider-neutras já existentes. Esta é uma
> **fatia focada** (administração + visibilidade de status); as demais telas dedicadas estão
> **DEFERIDAS** (ver §7).

Linhas de status obrigatórias desta superfície:

- Live smoke: NOT EXECUTED
- Live tool calling: NOT EXECUTED
- Production: BLOCKED
- Pricing: UNVERIFIED
- Data governance: UNVERIFIED

## 1. Arquivo e rota

- Componente: `src/features/anthropic/AnthropicAdminPage.tsx`.
- Rota: `/anthropic`, protegida pela permissão `model_provider.view`.
- Navegação: módulo adicionado ao grupo `control` em `src/app/modules.ts`, rótulo
  `nav.anthropic`.
- i18n: namespace `anthropic` completo em `src/i18n/locales/pt-BR.ts` e
  `src/i18n/locales/en-US.ts` (mais a chave `nav.anthropic`). **Nenhuma string de UI é
  hardcoded.**

## 2. Fonte de dados real (API v1)

A página consome o hook existente `useModelProviders()` (`src/hooks/use-agents.ts`), que
usa a API v1 (`GET /model-providers`) — **sem mock**. Entre os providers retornados, a
página localiza o provider Anthropic por `key === ANTHROPIC_PROVIDER_KEY`
(`anthropic.direct`). Nenhum dado é fabricado no cliente.

## 3. Banner permanente de produção bloqueada

Um banner **permanente e não ocultável** ("Uso em produção bloqueado") é sempre renderizado
com `role="alert"` e a mensagem mandatória:

> A integração está disponível para preparação e validação controlada em ambientes não
> produtivos. O uso em produção permanece bloqueado.

O banner aparece **inclusive quando o provider está DISABLED** — não depende do status
persistido.

Production: BLOCKED.

## 4. Resumo do provider (dados reais)

A seção "Resumo do provider" exibe, a partir da resposta real da API:

| Campo | Origem | Valor observado |
| --- | --- | --- |
| Nome | `provider.name` | nome do provider |
| Provider key | constante `ANTHROPIC_PROVIDER_KEY` | `anthropic.direct` |
| Versão | constante `ANTHROPIC_PROVIDER_VERSION` | `1` |
| Connector | constante `ANTHROPIC_CONNECTOR_KEY` | `system.anthropic` |
| Status persistido | `provider.status` via `ModelProviderStatusBadge` | status do catálogo |
| Capabilities implementadas | `provider.capabilities` | ex.: `STRUCTURED_OUTPUT`, `TOOL_CALLING` |
| Disponível em produção | `provider.productionAllowed` | "Não" |

As capabilities são as **implementadas** no catálogo — não significam disponibilidade em
produção.

## 5. Estados de verificação (texto + ícone, nunca só cor)

Cada linha de estado usa **texto e ícone** (acessível; nunca cor isolada):

| Estado | Rótulo | Valor exibido |
| --- | --- | --- |
| Preço oficial | Pricing | **Não verificado** (UNVERIFIED) |
| Governança de dados | Data governance | **Não verificado** (UNVERIFIED) |
| Smoke test real | Live smoke | **Não executado** (NOT EXECUTED) |
| Tool calling | Tool calling | **Validado offline** (OFFLINE VERIFIED) |
| Disponibilidade | Availability | **Apenas ambiente controlado não produtivo** |

Uma nota reforça: preço oficial e políticas de retenção/treinamento/residência de dados
ainda não foram verificados; a validação real (smoke) e o tool calling ao vivo ainda não
foram executados.

Live smoke: NOT EXECUTED. Live tool calling: NOT EXECUTED. Pricing: UNVERIFIED. Data
governance: UNVERIFIED.

## 6. Ações → telas existentes provider-neutras

As ações do cabeçalho apenas **enlaçam** para as telas seguras já existentes; nada de novo
foi reconstruído aqui:

- "Configurar connection" → `/integrations?tab=connections` (fluxo seguro de connection e
  credencial write-only via `SecretField`, entregue em BE-006.8; serve qualquer connector,
  inclusive `system.anthropic`).
- "Configurações de modelo" → `/model-configurations` (tela provider-neutra de criação de
  configurações).

## 7. Estados tratados

- **Loading**: mensagem de carregamento com `role="status"`.
- **Erro + retry**: alerta com botão "Tentar novamente" (`refetch`).
- **Not-found**: quando o provider Anthropic está ausente do catálogo, mensagem dedicada.

## 8. DEFERIDO (não construído nesta fatia)

Estes itens **não** fazem parte desta entrega e ficam para um marco seguinte:

- Wizard dedicado (com passos) de criação de connection com marca Anthropic.
- Diálogo dedicado de rotação de credencial Anthropic.
- Painel de detalhe de smoke status conectado a eventos de auditoria.
- Wizard dedicado de ModelConfiguration Anthropic com dropdown de allowlist de modelos vinda
  da API.
- Badges de elegibilidade Anthropic no editor de AgentVersion.
- Linhas de execução mostrando provider/modelo.
- Envelopamento, no cliente gerado, dos endpoints de catálogo por modelo e de
  validate-configuration.

Independentemente do que venha a seguir: **live smoke e live tool calling permanecem NOT
EXECUTED e a produção permanece BLOCKED.**
