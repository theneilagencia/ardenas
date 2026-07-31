# Arden.AS — Enforcement de Multitenancy (ARDEN-BE-002)

> Isolamento entre organizações é **inegociável**. Nenhum dado cruza tenants. O path
> localiza o tenant; a **membership validada no servidor** é o que autoriza.

## Regras

1. **O path não autoriza.** `:organizationId` identifica o tenant; a autorização é
   sempre a membership ativa do usuário naquela organização, validada a cada requisição
   (`OrganizationGuard` → `AuthorizationService`).
2. **Sem tenant no corpo.** O cliente nunca informa organização por corpo livre. A
   organização ativa vem da sessão/preferência validada.
3. **Proteção contra enumeração.** Organização inexistente e organização sem membership
   devolvem **o mesmo 404** — impossível descobrir quais organizações existem.
4. **Recomputo por requisição.** Permissões efetivas são recalculadas do banco a cada
   chamada; nada é confiado de chamadas anteriores nem do cliente.
5. **Escopo de leitura.** `GET /organizations` retorna **apenas** as organizações do
   próprio usuário (memberships não `REVOKED`, organizações não `ARCHIVED`).

## Cenário de teste crítico

`test/multitenancy.integration.spec.ts` monta o cenário exigido e o exercita **por HTTP
real** contra Postgres:

- **Usuário A** — membro apenas de **Alpha** (papel `analyst`).
- **Usuário B** — membro apenas de **Beta** (papel `analyst`).
- **Usuário C** — membro de **ambas**, com papéis **diferentes**: `corporate_admin` em
  Alpha, `auditor` em Beta.

Provas:

| Verificação | Resultado |
| --- | --- |
| A lista de organizações de A/B | apenas Alpha / apenas Beta |
| C lista organizações | Alpha **e** Beta |
| A acessa `GET /organizations/{beta}` | **404** (existe, mas não é membro) |
| B acessa `GET /organizations/{alpha}` | **404** |
| A troca para Beta | **404**, preferência inalterada |
| Permissões de C com Alpha ativa | contém `organization.manage` (admin) |
| Permissões de C com Beta ativa | **não** contém `organization.manage` (auditor) |
| `memberships/me` de C em cada org | reflete o papel correto; papéis não vazam entre orgs |

O ponto central: as permissões efetivas de C **mudam conforme a organização ativa**,
sempre recomputadas no servidor.

## Troca de organização

`POST /api/v1/session/switch-organization` valida a membership antes de persistir a
preferência. Se negado, **mantém a organização anterior** e audita
`organization.selection_denied`. Se aprovado, faz upsert de `UserSessionPreference` e
audita `organization.selected`.

## Vazamento no frontend

O E2E de modo api (`e2e/api/session-api.spec.ts`) prova que, sem token, o modo `api`
**não** cai para dados simulados — nenhuma organização de mock aparece. O frontend
limpa caches ao trocar de organização/sair (ARDEN-FE-002), mas a garantia real é do
backend.
