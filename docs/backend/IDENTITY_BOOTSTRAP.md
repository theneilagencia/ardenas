# Arden.AS — Bootstrap de Identidade (ARDEN-BE-002)

> Como criar a **primeira** organização e o **primeiro** administrador de forma segura,
> **fora** da API pública. Nunca há endpoint público de bootstrap, nunca auto-admin.

## Por que uma CLI

Conceder o primeiro papel de administrador é uma operação privilegiada. Expô-la como
endpoint criaria uma janela de escalonamento. Por isso o bootstrap é uma **CLI**
executada por um operador com acesso ao banco.

## Uso

```bash
# Pré-requisito: catálogo semeado (a CLI também o garante).
npm run db:seed

# Simulação (não escreve nada):
npm run bootstrap:organization -- \
  --name "TheNeil" --slug "theneil" \
  --user-subject "<SUBJECT_DO_PROVEDOR>" --user-email "admin@theneil.com" \
  --provider supabase --role corporate_admin --dry-run

# Execução real (exige confirmação interativa, ou --yes em ambiente não interativo):
npm run bootstrap:organization -- \
  --name "TheNeil" --slug "theneil" \
  --user-subject "<SUBJECT_DO_PROVEDOR>" --user-email "admin@theneil.com" \
  --provider supabase --role corporate_admin --yes
```

Arquivo: `apps/api/prisma/bootstrap-organization.ts`.

## Garantias

- **Idempotente.** Reexecutar não duplica: encontra usuário por `(provider, subject)`,
  organização por `slug`, membership por `(userId, organizationId)`; apenas garante a
  atribuição do papel. IDs permanecem estáveis entre execuções.
- **`--dry-run`.** Não escreve nada; reporta o que faria.
- **Confirmação.** Sem `--dry-run`, exige confirmação interativa. Em ambiente não
  interativo (sem TTY) **aborta** a menos que `--yes` seja passado explicitamente.
- **Sem segredos.** **Nunca** recebe senha; **nunca** imprime token. O `--user-subject`
  é o identificador do provedor de identidade, não uma credencial.
- **Falha em conflito material.** Se o `slug` já existe com **outro nome**, a CLI
  **falha** em vez de sobrescrever.
- **Auditoria.** Registra `identity.bootstrap` em `IdentityAuditEvent`.

## Parâmetros

| Flag | Obrigatória | Default | Descrição |
| --- | --- | --- | --- |
| `--name` | sim | — | Nome da organização. |
| `--slug` | sim | — | Slug único da organização. |
| `--user-subject` | sim | — | `subject` do usuário no provedor de identidade. |
| `--user-email` | não | — | E-mail do usuário (não é identidade). |
| `--provider` | não | `AUTH_PROVIDER` ou `supabase` | Provedor da identidade externa. |
| `--role` | não | `corporate_admin` | Papel de sistema inicial. |
| `--dry-run` | não | — | Não escreve. |
| `--yes` | não | — | Confirma em ambiente não interativo. |

## Cobertura

`test/bootstrap-constraints.integration.spec.ts` cobre dry-run (nada escrito), execução
real (usuário/org/membership/papel + auditoria), repetição idempotente e falha por
conflito material.
