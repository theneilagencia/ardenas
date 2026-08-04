<!-- Milestone: ARDEN-BE-008.6 -->
# Smoke status da Anthropic na UI (ARDEN-BE-008.6)

> O smoke test da Anthropic é **exclusivamente por CLI**. Não existe endpoint HTTP de smoke e
> os metadados de smoke **não** são expostos por nenhuma API (o serializer de credencial os
> remove). Por isso a UI apenas **exibe status + instruções ao operador** e **não** oferece um
> botão funcional de disparo. Fatia focada; o painel de detalhe conectado a auditoria fica
> DEFERIDO.

Linhas de status: Live smoke: NOT EXECUTED. Production: BLOCKED. Live tool calling: NOT
EXECUTED.

## 1. Smoke é CLI-only

- Não há endpoint HTTP de smoke.
- Os metadados de smoke não são expostos por nenhuma API — o serializer de credencial os
  remove.
- Consequência para a UI: só é possível **mostrar** o status e **instruir** o operador; um
  botão funcional de smoke **intencionalmente não foi construído** (conforme §20/§60).

## 2. O que a página mostra

Na seção de estados de verificação, "Smoke test real = Não executado" (NOT EXECUTED), com
texto + ícone. A página comunica que a validação real ao vivo ainda não ocorreu; a execução
do smoke é uma operação de CLI feita por um operador, fora do browser.

## 3. Estados de servidor vs. estados derivados na UI

- Estados **de servidor** (`AnthropicSmokeStatus` no código): `PASSED`, `FAILED`, `UNKNOWN`.
- Estados **derivados na UI** (não são estados do servidor): `NOT_EXECUTED` e `INVALIDATED`.
  São conceitos de apresentação usados pela interface, não valores persistidos pelo backend.

## 4. Sem botão de disparo

Não há CTA que dispare um smoke a partir da UI, porque não há endpoint para isso. Qualquer
disparo é feito via CLI pelo operador. A UI se limita a status + instruções.

## 5. DEFERIDO

- Painel de detalhe de smoke status conectado a **eventos de auditoria** (audit-event-driven).
- Qualquer trigger funcional de smoke (dependeria de um endpoint que não existe).

Enquanto isso: **live smoke permanece NOT EXECUTED e a produção permanece BLOCKED.**
