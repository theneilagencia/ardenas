# Política de rede do conector — ARDEN-BE-006.5

> Como o contrato `ConnectorNetworkPolicy` (https-only, restritivo) vira a política
> **efetiva de runtime** `SecureHttpPolicy` usada pelo
> [cliente HTTP seguro](./SECURE_HTTP_CLIENT.md).

## 1. Dois níveis

- **Contrato** (`src/contracts/connectors/network-policy.schema.ts`):
  `allowedProtocols: Array<'https'>`. É o que o catálogo/organização declaram e o que
  a API expõe. Defaults de produção (`PRODUCTION_NETWORK_POLICY_DEFAULTS`) são
  restritivos: só `https`, sem redirects, sem redes privadas/loopback/link-local.
- **Runtime** (`http/secure-http.types.ts::SecureHttpPolicy`): **superset** que aceita
  `allowedProtocols: Array<'http' | 'https'>`. `http` **só** é habilitado por política
  de desenvolvimento explícita (ex.: testes com servidor local), **nunca** por default
  de produção. `fromConnectorNetworkPolicy()` deriva a política de runtime do contrato.

## 2. Campos e efeito

| Campo | Efeito na validação |
| --- | --- |
| `allowedProtocols` | Esquema da URL deve estar na lista. `file/ftp/gopher/data/...` sempre bloqueados. |
| `allowedHosts` | Allowlist de host (suporta `*.dominio` e, só em dev, `*` total). |
| `allowedPorts` | Porta efetiva (explícita ou default do esquema) deve constar. |
| `allowedPathPrefixes?` | Se presente, o path deve começar por um dos prefixos. |
| `allowRedirects` / `maximumRedirects` | Controla e limita saltos; cada salto é **revalidado**. |
| `allowPrivateNetworks` / `allowLoopback` / `allowLinkLocal` | Liberam categorias de IP **apenas** em dev. `metadata/multicast/broadcast/reserved` **nunca** liberam. |
| `maximumRequestBytes` / `maximumResponseBytes` | Limites de payload (request antes de enviar; response declarado e por streaming). |
| `timeoutMs` | Timeout de socket → `EXTERNAL_TIMEOUT`. |

## 3. Regra de ouro

A allowlist de host é conveniência; a **segurança real** vem da classificação do **IP
final resolvido**. Um host permitido que resolve para `169.254.169.254`, `127.0.0.1`
ou `10.0.0.0/8` é **rejeitado** — em produção sempre, e em dev só passa se a flag
correspondente estiver explicitamente ligada (exceto metadata/multicast/etc., que
nunca passam).
