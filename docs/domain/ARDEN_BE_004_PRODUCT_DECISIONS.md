# ARDEN-BE-004 — Decisões de produto (governança, políticas e enforcement)

Este documento fecha as decisões abertas necessárias para transformar o Gradiente
de Autoridade (validado na publicação em ARDEN-BE-003) em **controle efetivo** sobre
as ações futuras de uma operação. Ele resolve D-003/D-004 (herdadas de FE-003) e
registra a nova D-005.

## D-003 — Direção semântica do Gradiente (resolvida)

O Gradiente é **crescente em autoridade e restrição de governança**:

| Semântico              | Numérico | Execução de ação                              |
| ---------------------- | -------- | --------------------------------------------- |
| observe                | 1        | apenas leitura                                |
| prepare                | 2        | leitura + preparo (rascunhos, não efetiva)    |
| execute_under_rule     | 3        | executa diretamente, sujeito a políticas      |
| execute_with_approval  | 4        | executa **somente após aprovação humana**     |
| blocked                | 5        | nada é permitido                              |

`blocked` é o nível **mais restritivo** (5), não "o mais poderoso". O motor trata
`level >= 5` como negação total. Publicar em nível ≥ 4 exige `approvalRequired`; nível 5
exige também `justificationRequired` (herdado de BE-003).

## D-004 — Taxonomia de ações (resolvida)

As ações deixam de ser texto livre. Passa a existir uma **taxonomia estável e fechada**
(`actionKey`, enum de 16 valores) — ver `AUTHORITY_ACTION_TAXONOMY_V1.md`. O contrato
rejeita qualquer `actionKey` fora da taxonomia. Isso elimina o risco de decisão baseada
em rótulo arbitrário do cliente.

## D-005 — Onde a decisão de autorização acontece (nova)

**A decisão é sempre do servidor.** O frontend nunca decide se uma ação é permitida,
bloqueada ou exige aprovação; nunca envia o aprovador final; nunca usa o papel de tela
como autorização. O backend:

1. avalia a ação contra o Gradiente da **versão publicada corrente** e as políticas
   vinculadas (motor puro, determinístico, sem `eval`);
2. quando exige aprovação, cria uma **solicitação** roteada por um **fluxo**;
3. registra **decisões imutáveis** com segregação de funções, elegibilidade e quórum;
4. ao concluir, emite uma **autorização de ação persistida** — o artefato terminal.

A aprovação **termina em uma autorização persistida, não na execução da ação**. A
execução real é ARDEN-BE-005.

## Fora de escopo (BE-004)

Execução real de ações, workers/filas, agentes, chamadas de IA, integrações externas,
Work Units, billing, assinatura eletrônica, aprovação por WhatsApp/link público, service
accounts, API keys, SCIM, motor jurídico/regulatório completo e BPMN.

## Defaults neutros (documentados)

- **1ª versão de política**: efeito `DENY`, sem condições (`NEUTRAL_POLICY_DEFINITION`).
  Nega por padrão — seguro; nada substantivo é inventado.
- **Perfil de autoridade ausente/ inválido na avaliação**: tratado como nível 5
  (`NEUTRAL_PROFILE`), negando por padrão.
