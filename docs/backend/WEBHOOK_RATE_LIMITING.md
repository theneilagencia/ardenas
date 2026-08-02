# Webhook de entrada — rate limiting (ARDEN-BE-006.7)

Rate limit **básico em processo** (sem infraestrutura externa nova), janela deslizante
de 60s, ~120 req/janela por `tokenHash + IP`. O IP vem de `req.ip` (socket), **não** de
`X-Forwarded-For` arbitrário. Excesso → `RATE_LIMITED` (429), resposta pública mínima
que não revela a existência do endpoint. Chaves expiram por varredura; limite de chaves
para conter memória. Reforço distribuído (Redis) é decisão futura — documentado como
limitação.
