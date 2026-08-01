# Prevenção de SSRF — ARDEN-BE-006

> Etapa de planejamento (ARDEN-BE-006.1). Define o threat model e o pipeline de
> validação; **não** implementa o cliente HTTP. Referência:
> [`ARDEN_BE_006_CONNECTORS_PLAN.md`](../implementation/ARDEN_BE_006_CONNECTORS_PLAN.md).

## 1. Princípio

Toda chamada externa passa por um **`SecureHttpClient`** que valida a requisição
contra uma **`ConnectorNetworkPolicy`** e resolve/classifica o IP de destino **antes**
de conectar, **fixando a conexão ao IP validado** e **revalidando a cada redirect**.
SSRF **não** é reduzido a regex — a decisão é sobre o IP final resolvido.

```ts
interface ConnectorNetworkPolicy {
  allowedProtocols: Array<'https'>;
  allowedHosts: string[];
  allowedPorts: number[];
  allowedPathPrefixes?: string[];
  allowRedirects: boolean;
  maximumRedirects: number;
  allowPrivateNetworks: boolean;   // produção: false
  allowLoopback: boolean;          // produção: false
  allowLinkLocal: boolean;         // produção: false
  maximumRequestBytes: number;
  maximumResponseBytes: number;
  timeoutMs: number;
}
```

**Defaults de produção:** `allowedProtocols=['https']`, `allowPrivateNetworks=false`,
`allowLoopback=false`, `allowLinkLocal=false`, `allowRedirects=false`. `http` só com
política de desenvolvimento explícita (nunca default).

## 2. Pipeline de validação (ordem obrigatória)

1. **Parse da URL** (`new URL`) — falha de parse → `SSRF_BLOCKED`.
2. **Protocolo** — só `https` (ou `http` sob política dev explícita). Esquemas
   `file:`, `ftp:`, `gopher:`, `data:`, etc. → `PROTOCOL_NOT_ALLOWED`.
3. **Userinfo embutido** — `url.username`/`url.password` presentes → `SSRF_BLOCKED`
   (URLs com credencial embutida são rejeitadas).
4. **Hostname** — extrai host; rejeita host vazio.
5. **Allowlist de host** — host ∈ `allowedHosts` (match exato/sufixo controlado). Fora
   → `HOST_NOT_ALLOWED`.
6. **Resolução DNS** — resolver **customizado** (`node:dns` `lookup` com `all: true`)
   resolve **todos** os A/AAAA. Sem registro → `SSRF_BLOCKED`.
7. **Normalização IPv4/IPv6** — normaliza cada IP; expande formas alternativas
   (decimal/octal/hex se a runtime aceitar) para a forma canônica; desembrulha
   **IPv4-mapped IPv6** (`::ffff:a.b.c.d`) para o IPv4 subjacente.
8. **Classificação do IP** — para **cada** IP resolvido, bloquear:
   loopback (`127.0.0.0/8`, `::1`), `0.0.0.0`/`::`, RFC1918
   (`10/8`, `172.16/12`, `192.168/16`), CGNAT (`100.64/10`), link-local
   (`169.254/16`, `fe80::/10`), **metadata service** (`169.254.169.254`,
   `fd00:ec2::254`), multicast, broadcast, ULA IPv6 (`fc00::/7`), reservados. Qualquer
   IP privado com `allowPrivateNetworks=false` → `PRIVATE_NETWORK_DENIED`.
9. **Porta** — porta ∈ `allowedPorts` (default `[443]`). Fora → `PROTOCOL_NOT_ALLOWED`.
10. **Conexão fixada ao IP validado** — o socket conecta ao **IP já validado** (via
    `lookup` fixo no agente/`options`), impedindo **DNS rebinding** entre a validação e
    a conexão.
11. **Redirect** — se `allowRedirects=false`, qualquer `3xx` → `REDIRECT_DENIED`. Se
    permitido, **reexecutar os passos 1–10 para o destino do redirect** (nova
    resolução + classificação + pinning), respeitando `maximumRedirects`.
12. **Limite de payload** — abortar se request > `maximumRequestBytes` ou resposta >
    `maximumResponseBytes` (`REQUEST_TOO_LARGE`/`RESPONSE_TOO_LARGE`). Sem streaming
    ilimitado.
13. **Timeout** — connect + total (e read se suportado); `EXTERNAL_TIMEOUT` ao estourar.
14. **Redaction** — URL/headers/erros sanitizados antes de log/evidência/auditoria.

