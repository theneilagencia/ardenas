# Revisão de dependências — ARDEN-BE-006

> Etapa de planejamento (ARDEN-BE-006.1). Avalia dependências; **nenhuma é instalada
> nesta etapa**. Referência:
> [`ARDEN_BE_006_CONNECTORS_PLAN.md`](../implementation/ARDEN_BE_006_CONNECTORS_PLAN.md).

## 1. Princípios

- Preferir `node:crypto` quando suficiente (sem crypto artesanal).
- Evitar cliente HTTP duplicado — o backend não usa `axios`/`got` hoje (nenhuma
  ocorrência em `apps/api`); Node 22 traz `fetch`/`undici` nativos.
- Evitar dependência obscura ou sem manutenção.
- Evitar pacote que faça redirects automáticos sem hooks de validação (incompatível
  com o pipeline SSRF, que revalida cada redirect).

## 2. Avaliação

| Dependência | Finalidade | Alternativas | Manutenção | Licença | Risco | Decisão |
|---|---|---|---|---|---|---|
| `node:crypto` (nativo) | AES-256-GCM, HMAC-SHA256, `randomBytes`, `timingSafeEqual`, sha256 | libsodium, `@peculiar/webcrypto` | Node core | — | Baixo | **Usar** (AEAD nativo; sem terceiros) |
| `fetch`/`undici` (nativo Node 22) | cliente HTTP com agente customizável, redirects manuais | `axios`, `got`, `node-fetch` | Node core | — | Baixo | **Usar** (`undici.Agent`/`fetch` com `redirect: 'manual'`) |
| `node:dns` (nativo) | resolução DNS (`lookup`/`resolve` com `all`) | `dns-lookup`, resolvers de terceiros | Node core | — | Baixo | **Usar** (resolver + pinning ao IP) |
| `node:net` (nativo) | `isIP`, classificação de IPv4/IPv6 | `ip`, `ipaddr.js`, `is-ip` | Node core | — | Baixo | **Usar** como base; avaliar helper só se necessário |
| `ipaddr.js` (candidato) | parsing/classificação robusta de faixas (RFC1918, IPv4-mapped, ULA) | tabelas próprias sobre `node:net` | Ativa, ampla adoção | Apache-2.0 wrapper/ISC | Baixo | **Adiar/avaliar na Fase 5** — preferir tabelas próprias; só adotar se cobertura de casos (mapeado/decimal/ULA) exigir |
| `zod` (já no projeto) | schemas de config/credencial/tool I/O/network policy/webhook | JSON Schema (`ajv`) | Já usada | MIT | Baixo | **Reutilizar** (evita `ajv` para não duplicar validação) |
| `ajv`/JSON Schema | validação documental | `zod` | — | — | Médio (duplicação) | **Não adotar** (Zod é a SSOT executável) |
| lib de canonicalização de webhook | assinar/verificar bytes brutos | preservar raw body + `crypto.createHmac` | — | — | Médio | **Não adotar** — usar raw body + HMAC nativo (não reserializar JSON) |

## 3. Conclusão

O 1º marco é implementável **sem novas dependências**: `node:crypto` (cofre AES-GCM,
HMAC de webhook, fingerprint), `fetch`/`undici` (cliente HTTP seguro com redirects
manuais), `node:dns` + `node:net` (resolução e classificação de IP com pinning), e
`zod` (schemas). A única candidata realista é `ipaddr.js`, **adiada** para a Fase 5 e
adotada apenas se as tabelas próprias de classificação não cobrirem com folga os casos
do [SSRF_PREVENTION.md](./SSRF_PREVENTION.md) (IPv4-mapped, notação decimal/octal/hex,
ULA). Qualquer adoção será registrada aqui antes da instalação, com finalidade,
manutenção, licença e risco.

**Nenhuma dependência foi instalada nesta etapa.**
