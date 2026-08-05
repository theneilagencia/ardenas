# Decisão do cofre de credenciais — ARDEN-BE-006

> Etapa de planejamento (ARDEN-BE-006.1). Define a estratégia; **não** implementa
> criptografia. Referência do milestone:
> [`ARDEN_BE_006_CONNECTORS_PLAN.md`](../implementation/ARDEN_BE_006_CONNECTORS_PLAN.md).

## 1. Contexto e requisitos

Credenciais de sistemas externos (bearer tokens, API keys, senhas básicas, segredos
HMAC de webhook) precisam ser:

- criptografadas em repouso (zero plaintext persistido);
- resolvidas **somente no servidor** (o worker resolve; o frontend nunca injeta);
- nunca retornadas por endpoint, nunca em log/auditoria/evidência;
- versionadas, rotacionáveis e revogáveis, com histórico preservado;
- portáveis para um provedor gerenciado no futuro, sem reescrever o domínio.

## 2. Alternativas comparadas

| Alternativa | Segurança | Complexidade | Portabilidade | Rotação | Custo operacional |
|---|---|---|---|---|---|
| **AES-256-GCM + PostgreSQL (app)** | Alta (AEAD; master key fora do banco) | Baixa | Alta (atrás de interface) | App controla versões | Baixo (sem serviço externo) |
| AWS Secrets Manager | Alta | Média | Baixa (lock-in AWS) | Nativa | $ por segredo/rotação |
| Google Secret Manager | Alta | Média | Baixa (lock-in GCP) | Nativa | $ por versão/acesso |
| HashiCorp Vault | Muito alta | Alta (operar Vault/HA/unseal) | Média | Nativa (transit/rotation) | Alto (infra dedicada) |
| Supabase Vault | Média/Alta | Baixa | Média (acoplado ao Supabase) | Limitada | Baixo |

## 3. Decisão do 1º marco

**Envelope encryption na aplicação com AES-256-GCM e ciphertext no PostgreSQL**,
atrás da interface `SecretVault`. Motivos: máxima portabilidade (a interface permite
trocar por um provedor gerenciado sem tocar no domínio), sem nova infra operacional,
alinhado às convenções do repositório (chave por env validada no boot, como
`AUTH_PROVIDER`), e AEAD moderno nativo em `node:crypto` (sem crypto artesanal).

### Interface

```ts
interface SecretVault {
  storeSecret(input: StoreSecretInput): Promise<StoredSecretReference>;
  resolveSecret(reference: SecretReference): Promise<ResolvedSecret>;
  rotateSecret(input: RotateSecretInput): Promise<StoredSecretReference>;
  revokeSecret(reference: SecretReference): Promise<void>;
}
```

- **Provider inicial:** `app-aes-gcm` (envelope encryption na aplicação).
- **Provider `fake`:** apenas testes (determinístico, **proibido em produção** pela
  mesma checagem de `superRefine` usada por `AUTH_PROVIDER=fake`).
- **Algoritmo:** AES-256-GCM (autenticado; tag de integridade; nonce de 96 bits único
  por operação, de `crypto.randomBytes`).
- **Master key:** `CONNECTOR_MASTER_KEY` (32 bytes; base64/hex). **Nunca** no banco,
  **nunca** no Git. Em produção, **boot falha** se ausente/curta.
- **Envelope (opcional no 1º marco):** DEK por credencial cifrada pela master key
  (KEK); o modelo já tem `encryptedDataKey` para habilitar isso sem migração futura.
- **`keyVersion`:** `CONNECTOR_KEY_VERSION` (default `v1`) — permite rotação de master
  key: novas versões cifram com a chave corrente; versões antigas decifram pela chave
  daquela `keyVersion`, mantida em mapa de chaves (fora do banco).
- **AAD (Associated Data):** `organizationId | connectionId | credentialVersionId |
  keyVersion` — vincula o ciphertext ao tenant e à versão. Decifrar com AAD de outro
  tenant **falha a autenticação** (defesa contra troca de ciphertext entre tenants).
- **Fingerprint:** `sha256(keyVersion || plaintext)` truncado (ex.: 12 hex) — permite
  exibir/auditar “qual credencial” sem revelar o valor. Nunca é o valor nem reversível.

### Variáveis de ambiente (a adicionar em `apps/api/src/config/env.schema.ts`)

| Var | Default (dev/test) | Produção |
|---|---|---|
| `CONNECTOR_VAULT_PROVIDER` | `app-aes-gcm` (`fake` em test) | `app-aes-gcm` (`fake` proibido) |
| `CONNECTOR_MASTER_KEY` | dev default explícito **apenas** fora de produção | **obrigatória** (boot falha sem ela) |
| `CONNECTOR_KEY_VERSION` | `v1` | `v1`+ |

Regra `superRefine`: em `production`, `CONNECTOR_MASTER_KEY` não vazia e com tamanho
suficiente (≥ 32 bytes decodificados) e `CONNECTOR_VAULT_PROVIDER != 'fake'`.

## 4. Ciclo de vida

