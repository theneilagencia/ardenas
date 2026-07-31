# Arden.AS — Eventos de Auditoria de Identidade (ARDEN-BE-002)

> Registro **append-only** de eventos de identidade, autorização e tenant. Sem update
> nem delete públicos. Nunca contém tokens/segredos.

## Modelo

`IdentityAuditEvent` (`identity_audit_events`):

| Campo | Descrição |
| --- | --- |
| `id` | UUID. |
| `actorUserId` | Usuário ator (quando conhecido). |
| `organizationId` | Organização em contexto (quando aplicável). |
| `action` | Ação (ver catálogo abaixo). |
| `resourceType` / `resourceId` | Recurso afetado. |
| `outcome` | `SUCCESS` \| `DENIED` \| `FAILURE`. |
| `reasonCode` | Código do motivo (ex.: `MEMBERSHIP_REQUIRED`, `USER_SUSPENDED`). |
| `correlationId` | Correlação com a requisição (rastreabilidade fim-a-fim). |
| `ipAddress` / `userAgent` | Origem (quando disponível). |
| `metadata` | JSON **saneado** (chaves sensíveis redigidas). |
| `occurredAt` | Timestamp UTC. |

Índices por `organizationId`, `actorUserId` e `correlationId` para investigação.

## Escrita append-only e best-effort

`IdentityAuditService.record()` (`src/identity/identity-audit.service.ts`) apenas
**cria** eventos. Uma falha ao gravar auditoria **não derruba** a requisição, mas é
logada. Não há caminho público de update/delete.

## Redação de metadados

Antes de gravar, `metadata` passa por saneamento: qualquer chave que combine
`/(authorization|token|secret|password|cookie)/i` é substituída por `[REDACTED]`.
Tokens **nunca** entram no log; o cabeçalho `Authorization` é redigido. Coberto por
`test/identity-authz.integration.spec.ts` (“metadados sensíveis são redigidos”).

## Catálogo de ações

| Ação | Quando | Outcome típico |
| --- | --- | --- |
| `identity.authenticated` | Autenticação bem-sucedida | `SUCCESS` |
| `identity.authentication_failed` | Token ausente/expirado/inválido | `FAILURE` (`MISSING_TOKEN`/`EXPIRED`/`INVALID`) |
| `identity.user_provisioned` | Primeiro provisionamento JIT | `SUCCESS` |
| `identity.bootstrap` | Bootstrap de organização (CLI) | `SUCCESS` |
| `access.denied` | Usuário suspenso tenta acessar | `DENIED` (`USER_SUSPENDED`) |
| `organization.access_denied` | Org inexistente/suspensa | `DENIED` |
| `membership.access_denied` | Sem membership / membership suspensa | `DENIED` |
| `permission.access_denied` | Falta permissão exigida | `DENIED` |
| `organization.selected` | Troca de organização aprovada | `SUCCESS` |
| `organization.selection_denied` | Troca de organização negada | `DENIED` |
| `session.loaded` / `session.refreshed` | Sessão montada/atualizada | `SUCCESS` |
| `session.logged_out` | Logout | `SUCCESS` |

## Consultas úteis (investigação)

```sql
-- Negações recentes de uma organização
SELECT occurred_at, action, reason_code, actor_user_id
FROM identity_audit_events
WHERE organization_id = $1 AND outcome = 'DENIED'
ORDER BY occurred_at DESC LIMIT 100;

-- Rastrear uma requisição fim-a-fim
SELECT * FROM identity_audit_events WHERE correlation_id = $1 ORDER BY occurred_at;
```

Ver `IDENTITY_INCIDENT_RESPONSE.md` para uso operacional.
