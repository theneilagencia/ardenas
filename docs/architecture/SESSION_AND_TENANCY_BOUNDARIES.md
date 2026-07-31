# Arden.AS — Fronteiras de Sessão e Multi-tenant

> **Nome do resultado:** ARDEN-FE-002 — Fronteiras de sessão e contexto de tenant.
> Documento arquitetural. Separa explicitamente **controle de experiência (UX)** de
> **segurança real (backend)**.

## Princípio

> O frontend pode decidir **o que exibir**, mas **nunca** será a autoridade final
> sobre identidade, papel, tenant ou permissão.

Nesta etapa a sessão é **local e simulada** (não há login real, token, cookie,
backend ou RLS). A arquitetura foi desenhada para não confundir essa simulação com
segurança: os contratos já refletem uma futura fonte server-side e o `organizationId`
propagado ao servidor é **derivado da sessão**, nunca informado pelo usuário.

## O que é controle de UX (cliente)

- `can(permission)` e a `PermissionBoundary` — escondem/desabilitam ações que o
  usuário não pode fazer. **Esconder um botão não protege uma ação.**
- `assertPermission(ctx, …)` nos casos de uso — lança `FORBIDDEN` localmente para
  evitar disparar uma ação claramente não permitida. É **defesa de interface**.
- Estados de sessão (`loading/unauthenticated/expired/suspended/no_organization/
  error/forbidden`) e suas telas.
- Isolamento visual entre organizações (filtros por `organizationId`, chaves de
  query por tenant, limpeza de cache na troca).

Tudo acima é **repetível/burlável no cliente** e deve ser tratado como conveniência.

## O que será responsabilidade do backend

- Autenticação real (emissão/validação de sessão, expiração, refresh, sign-out).
- Resolução autoritativa de identidade, memberships, papéis e permissões.
- Autorização **server-side** de **cada** ação (o cliente pode mentir).
- Segregação de tenant por linha (RLS) — o `X-Arden-Organization` é uma dica; o
  servidor deve derivar o tenant da sessão autenticada e **ignorar** valores
  arbitrários do cliente.
- Trilha de auditoria imutável e confiável (a auditoria local aqui é provisória).

## Como o tenant é derivado

1. O `SessionRepository` resolve o `SessionContext` (usuário, memberships,
   organização ativa, permissões, expiração).
2. O `TenantContext` é a **única** autoridade de sessão no cliente: seleciona a
   organização ativa em **um só ponto** e espelha o mínimo para as fatias ainda não
   migradas (via `store.applySession`).
3. Todo caso de uso recebe um `RequestContext` **derivado da sessão** — o
   `organizationId` vem daí, nunca de um formulário. Casos de uso sobrescrevem
   qualquer `organizationId` informado no input.
4. No modo `api`, o `ApiClient` envia `X-Arden-Organization` lido da sessão ativa
   (`active-context`), não de entrada do usuário.

## Como a organização ativa é trocada

- Único ponto: `TenantContext.switchOrganization(id)` → `SessionRepository.
  switchOrganization(id)`.
- O repositório **valida membership ativa** no destino; sem ela, lança `FORBIDDEN`.
- Em caso de erro, mantém a organização anterior.
- Ao efetivar: registra evento local `organization.switched`, **limpa o cache**
  (`queryClient.clear()`), reseta estado transitório e reaplica a sessão.

## Como os caches são isolados

- Chaves de query incluem o `organizationId` (`['operations', orgId, …]`).
- Na troca de organização e no sign-out: `queryClient.clear()` + `resetTenantScope()`
  (fecha drawers/modais/tour) — impede exibir dados do tenant anterior durante a
  transição. A seleção persistida em IndexedDB guarda apenas usuário/organização
  ativos e o marcador de sign-out — **nunca tokens**.

## Contratos que a API futura deverá implementar

- `GET  /session` → `SessionContext | null`
- `POST /session/switch-organization { organizationId }` → `SessionContext`
- `POST /session/refresh` → `SessionContext`
- `POST /session/sign-out` → `204`
- Todos os endpoints de domínio devem **derivar o tenant da sessão** e revalidar
  permissões server-side. O header `X-Arden-Organization` é dica, não autoridade.

## Estados de sessão

| Estado | Origem | Tela |
|---|---|---|
| `loading` | resolvendo sessão | spinner |
| `authenticated` | sessão + org ativa | aplicação |
| `unauthenticated` | sem sessão | tela informativa (sem login nesta etapa) |
| `expired` | `expiresAt` no passado | expirada + renovar/recarregar |
| `suspended` | usuário/membership suspensos | acesso suspenso |
| `no_organization` | sem membership ativa | sem organização |
| `forbidden` | rota sem permissão | acesso negado (por rota) |
| `error` | falha ao carregar | erro + tentar novamente |

## Riscos remanescentes (documentados)

- **Nada aqui é segurança de produção.** Todo `can()`/boundary é burlável no cliente.
- A auditoria de sessão é **local e mutável** (best-effort); não é imutável.
- Em modo `api` sem backend configurado, a sessão falha com erro **tipado**
  (`UNAVAILABLE`) — **sem fallback silencioso** para mock.
- As demais fatias de domínio (aprovações, execuções, etc.) ainda usam a store como
  fonte da verdade; herdam o `organizationId` do espelho de sessão até serem migradas.
- A identidade de usuário é derivada por e-mail no snapshot (simulação); o backend
  fornecerá identidades reais.
