# Evidência do runtime (ARDEN-BE-007.3 §27/§28)

Sem tabelas novas: reutiliza `evidence_records`, `execution_events` e `audit_events` do
BE-005. A evidência (tipo OUTPUT em sucesso; ERROR em falha, via `AgentStepError.toolEvidence`)
é SANITIZADA e contém apenas metadados: agentDefinition/version, contentHash, provider/model,
inputHash, outputHash, schemaHash, status, errorCode, repairAttemptCount, modelCallCount,
usage, durationMs, sinais de segurança, checks de avaliação. **Nunca** conteúdo integral:
sem prompt completo, systemInstructions completos, execution input completo, output completo
por default, nem segredo.

Eventos de execução `agent.*` (append-only, actorType WORKER): execution_started,
context_assembled, model_called, output_received, output_invalid, output_repair_started,
output_repair_exhausted, evaluation_passed/failed, execution_completed/failed/unknown.
Auditoria de negócio: `agent.execution_started` + classificação final. Toda gravação passa
pela redação do `ExecutionRecorder`/`AuditRecorder` (endurecida para cobrir api-key/credential).
