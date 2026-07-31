# Arden.AS — Modelo de Gradiente de Autoridade v1 (ARDEN-BE-003 · GAP-11)

> A autoridade da operação passa a ser um **perfil de nível de versão**
> (`AuthorityProfile`), e não mais apenas um `authorityLevel` por passo/ação com uma
> matriz de exibição. **O nível da versão é a classificação primária de publicação.**
> Isto é **validação**, não execução — não há motor de runtime.

## Contexto (GAP-11)

Antes, o frontend tinha autoridade apenas **por passo/ação** (`authorityLevel`) mais uma
matriz de exibição. O v1 introduz um `AuthorityProfile` **por versão**. Relação: as
`allowedActions` carregam `semanticLevel`, e a validação faz o **cross-check** entre o
nível da versão e o nível semântico das ações. Ver
`docs/api/FRONTEND_TO_API_V1_MAP.md` e `authority.schemas.ts`.

## Estrutura do `AuthorityProfile` (nível de versão)

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `level` | `1..5` | Nível do gradiente (classificação primária de publicação). |
| `allowedActions[]` | `{ key, semanticLevel, destructive }` | Ações permitidas; `key` é **texto livre** (D-004). |
| `approvalRequired` | `boolean` | Exige aprovação. |
| `approvalPolicyId` | `string?` | Política de aprovação referenciada. |
| `financialLimit` | `money \| null` | Limite financeiro (ou nulo). |
| `destructiveActionsAllowed` | `boolean` | Permite ações destrutivas. |
| `justificationRequired` | `boolean` | Exige justificativa. |

`semanticLevel` das ações usa a taxonomia semântica (ex.: `observe`, `prepare`,
`execute`, `execute_with_approval` = 4, …).

## Precedência: versão vs por-ação

O **nível da versão** é a classificação primária de publicação. As ações permitidas têm
seu próprio `semanticLevel`, e a validação **cruza** os dois. Se o nível declarado da
versão for **menor** que o nível máximo das ações permitidas, emite-se um **warning**
(não bloqueia). O nível da versão prevalece como rótulo de classificação; as ações apenas
o restringem semanticamente.

## Regras de nível (1–5)

Validação **pura** em `apps/api/src/operations/authority.rules.ts`, aplicada na
publicação:

| Regra | Efeito |
| --- | --- |
| Ação destrutiva | Requer `destructiveActionsAllowed = true` **E** `semanticLevel ≥ execute_with_approval (4)`. |
| Nível ≤ 2 (`observe`/`prepare`) | **Não** pode permitir nem conter ações destrutivas. |
| Nível ≥ 4 | Requer `approvalRequired = true`. |
| Nível 5 | Requer `approvalRequired = true` **E** `justificationRequired = true`. |
| Nível declarado < nível máx. das ações permitidas | **Warning** (não bloqueia). |

Erros bloqueiam a publicação (`422`); warnings não. Ver
`OPERATION_PUBLICATION_TRANSACTION.md`.

## Validação, não execução

- O perfil é usado para **validar a publicação** e **classificar** a versão.
- **Não** existe motor de execução: nada é executado com base no gradiente.
- Não há agentes; operações não rodam. O gradiente **não** é decorativo — ele
  efetivamente bloqueia/aprova publicações via `authority.rules.ts` (coberto por
  `authority.rules.spec`, níveis 1–5) — mas seu escopo hoje é publicação, não runtime.

## Decisões futuras

| ID | Tema | Estado |
| --- | --- | --- |
| **D-003** | Direção de `blocked` (nível 5 mais restritivo vs flag separada) | Mantido `blocked = 5` via `AUTHORITY_ORDER`; revisar com produto. |
| **D-004** | Taxonomia canônica de `AuthorityAction.key` | `key` permanece **texto livre** até decisão. |

Ver `docs/api/API_V1_OPEN_DECISIONS.md`, `AUTHORITY_PROFILE_MODEL_V1` (este doc) e
`docs/backend/OPERATION_PUBLICATION_TRANSACTION.md`.
