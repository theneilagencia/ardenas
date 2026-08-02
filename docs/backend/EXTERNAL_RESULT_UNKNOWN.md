# Resultado externo incerto — ARDEN-BE-006.6

> Quando uma operação **não idempotente** (ex.: `POST` com `idempotencyMode=NONE`)
> sofre timeout/queda de conexão **após o possível envio**, o efeito é **incerto**: o
> destino PODE ter processado. Nunca inventamos sucesso nem falha segura automática.

## Regra

`classifyError` mapeia esses casos para **`EXTERNAL_RESULT_UNKNOWN`** com
`retryable = false`. Consequências:

- a etapa é finalizada como **FAILED com `errorCode = EXTERNAL_RESULT_UNKNOWN`** —
  **não** vira sucesso;
- **nenhuma repetição automática** (a idempotência não garante segurança);
- a evidência registra a **incerteza** (`resultClassification: 'UNKNOWN'`, host/path/
  hashes, sem segredo);
- auditoria `external_tool.execution_unknown`;
- a execução é **preservada** (eventos, tentativas e evidências persistidos) para
  intervenção posterior.

## Por que não compensar automaticamente

Ferramentas externas **não têm compensador** (`compensate` ausente). Um efeito
incerto NÃO é desfeito automaticamente — desfazer assumiria que o efeito ocorreu (ou
que não ocorreu), e nenhuma das duas é conhecida. A etapa incerta permanece FAILED e
sinalizada; etapas internas anteriores seguem a saga normal do BE-005.

## Limitação conhecida

O motor do BE-005 não possui um estado terminal dedicado de "aguardando intervenção".
O mapeamento fiel disponível SEM migration é FAILED + `EXTERNAL_RESULT_UNKNOWN` +
evidência/auditoria explícitas. Um estado dedicado é candidato a fase futura.
