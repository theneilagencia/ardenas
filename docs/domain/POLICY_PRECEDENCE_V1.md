# Precedência de Políticas — v1 (ARDEN-BE-004)

Como o motor combina o Gradiente de Autoridade e as políticas aplicáveis em **uma**
decisão determinística: `ALLOWED` | `DENIED` | `APPROVAL_REQUIRED`.

## Princípio: a decisão mais restritiva vence

Precedência absoluta:

```
DENY  >  REQUIRE_APPROVAL  >  ALLOW
```

Uma permissão **nunca** anula um bloqueio. Um `ALLOW` de política não sobrepõe um
Gradiente que nega, e um único `DENY` (do Gradiente ou de qualquer política aplicável)
resulta em `DENIED`.

## Ordem de avaliação

1. **Base do Gradiente** — a partir do nível efetivo e da camada da ação
   (ver `AUTHORITY_ACTION_TAXONOMY_V1.md`), o motor produz uma decisão base:
   - nível 1: só READ permitido;
   - nível 2: READ+PREPARE permitidos, EXECUTE negado;
   - nível 3: EXECUTE permitido (sob regras) — vira `APPROVAL_REQUIRED` se
     `approvalRequired` estiver ligado no perfil;
   - nível 4: EXECUTE exige aprovação;
   - nível 5: tudo negado.
   Ações destrutivas sem `destructiveActionsAllowed` são negadas antes de tudo.

2. **Políticas aplicáveis** — cada `OperationPolicyBinding` habilitado cuja versão de
   política está `PUBLISHED` e cuja política está `PUBLISHED`. Uma política **se aplica**
   quando todas as condições (`appliesWhen`) casam com o contexto da ação **e** a janela
   `validFrom`/`validUntil` está vigente. Condições são declarativas (operadores fechados,
   **sem `eval`**).

3. **Limites** — uma política `ALLOW` com `limits` (financeiro/quantidade) excedidos passa
   a contribuir `REQUIRE_APPROVAL` (`POLICY_LIMIT_EXCEEDED`).

4. **Combinação** — a decisão final é a mais restritiva entre a base e todas as
   contribuições de política.

## Resolução do fluxo de aprovação

Quando o resultado é `APPROVAL_REQUIRED`, o fluxo é escolhido, em ordem:

1. o `approvalFlowId` da política aplicável de **maior prioridade** que exige aprovação;
2. na ausência, o `approvalPolicyId` do perfil de autoridade da versão.

Se nenhum fluxo for resolvível, a criação de solicitação falha com `POLICY_NOT_ACTIVE`
(não há como rotear a decisão humana — a ação não pode ser autorizada às cegas).

## Empates

Não há empate possível: a combinação é uma função total sobre uma ordem linear
(`ALLOWED < APPROVAL_REQUIRED < DENIED`). Prioridade só desempata **qual fluxo** roteia,
nunca **qual decisão** vence.
