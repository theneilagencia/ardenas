# Editor de versão de agente (ARDEN-BE-007.7)

`AgentVersionEditorPage.tsx` — editor **secionado** de `AgentVersionDefinition`. Rascunho
editável em memória; versão publicada é imutável. Nenhuma execução de modelo/prompt aqui.

## Rascunho vs publicada (somente leitura)

- `DRAFT` → editável: `saveDraft` (POST cria versão / PATCH atualiza rascunho) e `publish`.
- `PUBLISHED`/`RETIRED` → `readOnly = true`: todos os campos `disabled`, **sem PATCH**. O
  banner mostra "versão publicada é somente leitura" e o CTA é **"criar nova versão"**
  (`/agents/{id}/versions/new`). Publicada com `agent.publish` pode ser aposentada (retire).

## Seções

`overview` (objetivo, configuração de modelo), `instructions` (system instructions),
`io` (input/output JSON Schema), `context` (política de contexto), `execution` (limites de
runtime: turnos, tool calls, tokens, duração, structured output), `tools` (política de
ferramentas por classe de risco), `evaluation` (checks determinísticos exigidos), `cost`
(teto estimado + limites), `review` (resumo + `changeSummary` para publicar).

## Concorrência otimista (expectedRevision)

Toda escrita (update/publish/retire) envia `expectedRevision: version.revision` lido do
recurso carregado. Divergência → `CONFLICT` (a UI mostra "conflito, recarregue"). O editor
nunca infere transições — usa os comandos do backend.

## contentHash selado no servidor

O hash de conteúdo da versão é **selado pelo backend na publicação** — o cliente não o
calcula nem o envia. A seção `overview` apenas exibe uma nota informativa
(`contentHashNote`).

## Sem segredo em instruções

As `systemInstructions` e os schemas **jamais** contêm segredo/credencial (aviso explícito
`noSecret` na seção de instruções). Credenciais de modelo vivem no cofre (BE-006.4),
referenciadas por configuração de modelo — nunca no texto da versão. LLM-as-judge fica
desabilitado (não suportado como critério). Ferramentas de classe crítica exibem aviso; a
execução real ocorre só via etapa `agent.execute` da operação.

## Custo (teto)

O teto `maximumEstimatedCostMinor` é editado em unidade humana e convertido para **unidade
menor inteira** por `toMinorUnits` (sem ponto flutuante monetário). Vazio → `null`
("custo não disponível"), nunca `0,00`. Isto é um limite configurado, não custo observado.
