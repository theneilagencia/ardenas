<!-- Milestone: ARDEN-BE-008.6 -->
# Habilitação não produtiva da Anthropic na UI (ARDEN-BE-008.6)

> Na UI, a produção da Anthropic está **permanentemente bloqueada**: um banner não ocultável
> declara o bloqueio, e a disponibilidade é **apenas em ambiente controlado não produtivo**. A
> elegibilidade de ativação é **autoritativa no backend**; não há endpoint de leitura de
> elegibilidade/bloqueadores — o bloqueador aparece via o erro `MODEL_PROVIDER_DISABLED` na
> chamada de ativação. Fatia focada; a UI dedicada de ativação fica DEFERIDA.

Linhas de status: Production: BLOCKED. Live smoke: NOT EXECUTED. Live tool calling: NOT
EXECUTED. Pricing: UNVERIFIED. Data governance: UNVERIFIED.

## 1. Produção permanentemente bloqueada na UI

Um banner permanente e não ocultável ("Uso em produção bloqueado", `role="alert"`) exibe a
mensagem mandatória de disponibilidade. Ele aparece sempre — inclusive com o provider
DISABLED. O campo "Disponível em produção" reflete `provider.productionAllowed` e mostra
"Não".

## 2. Disponibilidade apenas não produtiva

O estado "Disponibilidade = Apenas ambiente controlado não produtivo" comunica que a
integração serve só para preparação e validação controlada fora de produção.

## 3. Elegibilidade é autoritativa no backend

- **Não existe** endpoint de leitura de elegibilidade/bloqueadores de model-config.
- Os bloqueadores de ativação afloram **apenas** via o erro `MODEL_PROVIDER_DISABLED` na
  chamada de ativação (`activate`).
- A UI, portanto, não tenta prever elegibilidade localmente; a decisão é sempre do backend, e
  produção permanece BLOCKED.

## 4. Reuso das telas provider-neutras

A criação de connection segura e a criação de configuração de modelo são feitas nas telas
provider-neutras já existentes (Integrações → connections; ModelConfigurations), para as
quais a página Anthropic apenas enlaça. Nada de ativação foi reconstruído aqui.

## 5. DEFERIDO

- UI dedicada de ativação da Anthropic (com leitura de elegibilidade/bloqueadores) — depende
  de capacidades de backend que hoje não existem (sem endpoint de elegibilidade).
- Badges de elegibilidade Anthropic no editor de AgentVersion.

Independentemente de fases futuras: **a produção permanece BLOCKED.**
