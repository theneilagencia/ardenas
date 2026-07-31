# Arden.AS — Resposta a Incidentes de Identidade (ARDEN-BE-002)

> Runbook operacional para conter e investigar incidentes de identidade, acesso e
> tenant. Ações são no **banco do Arden** e/ou no **provedor de identidade**.

## Princípios

- O acesso é **recomputado a cada requisição**; portanto, suspender/revogar tem efeito
  **imediato** na próxima chamada. Não há sessão de servidor a invalidar além do token.
- O token do provedor (Supabase) tem vida curta; a invalidação definitiva do token é do
  provedor. Suspender o usuário no Arden nega o acesso mesmo com token ainda válido.

## Cenários

### 1. Token/credencial comprometida
1. **Suspender o usuário** no Arden (bloqueio imediato do acesso):
   ```sql
   UPDATE users SET status = 'SUSPENDED' WHERE id = $userId;
   ```
2. Revogar/rotacionar a sessão no provedor de identidade (Supabase) para invalidar o
   token emitido.
3. Investigar via auditoria por `correlationId`/`actorUserId` (ver abaixo).

### 2. Acesso indevido a uma organização
- **Revogar a membership** (não aparece mais na sessão; acesso negado):
  ```sql
  UPDATE memberships SET status = 'REVOKED'
  WHERE user_id = $userId AND organization_id = $orgId;
  ```
- Para bloqueio temporário, use `SUSPENDED` em vez de `REVOKED`.

### 3. Organização comprometida
- **Suspender a organização** (nega acesso de todos os membros):
  ```sql
  UPDATE organizations SET status = 'SUSPENDED' WHERE id = $orgId;
  ```
- Para retirada definitiva, `ARCHIVED` (deixa de ser visível na sessão).

### 4. Papel com permissões excessivas
- Marcar o papel como inativo (deixa de conceder permissões imediatamente):
  ```sql
  UPDATE roles SET status = 'INACTIVE' WHERE id = $roleId;
  ```
- Ou remover a atribuição em `membership_roles` / ajustar `role_permissions` e
  reexecutar o seed (idempotente) para reconvergir o catálogo.

### 5. Chave de assinatura do provedor rotacionada/comprometida
- O JWKS remoto é buscado dinamicamente; atualizar `SUPABASE_JWKS_URL`/rotacionar a
  chave no provedor propaga automaticamente. Reinícios não são necessários para novas
  chaves publicadas no JWKS.

## Investigação por auditoria

```sql
-- Linha do tempo de um ator
SELECT occurred_at, action, outcome, reason_code, organization_id, correlation_id
FROM identity_audit_events WHERE actor_user_id = $userId
ORDER BY occurred_at DESC LIMIT 200;

-- Falhas de autenticação recentes (possível brute force)
SELECT occurred_at, reason_code, ip_address, user_agent
FROM identity_audit_events
WHERE action = 'identity.authentication_failed'
ORDER BY occurred_at DESC LIMIT 200;

-- Negações de permissão por organização
SELECT occurred_at, actor_user_id, reason_code
FROM identity_audit_events
WHERE action = 'permission.access_denied' AND organization_id = $orgId
ORDER BY occurred_at DESC;
```

## Contenção rápida (checklist)

- [ ] Usuário suspenso no Arden?
- [ ] Sessão/token revogado no provedor?
- [ ] Membership revogada/suspensa onde aplicável?
- [ ] Organização suspensa se o incidente for de tenant?
- [ ] Papel excessivo neutralizado (INACTIVE / catálogo reconvergido)?
- [ ] Linha do tempo de auditoria coletada por `correlationId`/`actorUserId`?

## Limites

Rate limit nos endpoints de sessão reduz abuso. Tokens nunca são logados; metadados de
auditoria são saneados. A auditoria é append-only — não é possível apagar rastros pela
aplicação.
