# Ciclo de vida da ModelConfiguration Anthropic (ARDEN-BE-008.2)

> `ModelConfiguration` (tenant-scoped) reusa a tabela do BE-007. Pode ser **preparada
> como `DRAFT`** mesmo com o provider `DISABLED`, mas **não pode ser ativada** — logo
> nenhum agente pode ser publicado usando-a.

## 1. Preparação permitida (DRAFT)

Criar (`DRAFT`) uma config Anthropic é permitido: a criação aceita qualquer provider
**não `DEPRECATED`**. Um `DRAFT` não executa nada — é apenas intenção configurada.

## 2. Ativação bloqueada

A transição `DRAFT → ACTIVE` exige provider com `status = ACTIVE`. Como
`anthropic.direct` está `DISABLED`:

```
DRAFT → ACTIVE  ⇒  MODEL_PROVIDER_DISABLED (HTTP 409)
```

Em produção, além de `ACTIVE`, exige `productionAllowed = true`. O Anthropic falha em
ambos os critérios nesta fase.

## 3. Consequência: publicação bloqueada

Como a config **nunca chega a `ACTIVE`**, um `AgentVersion` **não pode ser publicado**
usando-a — a publicação exige uma model config `ACTIVE`. A cadeia inteira permanece
não executável por construção.

## 4. Amarração de tenant

`credentialConnectionId` deve pertencer ao **mesmo tenant**; caso contrário → 404 (sem
vazar existência de conexão de outra org).

## 5. Status e concorrência

```
DRAFT → ACTIVE → SUSPENDED   (REVOKED é terminal)
```

Enum: `DRAFT` / `ACTIVE` / `SUSPENDED` / `REVOKED`. Concorrência otimista por
`revision`; create com `Idempotency-Key`.

## 6. NUNCA

- ativar uma config apontando para provider `DISABLED`;
- publicar agente com config não `ACTIVE`;
- aceitar `credentialConnectionId` de outro tenant.
