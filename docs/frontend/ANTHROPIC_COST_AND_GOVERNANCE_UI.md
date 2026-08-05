<!-- Milestone: ARDEN-BE-008.6 -->
# Custo e governança de dados na UI Anthropic (ARDEN-BE-008.6)

> Na administração do provider Anthropic, o preço oficial é apresentado como **NÃO
> VERIFICADO** e a governança de dados como **NÃO VERIFICADA**. Nenhum cálculo de custo é
> feito no browser; quando o custo é `null`, a UI mostra "não disponível" — e **nunca** exibe
> `US$ 0,00` para a Anthropic. Fatia focada; itens não cobertos ficam DEFERIDOS.

Linhas de status: Pricing: UNVERIFIED. Data governance: UNVERIFIED. Production: BLOCKED. Live
smoke: NOT EXECUTED.

## 1. Preço oficial — UNVERIFIED

A seção de estados de verificação exibe "Preço oficial = Não verificado" (texto + ícone,
nunca só cor). Não há rate card comercial verificado para a Anthropic; enquanto o gate de
pricing não for reaberto, este estado permanece **UNVERIFIED** e `productionAllowed`
permanece "Não".

## 2. Governança de dados — UNVERIFIED

"Governança de dados = Não verificado". Políticas de retenção, treinamento e residência de
dados ainda **não foram verificadas**. A nota da página reforça explicitamente essa condição.

## 3. Custo `null` → "não disponível", nunca `US$ 0,00`

- A página de administração Anthropic **não calcula** custo.
- O custo de execução é responsabilidade do painel de usage/execução já existente.
- Quando o custo estimado é `null` (ex.: `COST_RATE_CARD_NOT_AVAILABLE`), a UI mostra "não
  disponível" / "Custo não disponível".
- Para a Anthropic, a UI **nunca** exibe `US$ 0,00` — um custo zero seria enganoso enquanto o
  preço está UNVERIFIED.
- Um provider **interno** pode legitimamente exibir `US$ 0,00`; essa distinção é preservada —
  zero só aparece quando é de fato o custo real de um provider interno, não como fallback de
  custo ausente da Anthropic.

## 4. Sem cálculo de custo no cliente

Nenhuma tarifa, conversão de moeda ou multiplicação de tokens é feita no browser. O cliente
apenas exibe o que a API fornece (ou "não disponível"). Isso mantém a fonte de verdade de
custo no backend e evita divergência com faturamento.

## 5. DEFERIDO

- Banner/painel dedicado de custo Anthropic com breakdown por modelo.
- Exibição de rate card comercial (depende de reabrir o gate de pricing; hoje UNVERIFIED).
- Linhas de execução mostrando provider/modelo e custo por execução Anthropic.
