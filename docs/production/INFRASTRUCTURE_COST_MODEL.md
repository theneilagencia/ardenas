<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Modelo de custo de infraestrutura

> **AVISO DE HONESTIDADE.** Todos os preços de nuvem/PaaS dependem de região, plano,
> tamanho de instância, retenção e volume, e só são confiáveis via **calculadora oficial +
> cotação**. Nesta fase permanecem `REQUIRES_SALES_CONFIRMATION` (S5 do
> `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`). **Nenhum número monetário é inventado.** Este
> documento modela **estrutura de custo** e **direcionadores**, não valores.

## Método

- Modelamos **quais recursos** cada cenário consome (direcionadores de custo), não quanto
  custam.
- Para obter valores reais em 001.2B: preencher cada célula com a **calculadora oficial**
  do provedor escolhido, registrando moeda, região, data, premissas, exclusões, fonte e
  incerteza. Um esqueleto de planilha está em "Ficha de cotação" abaixo.

## Cenários

### Cenário 1 — dev/staging (custo mínimo)
- Compute: 1 API pequena (scale-to-zero se disponível), 1 worker pequeno, jobs de CI.
- Banco: menor instância gerenciada **ou** Neon com autosuspend; **sem HA** obrigatória.
- Backups: retenção curta (≥ 7 dias).
- Secret manager: nº baixo de secrets/acessos.
- Egress/observabilidade: volume baixo.

### Cenário 2 — piloto (produção limitada)
- Compute: API com ≥ 1 réplica sempre ativa + worker; scale conforme carga.
- Banco: instância com **HA** + **PITR** habilitados (gates).
- Backups: retenção ≥ 7 dias; PITR ativo.
- Secret manager: acessos por runtime; auditoria.
- Egress: allowlist; observabilidade externa (Sentry + Grafana Cloud, planos iniciais).

### Cenário 3 — produção (comercial)
- Compute: múltiplas réplicas de API/worker; autoscaling; front-door.
- Banco: HA + PITR; retenção ≥ 30 dias; possível réplica de leitura; cópia inter-região
  **se** o jurídico permitir (S8).
- Secret manager: rotação; auditoria; alertas.
- Observabilidade: retenção maior; alerting SEV-1/2.

## Matriz de direcionadores (a preencher com valores oficiais em 001.2B)

| Recurso | Direcionador de custo | Cenário 1 | Cenário 2 | Cenário 3 | Fonte de preço |
| --- | --- | --- | --- | --- | --- |
| Compute API | vCPU/mem × horas × réplicas (ou req + tempo ativo) | mínimo / scale-to-zero | ≥1 réplica | N réplicas + autoscale | S5.1–S5.7 (calc.) |
| Compute worker | vCPU/mem × horas | mínimo | 1+ | N | idem |
| PostgreSQL | tamanho instância + storage + HA + PITR + backup | menor, sem HA | HA+PITR | HA+PITR+retenção 30d (+RR) | S5.1–S5.4 |
| Egress de rede | GB de saída | baixo | médio | maior | calc. do provedor |
| Secret manager | nº de secrets + nº de acessos/API calls | baixo | médio | médio-alto | S5 |
| Registro de imagem | GB armazenados + transferências | baixo | baixo | médio | S7 (calc.) |
| Observabilidade | volume de logs/traces + retenção | plano inicial | plano inicial | plano superior | S5.8/S5.9 |
| Backups/PITR | GB × retenção | 7d | 7d | 30d | S5 |

**Toda célula de valor = `REQUIRES_SALES_CONFIRMATION` até preenchida com cotação oficial.**

## Ficha de cotação (campos obrigatórios por linha, em 001.2B)

`moeda` · `região` · `data_da_cotação_utc` · `premissas` (tamanho/tráfego/retenção) ·
`exclusões` (o que não está incluído) · `fonte` (URL da calculadora/proposta) ·
`incerteza` (faixa/±). **Sem falsa precisão**: se for estimativa de faixa, registrar faixa.

## Direcionadores qualitativos (independentes de preço)

- **Custo ocioso** favorece **D (PaaS)** em dev/staging: scale-to-zero de compute e banco
  (Neon autosuspend) reduzem gasto quando parado.
- **Hyperscaler (A/B/C)** tende a ter instância de banco provisionada 24/7 → maior custo
  ocioso no estágio inicial, porém preço previsível em escala e descontos por compromisso.
- **Observabilidade externa** (Sentry/Grafana Cloud) tem planos iniciais gratuitos/baixos
  que cobrem piloto — validar limites por volume.

## Estado atual

- **Sem valores.** Todos `REQUIRES_SALES_CONFIRMATION`. Impossível comparar TCO com
  honestidade nesta fase → contribui para `INFRASTRUCTURE_DECISION: REQUIRES_BUSINESS_DECISION`.
