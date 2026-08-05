<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Contratos de infraestrutura como código (provider-neutros)

IaC **não executável** nesta fase. Estrutura em `infra/` (ver `infra/README.md`): apenas
contratos, inputs, outputs, invariantes e templates. Sem recurso específico de
AWS/GCP/Azure/PaaS; sem provider Terraform; nada de `init/plan/apply`.

## Módulos (`infra/modules/<m>/contract.yaml`)
network · compute-api · compute-worker · postgres · secrets · registry · observability ·
backup · restore-drill. Cada um declara `inputs:`, `outputs:`, `invariants:`.

## Invariantes-chave
- network: `databasePublicAccess=false`, `defaultEgress=DENY`, `tlsRequired=true`, Anthropic BLOCKED.
- compute-api/worker: stateless, `/live`+`/ready`, sem chave estática de nuvem, worker sem ingress público.
- postgres: `managed=true`, `publicAccess=false`, `automaticBackups=true`, `pitr=required`.
- secrets: sem secret real no manifesto; wrapping key só p/ restore-operator.

## Validação
`npm run infrastructure:contracts:validate` · `npm run infrastructure:environments:validate`.
