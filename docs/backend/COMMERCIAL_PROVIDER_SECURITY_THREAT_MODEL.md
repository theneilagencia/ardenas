# Threat model de segurança do provider comercial (ARDEN-BE-008, auditoria)

> Doc de AUDITORIA (sem código). Introduzir um provider comercial abre superfície nova:
> rede externa, credencial de alto valor, custo real por chamada e um terceiro processando
> dados do tenant. "Controle atual" reaproveita BE-004 (autoridade), BE-006 (cofre/SSRF) e
> BE-007 (redação/allowlist/UNKNOWN). "Controle necessário" é o **delta** para o comercial.
> Fatos específicos do provider: REQUER VERIFICAÇÃO EXTERNA.

| Ameaça | Vetor | Impacto | Controle atual | Controle necessário | Teste |
| --- | --- | --- | --- | --- | --- |
| Vazamento de API key | key em log/prompt/resposta | Comprometimento da conta do provider | Cofre AES-256-GCM por tenant (BE-006.4), resolução server-side, key nunca no prompt/log/evidência | Canário de key do provider ausente de prompt/log/evidência; key só via `CredentialResolver` | canário `ARDEN_BE008_PROVIDER_KEY_*` ausente de toda saída |
| Resolução cross-tenant de credencial | run de um tenant resolve key de outro | Uso indevido/cobrança cruzada | Tenant vem da linha da `ExecutionRun`; `findFirst` por `organizationId` (BE-006/007) | Resolução da key do provider ligada ao mesmo tenant do run, sem exceção | run do tenant A não resolve `ModelConfiguration`/key do tenant B → 404 |
| Logging de request pelo provider | provider retém/loga o prompt | Exposição de dados do cliente | Redação/hashes do lado Arden; sem prompt bruto persistido (BE-007) | Confirmar retenção/logs contratuais; flag de retenção zero se disponível | ver `COMMERCIAL_PROVIDER_DATA_GOVERNANCE.md` (REQUER VERIFICAÇÃO EXTERNA) |
| Logging de response pelo provider | provider retém/loga o output | Exposição de saída do cliente | Output nunca em métrica/log Arden (BE-007.6) | Confirmar retenção de output no provider | REQUER VERIFICAÇÃO EXTERNA |
| Exfiltração de prompt | conteúdo não confiável tenta vazar system prompt | Vazamento de instruções | Não confiável rotulado como dado; instruções versionadas têm precedência (BE-007) | Sem novo delta técnico; reforço de rótulo no mapeador de request | injeção pedindo o system prompt não altera saída de segurança |
| Exfiltração de contexto | injeção manda o modelo despejar o contexto para uma tool | Vazamento de dados do tenant | `AgentToolCallGate` revalida toda tool call; allowlist server-side (BE-007) | Allowlist de tools inalterada pelo provider; nenhuma tool de rede livre | tool call para exfiltrar contexto → `agent.tool_denied` |
| Envenenamento de tool schema | description/schema hostil influencia o modelo | Chamada indevida de tool | Só alias+action da operação; gate revalida; schema validado (BE-006/007) | Definição de tool enviada = alias/description/schema apenas; sem endpoint/credencial | schema hostil não amplia allowlist |
| Request replay | reenvio da mesma chamada | Efeito/custo duplicado | Checkpoints do BE-005; `ActionAuthorization` de uso único; replays idempotentes | Idempotency-key estável por etapa se o provider suportar | replay não duplica efeito aprovado |
| Retry duplicado | motor repete chamada com efeito não-idempotente | Geração/efeito duplicado, custo dobrado | Resultado incerto → UNKNOWN, sem retry automático (BE-006.6/007.3) | Não re-tentar chamada com orquestração de tool pendente sem prova de idempotência | timeout pós-envio incerto → UNKNOWN, sem 2ª chamada |
| Substituição de modelo | modelo trocado por um não homologado | Custo/comportamento/segurança inesperados | `ModelConfiguration` fixa provider/model (BE-007.1) | Allowlist de modelos (catálogo fechado); modelId fora → rejeição | modelId não catalogado → `MODEL_PROVIDER_NOT_AVAILABLE` |
| `modelId` arbitrário | modelId vindo do request/step | Fuga da allowlist | modelId fixado na `ModelConfiguration`, nunca do input (BE-007.1) | Validação contra allowlist do provider comercial | modelId do payload de execução é ignorado |
| Endpoint override | input tenta apontar para outro host | SSRF / exfiltração para host hostil | `SecureHttpClient` + endpoint fixo por definição; URL absoluta rejeitada (BE-006) | Endpoint do provider **fixado na definição do conector**, não configurável por request | request com host alternativo é rejeitado |
| Abuso de proxy | usar o provider como proxy para host interno | SSRF interno | SSRF: classificação de IP final, pinning, https-only em produção (BE-006) | Endpoint pinado; sem redirect para rede privada | chamada a IP privado/loopback bloqueada |
| Bypass de região | chamada roteada para região não homologada | Violação de residência de dados | — | Endpoint/região pinados por definição; sem override por request | REQUER VERIFICAÇÃO EXTERNA (região oficial); teste: endpoint fora da lista → rejeitado |
| Exaustão de rate limit | volume alto esgota a cota | Indisponibilidade para o tenant | 429 → `MODEL_RATE_LIMITED` com backoff (BE-007.3) | Teto de chamadas por execução/tenant (`AgentExecutionPolicy`) e respeito a `Retry-After` | acima do teto → limite recusado antes da chamada |
| Denial of wallet | atacante induz muitas chamadas caras | Prejuízo financeiro | Limites de chamadas/orçamento/timeout do `AgentExecutionPolicy` (BE-007) | Teto de custo/wallet por tenant que **barra antes** de chamar | execução acima do teto de custo → `AGENT_LIMIT_EXCEEDED` sem chamar o provider |
| Abuso de custo | loop de tool/turnos infla o consumo | Custo descontrolado | Máx. de passos/turnos e orçamento por execução (BE-007) | Ceilings de custo por tenant + alertas de consumo | loop de turnos para no limite de passos |
| Resposta gigante | provider/injeção devolve payload enorme | Memória/custo/DoS | Limites de payload do cliente HTTP (BE-006) | **Cap de tamanho de resposta** do provider (bytes/tokens) | resposta acima do cap → FAILED, sem carregar tudo |
| Tool call malformada | modelo propõe tool call inválida | Erro/possível ação indevida | Gate valida alias+action+autoridade+input schema (BE-007) | Sem delta; tool call inválida devolvida como erro ao modelo | alias desconhecido/action negada → `agent.tool_denied` |
| Injeção indireta de prompt | doc/tool result hostil manda ignorar policy | Ação fora de escopo | Sanitização + rótulo não confiável; autoridade server-side (BE-004/007) | Sem delta técnico do provider; validação inalterada | "ignore a policy" → tool_denied |
| Indisponibilidade do provider | outage/5xx/timeout | Execuções travadas | 5xx/timeout → FAILED/UNKNOWN classificados; execução preservada (BE-007.3) | Timeout via `AbortSignal`; sem retry inseguro; alerta de outage | outage simulado → FAILED/UNKNOWN, execução preservada, sem duplicação |

## Notas

- Nenhum controle atual depende de o modelo "decidir" corretamente: allowlist, autoridade,
  tenant e segredo são **server-side e determinísticos** (BE-004/006/007).
- O maior delta do comercial é **financeiro e de rede**: teto de custo/wallet por tenant,
  cap de resposta, endpoint/região/modelo pinados e credencial no cofre por tenant.

## REQUER VERIFICAÇÃO EXTERNA (na implementação)
- endpoints e regiões oficiais do provider (para pinning);
- suporte a idempotency-key e a limites de resposta/streaming do SDK;
- políticas de retenção/log do provider (ligadas às ameaças de logging acima).
