# Anthropic — integração do SDK oficial (ARDEN-BE-008.3)

> O SDK oficial `@anthropic-ai/sdk` foi instalado nesta fase, **pinado exatamente** e
> importado **apenas** na fronteira de transporte. Nenhuma chamada real foi feita nesta fase
> (execução atrás de feature gate). Fonte de fatos do SDK: `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`.

## 1. Pin exato (VERIFIED)

| Item | Valor |
| --- | --- |
| Pacote | `@anthropic-ai/sdk` |
| Versão | `0.115.0` — **exata**, sem `^`, `~` ou `latest` |
| Integrity | `sha512-BJrFI…` (fixada no lockfile) |
| Escopo de instalação | **apenas** o workspace `@arden/api` (`apps/api/package.json`) |
| Runtime | Node 20 LTS+ |

O pin é intencionalmente rígido: reprodutibilidade de build e ausência de upgrade silencioso
sobrepõem-se à conveniência de faixas semver. A versão está declarada como dependência direta
somente em `apps/api`; nenhum outro workspace conhece o SDK.

## 2. Guarda de dependência (ARCHITECTURAL_DECISION)

A guarda de dependência do 007.3 foi atualizada para o provider comercial:

- **apenas** `@anthropic-ai/sdk@0.115.0` é permitido; qualquer outra versão falha o gate;
- qualquer **outro SDK comercial** (OpenAI, Google, Cohere, Mistral, Bedrock, etc.) falha;
- o SDK só pode aparecer no workspace `@arden/api` — presença em qualquer outro workspace falha.

A guarda roda como teste de arquitetura e no CI: uma mudança de versão ou um SDK novo **não**
passa despercebida por review.

## 3. Política de atualização (ARCHITECTURAL_DECISION)

Upgrade do SDK é uma **decisão deliberada**, nunca automática:

- sem faixa semver → `npm install`/dependabot não sobem a versão sozinhos;
- subir a versão exige: alterar o pin + a integrity, reexecutar a verificação oficial
  (defs `.d.ts`, base URL, StopReason, Usage, classes de erro) e reavaliar os mappers;
- a matriz de erros, o mapa de request/response e o mapa de usage são **verificados contra a
  versão pinada**; um upgrade sem re-verificação é PROIBIDO.

## 4. NUNCA

- usar faixa (`^`/`~`) ou `latest` para o SDK comercial;
- instalar o SDK fora de `@arden/api`;
- importar `@anthropic-ai/sdk` fora da fronteira de transporte (ver
  `ANTHROPIC_TRANSPORT_ARCHITECTURE.md`);
- subir a versão sem reexecutar a verificação oficial e atualizar integrity + mappers.

## 5. Estado após 008.3

SDK instalado e pinado: **SIM**. Chamada real ao provider: **NÃO** (gate desligado). O SDK
existe no processo mas o transporte real só toca a rede sob feature gate explícito — ver
`ANTHROPIC_RUNTIME_FEATURE_GATES.md`.
