<!-- Milestone: ARDEN-PRD-001.1 -->
# ARDEN-PRD-001.1 — Evidência de testes

## Testes unit novos (`apps/api/src/security/`) — 30 verdes
`platform-secret-source.spec.ts` (10): catálogo fechado; adapter de ambiente; obrigatório
ausente/vazio fail-closed; dev/test usa env; **produção + environment sem aprovação FALHA**;
produção + aprovação aceita; **external sem adapter FALHA**; external com adapter; erro
sanitizado.

`connector-master-key-lifecycle.spec.ts` (20): keyring com uma primária; primária+decrypt;
sem primária falha; tamanho/encoding/vazio inválidos falham; versão desconhecida fail-closed;
preflight OK / MISSING_VERSIONS; **rotação — ciphertext K1 legível após promover K2**; novo
ciphertext usa K2; eligibility bloqueada por referências / liberada com zero+backup+drill+
approval; **backup cifrado sem plaintext/wrapping-key**; restore com chave certa; **wrapping
key errada falha**; **checksum adulterado falha**; **ciphertext adulterado falha na auth tag**;
verifyRestore sanitizado; **DRILL offline completo** (K1→canário→backup→restore→decrypt→K2→
reencrypt→eligibility).

## Canários (sintéticos) — ausentes de artefato/relatório
`ARDEN_PRD001_MASTER_KEY_CANARY_*`, `..._CONNECTOR_SECRET_CANARY_*`, `..._BACKUP_WRAPPING_CANARY_*`
não aparecem no artefato de backup nem nos relatórios sanitizados (asserções no drill).

## Gates executados (esta fase)
typecheck:api ✓ · lint (security) ✓ · vitest security 30/30 ✓ · (gate matrix completo — ver
STATUS). Nenhum teste falhando nos módulos novos.

## STILL_OPEN (não executado nesta fase)
Testes de INTEGRAÇÃO com PostgreSQL (reencryption/concorrência/idempotência/startup-block/
API+worker readiness), teste crítico de perda de chave em nível de app, gates de CI dedicados.
