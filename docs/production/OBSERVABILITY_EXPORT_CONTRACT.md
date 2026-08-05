<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Contrato de exportação de observabilidade (provider-neutro)

Sinais a exportar: **logs, métricas, traces, errors, uptime, synthetics**. Protocolo
proposto: **OpenTelemetry** (justificado pela portabilidade), **sem** escolher backend.

## Atributos obrigatórios
- resource attributes; service names (api/worker); environment labels
  (local/CI/staging/production/recovery); **release SHA**;
- **redaction** (nunca logar segredo/plaintext/credencial);
- sampling policy; requisitos de retenção (definidos por ambiente).

## Estado
Contrato pronto; **nenhum collector externo** adicionado nesta fase. Backend escolhido em
001.2B (consequência do ADR-0001). Alertas em `ALERT_DEFINITION_SCHEMA.md`.
