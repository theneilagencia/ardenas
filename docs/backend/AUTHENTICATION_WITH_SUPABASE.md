# Arden.AS — Autenticação com Supabase (ARDEN-BE-002)

> O Supabase Auth cuida **apenas** de identidade, login e emissão de token. O Arden
> verifica o token **criptograficamente** e é dono do resto. O Supabase é usado
> **isolado atrás de um adaptador** — trocá-lo não afeta o domínio.

## Verificação do token (nunca só decodificar)

`SupabaseIdentityProvider` (`src/identity/supabase-identity.provider.ts`) usa `jose`:

- **Assinatura** validada por **JWKS remoto** (`createRemoteJWKSet`) — chave pública,
  nunca `service_role`.
- **Issuer** obrigatório (`SUPABASE_JWT_ISSUER`).
- **Audience** validada quando configurada (`SUPABASE_JWT_AUDIENCE`).
- **Expiração / not-before** com tolerância de relógio (`AUTH_CLOCK_TOLERANCE_SECONDS`).
- **Algoritmos restritos**: apenas `RS256` e `ES256`. Tokens `HS256` (segredo simétrico)
  são **rejeitados** — impede confundir a chave pública com segredo compartilhado.

Um token apenas **decodificado** (sem verificação de assinatura) **nunca** é aceito.
Falha de expiração mapeia para `SESSION_EXPIRED`; qualquer outra falha para
`UNAUTHENTICATED`. Não é necessário `service_role` para validar.

## Configuração

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `AUTH_PROVIDER` | sim | `supabase` (default) ou `fake`. `fake` é **proibido em production**. |
| `SUPABASE_JWKS_URL` | quando `supabase` | URL do JWKS (`.../auth/v1/.well-known/jwks.json`). |
| `SUPABASE_JWT_ISSUER` | quando `supabase` | Issuer esperado. |
| `SUPABASE_JWT_AUDIENCE` | não | Audience esperada (validada se presente). |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | não | Referência; não usadas na verificação. |
| `AUTH_CLOCK_TOLERANCE_SECONDS` | não (default 5) | Tolerância de relógio. |

A validação de configuração (`src/config/env.schema.ts`) **não deixa a aplicação subir**
se `AUTH_PROVIDER=supabase` sem `SUPABASE_JWKS_URL`/`SUPABASE_JWT_ISSUER`, e **rejeita**
`AUTH_PROVIDER=fake` quando `NODE_ENV=production`.

## Provedor fake (apenas dev/testes)

`FakeIdentityProvider` emite/verifica tokens opacos (`fake.<base64url(json)>`) — **não é
criptografia**. Existe para desenvolvimento e testes automatizados, é **bloqueado em
production** pela config e emite um `WARNING: FAKE IDENTITY PROVIDER ACTIVE` ao subir.
**Não há fallback silencioso** entre Supabase e fake — a seleção é única e explícita.

## Provisionamento JIT

Ao autenticar pela primeira vez, o usuário interno é criado **on-demand** por
`(externalProvider, externalSubject)` (`UserProvisioningService`):

- O **subject é imutável**; o e-mail e o nome de exibição são atualizados a cada login.
- O e-mail **não** é identidade estável (pode mudar no provedor).
- **Não** cria organização nem membership automaticamente.
- **Não** concede admin automaticamente.
- Sem membership ativa, a sessão volta com status `no_organization`.

O primeiro provisionamento gera o evento de auditoria `identity.user_provisioned`; toda
autenticação gera `identity.authenticated` (e `identity.authentication_failed` em falha).

## Higiene

- Tokens **nunca** são logados; o cabeçalho `Authorization` é redigido.
- Os endpoints de sessão têm **rate limit** próprio (mais estrito que o base).
- Timestamps em UTC; identificadores opacos (UUID).
