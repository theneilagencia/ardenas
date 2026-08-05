# Publicação imutável de versão de agente (ARDEN-BE-007.2)

Comando idempotente e transacional (`PublishAgentVersionService`). Passos:

1. carrega agente tenant-scoped (não REVOKED);
2. carrega versão tenant-scoped; exige DRAFT;
3. valida `revision` esperada;
4. valida `modelConfiguration` do mesmo tenant e **ACTIVE**;
5. valida provider **ACTIVE** e permitido no ambiente (produção bloqueia
   `productionAllowed=false` → `MODEL_PROVIDER_DISABLED`);
6. valida conteúdo (objective não vazio, systemInstructions ≤ 20000, cinco políticas
   coerentes contra os contratos, schemas objeto) — **sem** afirmar resolução de tools
   (a versão é reutilizável; só coerência interna);
7. calcula `contentHash` determinístico (SHA-256 canônico sobre o conteúdo funcional);
8. transiciona DRAFT→PUBLISHED guardado por `revision` **E** `status=DRAFT` — em corrida,
   só uma publicação vence; a perdedora recebe `VERSION_CONFLICT` (ou replay idempotente);
9. atualiza `currentPublishedVersionId` do agente e DRAFT→ACTIVE na primeira publicação;
10. audita `agent_version.published`.

Após publicar, nenhum campo funcional muda: PATCH em versão publicada → `ALREADY_PUBLISHED`;
`contentHash` e `revision` preservados; nenhuma auditoria de update. Nova versão exige
comando explícito (novo `versionNumber`, DRAFT, id novo; pode copiar via `basedOnVersionId`).

## Retirada
`PUBLISHED|DRAFT → RETIRED` (terminal, idempotente). Se era a versão publicada atual,
**limpa** `currentPublishedVersionId` — não seleciona versão antiga automaticamente
(decisão explícita). O agente permanece ACTIVE, porém sem versão publicada até nova publicação.
