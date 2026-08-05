# Startup validation do cofre — ARDEN-BE-006.4

`loadConfig` (`env.schema.ts`, `superRefine`) FALHA o boot quando, em production:
- provider ausente/ inválido (enum) ou `fake`;
- `CONNECTOR_MASTER_KEY` ausente;
- master key malformada / ≠ 32 bytes;
- keyring JSON inválido.

Fora de produção: `fake` é permitido; master key de fixture (32 bytes) é usada nos
testes (`test/setup-env.ts`). O factory do provider lança se `fake` for selecionado em
production. Coberto por `vault-config.spec.ts` (startup) — sem depender de subir a app.
