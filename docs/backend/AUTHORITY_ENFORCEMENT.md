# Enforcement de Autoridade (ARDEN-BE-004)

O `EnforcementService` é o **ponto único** de decisão sobre ações. Nenhuma ação que exige
aprovação é considerada autorizada só porque o frontend mostrou um botão ou o usuário tem
papel de admin.

## `POST /operations/{id}/actions/evaluate`

Avaliação **pura** — não persiste nada. Fluxo:

1. Carrega a operação (404 se cross-tenant — anti-enumeração).
2. Usa **sempre a versão publicada corrente** como fonte de autoridade. Sem versão
   publicada → `DENIED` (`NO_PUBLISHED_VERSION`).
3. Monta o contexto (payload achatado + `actionKey`) e o hash estável do payload.
4. Resolve as políticas aplicáveis (bindings habilitados + versão de política publicada).
5. Chama o motor puro → `{ decision, reasonCodes, applicablePolicies }`.

Retorno: `ActionEvaluationResult` com `decision ∈ {ALLOWED, DENIED, APPROVAL_REQUIRED}`,
os `reasonCodes` e as políticas que contribuíram. Permissão: `authority.evaluate`.

## `POST /action-authorizations/validate`

Valida uma autorização **sem executar** a ação:

- Sem `authorizationId`: reavalia a ação; `valid = (decision === ALLOWED)` — cobre o caso
  "permitida diretamente" (nível 3 sem política restritiva).
- Com `authorizationId`: confere tenant, casamento de `operationId/actionKey/payloadHash`
  (`AUTHORIZATION_PAYLOAD_MISMATCH`), **invalidação preguiçosa** (versão de autoridade
  mudou → `INVALIDATED`), **expiração preguiçosa** (`validUntil` vencido → `EXPIRED`) e o
  status atual.

## Emissão de autorização

`issueAuthorization(tx, …)` roda **dentro da transação de aprovação**, uma única vez — a
transição terminal da solicitação (`PENDING → APPROVED`, com trava de linha) é o guarda de
concorrência. A autorização carrega `authoritySnapshot` e `policySnapshot` do momento da
decisão. É o **artefato terminal** de BE-004; a execução real é BE-005.

## Multitenancy

Toda consulta é escopada por `organizationId`. O path localiza o tenant mas **nunca
autoriza**; acesso cruzado retorna 404.
