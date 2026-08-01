# Modelo de Fluxo de Aprovação (ARDEN-BE-004)

## ApprovalFlow / ApprovalFlowStep

Um fluxo (`@@unique(organizationId, key)`) tem status `DRAFT|ACTIVE|SUSPENDED|ARCHIVED`
e uma sequência ordenada de etapas (`@@unique(approvalFlowId, sequence)`).

Cada **etapa** define:

| Campo                    | Significado                                                        |
| ------------------------ | ----------------------------------------------------------------- |
| `sequence`               | ordem 1..N sem lacunas (validado no serviço)                      |
| `decisionMode`           | `ANY_ONE` \| `QUORUM` \| `ALL`                                     |
| `quorum`                 | nº de aprovações distintas (obrigatório em `QUORUM`)              |
| `requiredPermission`     | permissão exigida do aprovador                                    |
| `eligibleRoleKey`        | papel exigido do aprovador                                        |
| `specificApproverUserId` | aprovador nomeado                                                 |
| `requesterCannotApprove` | segregação de funções (default `true`)                           |
| `justificationRequired`  | decisão exige justificativa                                       |
| `expiresAfterMinutes`    | prazo da etapa (define `expiresAt` da solicitação)               |
| `escalationAfterMinutes` | metadado de escalonamento (reservado; sem worker em BE-004)      |

## Ciclo de vida

- **Criar** (transacional: fluxo + etapas). Sequências validadas.
- **Editar** (concorrência otimista) — substitui as etapas em bloco.
- **Ativar** — exige ≥ 1 etapa; só fluxo `ACTIVE` governa novas solicitações.
- **Suspender** — para de rotear novas solicitações (não afeta as já criadas).

Um fluxo arquivado não transiciona nem é editado.

## Avanço de etapa

A solicitação guarda `currentStepSequence`. Ao atingir o quórum da etapa corrente, ou
avança para a próxima (recalculando `expiresAt` a partir de `expiresAfterMinutes`), ou —
se era a última — conclui em `APPROVED` e emite a autorização.

Permissões: criar/editar/ativar/suspender exigem `policy.manage`; ler exige
`approval.view`.
