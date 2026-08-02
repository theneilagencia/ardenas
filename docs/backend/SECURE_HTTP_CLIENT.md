# Cliente HTTP seguro — ARDEN-BE-006.5

> Implementação do `SecureHttpClient` planejado em
> [`SSRF_PREVENTION.md`](./SSRF_PREVENTION.md). Nesta fase o cliente **não** é ligado
> ao worker/executor (006.6) nem a webhooks (006.7); é uma unidade isolada e testada
> com servidores **locais** (nunca a internet).

## 1. Componentes

| Arquivo | Papel |
| --- | --- |
| `http/ip-classifier.ts` | Classifica um IP (v4/v6/IPv4-mapped) em `public` ou categoria bloqueada. Decisão pelo **IP final**, não por regex de host. |
| `http/ssrf-guard.ts` | `validateTarget(url, policy)` — pipeline de validação + resolução DNS + **pinning** ao IP validado. |
| `http/secure-http.types.ts` | `SecureHttpPolicy` (política efetiva de runtime), tipos de request/response e o token `SECURE_HTTP_CLIENT`. |
| `http/secure-http-client.ts` | `NodeSecureHttpClient` — dispatch com timeout, limites de payload e redirects controlados. |

## 2. Pipeline de uma chamada

1. `validateTarget` valida **protocolo → userinfo → host allowlist → porta → path
   prefix → DNS (todos os A/AAAA) → classificação de cada IP → pinning ao 1º IP**.
2. Verifica o limite de **corpo da requisição** (`maximumRequestBytes`).
3. `raw()` conecta com um `lookup` customizado que retorna **somente o IP fixado**
   (anti-DNS-rebinding), mantendo o hostname para SNI/`Host`.
4. Aplica `timeout`, remove **headers proibidos** do chamador
   (`host`, `content-length`, `connection`, `x-forwarded-*`, `forwarded`, …), injeta
   `user-agent` identificável e `x-correlation-id`.
5. Faz *streaming* respeitando `maximumResponseBytes` (limite **declarado** via
   `content-length` **e** acumulado por chunk).
6. Em `3xx` com `Location`: se `allowRedirects` e dentro de `maximumRedirects`,
   **revalida o novo destino do zero** (todo o pipeline, incluindo IP) e segue;
   `307/308` preservam método/corpo, os demais viram `GET` sem corpo.

## 3. Erros (mensagens públicas genéricas)

`PROTOCOL_NOT_ALLOWED`, `HOST_NOT_ALLOWED`, `PRIVATE_NETWORK_DENIED`, `SSRF_BLOCKED`,
`REDIRECT_DENIED`, `REQUEST_TOO_LARGE`, `RESPONSE_TOO_LARGE`, `EXTERNAL_TIMEOUT`,
`EXTERNAL_PROVIDER_ERROR`. Nenhuma mensagem revela IP resolvido, host interno ou
detalhe de rede — a telemetria fica no log estruturado, não na resposta.

## 4. Anti-DNS-rebinding

O socket conecta **apenas** ao IP validado no passo de classificação: um segundo
lookup malicioso (round-robin/TTL curto) não muda o destino porque o `lookup` do
`http.request` é substituído por uma função que devolve o IP fixado. Como **todos**
os IPs resolvidos são classificados, um registro com um IP público e outro privado é
rejeitado por inteiro.

## 5. Garantias de teste

Unidade: `ip-classifier.spec.ts` (44) e `ssrf-guard.spec.ts` (26). Integração:
`secure-http-client.integration.spec.ts` (13) com servidor local — sucesso, timeout,
limites de request/response (declarado e por streaming), redirect bloqueado/permitido,
revalidação de IP no redirect, headers proibidos removidos e host allowlist. Nenhum
teste depende da internet.
