<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Isolamento de ambientes

Modelo **proposto** de ambientes e isolamento, provider-neutro. Complementa
`ENVIRONMENT_STRATEGY.md` (auditoria PRD-001) com a decisão de infraestrutura.

## Ambientes

| Ambiente | Propósito | Dados | Rede/credenciais | Anthropic |
| --- | --- | --- | --- | --- |
| **local** | Desenvolvimento | Sintéticos/seed | Local; `EnvironmentPlatformSecretSource` | DISABLED |
| **CI** | Gates automatizados | Efêmeros (service `postgres:16`) | Isolado por job; secrets de teste | DISABLED |
| **staging** | Pré-produção | Sintéticos/anonimizados | **Isolado de produção** (rede, banco, secrets, identidades próprios) | DISABLED |
| **production** | Produção | Reais (tenant) | Rede privada; secret manager; identidades próprias | DISABLED (bloqueado) |
| **recovery-drill** | Restore drill | Restaurados de backup | **Isolado de produção**; wrapping key só aqui | DISABLED |

## Regras de isolamento

- **Staging ↔ Production totalmente isolados:** redes distintas, **bancos distintos**,
  **secret managers/paths distintos**, **identidades de workload distintas**. Nenhuma
  credencial de staging alcança produção e vice-versa.
- **Nunca** copiar dados reais de produção para staging sem anonimização (jurídico, S8).
- **recovery-drill** nunca escreve em produção; usa a `CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY`
  (papel `Restore operator`, `INFRASTRUCTURE_IAM_MODEL.md`).
- **Promoção** entre ambientes é por **artefato imutável** (mesma imagem OCI promovida),
  não rebuild — ver `DEPLOYMENT_AND_PROMOTION.md`.
- Cada ambiente tem seu próprio conjunto dos 5 secrets do catálogo fechado (valores
  distintos; a master key de produção nunca aparece em staging/CI/local).
- **CI** usa apenas secrets de teste; `WELL_KNOWN_TEST_MASTER_KEYS` são **rejeitadas em
  produção** (`env.schema.ts`) — impede que fixture de teste vaze para produção.

## Paridade dev/prod

- Mesma major do PostgreSQL (16) em todos os ambientes (local/CI via `postgres:16`;
  staging/prod no provedor gerenciado).
- Mesma imagem de container (`apps/api/Dockerfile`) promovida entre staging e produção.
- Diferenças aceitas: tamanho de instância, HA/PITR (só staging/prod), scale-to-zero.

## Itens de IMPLEMENTAÇÃO (001.2B — não feitos nesta fase)

1. Provisionar staging e production isolados (rede/banco/secrets/identidades separados).
2. Ambiente `recovery-drill` sob demanda para o restore drill.
3. Pipeline de promoção por artefato imutável entre staging→production.

## Estado atual

- **Documental / proposto.** Gate "Environments ready (staging+prod)" permanece **MISSING**
  (REQUIRED BEFORE PILOT).
