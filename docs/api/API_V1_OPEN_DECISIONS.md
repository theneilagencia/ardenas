# Arden.AS — API v1 · Decisões Pendentes (ARDEN-FE-003)

> Registra **somente** decisões que **não podem** ser comprovadas pelo código/docs
> existentes. Nada aqui é preenchido com suposição — onde não há decisão de produto,
> usamos **NÃO DEFINIDO**. Estas decisões **não bloqueiam** o contrato v1 do primeiro
> fluxo; refinam pontos deixados em aberto.

| ID | Tema | Decisão necessária | Opções | Impacto | Recomendação |
|---|---|---|---|---|---|
| D-001 | Autenticação | Formato do token/sessão do `Authorization` | Bearer JWT · sessão via cookie · opaco introspectado | Integração backend | NÃO DEFINIDO (contrato assume "Bearer ou equivalente", sem amarrar fornecedor) |
| D-002 | `Operation.status` | Consolidar o enum de status da operação | `draft\|active\|paused\|archived` (v1) · manter `scheduled/running/awaiting_approval` | Modelo + UI | v1 adota `draft\|active\|paused\|archived`; execução (awaiting_approval) fica fora do v1 |
| D-003 | Autoridade — direção | `blocked` como nível 5 (mais restritivo) ou flag separada | nível 5 · `blocked` como booleano à parte | Semântica do gradiente | Manter mapeamento por `AUTHORITY_ORDER` (blocked=5); revisar com produto |
| D-004 | Autoridade — taxonomia | Conjunto canônico de `AuthorityAction.key` | enum fechado · texto livre (hoje) · catálogo por integração | Validação de publicação | NÃO DEFINIDO (hoje é texto livre na matriz); manter `key` livre até decisão |
| D-005 | Definição rica da operação | Campos `inputs/outputs/rules/exceptionPolicy` e os 11 passos não-funcionais do wizard | incluir no v1 · adiar | Escopo do contrato | Adiar (fora do primeiro marco — GAP-12); só campos existentes/necessários entram no v1 |
| D-006 | Comparação de versões | Granularidade do diff (`differences[]`) | por campo raso · por caminho profundo (JSON Pointer) | UX de comparação | Começar por caminho (`path`) raso; refinar conforme necessidade |
| D-007 | Concorrência via `If-Match` | Reportar falha como 409 `VERSION_CONFLICT` ou 412 Precondition Failed | 409 (corpo com revisões) · 412 (protocolo) | Cliente HTTP | Preferir **409 `VERSION_CONFLICT`** com `details`; 412 opcional |
| D-008 | Idempotência | Janela de retenção e escopo da `Idempotency-Key` | 24h · 48h · por (org+usuário+endpoint) | Backend | NÃO DEFINIDO; recomendação inicial: por (org+usuário+endpoint), janela ≥ 24h |
| D-009 | Auditoria | Formato de imutabilidade (hash/encadeamento) | log append-only simples · hash encadeado (GAP-05) | Confiabilidade | Recomenda-se append-only imutável; formato de hash NÃO DEFINIDO |
| D-010 | Filtro `authorityLevel` na listagem | Filtrar operações por nível do gradiente da versão publicada | por versão publicada · por qualquer versão | Semântica da query | NÃO DEFINIDO; filtro declarado no contrato, semântica a confirmar |

> As decisões acima **não** foram inventadas: cada uma marca um ponto onde o
> código/documentos atuais não determinam o comportamento. O contrato v1 permanece
> suficiente para o primeiro fluxo sem depender delas.
