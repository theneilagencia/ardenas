# Threat model de prompt injection do agente (ARDEN-BE-007, auditoria)

> Todo conteúdo não confiável (input, documento, tool result, webhook) pode conter
> instruções maliciosas. Controles server-side, nunca confiança no modelo.

| Ameaça | Vetor | Impacto | Controle | Evidência | Teste (futuro) |
| --- | --- | --- | --- | --- | --- |
| Input malicioso | `ExecutionRun.input` | Modelo obedece instrução do atacante | Validação por `inputSchema`; conteúdo rotulado "não confiável" no prompt; instruções do sistema versionadas têm precedência | `inputHash`, promptHash | injeção em input não altera tool allowlist |
| Documento malicioso | fonte de contexto vinculada | Exfiltração/instrução | Fontes por allowlist + redação + rótulo não confiável; sem execução a partir de doc | contextSourceKinds | doc com "ignore policy" não executa tool proibida |
| Tool result malicioso | resposta de ferramenta externa | Cadeia de injeção | Tool result sanitizado (BE-006) + rotulado não confiável; gate revalida toda tool call | responseHash | tool result pedindo nova tool é revalidado |
| Webhook malicioso | trigger de entrada (BE-006.7) | Dispara execução com payload hostil | Assinatura HMAC + replay + input validado + mesmas defesas de input | payloadHash | payload hostil não escapa da allowlist |
| Exfiltrar secret | instrução para vazar credencial | Vazamento de segredo | Segredo NUNCA no prompt/contexto (cofre server-side); redação; output validado por schema | — | canário de segredo ausente de prompt/evidência |
| Ignorar policy | "desconsidere a autoridade" | Ação não autorizada | Autoridade/`ActionAuthorization` decididos SERVER-SIDE por tool call; o modelo não pode contornar | agent.tool_denied | instrução de ignorar policy → tool_denied |
| Tool não permitida | modelo chama alias inexistente/negado | Ação fora do escopo | `AgentToolCallGate` valida alias+action+autoridade | agent.tool_denied | alias desconhecido rejeitado |
| Troca de tenant | payload tenta mudar organizationId | Cross-tenant | Tenant vem SEMPRE da `ExecutionRun`/endpoint (BE-006/007); resolução `findFirst` por org | — | payload com outro org é ignorado |
| Data poisoning | contexto envenenado ao longo do tempo | Decisões ruins | Fontes versionadas + allowlist; sem memória global; avaliação determinística | evaluation events | — |
| Output enganoso | output plausível mas inválido | Sucesso falso | `outputSchema` + verificações determinísticas; output inválido nunca vira sucesso | outputHash | output fora do schema → FAILED |

## Princípios

- O conteúdo não confiável é sempre **dado**, nunca instrução — rotulado como tal no
  prompt e sem poder de alterar allowlist/autoridade/tenant.
- Toda decisão de segurança (tool allowlist, autoridade, tenant, segredo) é **server-side
  e determinística**, independente do que o modelo "decidiu".
- Segredo nunca entra no prompt/contexto/evidência (cofre; canário no teste futuro).
