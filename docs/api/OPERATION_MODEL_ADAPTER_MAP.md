# Arden.AS — Mapa de Adaptação do Modelo de Operação (ARDEN-BE-003 · GAP-12)

> O frontend tem uma `Operation` **rica e achatada**; o v1 é um modelo **lean e
> versão-cêntrico**: os campos ricos de negócio vivem em `OperationVersion.definition`.
> Este doc lista **cada** campo rico, o que é mapeado ao v1 e o que é adiado (D-005), com
> o **default neutro** e o plano de remover o adaptador. **Nada substantivo é inventado.**

## Princípio

- Campos **mapeados** ao v1 são transportados fielmente para `definition` (ou para os
  metadados da operação).
- Campos **adiados (D-005)** recebem, na leitura, **defaults neutros** (`''` / `[]` / `0`
  / `null`, mais `criticality = 'moderate'` e `version = '1.0'`). Nada é preenchido com
  informação de negócio inventada.
- O adaptador do frontend (`src/services/api/…` adapter) **documenta cada default**. O
  plano é **remover o adaptador** quando a definição rica entrar no contrato (D-005),
  passando o modelo do frontend a espelhar o v1.

## Campos mapeados ao v1 (→ `OperationVersion.definition` / metadados da operação)

| Campo frontend | Campo API | Transformação | Default | Risco |
| --- | --- | --- | --- | --- |
| `name` | `operation.name` (metadado) | direto | — | — |
| `description` | `operation.description` | direto | `null` | baixo |
| `ownerId` | `operation.ownerId` | direto (membro ativo do tenant) | `null` | baixo |
| `status` | `operation.status` | `draft\|active\|paused\|archived` (D-002) | `draft` | médio (colapso de status) |
| `objective` | `definition.objective` | direto | `''` | baixo |
| `expectedResult` | `definition.expectedResult` | direto | `''` | baixo |
| `triggers` | `definition.triggers` | direto | `[]` | baixo |
| `steps` | `definition.steps` | direto | `[]` | baixo |
| `actions` | `definition.actions` | direto | `[]` | baixo |
| `approverIds` | `definition.approverIds` | direto | `[]` | baixo |
| `contextSourceIds` | `definition.contextSourceIds` | direto | `[]` | baixo |
| `integrationIds` | `definition.integrationIds` | direto | `[]` | baixo |
| `completionCriteria` | `definition.completionCriteria` | direto | `[]` | baixo |
| `environment` | `definition.environment` | direto | `null` | baixo |
| `evidencePolicy` | `definition.evidencePolicy` | direto | `null` | baixo |

## Campos NÃO no v1 — adiados (D-005), default neutro na leitura

| Campo frontend | Campo API | Transformação | Default (neutro) | Risco |
| --- | --- | --- | --- | --- |
| `problem` | — (adiado) | — | `''` | perda temporária de conteúdo |
| `recipients` | — | — | `[]` | baixo |
| `deliverables` | — | — | `[]` | baixo |
| `frequency` | — | — | `null` | baixo |
| `sla` | — | — | `null` | médio |
| `indicators` | — | — | `[]` | baixo |
| `businessOwnerId` | — | — | `null` | médio (ownership) |
| `technicalOwnerId` | — | — | `null` | médio (ownership) |
| `supervisorId` | — | — | `null` | baixo |
| `substituteIds` | — | — | `[]` | baixo |
| `approvalChain` | — | — | `[]` | médio (governança) |
| `operationalLimits` | — | — | `null` | médio |
| `budget` | — | — | `null` | médio |
| `workUnits` | — | — | `[]` | baixo |
| `retentionPolicy` | — | — | `null` | médio (compliance) |
| `notificationRules` | — | — | `[]` | baixo |
| `criticality` | — | — | `'moderate'` | médio (default explícito) |
| `tags` | — | — | `[]` | baixo |
| `companyId` | — | — | `null` | baixo |
| `unitId` | — | — | `null` | baixo |
| `areaId` | — | — | `null` | baixo |
| `costCenterId` | — | — | `null` | baixo |
| `version` (string) | — | — | `'1.0'` | baixo (v1 usa `versionNumber` inteiro) |

## Autoridade (GAP-11)

A autoridade migra de `authorityLevel` por passo/ação + matriz de exibição para um
`AuthorityProfile` **de nível de versão** (classificação primária de publicação). Ver
`docs/domain/AUTHORITY_PROFILE_MODEL_V1.md`.

## Plano de remoção do adaptador

O adaptador existe apenas enquanto o frontend for mais rico que o contrato. Quando a
definição rica entrar no v1 (D-005), os campos adiados deixam de receber defaults neutros
e o adaptador é **removido**, com o modelo do frontend espelhando o v1 versão-cêntrico.
Até lá: **somente defaults neutros; nenhuma informação de negócio inventada.**

Ver `docs/api/API_V1_OPEN_DECISIONS.md` (D-002, D-005), `FRONTEND_TO_API_V1_MAP.md`.
