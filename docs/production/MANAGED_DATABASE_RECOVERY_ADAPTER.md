<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Adapter de recuperação de banco gerenciado

Contrato provider-neutro: `tooling/infrastructure/database-recovery.ts`.

```
interface ManagedDatabaseRecoveryAdapter {
  inspectBackups(): Promise<BackupInventory>
  requestRestore(input: RestoreRequest): Promise<RestoreOperation>
  inspectRestore(operationId): Promise<RestoreStatus>
  destroyRecoveryEnvironment(input): Promise<void>
}
```

## Estado atual
Nenhum provider real implementado. O adapter padrão `UnselectedRecoveryAdapter` é
**FAIL-CLOSED**: toda operação lança `RECOVERY_ADAPTER_NOT_SELECTED` antes de qualquer
efeito. **Nenhum restore/backup real é alegado.** `requestRestore` só aceita ambiente
`recovery-drill`. Comandos: `database:backup:verify`, `database:restore:prepare`,
`database:restore:validate`, `database:restore:drill` (todos bloqueados/planejam sem executar).
