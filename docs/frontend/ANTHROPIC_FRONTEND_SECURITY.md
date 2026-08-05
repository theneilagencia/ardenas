<!-- Milestone: ARDEN-BE-008.6 -->
# Postura de segurança do frontend Anthropic (ARDEN-BE-008.6)

> A página de administração do provider Anthropic é **somente leitura** e **nunca** coleta,
> persiste ou vaza segredo. Não há SDK de modelo no browser, não há geração de texto, não há
> campo de credencial nesta página. A entrada de credencial permanece no fluxo seguro
> write-only já existente. Esta é uma fatia focada; os invariantes abaixo são os efetivamente
> entregues.

Linhas de status: Production: BLOCKED. Live smoke: NOT EXECUTED. Live tool calling: NOT
EXECUTED. Pricing: UNVERIFIED. Data governance: UNVERIFIED.

## 1. Sem SDK de modelo no frontend

A página **não** importa o SDK oficial da Anthropic v0.115.0 (backend-only) nem qualquer
cliente de modelo. Toda a leitura vem da API v1 via `useModelProviders()`. O SDK vive
exclusivamente no backend.

## 2. Sem endpoint de geração no browser

A página **nunca** gera prompt, requisição ou resposta de modelo, e **nunca** renderiza
prompt/request/response crus. Não há chamada de inferência a partir do browser; a execução de
agente ocorre apenas via o motor de operações no backend.

## 3. Nenhum segredo nesta página

A página de administração **não** possui campo de API key e **não** coleta credencial.
Nenhum segredo transita, é exibido ou é persistido aqui. As respostas de leitura da API
trazem apenas metadados de provider (nome, key, versão, status, capabilities,
`productionAllowed`) — nunca segredo.

## 4. Credencial write-only pelo fluxo existente

A entrada de credencial é delegada à tela de Integrações → connections (BE-006.8), que usa o
componente seguro `SecretField` num fluxo **write-only**: o segredo vai só no request de
escrita e nunca retorna nas respostas. A página Anthropic apenas **enlaça** para essa tela
(`/integrations?tab=connections`); não replica o formulário de credencial.

## 5. Sem cálculo de custo no browser

Nenhum cálculo de custo é feito no cliente. O custo de execução é responsabilidade do painel
de usage/execução já existente; quando o custo é `null`, a UI mostra "não disponível" — e
**nunca** exibe `US$ 0,00` para a Anthropic. Detalhe em
`ANTHROPIC_COST_AND_GOVERNANCE_UI.md`.

## 6. Isolamento cross-tenant

A troca de organização reutiliza o `queryClient.clear()` já existente, garantindo que caches
de um tenant não vazem para outro. Nenhum estado específico da Anthropic escapa desse
isolamento.

## 7. Hide-and-guard + revalidação no backend

A rota `/anthropic` é protegida por `model_provider.view` como **defesa de UX**
(hide-and-guard). O backend permanece a autoridade final: revalida todo acesso e toda ação. A
decisão de habilitação/produção nunca é do cliente — produção permanece **BLOCKED**.

## 8. DEFERIDO

O canário de segredo-no-DOM e o teste de cross-tenant-404 dedicados à Anthropic fazem parte
da matriz de testes **DEFERIDA** (ver `ARDEN_BE_008_ANTHROPIC_FRONTEND_TEST_EVIDENCE.md`). Os
invariantes acima já são cobertos pelos testes entregues (unit + a11y) e pelo reuso das telas
seguras existentes.
