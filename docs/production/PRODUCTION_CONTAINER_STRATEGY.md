<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Estratégia de container de produção

Auditoria de `apps/api/Dockerfile` (existente) + invariantes.

## Estado atual (adequado)
- Multi-stage `node:22-slim`; `USER node` (não-root); `EXPOSE 3000`.
- API e worker pela **mesma imagem**, comandos distintos: API `node apps/api/dist/main.js`;
  worker `ARDEN_WORKER=1 node apps/api/dist/worker.js`.
- Build a partir da raiz do monorepo; `.dockerignore` exclui `node_modules`, `dist`,
  `**/.env`, coverage, `.git`.
- Sem secrets na imagem; sem build-args sensíveis.

## Invariantes (verificados por contrato/registry)
- Identidade por **commit SHA** (nunca `latest`).
- Sem `.env`/backup/chave/token na camada; sem secret em source map.
- Graceful shutdown (worker: leases + heartbeat).
- Imagem imutável promovida staging→produção.

## Pendente (001.2B)
Registro concreto (GHCR/ECR/Artifact Registry) e scan de imagem — após seleção. Sem
publicação nesta fase.
