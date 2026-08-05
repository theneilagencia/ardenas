<!-- Milestone: ARDEN-BE-008.7 -->
# ARDEN-BE-008 — Portões de produção DEFERIDOS

Este milestone entrega a integração comercial Anthropic **em estado não produtivo,
verificado offline**. Os itens abaixo permanecem **DEFERIDOS** e **bloqueiam produção**
até serem cumpridos com fonte oficial e autorização explícita. Nenhum documento deste
milestone deve suavizar estes estados.

| Portão | Estado | O que falta para liberar |
| --- | --- | --- |
| Live smoke (chamada real autenticada) | **NOT EXECUTED** | Credencial oficial de teste + autorização do operador + ambiente não produtivo allowlisted + limite baixo de tokens + payload sintético |
| Live structured output (verificação real) | **NOT EXECUTED** | Idem live smoke |
| Live tool calling (contra Anthropic) | **NOT EXECUTED** | Idem + política de tool ao vivo aprovada |
| Live usage/custo real | **NOT EXECUTED** | Chamada real + rate card oficial verificado |
| Pricing oficial | **UNVERIFIED** | Preços diretos de fonte oficial da Anthropic (docs retornaram 403 nas fases anteriores) |
| Retention | **UNVERIFIED** | Documento oficial de retenção |
| Training | **UNVERIFIED** | Documento oficial de uso para treino |
| Zero Data Retention | **UNVERIFIED** | Confirmação oficial de ZDR |
| Data residency | **UNVERIFIED** | Política oficial de residência |
| DPA | **UNVERIFIED** | DPA assinado |
| Sub-processors | **UNVERIFIED** | Lista oficial de subprocessadores |
| `productionAllowed` | **false** | Todos os acima + decisão de produto |
| Provider persistido | **DISABLED** | Idem |
| Produção | **BLOQUEADA** | Idem |

## Riscos declarados
- **Vida de segredo em JS é best-effort:** sem zeroização determinística de memória.
- **Comportamento da Anthropic não verificado ao vivo:** mapeamentos comprovados apenas
  contra `FakeAnthropicTransport`.
- **Circuit breaker não produtivo em memória:** o bloqueio de produção é reforçado em
  runtime, não é um controle de infraestrutura externa.
- **Governança oficial pendente:** todos os estados de governança permanecem UNVERIFIED.

## Próximo passo correto
Não ampliar providers. O próximo milestone é **ARDEN-PRD-001 — Production Readiness**
(ambientes, deploy, observabilidade externa, backups, incident response, segurança
operacional, performance, carga, recuperação, piloto controlado).