## 3. Casos cobertos (todos devem BLOQUEAR salvo política dev explícita)

| Caso | Exemplo | Bloqueio |
|---|---|---|
| loopback | `http://127.0.0.1`, `http://localhost` | `PRIVATE_NETWORK_DENIED`/`SSRF_BLOCKED` |
| unspecified | `http://0.0.0.0`, `http://[::]` | `SSRF_BLOCKED` |
| IPv6 loopback | `http://[::1]` | `PRIVATE_NETWORK_DENIED` |
| metadata | `http://169.254.169.254` | `PRIVATE_NETWORK_DENIED` |
| RFC1918 | `http://10.0.0.1`, `http://172.16.0.1`, `http://192.168.0.1` | `PRIVATE_NETWORK_DENIED` |
| link-local | `http://169.254.0.1`, `http://[fe80::1]` | `PRIVATE_NETWORK_DENIED` |
| ULA IPv6 | `http://[fc00::1]` | `PRIVATE_NETWORK_DENIED` |
| IPv4-mapped IPv6 | `http://[::ffff:10.0.0.1]` | `PRIVATE_NETWORK_DENIED` |
| esquemas alternativos | `file:///etc/passwd`, `gopher://…`, `ftp://…`, `data:…` | `PROTOCOL_NOT_ALLOWED` |
| userinfo embutido | `https://user:pass@host/…` | `SSRF_BLOCKED` |
| representação numérica | `http://2130706433` (decimal de 127.0.0.1), octal/hex | `PRIVATE_NETWORK_DENIED` |
| hostname público → IP privado | `internal.example.com` → `10.x` | `PRIVATE_NETWORK_DENIED` |
| redirect → IP privado | `https://ok.example → http://169.254.169.254` | `REDIRECT_DENIED`/`PRIVATE_NETWORK_DENIED` |
| DNS rebinding | resolve público na validação, privado na conexão | mitigado por **pinning ao IP validado** |
| porta não permitida | `https://host:22` | `PROTOCOL_NOT_ALLOWED` |

## 4. Componentes necessários (implementação — Fase 5)

- **Custom DNS resolver** (`node:dns`) com `all: true` para classificar todos os IPs.
- **Conexão fixada ao IP validado** — `lookup` customizado no agente HTTP para que o
  socket use exatamente o IP classificado (anti-rebinding).
- **Agente HTTP customizado** (sobre `undici`/`fetch` nativo do Node 22) com redirects
  **desabilitados por padrão** e reprocessados manualmente sob política.
- **Classificador de IP** (`node:net` `isIP` + tabelas de faixas) — sem depender de
  regex sintático.

## 5. Interface do cliente seguro (planejada)

```ts
interface SecureHttpClient {
  execute(
    request: SecureHttpRequest,
    policy: ConnectorNetworkPolicy,
    context: ConnectorExecutionContext,
  ): Promise<SecureHttpResponse>;
}
```

Responsabilidades: timeout, abort, limite de request/response, redirects controlados,
validação DNS/IP, headers permitidos (bloquear `Host`, `Content-Length`, headers de
proxy/forwarding e sobrescrita de headers internos), redaction, `correlationId`,
user-agent identificável e `Idempotency-Key` quando aplicável. **Não** permite download
arbitrário de arquivos nesta issue.

## 6. Threat model de SSRF (resumo)

| Ameaça | Vetor | Controle preventivo | Controle detectivo | Teste |
|---|---|---|---|---|
| Acesso a metadata cloud | URL para `169.254.169.254` | classificação de IP bloqueia link-local/metadata | evento `ssrf.blocked` | teste SSRF metadata |
| Acesso a rede interna | hostname/redirect → IP privado | resolução + classificação + allowlist | `network_policy.denied` | teste DNS→privado, redirect→privado |
| DNS rebinding | resolução muda entre validação e conexão | **pinning** ao IP validado | — | teste rebinding |
| Exfiltração por redirect | 3xx para destino proibido | redirects off por padrão + revalidação | `ssrf.blocked` | teste redirect |
| Esquemas perigosos | `file:`/`gopher:` | allowlist de protocolo | `protocol_not_allowed` | teste esquemas |
| Bypass por notação numérica | `2130706433` | normalização antes da classificação | — | teste IPv4 decimal/octal/hex |
| IPv4-mapped IPv6 | `::ffff:10.0.0.1` | desembrulho antes da classificação | — | teste IPv6 mapeado |

Todos os testes usam **servidores locais controlados e fixtures** — **sem internet
real**.
