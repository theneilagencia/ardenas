# Mapa de Adaptação — Políticas (Frontend ↔ API v1)

Como o modelo de política do frontend se conecta aos recursos v1. Em modo `api` **não há
fallback** para mock/IndexedDB.

## Recursos e endpoints

| Recurso                | Endpoint v1                                                      |
| ---------------------- | --------------------------------------------------------------- |
| Listar políticas       | `GET /organizations/{org}/policies`                             |
| Criar política         | `POST /organizations/{org}/policies` (idempotente)             |
| Consultar/editar       | `GET|PATCH /organizations/{org}/policies/{policyId}`           |
| Nova versão            | `POST …/policies/{policyId}/versions` (idempotente)            |
| Editar rascunho        | `PATCH …/policies/{policyId}/versions/{versionId}`            |
| Publicar               | `POST …/policies/{policyId}/versions/{versionId}/publish`      |
| Suspender/arquivar     | `POST …/policies/{policyId}/suspend|archive`                   |
| Vínculos               | `GET|POST …/operations/{op}/policy-bindings`, `PATCH|DELETE …/{bindingId}` |

## Campos (contrato → UI)

- `status` (`DRAFT|PUBLISHED|SUSPENDED|ARCHIVED`) → selo de estado.
- `currentDraftVersionId` / `publishedVersionId` → ponteiros de edição/vigência.
- `definition.appliesWhen[]` → editor de condições (campo/operador/valor).
- `definition.effect` (`ALLOW|DENY|REQUIRE_APPROVAL`) → efeito da política.
- `definition.limits` → limites financeiro/quantidade (moeda explícita).
- `revision` → `expectedRevision` em edições (concorrência otimista).

## Regras de UI

- O cliente **não** decide efeito de política sobre uma ação — apenas edita a definição;
  a decisão é do servidor (`/actions/evaluate`).
- Edição de versão publicada é bloqueada (409 `ALREADY_PUBLISHED`) — a UI oferece "nova
  versão".
