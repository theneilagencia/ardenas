<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Política de backup e PITR do banco

Política **proposta** (documental). Provider-neutra; a implementação (habilitar backups,
configurar retenção) é de ARDEN-PRD-001.2B. Fatos remetem a S1 do
`ARDEN_PRD_001_2A_SOURCE_REGISTER.md`.

## Objetivos (RPO/RTO propostos)

| Métrica | Alvo de piloto | Alvo de produção comercial | Observação |
| --- | --- | --- | --- |
| **RPO** (perda máxima) | ≤ 5 min | ≤ 5 min | Depende de PITR contínuo (WAL/logs). Provedores indicam RPO de minutos com PITR (S1.6/S1.9) — **reconfirmar** por plano/região. |
| **RTO** (tempo p/ restaurar) | ≤ 4 h | ≤ 1 h | Medido no restore drill (`DATABASE_RESTORE_DRILL_PLAN.md`); não assumido de marketing. |
| **Retenção de backup** | ≥ 7 dias | ≥ 30 dias | RDS/Cloud SQL/Azure suportam retenção configurável (S1.3/S1.7/S1.10). |
| **Janela PITR** | ≥ 7 dias | ≥ 7 dias (rever) | Azure PITR até 35d; Cloud SQL logs 1–35d por edição (S1.10/S1.6). |

> RPO/RTO são **metas propostas**, não SLAs. Só viram "verificados" após o restore drill
> medir tempos reais. Nenhum número de SLA de provedor é reproduzido como final (S4 =
> REQUIRES_SALES_CONFIRMATION).

## Componentes a proteger (dois planos independentes)

O Arden.AS tem **dois** ativos de recuperação que devem ser restaurados em conjunto:

1. **Dados do banco** (PostgreSQL) — backups automatizados + PITR do provedor.
2. **`CONNECTOR_MASTER_KEY` (keyring)** — backup cifrado com **chave de embrulho
   separada**, checksum SHA-256, restore verify e drill offline (ARDEN-PRD-001.1;
   `connector-master-key-backup.ts`, `CONNECTOR_MASTER_KEY_BACKUP.md`).

**Invariante crítico:** restaurar o banco **sem** a master key correta torna as
credenciais cifradas ilegíveis (crypto-shredding efetivo). Portanto o drill de restauração
**deve** provar: restore do banco **+** disponibilidade da master key da versão referenciada
(`keyVersion` por credencial) **+** decrypt de credencial canário. Ver
`DATABASE_RESTORE_DRILL_PLAN.md`.

## Política proposta

- **Backups automatizados**: habilitados no provedor gerenciado (não backup caseiro).
  Gate BLOCKING "Backups enabled".
- **PITR**: habilitado; janela ≥ 7 dias; RPO alvo ≤ 5 min (reconfirmar por plano).
- **Backups são privados e cifrados em repouso** pelo provedor; acesso restrito por IAM
  (ver `INFRASTRUCTURE_IAM_MODEL.md`, papel `Backup operator` / `Restore operator`).
- **Cópia inter-região** dos backups: **decisão de negócio/jurídico** (residência de dados,
  S8) — marcada `REQUIRES_LEGAL_REVIEW`; não decidida aqui.
- **Retenção**: piloto ≥ 7 dias; produção ≥ 30 dias (rever custo, S5).
- **Teste de restauração periódico** (drill) obrigatório antes de piloto e recorrente
  (gate BLOCKING "Restore drill passed").
- **Nunca** apagar backups automatizados manualmente enquanto sustentam PITR (S1.7).
- **Master key**: backup cifrado + restore verify já entregues (aplicação); em produção o
  material do backup vive no secret manager (`CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY`)
  — nunca no repo.

## Responsabilidades (quem faz o quê)

| Ação | Provedor gerenciado | Time Arden.AS |
| --- | --- | --- |
| Executar backup automatizado | Sim | Configurar retenção/janela |
| Armazenar WAL/logs p/ PITR | Sim | Escolher janela |
| Restaurar (novo cluster) | Fornece a operação | Executar o drill e medir RTO |
| Backup da master key | — | `master-key:backup` (app) |
| Verificar decrypt pós-restore | — | `master-key:restore:verify` + credencial canário |

## Estado atual (honesto)

- **DATABASE** backup/PITR/restore em infra real: **STILL_OPEN / UNVERIFIED** — a habilitar
  em 001.2B. Gate "Backups enabled" e "Restore drill passed" permanecem **BLOCKING/MISSING**.
- **Master key**: backup cifrado + restore verify + drill **offline** entregues
  (PARTIALLY_CLOSED, nível de aplicação); backup/restore em **infra real** STILL_OPEN.
