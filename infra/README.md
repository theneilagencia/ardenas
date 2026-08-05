# ARDEN-PRD-001.2A.2 — Infraestrutura como código (contratos provider-neutros)

**NÃO executável nesta fase.** Contém apenas contratos, interfaces, variáveis, outputs
esperados, invariantes e templates. **Nenhum** recurso específico de AWS/GCP/Azure/PaaS.
**Nenhum** provider Terraform. Não rodar `terraform init/plan/apply`.

## Estrutura
- `contracts/` — contratos transversais.
- `environments/{staging,production,recovery}/` — contratos por ambiente (isolados).
- `modules/{network,compute-api,compute-worker,postgres,secrets,registry,observability,backup,restore-drill}/contract.yaml`
  — inputs, outputs, invariantes por módulo.

## Ativação (001.2B)
A materialização em IaC real ocorre em ARDEN-PRD-001.2B, **após** o
`ARDEN_PRD_001_2B_ENTRY_GATE = PASS` (ver `docs/production/ARDEN_PRD_001_2B_ENTRY_GATE.md`)
e o `config/infrastructure/production-decision.yaml` preenchido/aprovado. O provider real é
escolhido então; até lá tudo permanece neutro.

## Validação offline
`npm run infrastructure:contracts:validate` e `npm run infrastructure:environments:validate`.
