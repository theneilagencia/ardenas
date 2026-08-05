# Mapeamento declarativo de I/O de ferramenta — ARDEN-BE-006.6

> Estende (minimamente) `TOOL_DATA_MAPPING_V1` — o documento de domínio ainda não
> especificava a gramática. Aqui está a DSL FECHADA implementada. **Dados, nunca
> código.** Não há JavaScript, `eval`, templates, env vars, acesso ao cofre, outro
> tenant, wildcards, loops ou funções.

## Gramática

Um **mapa** é um objeto cujas chaves são campos de destino e cujos valores são **nós**.
Um nó é EXATAMENTE uma operação:

| Nó | Efeito |
| --- | --- |
| `{ "path": "input.a.b" }` | Seleciona por caminho pontilhado. |
| `{ "rename": "input.a" }` | Idem `path` (o "rename" é a chave-alvo diferente). |
| `{ "const": <literal> }` | Constante NÃO sensível (primitivo/array/objeto de primitivos). |
| `{ "compose": { k: <nó>, … } }` | Objeto aninhado recursivo. |

- **Raízes permitidas**: entrada → `input`, `steps` (outputs de etapas anteriores
  permitidas pelo motor); saída → `output`. Qualquer outra raiz é rejeitada.
- Segmentos de caminho: `[A-Za-z0-9_-]+`. Sem `..`, `$`, wildcards.
- Caminho ausente ⇒ a chave de destino é **omitida**.
- **Mapa vazio ⇒ identidade** (passa a origem adiante).
- Violação ⇒ `TOOL_INPUT_INVALID` / `TOOL_OUTPUT_INVALID` (nunca sucesso).

## Validação

Após o mapeamento de entrada, o input é validado contra o `inputSchema` da
ferramenta (JSON Schema mínimo: type/required/properties/additionalProperties/enum/
items). Antes do mapeamento de saída, o output cru é validado contra o `outputSchema`.
Output que não corresponde ⇒ `TOOL_OUTPUT_INVALID` — **jamais tratado como sucesso**.

## Exemplo

```json
// inputMapping
{ "method": { "const": "POST" }, "path": { "const": "/v1/echo" },
  "body": { "compose": { "id": { "path": "input.user.id" } } } }
// outputMapping
{ "echoed": { "path": "output.body.echoed" } }
```
