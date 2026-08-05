<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Modelo de IAM e identidades de workload

Matriz **proposta** de identidades de workload e privilégios mínimos, provider-neutra.
Implementação em ARDEN-PRD-001.2B. Princípio: **menor privilégio**; nenhuma identidade
lê mais segredos do que precisa; separação forte entre runtime e recuperação.

## Identidades (workload identity matrix)

| Identidade | Onde roda | Lê secrets | Banco | Outros privilégios | NÃO pode |
| --- | --- | --- | --- | --- | --- |
| **API** | Compute (serviço) | `DATABASE_URL`, `CONNECTOR_MASTER_KEY_PRIMARY`, `SESSION_JWT_MATERIAL`, `OBSERVABILITY_TOKEN` | Conexão via **pooler** (app role, DML) | Emitir logs/métricas | Ler `CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY`; DDL; apagar backups |
| **Worker** | Compute (serviço) | `DATABASE_URL`, `CONNECTOR_MASTER_KEY_PRIMARY`, `OBSERVABILITY_TOKEN` | Pooler (app role, DML) | Consumir fila | Ler `SESSION_JWT_MATERIAL` (não precisa); wrapping key; DDL |
| **Migration job** | Job efêmero (CI/deploy) | `DATABASE_URL` **direto** (admin) | Conexão **direta** (admin, DDL) | `prisma migrate deploy` | Rodar como serviço 24/7; ler master key |
| **CI deploy** | GitHub Actions | Credencial de deploy (OIDC federado, curto) | — | Push de imagem (registro), acionar deploy | Acesso de leitura à master key de runtime; acesso a produção fora do fluxo aprovado |
| **Backup operator** | Automação do provedor | — | Executa/gerencia backups | Configurar retenção/PITR | Ler dados de credencial em claro; runtime |
| **Restore operator** | Ambiente `recovery-drill` | `CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY` (drill) | Restaurar p/ **novo** cluster (drill) | Executar restore drill | Escrever em produção; usar a primária de runtime |
| **Break-glass** | Acesso de emergência | Elevado, temporário, auditado | Elevado, temporário | Intervenção de incidente | Uso rotineiro; sem aprovação/registro |

## Regras transversais

- **Workload identity nativa** (IAM role / Workload Identity / Managed Identity) — **sem
  chaves de serviço exportadas** de longa duração (S3.2/S3.3).
- **CI usa federação OIDC** de curta duração para deploy — sem segredo estático de nuvem
  no GitHub.
- **Separação de chaves:** a `CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY` é lida **apenas**
  pelo `Restore operator` (recuperação), nunca pela API/worker de runtime. Isso preserva
  a propriedade de "backup cifrado com chave separada" (001.1).
- **Migration ≠ runtime:** a conexão de admin/DDL (direta) é distinta da conexão de app
  (pooler), com role de banco separado (`POSTGRESQL_POOLING_DECISION.md`).
- **Break-glass** é sempre temporário, aprovado e auditado; expira automaticamente; gera
  alerta.
- **Auditoria:** toda leitura de secret e todo acesso de restore são logados (S3).

## Mapeamento por plataforma (resumo)

| Papel | AWS (A) | GCP (B) | Azure (C) | PaaS (D) |
| --- | --- | --- | --- | --- |
| Workload identity | IAM Role / IRSA | Workload Identity | Managed Identity | Tokens de serviço escopados |
| CI→deploy | OIDC → IAM Role | OIDC → SA | OIDC → App reg | Token de deploy escopado |
| Segredo por identidade | Policy no segredo | IAM no segredo | RBAC no cofre | Política por caminho/projeto |

## Itens de IMPLEMENTAÇÃO (001.2B — não feitos nesta fase)

1. Criar as identidades acima com política mínima; provar que API não lê a wrapping key.
2. Configurar OIDC do GitHub Actions → role de deploy (sem segredo estático).
3. Separar role de banco de app (DML, via pooler) do role de migração (DDL, direto).
4. Processo de break-glass com expiração + alerta + registro.

## Estado atual

- **Documental / proposto.** Nada provisionado. Depende do ADR-0001 (plataforma) para
  materializar os nomes concretos.
