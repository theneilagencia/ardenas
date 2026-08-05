# ARDEN-BE-008.2A — gate de verificação oficial bloqueante

Gate executado em **2026-08-03** (UTC). Objetivo: verificar, **exclusivamente por fontes
oficiais**, os fatos que faltaram no 008.1 — preços comerciais da API e governança de dados —
para decidir se rate cards comerciais podem ser persistidos e se o provider pode deixar de ser
`DISABLED`. Nenhuma requisição à API da Anthropic; nenhuma key real; nenhum bypass de bloqueio.

## 1. Resultado do gate

| Dimensão | Status | Consequência |
| --- | --- | --- |
| **PRICING_STATUS** | **UNVERIFIED** | rate cards comerciais **não** persistidos (catálogo vazio) |
| **DATA_GOVERNANCE_STATUS** | **UNVERIFIED** (requisitos bloqueantes) | provider permanece `DISABLED`; `productionAllowed=false` |

**Terminação: Resultado B (§7) — verificação insuficiente.** Conforme o próprio gate permite,
é lícito prosseguir para o 008.2B **apenas com a infraestrutura administrativa**, desde que o
provider e os modelos permaneçam `DISABLED`, `ModelConfiguration` não possa ser ativada, nenhuma
chamada real seja possível e todos os gaps fiquem explícitos (este documento). O 008.2B **não**
converte ausência de verificação em aceitação.

## 2. Fontes tentadas (log de tentativas)

Todas as tentativas usaram HTTPS direto às URLs oficiais (o proxy do ambiente roteia
`anthropic.com` diretamente). Método: fetch legítimo, sem spoofing de user-agent, sem proxy de
terceiros, sem scraping agressivo, sem cópias não oficiais.

| # | URL oficial | UTC | Status | Bloqueio | Alternativa oficial |
| --- | --- | --- | --- | --- | --- |
| 1 | `https://docs.anthropic.com/en/docs/about-claude/pricing` | 2026-08-03T13:50Z | 403 Forbidden | Cloudflare anti-bot | tentadas #4, #6 |
| 2 | `https://www.anthropic.com/pricing` | 2026-08-03T13:50Z | 403 Forbidden | Cloudflare anti-bot | — |
| 3 | `https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-data` | 2026-08-03T13:50Z | 403 Forbidden | Cloudflare anti-bot | tentada #5 |
| 4 | `https://docs.anthropic.com/en/docs/about-claude/models/overview` | 2026-08-03T13:51Z | 403 Forbidden | Cloudflare anti-bot | SDK types (008.1) |
| 5 | `https://www.anthropic.com/legal/commercial-terms` | 2026-08-03T13:51Z | 403 Forbidden | Cloudflare anti-bot | — |
| 6 | `https://trust.anthropic.com/` | 2026-08-03T13:51Z | 403 Forbidden | Cloudflare anti-bot | — |
| 7 | `https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/README.md` | 2026-08-03T13:50Z | **200 OK** | — | lido (ver §3) |

## 3. O que foi legitimamente obtido

- **GitHub oficial (SDK README, 200 OK)** — confirmado que **não** contém preço nem política de
  dados; cobre apenas instalação/uso/runtime/licença. Portanto não serve como fonte de pricing
  ou governança (apenas corrobora fatos técnicos já verificados no 008.1).
- **Registry npm + tipos `.d.ts`** (008.1, VERIFIED) — fatos técnicos do SDK/transporte/erros/
  modelos permanecem válidos e congelados nos contratos. **Não** contêm preço/governança.

## 4. Evidências mínimas NÃO obtidas

Preço (§5): nenhuma fonte oficial legível com model ID + custo input + custo output + moeda +
unidade + cached input + data + vigência. → **UNVERIFIED**. Não inferir por família; não
preencher por aproximação; catálogo de rate cards permanece **vazio**.

Governança (§6), cada item classificado:

| Item | Status |
| --- | --- |
| API comercial vs Claude.ai (distinção) | UNVERIFIED |
| Retenção padrão da API | UNVERIFIED |
| Treinamento com dados da API | UNVERIFIED |
| Zero data retention | UNVERIFIED |
| Requisitos p/ controles especiais | UNVERIFIED |
| Regiões / data residency | UNVERIFIED |
| DPA | UNVERIFIED |
| Sub-processadores | UNVERIFIED |
| Abuse monitoring | UNVERIFIED |
| Exclusão de dados | UNVERIFIED |
| Termos empresariais aplicáveis | UNVERIFIED |

Nenhum item foi convertido de `CONDITIONALLY_AVAILABLE` para `VERIFIED`. Nenhum requisito de
governança é afirmado como atendido.

## 5. Efeito no milestone

- Rate cards comerciais Anthropic: **não persistir** (nenhum `0 USD` como desconhecido; ausência
  de rate card é o estado correto).
- Provider `anthropic.direct@1`: permanece `DISABLED` / `productionAllowed=false` /
  `CONTRACT_ONLY`. **Não** registrar no runtime.
- Modelos: permanecem `DISABLED`.
- `ModelConfiguration` Anthropic: pode ser **preparada** (DRAFT) mas **não ativada**
  (`MODEL_PROVIDER_DISABLED`).
- Reabertura do gate: só com leitura direta legítima das páginas oficiais de pricing e de
  governança (hoje 403). Até lá, decisão permanece **CONDITIONALLY_CONFIRMED**.

## 6. Classificação (separação exigida §49)

- **VERIFIED**: fatos técnicos do SDK/transporte/erros/modelos (008.1, congelados).
- **CONDITIONALLY_AVAILABLE**: nenhum item promovido a esta classe nesta rodada.
- **UNVERIFIED**: todos os preços e todos os itens de governança acima.
- **ARCHITECTURAL_DECISION**: Anthropic via API direta; credencial tenant-managed no vault
  BE-006; base URL travada em OFFICIAL.
- **DEFERRED**: rate cards comerciais, ativação do provider/modelos, `productionAllowed`,
  execução — todos para 008.3+ após verificação direta.
