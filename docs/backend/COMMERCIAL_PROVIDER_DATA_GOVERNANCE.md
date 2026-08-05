# Governança de dados do provider comercial (ARDEN-BE-008, auditoria)

> Doc de AUDITORIA (sem código). Ao usar um provider comercial, dados do tenant saem do
> perímetro da Arden e vão para um terceiro. Este doc fixa **o que sai** e **o que nunca
> sai**, e lista os pontos de governança contratual que dependem do provider escolhido
> (candidato líder: Anthropic Claude). Todo fato específico do provider está marcado
> **REQUER VERIFICAÇÃO EXTERNA** — não é afirmado de memória.

## O que É enviado ao provider

- **instruções de sistema** versionadas da `AgentVersion` (não confiáveis nunca têm
  precedência sobre elas);
- **mensagens/contexto redigidos** — o contexto montado pelo runtime, já sanitizado e com
  conteúdo não confiável rotulado como dado (BE-007); sem prompt/contexto bruto persistido
  do nosso lado (guardamos só hashes);
- **definições de tools** — apenas alias, description e schema de input/output; **nunca** o
  endpoint, a classe de executor ou a credencial da ferramenta;
- **schema de saída** (structured output).

## O que NUNCA é enviado ao provider

- segredos/credenciais (API keys de tools, tokens) — resolvidos server-side no cofre
  AES-256-GCM (BE-006.4), descartados após montar o request, **nunca** no prompt;
- conteúdo bruto do cofre / versões de credencial;
- internos de conexão (endpoints, headers de auth, configuração sensível do conector);
- dados de outros tenants — o tenant vem sempre da linha da `ExecutionRun`, resolução
  `findFirst` por `organizationId` (BE-006/007);
- trilha de auditoria / evidência completa — o provider recebe só o necessário para gerar,
  não o histórico de execução.

> A própria **API key do provider** também não circula no prompt: vive no cofre por tenant
> e é resolvida server-side imediatamente antes da chamada (ver
> `COMMERCIAL_PROVIDER_CREDENTIAL_MODEL.md`).

## Pontos de governança contratual

Cada item abaixo depende do provider e do plano contratado. Nenhum é afirmado aqui.

| Item | O que verificar | Status |
| --- | --- | --- |
| Retenção | por quanto tempo o provider retém prompts/outputs; retenção zero disponível? | REQUER VERIFICAÇÃO EXTERNA |
| Logs do provider | o provider loga conteúdo de requests/responses; por quanto tempo | REQUER VERIFICAÇÃO EXTERNA |
| Treino sobre os dados | os dados de API são usados para treinar modelos; opt-out por padrão? | REQUER VERIFICAÇÃO EXTERNA |
| Região | em que região(ões) o processamento ocorre | REQUER VERIFICAÇÃO EXTERNA |
| Data residency | há garantia de residência/localização de dados por região | REQUER VERIFICAÇÃO EXTERNA |
| DPA | existe Data Processing Addendum; termos de processador/subprocessador | REQUER VERIFICAÇÃO EXTERNA |
| Sub-processadores | lista de sub-processadores do provider e notificação de mudança | REQUER VERIFICAÇÃO EXTERNA |
| Política de deleção | prazo/mecanismo de deleção de dados sob demanda | REQUER VERIFICAÇÃO EXTERNA |
| Content opt-out | é possível desativar coleta/uso de conteúdo (abuse/monitoring)? | REQUER VERIFICAÇÃO EXTERNA |

## Classificação de dados

O conteúdo enviado ao provider deve ser tratado, por padrão, como **dados do cliente
possivelmente sensíveis** (contexto de negócio da org). A minimização já aplicada pelo
runtime (redação, hashes em vez de conteúdo, sem segredo, rótulo de não confiável) é o
principal controle técnico do lado da Arden; os controles contratuais acima são o
complemento do lado do provider e **precisam ser confirmados antes do go-live comercial**.

## Observabilidade (lado Arden)

Métricas `arden_agent_*` são in-memory, com labels de **baixa cardinalidade apenas**
(status/provider/model/governance/evaluation/error_code); ids de org/run/user ficam só no
log estruturado. **Prompts e outputs nunca entram em métrica nem em log** (BE-007.6). O uso
do provider comercial não muda isso.

## REQUER VERIFICAÇÃO EXTERNA (na implementação)
- todos os itens da tabela de governança (retenção, treino, região, residency, DPA,
  sub-processadores, deleção, content opt-out) confirmados na documentação/contrato oficial
  do provider e no plano efetivamente contratado;
- cabeçalhos/flags do SDK que ativam retenção zero ou desativam uso de conteúdo, se houver.
