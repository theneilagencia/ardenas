# Decisão do primeiro provider comercial de modelos (ARDEN-BE-008 · auditoria)

Auditoria arquitetural do menor milestone seguro para integrar o PRIMEIRO provider comercial
de modelos ao Arden.AS. Documento de decisão — nenhum código, SDK ou preço aqui. Fatos
externos (SDKs, preços, regiões, DPA) marcados como **REQUER VERIFICAÇÃO EXTERNA**.

## 1. Recomendação

**Provider inicial: Anthropic Claude, via API direta da Anthropic (Alternativa A).**
Confiança: alta na arquitetura; média nos parâmetros externos (a confirmar antes de 008.3).

A decisão NÃO é automática por afinidade — resulta da comparação arquitetural abaixo, sob os
critérios do produto: **um provider real, reaproveitar a abstração existente, menor superfície
operacional, sem gateway externo, sem multi-provider prematuro.**

## 2. Por que Claude é o mais coerente com o produto (fatos do projeto)

- O runtime já é **provider-neutral**: `ModelProvider.generate(ModelGenerationRequest) →
  ModelGenerationResult` + `InMemoryModelProviderRegistry.register()`. Integrar um provider é
  implementar UMA interface e registrar por `key@version` — sem tocar runtime/worker/contrato.
- O contrato canônico já favorece o modelo de interação da Anthropic: **structured output por
  tool/schema**, **tool use** (o modelo só PROPÕE `ModelToolCall`; servidor valida/executa),
  papéis de mensagem separados e `systemInstructions` isolado — 1:1 com o formato Messages.
- `agentUsage` já contempla `cachedInputTokens`/`cachedOutputTokens`, alinhado a **prompt
  caching** (fase posterior, não no primeiro slice).
- Alinhamento organizacional: a TheNeil já opera intensamente sobre o ecossistema Anthropic no
  próprio desenvolvimento — reduz risco de operação/observabilidade/segurança conhecidos.
- SDK TypeScript oficial disponível (**REQUER VERIFICAÇÃO EXTERNA** de nome/versão/manutenção).

## 3. Comparação arquitetural (objetiva)

| Critério | A · Anthropic API direta | B · Claude via AWS Bedrock | C · OpenAI API | D · Google Vertex AI |
| --- | --- | --- | --- | --- |
| Acoplamento | baixo (1 SDK, 1 host) | médio (AWS SDK + IAM + região) | baixo | médio (GCP auth + projeto/região) |
| Credencial | API key → vault BE-006 | chaves AWS/role → modelo IAM distinto | API key → vault | service account/OAuth → modelo distinto |
| Superfície operacional | mínima | maior (conta AWS, região, quotas) | mínima | maior (projeto GCP, região) |
| Structured output | tool/schema nativo | igual (Claude) via runtime Bedrock | JSON schema/function | schema/function |
| Tool calling | nativo | igual (Claude) | nativo | nativo |
| Prompt caching | sim (fase futura) | sim (via Bedrock) | parcial | parcial |
| Regiões / residency | REQUER VERIFICAÇÃO EXTERNA | forte (regiões AWS) | REQUER VERIFICAÇÃO EXTERNA | forte (regiões GCP) |
| Enterprise controls | REQUER VERIFICAÇÃO EXTERNA | via AWS org | REQUER VERIFICAÇÃO EXTERNA | via GCP org |
| Preço | REQUER VERIFICAÇÃO EXTERNA | REQUER VERIFICAÇÃO EXTERNA | REQUER VERIFICAÇÃO EXTERNA | REQUER VERIFICAÇÃO EXTERNA |
| Erros/observabilidade | direto, previsível | camada AWS adicional | direto | camada GCP adicional |
| Aderência ao contrato atual | máxima (mesmo modelo de tool/schema) | alta | alta (mapeável) | alta (mapeável) |
| Multi-provider prematuro? | não | não | não | não |

**Leitura:** A e B entregam o mesmo modelo (Claude). B agrega superfície operacional (conta/
região/IAM AWS) e um segundo modelo de credencial — valioso para clientes AWS-first e data
residency, mas contraria "menor superfície operacional" no PRIMEIRO slice. C e D introduzem
outro fornecedor/again outro modelo de credencial sem ganho arquitetural sobre A nesta fase.

## 4. Alternativas de integração (avaliação)

- **A — Anthropic API direta** (`Arden → Anthropic SDK → Claude`): **recomendada**. Menor
  acoplamento e superfície; credencial simples (API key → vault BE-006); aderência máxima.
- **B — Claude via Bedrock** (`Arden → AWS SDK → Bedrock Runtime → Claude`): forte candidato de
  **fase posterior** para clientes AWS e data residency por região. Registrável como segundo
  `providerKey` sem reescrever o adapter canônico.
- **C — abstração multi-provider desde o início**: **rejeitada agora** (multi-provider
  prematuro). A abstração já existe no ponto certo (`ModelProvider`/registry); não criar
  camada de roteamento antes de ter ≥2 providers reais.
- **D — gateway externo de modelos**: **rejeitada** (superfície operacional e de segurança
  adicional, dependência de terceiro, contraria "sem gateway externo").

## 5. Como evitar acoplamento ao fornecedor

- Nenhum tipo do SDK escapa do domínio: o adapter traduz para/de `ModelGenerationRequest`/
  `ModelGenerationResult` (ver `COMMERCIAL_PROVIDER_ADAPTER_ARCHITECTURE.md`).
- Provider registrado por `key@version`; um segundo provider (Bedrock/OpenAI/Vertex) entra por
  novo adapter + `register()`, sem alterar runtime, contexto, tool calling, avaliação ou frontend.
- Catálogo de modelos e rate cards versionados em código por provider — sem `modelId` livre.

## 6. Pontos que exigem verificação externa (antes de 008.3)

Nome/versão/manutenção do SDK TypeScript oficial; IDs de modelo atuais e limites de tokens;
preços por modelo (input/output/cached); regiões e data residency; política de retenção e de
treinamento sobre dados; disponibilidade de DPA e lista de sub-processadores; enterprise
controls; limites de rate/quotas. Nenhum desses foi assumido de memória neste documento.

## 7. Decisão

Prosseguir o ARDEN-BE-008 com **Anthropic Claude via API direta**, reutilizando o vault e as
conexões do BE-006 e a interface `ModelProvider` existente. Bedrock/OpenAI/Vertex ficam como
providers adicionais de fases posteriores, habilitáveis pela mesma abstração. Ver o plano em
`../implementation/ARDEN_BE_008_IMPLEMENTATION_PLAN.md`.

> **Atualização 008.1** — a recomendação acima foi convertida em decisão técnica verificável
> (`ANTHROPIC_PROVIDER_DECISION_VERIFIED.md`, status **CONDITIONALLY_CONFIRMED**), com os fatos de
> SDK/transporte/erros/modelos lidos de fonte oficial (`ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`).
> Preços e governança de dados continuam PENDING_DIRECT/UNVERIFIED — a confirmar por leitura
> direta antes de 008.2. O provider foi materializado apenas como **contrato** (`CONTRACT_ONLY` /
> `DISABLED`), sem SDK, sem chamada real e sem execução.
