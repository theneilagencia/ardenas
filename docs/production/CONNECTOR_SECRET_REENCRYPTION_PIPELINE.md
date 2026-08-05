<!-- Milestone: ARDEN-PRD-001.1D -->
# ARDEN-PRD-001.1D — Pipeline de recriptografia de credenciais

Implementado em `apps/api/src/security/connector-credential-reencryption.service.ts`
(+ adapter Prisma `connector-reencryption.prisma-adapter.ts`).

## Fluxo por registro
```
selecionar elegível (status=ACTIVE, material presente, keyVersion != PRIMARY)
→ decifra com a versão registrada (AAD org\tconn\tcredId\tkeyVersion)
→ cifra com a PRIMARY (mesma AAD exceto keyVersion)
→ COMPARE-AND-SET (WHERE id + keyVersion=antigo + encryptedSecret=antigo)
→ descarta plaintext
```
**Não toca** organizationId, connectionId, versionNumber, status, ownership, timestamps
funcionais ou metadata de negócio. **Sem migration** — usa o schema existente
(`keyVersion` + campos de material).

## Propriedades (comprovadas por teste)
- **Batching:** `batchSize` (1..500), transações curtas, sem carregar a tabela; `hasMore`
  para paginar; `maximumBatches` no CLI.
- **Dry-run:** reporta o que seria recriptografado sem escrever.
- **CAS/Concorrência:** alteração concorrente (rotação/revogação) → `updateMany` afeta 0
  linhas → `skippedConcurrentChange`; **nunca sobrescreve o vencedor**.
- **Idempotência:** 2ª execução → 0 elegíveis, 0 recriptografados (registros já em PRIMARY
  são ignorados).
- **Retomada:** derivada do estado do banco (sem checkpoint sensível).
- **Falhas classificadas:** `UNKNOWN_KEY_VERSION`, `AUTHENTICATION_FAILED`,
  `MALFORMED_CIPHERTEXT`, `CONCURRENT_CHANGE`, `DATABASE_ERROR`; falha de um registro não
  corrompe os demais; auth failure nunca ignorada; segredo inválido nunca vira vazio.
- **Sanitizado:** o resultado do batch não contém ciphertext nem segredo.

## Remoção de chave antiga
Só REPORTA elegibilidade (`keyRemovalEligibility`) quando referências=0 + backup + drill +
approval. **Nunca remove automaticamente.**
