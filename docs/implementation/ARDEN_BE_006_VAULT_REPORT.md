# ARDEN-BE-006.4 — Relatório (cofre de credenciais)

## Entregue
- `SecretVault` (interface) + providers `app-aes-gcm` (AES-256-GCM) e `fake` (testes);
  seleção por config, sem fallback, `fake` proibido em production.
- `ConnectorKeyProvider` (master key + keyring por env; nunca no banco).
- AAD determinística (tenant+conexão+versão+keyVersion); nonce único; auth tag; falha
  fechada e sanitizada.
- Serialização/validação de segredo (só JSON; limites; credentialSchema) + fingerprint
  `sha256:<8hex>`.
- Ciclo de vida REAL: create/rotate atômicos com cifra na mesma transação; revoke com
  crypto-shredding; resolução server-side (`CredentialResolver`, sem endpoint público).
- Controller de credenciais (list/create/rotate/revoke) — primeiros endpoints
  funcionais de conector; guards + tenant + permissão + idempotência; nunca devolve
  segredo.
- `SensitiveDataRedactor` central + REDACT_PATHS ampliado; logger sem body.
- Startup validation (config) — falha em production sem/inválida chave, `fake`.
- Correção contratual mínima: `credentials.rotate` deixou de ser optimisticConcurrency
  (não há revision no request); OpenAPI/cliente regenerados.

## Guardrails cumpridos
Sem plaintext persistido; secret nunca em resposta/log/auditoria/idempotência/evidência/
job; master key fora do banco/Git; sem chave default em produção; fake proibido em
produção; nonce único; AAD com tenant+recurso; sem endpoint público de resolução; uma
única credencial ACTIVE; rotação/rollback atômicos; revogada não reativa. **Não**
implementados: SecureHttpClient, SSRF runtime, worker externo, webhooks funcionais,
frontend.

## Fora de escopo (próximas fases)
SecureHttpClient + SSRF (006.5); executor externo + worker (006.6); webhooks (006.7);
frontend (006.8). Envelope-DEK e re-encryption de master key: evolução futura.
