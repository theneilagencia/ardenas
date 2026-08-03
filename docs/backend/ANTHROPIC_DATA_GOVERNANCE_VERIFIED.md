# Governança de dados Anthropic — verificado (ARDEN-BE-008.1 · re-gate 008.2A)

> O que a Arden controla (lado nosso, verificável) vs. o que depende da Anthropic (docs sob
> 403 → **UNVERIFIED**). Provider `anthropic.direct` v`1`. Fonte de fatos:
> `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`. Nenhuma política é afirmada de memória.
>
> **Atualização 008.2A (2026-08-03):** o gate de verificação oficial bloqueante foi reexecutado
> (privacy/legal/trust/docs oficiais) e **todas as páginas de governança retornaram 403**
> (Cloudflare). `DATA_GOVERNANCE_STATUS = UNVERIFIED` em requisitos bloqueantes — confirmado, não
> promovido. Ver `../implementation/ARDEN_BE_008_EXTERNAL_VERIFICATION_GATE.md` para o log de
> tentativas. Nenhum item abaixo mudou de status.

## 1. O que É enviado ao provider (controle da Arden)

- **instruções de sistema** versionadas da `AgentVersion`;
- **mensagens/contexto redigidos** — contexto montado e sanitizado pelo runtime (BE-007),
  conteúdo não confiável rotulado como dado; do nosso lado guardamos só hashes;
- **definições de tools** — apenas alias, description e schema de input/output; nunca
  endpoint, executor ou credencial da ferramenta;
- **schema de saída** (structured output).

## 2. O que NUNCA é enviado

- segredos/credenciais, incluindo a própria API key Anthropic (resolvida server-side no
  cofre BE-006 e descartada antes de compor o request);
- conteúdo bruto do cofre / versões de credencial;
- internos de conexão (endpoints, headers de auth);
- dados de outros tenants (tenant sempre da `ExecutionRun`);
- trilha de auditoria / evidência completa.

Métricas e logs nunca recebem prompt/output (BE-007.6). Este controle técnico é o principal
mitigante do lado da Arden e independe do provider.

## 3. Políticas da Anthropic — TODAS UNVERIFIED (docs 403)

Nenhum item abaixo foi lido em fonte oficial machine-readable; nenhum é afirmado como
atendido. Exigem leitura direta antes do go-live comercial (008.2/008.3):

| Item | Status |
| --- | --- |
| Retenção de prompts/outputs | UNVERIFIED |
| Uso de dados de API para treino / opt-out padrão | UNVERIFIED |
| Zero-data-retention disponível | UNVERIFIED |
| Região(ões) de processamento | UNVERIFIED |
| Data residency / garantia por região | UNVERIFIED |
| DPA (Data Processing Addendum) | UNVERIFIED |
| Sub-processadores + notificação de mudança | UNVERIFIED |
| Logging de conteúdo pelo provider + duração | UNVERIFIED |
| Política/prazo de deleção sob demanda | UNVERIFIED |

## 4. Avisos de escopo

- **NÃO aplicar** a política de consumo do Claude.ai (produto consumer) à **API direta** —
  são termos distintos;
- **NÃO aplicar** a política do Amazon Bedrock (ou de qualquer revenda cloud) à API direta —
  o perímetro contratual é outro;
- as políticas acima valem para `api.anthropic.com` (base URL VERIFIED) e o plano
  efetivamente contratado pelo tenant.

## 5. Sinais VERIFIED com significado de política UNVERIFIED

Os tipos do SDK (v0.115.0) expõem, no `Usage`/request, os campos:

- `inference_geo` (`string|null`) — existência VERIFIED; **significado de residency/região é
  UNVERIFIED** (não implica garantia de data residency);
- `service_tier` (`standard|priority|batch|null`) — existência VERIFIED; **implicações de
  tratamento/retenção por tier são UNVERIFIED**.

Não interpretar esses campos como garantia de governança até confirmação por leitura direta.

## 6. Atualização 008.3 — provider executável, mas sem chamada externa

O 008.3 tornou o provider **executável em runtime**, porém **apenas atrás de feature gate de
teste/desenvolvimento** e **sem nenhuma chamada externa real** (transporte real gated na rede,
testes offline). Portanto, mesmo com o provider executável, **nenhuma requisição foi enviada à
Anthropic** e a governança de dados permanece **UNVERIFIED** — nenhum item do §3 mudou de status.
O provider persistido segue `DISABLED` e a produção continua bloqueada. A verificação oficial
manual de retenção/treinamento/residency e o smoke test real controlado ficam para o 008.4. Ver
`ANTHROPIC_RUNTIME_FEATURE_GATES.md` e `../implementation/ARDEN_BE_008_ANTHROPIC_RUNTIME_REPORT.md`.