- **Criação:** recebe segredo (TLS) → valida contra `credentialSchema` → cifra
  imediatamente → descarta plaintext após uso → persiste ciphertext + metadados →
  gera fingerprint → **nunca** retorna o segredo → auditoria sem valor sensível.
- **Leitura (API):** somente metadados (status, fingerprint parcial, versão, datas) —
  jamais ciphertext ou plaintext.
- **Rotação:** valida permissão → cria nova versão (`versionNumber+1`) → ativa
  transacionalmente → supersede a anterior → mantém histórico → invalida cache →
  auditoria. Índice parcial único garante ≤1 `ACTIVE` por conexão.
- **Revogação:** impede novas execuções/resoluções, preserva histórico, sem
  restauração automática, auditoria.
- **Comportamento em produção:** sem master key → não sobe. **Comportamento em
  testes:** provider `fake` ou master key de teste fixa; nunca gera segredo default de
  produção.
- **Limpeza de plaintext em memória:** minimizar escopo/tempo de vida do buffer de
  plaintext; sobrescrever `Buffer` após uso quando praticável (dentro dos limites do
  GC do V8 — o runtime não garante zeragem imediata, então o controle real é
  **não-persistência** e **tempo de vida curto**).

## 5. Cache de segredos (opcional — aceitável não implementar no 1º marco)

Se houver: só em memória do processo, TTL curto, chave **tenant-scoped**, limpeza
após rotação/revogação, sem persistência local, sem log, sem compartilhamento entre
tenants. **Não** introduzir Redis para secrets.

## Threat model de credenciais

| Ameaça | Vetor | Impacto | Controle preventivo | Controle detectivo | Teste |
|---|---|---|---|---|---|
| Plaintext no banco | escrita sem cifrar | vazamento total | cifra antes de persistir; coluna só ciphertext | teste canário varre banco | canário: `encrypted_secret` ≠ plaintext |
| Plaintext em logs | log de request/objeto | vazamento | `SensitiveDataRedactor`; logger sem body de credencial | grep canário nos logs capturados | canário nos logs |
| Plaintext em erros | erro serializado | vazamento | `redactError`; erros públicos mínimos | inspeção do corpo de erro | teste de erro sanitizado |
| Plaintext em auditoria | `metadata` com segredo | vazamento | `AuditRecorder` redige; nunca passa segredo | varredura de `audit_events` | canário na auditoria |
| Plaintext em evidência | evidência de chamada | vazamento | `sanitizeContent`; evidência só host/hash/fingerprint | varredura de `evidence_records` | canário na evidência |
| Plaintext no frontend | store/IndexedDB/URL | vazamento no cliente | segredo só entrada; nunca retornado; sem persistência | teste de store/IndexedDB | teste FE: segredo ausente |
| Plaintext no job | payload da fila | vazamento durável | job só `executionRunId`; resolução no worker | inspeção de `execution_jobs.payload` | teste: payload sem segredo |
| Master key no Git | commit acidental | comprometimento | chave só por env; `.env` fora do Git; gate de secret hygiene | job “Secret hygiene” do CI | CI secret scan |
| Master key ausente | deploy sem chave | falha aberta? | boot **falha** em produção sem chave | startup validation | teste: prod sem chave lança |
| Nonce reutilizado | gerador fraco/reuso | quebra do GCM | `randomBytes(12)` por operação; nunca reusar | teste de unicidade de nonce | 2 cifrados → nonces distintos |
| Troca de ciphertext entre tenants | usar ciphertext de outro tenant | acesso cruzado | AAD = tenant+conn+version → decifra falha | falha de autenticação AEAD | teste cross-tenant decrypt falha |
| Rotação concorrente | duas rotações simultâneas | duas ACTIVE / perda | índice parcial único + transação + revision | contagem de ACTIVE | teste rotação concorrente |
| Credencial revogada em retry | retry usa versão antiga | uso indevido | resolução revalida status a cada tentativa | evento `credential.resolution_denied` | teste revogação-durante-retry |
| Cache cross-tenant | chave de cache sem tenant | vazamento cruzado | cache tenant-scoped + TTL curto (se houver) | — | teste de isolamento de cache |
| Dumps | backup/dump do banco | ciphertext exposto | só ciphertext no banco; master key fora | — | inspeção de dump = ciphertext |
| Snapshots de teste | fixture com segredo | vazamento em repo | canário único por teste; sem segredo em fixtures | grep canário em snapshots | canário em snapshots |
| Tracing | span/atributo com segredo | vazamento em telemetria | não anexar segredo a spans; redaction | revisão de atributos | teste de observabilidade |
| Serialização acidental | `JSON.stringify` de objeto de credencial | vazamento | tipos com apenas metadados na fronteira HTTP; segredo em Buffer isolado | teste de serialização | canário em `JSON.stringify(dto)` |

## 6. Conclusão

Provider `app-aes-gcm` (AES-256-GCM + envelope + AAD por tenant/versão), master key
por env obrigatória em produção, atrás de `SecretVault`. Portável, sem infra nova,
sem crypto artesanal, sem plaintext persistido. Implementação na **Fase 3** do plano.
