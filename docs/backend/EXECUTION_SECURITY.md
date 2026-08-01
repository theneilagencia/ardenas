# Segurança da Execução (ARDEN-BE-005 §46)

- **Tenant em toda query**: execuções/etapas/eventos/evidências/jobs/autorizações são
  escopados por organização; acesso cruzado → 404 (anti-enumeração).
- **Autorização revalidada** no servidor na criação; consumo de uso único transacional;
  `actionKey` e `payloadHash` conferidos contra a autorização.
- **Sem código arbitrário**: executores vêm de um catálogo fechado; nunca `eval`,
  `new Function` nem import dinâmico por input; `actionKey` de etapa restrito ao registry.
- **Worker não confia no payload**: carrega a execução por id e usa o tenant da própria
  linha; nunca aceita `organizationId` vindo do payload sem validação.
- **Evidências/eventos append-only**; sem endpoint de edição/exclusão.
- Nenhum token em logs; nenhum segredo em evidência; payload sanitizado.
- Sem conectores externos, sem agentes, sem IA nesta fase.
