<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura de connectors e tools

Score: **100%** (8 requisitos).

| Capacidade | Evidência | Status |
| --- | --- | --- |
| Catálogo de conectores/tools | projeção ConnectorDefinition/ToolDefinition | COMPLETE |
| Conexões (CRUD + lifecycle + test) | connections.service; test via SecureHttpClient | COMPLETE |
| Cofre AES-256-GCM (write-only) | aes-gcm.ts; canário sem plaintext | COMPLETE |
| Rotação + crypto-shredding | credential-versions.service; revoke apaga material | COMPLETE |
| Tool bindings (org + operação) | Organization/OperationToolBinding | COMPLETE |
| Webhooks inbound/outbound assinados | token→org server-side; dedup/replay; HMAC | COMPLETE |
| SSRF guard (anti-rebinding) | DNS all A/AAAA + classificação + pin; loopback/metadata bloqueados | COMPLETE |
| Executor de tool externa | external.http.request; retry; resultado incerto→UNKNOWN (sem falso sucesso) | COMPLETE |

UI `/integrations` conectada ao backend real (modo api); indisponível em demo (por design).
