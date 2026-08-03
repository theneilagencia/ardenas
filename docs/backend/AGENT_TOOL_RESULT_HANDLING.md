# Agent tool result handling (ARDEN-BE-007.5)

O resultado do `ExternalToolExecutor` é mapeado para `{status, output?, errorCode?,
evidenceReferenceIds}`. SUCCEEDED → redige (campos sensíveis), classifica `UNTRUSTED_EXTERNAL`,
inspeciona injeção (`PromptInjectionGuard`) e ISOLA como mensagem `TOOL` entre
`<untrusted_tool_result>`; nunca system message. FAILED → erro sanitizado limitado ao modelo.
DENIED → resultado tipado sem detalhe de segurança. UNKNOWN → aplica `unknownResultBehavior`
(nunca vira sucesso; não repete automaticamente). Sem secret/headers/URL/raw body no
resultado devolvido ao modelo.
