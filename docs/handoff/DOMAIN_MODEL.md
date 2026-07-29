# Arden.AS — Modelo de domínio

Extraído do protótipo funcional. Toda entidade aqui existe na demonstração e tem tela correspondente.

## Hierarquia organizacional

```
Organization (grupo)
└── Company (empresa, CNPJ próprio, política e orçamento independentes)
    └── Unit (unidade, por região ou linha de negócio)
        └── Area (área, recebe operações e responsáveis)
            ├── Team (equipe, com gestor e aprovadores)
            └── CostCenter (centro de custo, rateio de Work Units)
```

Toda entidade operacional carrega `organizationId` e `companyId`. `unitId` e `areaId` são opcionais para entidades corporativas, obrigatórios para operações.

Regra: dados não cruzam entre organizações. O seletor de organização filtra dashboard, operações, execuções, pessoas, políticas, orçamento, Work Units, integrações, contexto, riscos e relatórios.

## Operação

A unidade central do produto. Não é prompt, agente, workflow nem automação.

### Campos obrigatórios na publicação

Identidade: `name`, `companyId`, `unitId`, `areaId`, `costCenterId`, `criticality`, `tags`.

Resultado: `problem`, `objective`, `expectedResult`, `recipients[]`, `deliverables[]`, `frequency`, `sla`, `indicators[]`, `completionCriteria[]`.

Responsáveis: `ownerId` (obrigatório), `businessOwnerId`, `technicalOwnerId`, `supervisorId`, `approverIds[]`, `substituteIds[]`.

Execução: `triggers[]`, `contextSourceIds[]`, `integrationIds[]`, `steps[]`, `actions[]`.

Controle: `approvalChain[]`, `operationalLimits[]`, `budget`, `workUnits`, `evidencePolicy`, `retentionPolicy`, `notificationRules[]`.

Ciclo: `environment`, `version`, `status`, `publishedAt`.

### Bloqueadores de publicação

Validados no protótipo, na etapa 19 do wizard:

- responsável não definido
- resultado esperado ausente
- ambiente não selecionado
- orçamento não configurado
- evidência não configurada
- integração não testada
- autoridade incoerente com o risco da ação
- aprovador ausente em ação que exige aprovação

Com qualquer bloqueador presente, a publicação fica indisponível. Não é aviso: é impedimento.

### Estados

`draft` · `awaiting_approval` · `scheduled` · `running` · `paused` · `archived`

## Gradientes de Autoridade

Cinco níveis, aplicados **por ação**, não por operação:

| Nível | Condição de acionamento |
|---|---|
| `observe` | Somente leitura em fonte autorizada |
| `prepare` | Produz artefato, não entrega nem altera sistema |
| `execute_under_rule` | Executa dentro de regra previamente aprovada |
| `execute_with_approval` | Prepara e retém, aguardando decisão humana |
| `blocked` | Estruturalmente impedido, independente de aprovação |

Ações destrutivas ou irreversíveis nunca recebem nível abaixo de `execute_with_approval`. Exclusão permanente exige dois aprovadores nomeados.

## Execução

Estados: `preparing` · `running` · `awaiting_approval` · `paused` · `exception` · `completed` · `failed` · `cancelled`

Ao iniciar, a execução obrigatoriamente:

1. cria objeto em `executions` com identificador próprio
2. vincula à operação e à versão publicada
3. percorre as `steps[]` configuradas na operação, não uma sequência genérica
4. gera evidência por etapa
5. registra consumo de Work Units e debita do orçamento da área
6. cria `Approval` quando a etapa tem `execute_with_approval`
7. cria `Exception` quando uma condição de política não é satisfeita
8. atualiza os indicadores de Resultados
9. grava evento de auditoria em cada transição

## Work Units

Medida de capacidade operacional contratada. **Token é medida técnica interna e não aparece como unidade comercial em nenhuma tela.**

Fatores considerados na estimativa: volume de registros, número de fontes, complexidade das etapas, quantidade de validações, chamadas a serviços externos, tamanho dos artefatos gerados.

Ledger: `contracted` · `used` · `reserved` · `projected` · `available` · `overage`

Fluxo de excedente: alerta em 85% → solicitação com justificativa → aprovação do responsável financeiro → redistribuição ou liberação → auditoria.

## Evidência

Tipos: `source` · `document` · `record` · `version` · `decision` · `approval` · `action` · `message` · `result` · `log` · `exception` · `justification`

O mesmo objeto é referenciado por operação, execução e auditoria. Não duplicar.

## Política

Ciclo: `draft` → `submitted` → `approved` → `published` → `suspended`

Herança, com precedência de cima para baixo:

1. Política corporativa (grupo)
2. Política da empresa
3. Regra da área
4. Exceção local, com justificativa e prazo

Conflito entre níveis deve ser exibido explicitamente, não resolvido em silêncio.

## Risco

Avaliado por ação. Campos: `operationId`, `actionId`, `dataAccessed`, `integrationId`, `consequence`, `reversibility`, `exposure`, `impact`, `authorityLevel`, `approvalRequired`, `ownerId`, `mitigation`.

Níveis: `low` · `moderate` · `elevated` · `critical`

A classificação é sempre exibida em texto ao lado da cor.

## Auditoria

Campos obrigatórios em todo evento:

```
id, timestamp, actorId, actorRole, organizationId,
action, objectType, objectId,
previousValue, newValue, justification,
relatedOperationId, relatedExecutionId, evidenceId, result
```

Eventos implementados no protótipo: publicação de operação, rascunho salvo, execução iniciada, evidência registrada, etapa de implantação concluída, implantação concluída.

Eventos previstos e ainda não gravados: convite de pessoa, alteração de papel, criação e publicação de política, conexão de integração, adição de contexto, definição de orçamento, aprovação e rejeição, movimentação de arquivo, promoção de ambiente, rollback, troca de idioma, acesso negado.
