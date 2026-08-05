<!-- Milestone: ARDEN-BE-008.6 -->
# Evidência de testes — Frontend administrativo da Anthropic (ARDEN-BE-008.6)

> Evidência dos testes efetivamente entregues nesta **fatia focada**: 5 testes unit + 1 teste
> a11y para a página de administração do provider Anthropic, todos verdes, com os gates de
> frontend verdes. A matriz ampla de testes está **DEFERIDA**. Nenhum teste ao vivo (LIVE =
> NONE): live smoke e live tool calling permanecem NOT EXECUTED; produção BLOCKED.

Linhas de status: Live smoke: NOT EXECUTED. Live tool calling: NOT EXECUTED. Production:
BLOCKED. Pricing: UNVERIFIED. Data governance: UNVERIFIED.

## 1. Testes unit entregues (`AnthropicAdminPage.test.tsx` — 5)

1. **Provider + banner de produção bloqueada**: renderiza o resumo do provider real e o
   banner permanente "Uso em produção bloqueado".
2. **Banner visível com provider DISABLED**: o banner de produção bloqueada aparece mesmo
   quando o provider está DISABLED (não depende do status persistido).
3. **Pricing/governança UNVERIFIED + smoke NOT EXECUTED**: os estados de verificação exibem
   Preço = Não verificado, Governança de dados = Não verificado, Smoke test real = Não
   executado.
4. **Tool calling OFFLINE, não ao vivo**: o estado de tool calling exibe "Validado offline"
   — não "ao vivo".
5. **Not-found**: quando o provider Anthropic está ausente do catálogo, a página mostra a
   mensagem dedicada de não encontrado.

## 2. Teste de acessibilidade entregue (`AnthropicAdminPage.a11y.test.tsx` — 1)

- Execução do **axe** sobre a página, sem violações **serious/critical**. Reforça que os
  estados usam texto + ícone (nunca cor isolada) e que banners/alertas têm papéis acessíveis.

## 3. Totais dos gates de frontend (verdes)

- Suíte de frontend: **255 testes unit + 3 testes a11y**, todos verdes.
- Typecheck e lint da raiz: **limpos**.
- Build: **ok**.
- OpenAPI: **diff-free**.

## 4. Testes ao vivo

**LIVE = NONE.** Nenhum teste ao vivo foi executado. Live smoke: NOT EXECUTED. Live tool
calling: NOT EXECUTED. Produção: BLOCKED.

## 5. Matriz de testes DEFERIDA (não executada nesta fatia)

- ~46 testes unit adicionais (cobertura das telas/fluxos dedicados ainda não construídos).
- ~20 testes de integração.
- E2E offline.
- Canário de segredo-no-DOM dedicado à Anthropic.
- Teste de cross-tenant-404 dedicado.

Os invariantes cobertos por essa matriz DEFERIDA já são parcialmente assegurados, nesta
fatia, pelos 5 unit + 1 a11y entregues e pelo reuso das telas seguras existentes.
